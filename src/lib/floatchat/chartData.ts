// Pure data mapping for the FloatChat graphs. Missing/fill values are dropped (never plotted as 0) and,
// by default, only readings whose QC flags are 1 (good) or 2 (probably good) are used.
import { classifyQc } from "./qc";

export type ChartRow = Record<string, unknown>;
export type Variable = "temperature" | "salinity";

/** Argo fill value is 99999; anything this large is treated as missing. */
const FILL_ABS = 99990;

const ALIASES: Record<"pressure" | Variable, string[]> = {
  pressure: ["pressure", "pres"],
  temperature: ["temperature", "temp"],
  salinity: ["salinity", "psal"],
};
const QC_COL: Record<"pressure" | Variable, string> = { pressure: "pres_qc", temperature: "temp_qc", salinity: "psal_qc" };

export function num(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || Math.abs(n) >= FILL_ABS) return null;
  return n;
}

function field(r: ChartRow, kind: "pressure" | Variable): unknown {
  for (const k of ALIASES[kind]) if (k in r) return r[k];
  return undefined;
}
const hasField = (r: ChartRow, kind: "pressure" | Variable) => ALIASES[kind].some((k) => k in r);

/** QC check for one variable. A flag column absent from the row cannot be checked (counted separately). */
function qcOk(r: ChartRow, kind: "pressure" | Variable, includeAllQc: boolean): boolean {
  if (includeAllQc) return true;
  const col = QC_COL[kind];
  if (!(col in r)) return true;
  const b = classifyQc(r[col]);
  return b === "good" || b === "probably_good";
}
const qcPresent = (r: ChartRow, kinds: Array<"pressure" | Variable>) => kinds.every((k) => QC_COL[k] in r);

export interface ProfileGroup {
  key: string;
  floatId: string | null;
  cycleNumber: number | null;
  profileTime: string | null;
  rows: ChartRow[];
}

const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

/** Rows that carry a pressure and a temperature or salinity column, grouped by profile. */
export function groupProfiles(rows: ChartRow[]): ProfileGroup[] {
  const map = new Map<string, ProfileGroup>();
  for (const r of rows ?? []) {
    if (!hasField(r, "pressure") || !(hasField(r, "temperature") || hasField(r, "salinity"))) continue;
    const floatId = str(r["float_id"]) ?? str(r["wmo_number"]);
    const cycle = num(r["cycle_number"]);
    const key = str(r["profile_id"]) ?? `${floatId ?? "unknown"}#${cycle ?? "?"}`;
    let g = map.get(key);
    if (!g) {
      g = { key, floatId, cycleNumber: cycle, profileTime: str(r["profile_time"]), rows: [] };
      map.set(key, g);
    }
    g.rows.push(r);
  }
  return [...map.values()];
}

export interface PlotResult {
  x: number[];
  y: number[];
  /** Third value per point (pressure for the T-S diagram). */
  c: number[];
  plotted: number;
  missing: number;
  qcRejected: number;
  /** False when the rows had no QC flag columns, so QC could not be applied. */
  qcChecked: boolean;
}

function emptyResult(): PlotResult {
  return { x: [], y: [], c: [], plotted: 0, missing: 0, qcRejected: 0, qcChecked: true };
}

/** One profile: x = value, y = pressure (dbar), sorted from the surface down. */
export function depthProfile(rows: ChartRow[], variable: Variable, opts: { includeAllQc?: boolean } = {}): PlotResult {
  const out = emptyResult();
  const pts: Array<[number, number]> = [];
  for (const r of rows) {
    const p = num(field(r, "pressure"));
    const v = num(field(r, variable));
    if (p === null || v === null) { out.missing++; continue; }
    if (!qcOk(r, "pressure", !!opts.includeAllQc) || !qcOk(r, variable, !!opts.includeAllQc)) { out.qcRejected++; continue; }
    if (!qcPresent(r, ["pressure", variable])) out.qcChecked = false;
    pts.push([v, p]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  out.x = pts.map((p) => p[0]);
  out.y = pts.map((p) => p[1]);
  out.c = out.y;
  out.plotted = pts.length;
  return out;
}

/** One profile: x = salinity, y = temperature, c = pressure. */
export function tsDiagram(rows: ChartRow[], opts: { includeAllQc?: boolean } = {}): PlotResult {
  const out = emptyResult();
  const pts: Array<[number, number, number]> = [];
  for (const r of rows) {
    const p = num(field(r, "pressure"));
    const t = num(field(r, "temperature"));
    const s = num(field(r, "salinity"));
    if (p === null || t === null || s === null) { out.missing++; continue; }
    const all = !!opts.includeAllQc;
    if (!qcOk(r, "pressure", all) || !qcOk(r, "temperature", all) || !qcOk(r, "salinity", all)) { out.qcRejected++; continue; }
    if (!qcPresent(r, ["pressure", "temperature", "salinity"])) out.qcChecked = false;
    pts.push([s, t, p]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  out.x = pts.map((p) => p[0]);
  out.y = pts.map((p) => p[1]);
  out.c = pts.map((p) => p[2]);
  out.plotted = pts.length;
  return out;
}

/** Small window around the chosen pressure: ±5 dbar near the surface, 5% of the pressure deeper down. */
export function toleranceFor(targetDbar: number): number {
  return Math.max(5, Math.round(targetDbar * 0.05));
}

export interface TimePoint {
  profileId: string;
  cycleNumber: number | null;
  time: string;
  value: number;
  pressure: number;
}

/**
 * One float: one point per cycle, using the valid reading nearest the target pressure (within tolerance),
 * ordered by profile_time. Profiles without a time or without a qualifying reading are skipped.
 */
export function timeSeries(
  readings: ChartRow[],
  variable: Variable,
  targetDbar: number,
  opts: { includeAllQc?: boolean; tolerance?: number } = {},
): { points: TimePoint[]; cyclesSkipped: number } {
  const tol = opts.tolerance ?? toleranceFor(targetDbar);
  const best = new Map<string, TimePoint & { dist: number }>();
  const seen = new Set<string>();
  for (const r of readings) {
    const pid = str(r["profile_id"]);
    const time = str(r["profile_time"]);
    if (!pid) continue;
    seen.add(pid);
    if (!time || Number.isNaN(Date.parse(time))) continue;
    const p = num(field(r, "pressure"));
    const v = num(field(r, variable));
    if (p === null || v === null) continue;
    if (!qcOk(r, "pressure", !!opts.includeAllQc) || !qcOk(r, variable, !!opts.includeAllQc)) continue;
    const dist = Math.abs(p - targetDbar);
    if (dist > tol) continue;
    const cur = best.get(pid);
    if (!cur || dist < cur.dist || (dist === cur.dist && p < cur.pressure)) {
      best.set(pid, { profileId: pid, cycleNumber: num(r["cycle_number"]), time, value: v, pressure: p, dist });
    }
  }
  const points = [...best.values()]
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    .map(({ dist: _d, ...rest }) => rest);
  return { points, cyclesSkipped: seen.size - points.length };
}
