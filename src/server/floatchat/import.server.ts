// User-pasted profiles are stored with data_source = 'synthetic' (not from an Argo NetCDF file).
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json } from "./data.server";

const Schema = z.object({
  wmo_number: z.union([z.string(), z.number()]).transform(String).refine((s) => /^[0-9]{1,10}$/.test(s), "wmo_number must be digits"),
  platform_type: z.string().max(40).optional(),
  cycle_number: z.number().int().min(0).max(100000).default(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  data_mode: z.enum(["R", "A", "D"]).default("R"),
  measurements: z
    .array(z.object({ pressure: z.number().min(0).max(12000), temperature: z.number().min(-3).max(45).nullable().optional(), salinity: z.number().min(0).max(45).nullable().optional() }))
    .min(1)
    .max(2000),
});

export async function handleImport(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const p = Schema.safeParse(body);
  if (!p.success) return json({ error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, 400);
  const d = p.data;
  const floatId = `USER-${d.wmo_number}`;
  const profileId = `USER_${d.wmo_number}_${String(d.cycle_number).padStart(3, "0")}`;

  const { data: existing } = await supabaseAdmin.from("profiles").select("profile_id").eq("profile_id", profileId).maybeSingle();
  if (existing) return json({ error: `Profile ${profileId} already exists` }, 409);

  const f = await supabaseAdmin.from("floats").upsert({ float_id: floatId, platform_type: d.platform_type ?? null, project_name: "User import" }, { onConflict: "float_id" });
  if (f.error) return json({ error: f.error.message }, 500);
  const c = await supabaseAdmin.from("cycles").upsert({ float_id: floatId, cycle_number: d.cycle_number }, { onConflict: "float_id,cycle_number" }).select("cycle_id").single();
  if (c.error) return json({ error: c.error.message }, 500);
  const pr = await supabaseAdmin.from("profiles").insert({
    profile_id: profileId, cycle_id: c.data.cycle_id, direction: "A", profile_time: new Date().toISOString(),
    latitude: d.latitude, longitude: d.longitude, position_qc: null, data_mode: d.data_mode,
    data_source: "synthetic", source_file: "user_import",
  });
  if (pr.error) return json({ error: pr.error.message }, 500);
  const m = await supabaseAdmin.from("measurements").insert(
    d.measurements.map((x, i) => ({ profile_id: profileId, level_index: i, pressure: x.pressure, temperature: x.temperature ?? null, salinity: x.salinity ?? null, is_adjusted: false })),
  );
  if (m.error) return json({ error: m.error.message }, 500);
  return json({ success: true, profile_id: profileId, count: d.measurements.length, data_source: "synthetic" });
}
