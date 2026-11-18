// Read endpoints for the map/dashboard. Argo tables are not readable by anon/authenticated, so these fixed,
// read-only queries use the server-only service client; term_definitions stays on the publishable key.
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { tallyQc } from "@/lib/floatchat/qc";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Short cache so the dashboard does not re-scan every reading on each page load. Cleared after imports.
let statsCache: { at: number; value: Awaited<ReturnType<typeof computeStats>> } | null = null;
const STATS_TTL_MS = 60_000;
export function invalidateStatsCache() {
  statsCache = null;
}
export async function getStats() {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.value;
  const value = await computeStats();
  statsCache = { at: Date.now(), value };
  return value;
}

async function computeStats() {
  const sb = supabaseAdmin;
  const [base, qc, regions] = await Promise.all([
    sb.rpc("floatchat_stats"),
    sb.rpc("floatchat_qc_summary"),
    sb.rpc("floatchat_region_summary"),
  ]);
  if (base.error) throw new Error(base.error.message);
  const s = base.data as Record<string, any>;
  const m = (s["measurements_by_mode"] ?? {}) as Record<string, number>;

  // QC tallies: missing flags count as "unknown". A failure here does not hide the base figures.
  let qcSummary: Record<string, unknown> | null = null;
  let qcError: string | null = null;
  if (qc.error) qcError = qc.error.message;
  else {
    const q = qc.data as { measurement_flags: Array<Record<string, number | null>>; position_flags: Array<Record<string, number | null>> };
    const mf = q.measurement_flags ?? [];
    qcSummary = {
      pres_qc: tallyQc(mf.map((r) => ({ flag: r["pres_qc"], n: r["n"] ?? 0 }))),
      temp_qc: tallyQc(mf.map((r) => ({ flag: r["temp_qc"], n: r["n"] ?? 0 }))),
      psal_qc: tallyQc(mf.map((r) => ({ flag: r["psal_qc"], n: r["n"] ?? 0 }))),
      position_qc: tallyQc((q.position_flags ?? []).map((r) => ({ flag: r["position_qc"], n: r["n"] ?? 0 }))),
    };
  }

  return {
    total_floats: s["total_floats"],
    total_cycles: s["total_cycles"],
    total_profiles: s["total_profiles"],
    total_measurements: s["total_measurements"],
    profiles_by_mode: s["profiles_by_mode"],
    profiles_by_source: s["profiles_by_source"],
    real_time_obs: m["R"] ?? 0,
    adjusted_obs: m["A"] ?? 0,
    delayed_mode_obs: m["D"] ?? 0,
    earliest_date: s["earliest_date"],
    latest_date: s["latest_date"],
    source_files: s["source_files"],
    qc: qcSummary,
    qc_error: qcError,
    regions: regions.error ? null : regions.data,
    regions_error: regions.error ? regions.error.message : null,
  };
}

export async function getMapProfiles() {
  const sb = supabaseAdmin;
  const out: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("map_profiles")
      .select("*")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("profile_time", { ascending: false })
      .order("profile_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []).map((r) => ({ ...r, platform_type: r.platform_type ?? "unknown", country: r.country ?? "—" })));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function getFloatTrack(floatId: string) {
  const { data, error } = await supabaseAdmin
    .from("map_profiles")
    .select("cycle_number, profile_id, latitude, longitude, profile_time, data_mode")
    .eq("float_id", floatId)
    .order("cycle_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, cycle_date: r.profile_time }));
}

export async function getProfileDetails(profileId: string) {
  const sb = supabaseAdmin;
  const { data: profile, error } = await sb.from("map_profiles").select("*").eq("profile_id", profileId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;
  const { data: measurements, error: mErr } = await sb
    .from("measurements")
    .select("measurement_id, level_index, pressure, temperature, salinity, pres_qc, temp_qc, psal_qc, is_adjusted")
    .eq("profile_id", profileId)
    .order("pressure", { ascending: true })
    .limit(5000);
  if (mErr) throw new Error(mErr.message);
  return { profile, measurements: measurements ?? [] };
}

export async function getTerms() {
  const { data, error } = await publicClient()
    .from("term_definitions")
    .select("term_id, term, category, rule_text, sql_fragment, source_note, phrases, required_tables")
    .order("term");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Readings near one pressure for every profile of one float (for the time graphs). Returns raw readings
 * within the window plus profile meta; the nearest valid reading per cycle is picked in chartData.ts.
 */
export async function getFloatSeries(floatId: string, pressure: number, tolerance: number) {
  const sb = supabaseAdmin;
  const { data: profs, error } = await sb
    .from("map_profiles")
    .select("profile_id, cycle_number, profile_time, data_mode, data_source")
    .eq("float_id", floatId)
    .order("profile_time", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);
  const meta = new Map((profs ?? []).filter((p) => p.profile_id).map((p) => [p.profile_id as string, p]));
  if (meta.size === 0) return { floatId, pressure, tolerance, profiles: 0, readings: [] };
  const readings: Record<string, unknown>[] = [];
  const ids = [...meta.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: mErr } = await sb
      .from("measurements")
      .select("profile_id, pressure, temperature, salinity, pres_qc, temp_qc, psal_qc")
      .in("profile_id", ids.slice(i, i + 200))
      .gte("pressure", pressure - tolerance)
      .lte("pressure", pressure + tolerance)
      .limit(10000);
    if (mErr) throw new Error(mErr.message);
    for (const m of data ?? []) readings.push({ ...meta.get(m.profile_id), ...m });
  }
  return { floatId, pressure, tolerance, profiles: meta.size, readings };
}
