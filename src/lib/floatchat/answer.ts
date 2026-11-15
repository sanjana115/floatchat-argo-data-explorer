// Answer text helpers: facts computed only from returned rows, a guard that rejects numbers/IDs/jargon
// not backed by those facts, and a deterministic template answer.
import type { Provenance } from "./provenance";

const ID_COLUMNS = new Set(["profile_id", "float_id", "wmo_number", "cycle_number", "cycle_id", "measurement_id", "level_index"]);
const UNITS: Record<string, string> = { temperature: "°C", pressure: "decibars", salinity: "" };
const DECIMALS: Record<string, number> = { temperature: 2, salinity: 3, pressure: 1, latitude: 2, longitude: 2 };

export interface NumericFact { column: string; count: number; min: number; max: number; mean: number; decimals: number }
export interface Facts {
  rowCount: number;
  profileCount: number;
  floatCount: number;
  numeric: NumericFact[];
  categorical: Array<{ column: string; counts: Record<string, number> }>;
  dateRange: { earliest: string; latest: string } | null;
  /** Small result sets: the rows themselves (identifier columns removed). */
  sampleRows: Record<string, unknown>[];
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function baseName(col: string) {
  for (const k of Object.keys(DECIMALS)) if (col.toLowerCase().includes(k)) return k;
  return col;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function computeFacts(rows: Record<string, unknown>[], prov: Provenance | null): Facts {
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const numeric: NumericFact[] = [];
  const categorical: Facts["categorical"] = [];
  let dateRange: Facts["dateRange"] = null;
  for (const col of cols) {
    if (ID_COLUMNS.has(col.toLowerCase())) continue;
    const vals = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
    if (vals.length === 0) continue;
    if (vals.every((v) => typeof v === "number")) {
      const nums = vals as number[];
      const d = DECIMALS[baseName(col)] ?? 2;
      numeric.push({
        column: col,
        count: nums.length,
        min: round(Math.min(...nums), d),
        max: round(Math.max(...nums), d),
        mean: round(nums.reduce((a, b) => a + b, 0) / nums.length, d),
        decimals: d,
      });
    } else if (vals.every((v) => typeof v === "string" && !Number.isNaN(Date.parse(v as string)) && /\d{4}-\d{2}-\d{2}/.test(v as string))) {
      const sorted = (vals as string[]).slice().sort();
      dateRange = { earliest: formatDate(sorted[0] ?? ""), latest: formatDate(sorted[sorted.length - 1] ?? "") };
    } else if (vals.every((v) => typeof v === "string" || typeof v === "boolean")) {
      const counts: Record<string, number> = {};
      for (const v of vals) counts[String(v)] = (counts[String(v)] ?? 0) + 1;
      if (Object.keys(counts).length <= 12) categorical.push({ column: col, counts });
    }
  }
  const sampleRows = rows.length <= 12
    ? rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !ID_COLUMNS.has(k.toLowerCase()) && k.toLowerCase() !== "profile_time")
        .map(([k, v]) => [k, typeof v === "number" ? round(v, DECIMALS[baseName(k)] ?? 2) : v])))
    : [];
  return {
    rowCount: rows.length,
    profileCount: prov?.profileCount ?? 0,
    floatCount: prov?.floatCount ?? 0,
    numeric,
    categorical,
    dateRange,
    sampleRows,
  };
}

/** Every number the answer may contain: facts (and their roundings) plus numbers in the interpretation lines. */
export function allowedNumbers(facts: Facts, interpretationLines: string[]): Set<string> {
  const out = new Set<string>();
  const add = (v: number) => {
    for (let d = 0; d <= 4; d++) out.add(String(round(v, d)));
    out.add(String(Math.abs(v)));
    for (let d = 0; d <= 4; d++) out.add(String(Math.abs(round(v, d))));
  };
  [facts.rowCount, facts.profileCount, facts.floatCount].forEach(add);
  for (const n of facts.numeric) [n.count, n.min, n.max, n.mean, round(n.max - n.min, n.decimals)].forEach(add);
  for (const c of facts.categorical) Object.values(c.counts).forEach(add);
  for (const r of facts.sampleRows) for (const v of Object.values(r)) if (typeof v === "number") add(v);
  const textNums = [facts.dateRange?.earliest ?? "", facts.dateRange?.latest ?? "", ...interpretationLines].join(" ").match(/\d+(?:\.\d+)?/g) ?? [];
  for (const t of textNums) add(Number(t));
  return out;
}

const JARGON = /\b(SQL|SELECT|JOIN|WMO|QC|dbar|PSU|profile_id|float_id|cycle_number|data_mode|data_source|query|database|row|rows)\b/i;

export function countSentences(text: string): number {
  return text.replace(/(\d)\.(\d)/g, "$1,$2").split(/[.!?](?:\s|$)/).map((s) => s.trim()).filter(Boolean).length;
}

export function checkAnswer(text: string, facts: Facts, interpretationLines: string[]): string | null {
  const t = text.trim();
  if (!t) return "empty answer";
  const n = countSentences(t);
  if (n < 2 || n > 4) return `answer has ${n} sentences (needs 2 to 4)`;
  const jargon = t.match(JARGON);
  if (jargon) return `answer contains jargon or identifier term "${jargon[0]}"`;
  const allowed = allowedNumbers(facts, interpretationLines);
  for (const raw of t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const num = raw.replace(/,(?=\d{3}\b)/g, "").replace(/,$/, "");
    if (!allowed.has(String(Number(num)))) return `answer contains number ${raw} that is not computed from the returned rows`;
  }
  return null;
}

const nice = (col: string) => col.replace(/_/g, " ");
const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 3 });

export function templateAnswer(facts: Facts): string {
  if (facts.rowCount === 0) {
    return "No matching ocean measurements were found for this question. Try a wider area, a different depth range, or a different time window.";
  }
  const s: string[] = [];
  s.push(
    facts.profileCount > 0
      ? `I found ${fmt(facts.rowCount)} matching results from ${fmt(facts.profileCount)} ${facts.profileCount === 1 ? "profile" : "profiles"} recorded by ${fmt(facts.floatCount)} ${facts.floatCount === 1 ? "float" : "floats"}.`
      : `I found ${fmt(facts.rowCount)} matching results.`,
  );
  for (const key of ["temperature", "salinity", "pressure"]) {
    const n = facts.numeric.find((x) => baseName(x.column) === key);
    if (!n || s.length >= 3) continue;
    const unit = UNITS[key] ?? "";
    const u = unit ? ` ${unit}` : "";
    const label = key === "pressure" ? "Depths (as pressure)" : `${key.charAt(0).toUpperCase()}${key.slice(1)} values`;
    s.push(n.min === n.max ? `${label} were ${fmt(n.min)}${u}.` : `${label} ranged from ${fmt(n.min)}${u} to ${fmt(n.max)}${u}, averaging ${fmt(n.mean)}${u}.`);
  }
  if (s.length < 3 && facts.dateRange) {
    s.push(facts.dateRange.earliest === facts.dateRange.latest ? `The readings were taken on ${facts.dateRange.earliest}.` : `The readings were taken between ${facts.dateRange.earliest} and ${facts.dateRange.latest}.`);
  }
  if (s.length < 2) {
    const c = facts.categorical[0];
    if (c) s.push(`By ${nice(c.column)}: ${Object.entries(c.counts).map(([k, v]) => `${k} (${fmt(v)})`).join(", ")}.`);
    else s.push("The full details are in the evidence panel below.");
  }
  return s.slice(0, 4).join(" ");
}
