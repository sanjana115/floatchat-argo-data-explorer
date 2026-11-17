// Answer text helpers: facts computed only from returned rows, a guard that rejects numbers/IDs/jargon
// not backed by those facts, and a deterministic plain-language template answer.
// Audience: a non-expert. Main text = answer first, one line of context, how a vague term was read,
// and short notes (capped results, real-time data, imported data). IDs, QC and modes stay in the panels.
import type { Provenance } from "./provenance";

const ID_COLUMNS = new Set(["profile_id", "float_id", "wmo_number", "cycle_number", "cycle_id", "measurement_id", "level_index", "source_file"]);
const isHidden = (col: string) => ID_COLUMNS.has(col.toLowerCase()) || /_qc$/i.test(col);

export type Kind = "temperature" | "salinity" | "pressure" | "latitude" | "longitude" | "count" | "other";
/** Display rounding: temperature 1 decimal, salinity 2, depth (from pressure) whole metres. */
export const DECIMALS: Record<Kind, number> = { temperature: 1, salinity: 2, pressure: 0, latitude: 1, longitude: 1, count: 0, other: 2 };
const UNITS: Record<Kind, string> = { temperature: "°C", salinity: "", pressure: "metres (about, from pressure)", latitude: "degrees", longitude: "degrees", count: "", other: "" };

/** Plain words for Argo data modes (codes never appear in the main text). */
export const MODE_PLAIN: Record<string, string> = {
  R: "real-time, not yet given a final quality review",
  A: "adjusted by the data team",
  D: "fully reviewed by experts",
};

export function columnKind(col: string, values?: unknown[]): Kind {
  const c = col.toLowerCase();
  const ints = !values || values.every((v) => typeof v === "number" && Number.isInteger(v));
  if (ints && /(^|_)(count|n|floats|profiles|measurements|readings|levels|total)($|_)|_count$/.test(c)) return "count";
  if (c.includes("temp")) return "temperature";
  if (c.includes("salin") || c.includes("psal")) return "salinity";
  if (c.includes("pres") || c.includes("depth")) return "pressure";
  if (c.includes("lat")) return "latitude";
  if (c.includes("lon")) return "longitude";
  return "other";
}

const WORDS: Record<string, string> = { avg: "average", mean: "average", max: "highest", min: "lowest", stddev: "spread of", psal: "salinity", temp: "temperature", pres: "pressure", n: "number" };
export function humanize(col: string): string {
  const words = col.toLowerCase().split(/_+/).filter(Boolean).map((w) => WORDS[w] ?? w);
  return words.filter((w, i) => w !== words[i - 1]).join(" ");
}

export interface NumericFact { column: string; kind: Kind; label: string; unit: string; count: number; min: number; max: number; mean: number; decimals: number }
export interface GroupFact { labelColumn: string; items: Array<{ label: string; values: Record<string, number> }> }
export interface Facts {
  rowCount: number;
  profileCount: number;
  floatCount: number;
  numeric: NumericFact[];
  categorical: Array<{ column: string; counts: Record<string, number> }>;
  dateRange: { earliest: string; latest: string } | null;
  /** Small result sets: the rows themselves (identifier and QC columns removed, values rounded). */
  sampleRows: Record<string, unknown>[];
  /** Small result sets where each row is one labelled group (e.g. one row per region). */
  groups: GroupFact | null;
  /** True when the number of returned results reached the row limit. */
  capped: boolean;
  rowLimit: number | null;
  /** Rows are individual readings (one per depth level). */
  rowsAreReadings: boolean;
  realtimeProfiles: number;
  syntheticProfiles: number;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const isDateLike = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const plainValue = (col: string, v: unknown) => (col.toLowerCase() === "data_mode" && typeof v === "string" ? MODE_PLAIN[v] ?? v : v);

export function computeFacts(rows: Record<string, unknown>[], prov: Provenance | null, opts: { limit?: number | null } = {}): Facts {
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const numeric: NumericFact[] = [];
  const categorical: Facts["categorical"] = [];
  let dateRange: Facts["dateRange"] = null;
  const labelCols: string[] = [];
  for (const col of cols) {
    if (isHidden(col)) continue;
    const vals = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
    if (vals.length === 0) continue;
    if (vals.every((v) => typeof v === "number")) {
      const nums = vals as number[];
      const kind = columnKind(col, nums);
      const d = DECIMALS[kind];
      numeric.push({
        column: col, kind, label: humanize(col), unit: UNITS[kind], count: nums.length, decimals: d,
        min: round(Math.min(...nums), d), max: round(Math.max(...nums), d), mean: round(nums.reduce((a, b) => a + b, 0) / nums.length, d),
      });
    } else if (vals.every(isDateLike)) {
      const sorted = (vals as string[]).slice().sort();
      dateRange = { earliest: formatDate(sorted[0] ?? ""), latest: formatDate(sorted[sorted.length - 1] ?? "") };
    } else if (vals.every((v) => typeof v === "string" || typeof v === "boolean")) {
      const counts: Record<string, number> = {};
      for (const v of vals) {
        const k = String(plainValue(col, v));
        counts[k] = (counts[k] ?? 0) + 1;
      }
      if (Object.keys(counts).length <= 12) categorical.push({ column: col, counts });
      if (vals.length === rows.length && new Set(vals.map(String)).size === rows.length) labelCols.push(col);
    }
  }

  // Grouped result: 2-12 rows, one distinct label per row, plus numbers per row (e.g. one row per region).
  let groups: GroupFact | null = null;
  const labelColumn = labelCols.find((c) => c.toLowerCase() !== "data_source") ?? labelCols[0];
  if (rows.length >= 2 && rows.length <= 12 && labelColumn && numeric.length > 0) {
    groups = {
      labelColumn,
      items: rows.map((r) => ({
        label: String(plainValue(labelColumn, r[labelColumn])),
        values: Object.fromEntries(numeric.filter((n) => typeof r[n.column] === "number").map((n) => [n.column, round(r[n.column] as number, n.decimals)])),
      })),
    };
  }

  const sampleRows = rows.length <= 12
    ? rows.map((r) => Object.fromEntries(Object.entries(r)
        .filter(([k]) => !isHidden(k) && k.toLowerCase() !== "profile_time")
        .map(([k, v]) => [k, typeof v === "number" ? round(v, DECIMALS[columnKind(k)]) : plainValue(k, v)])))
    : [];
  const limit = opts.limit ?? null;
  return {
    rowCount: rows.length,
    profileCount: prov?.profileCount ?? 0,
    floatCount: prov?.floatCount ?? 0,
    numeric,
    categorical,
    dateRange,
    sampleRows,
    groups,
    capped: limit !== null && rows.length > 0 && rows.length >= limit,
    rowLimit: limit,
    rowsAreReadings: rows.length > 0 && cols.some((c) => c.toLowerCase() === "pressure"),
    realtimeProfiles: prov?.modeSummary?.R ?? 0,
    syntheticProfiles: prov?.dataSourceSummary?.synthetic ?? 0,
  };
}

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
const toNumber = (raw: string) => Number(raw.replace(/,(?=\d{3}\b)/g, "").replace(/,$/, ""));

/** Every number the answer may contain: facts (and their roundings) plus numbers in the interpretation lines. */
export function allowedNumbers(facts: Facts, interpretationLines: string[]): Set<string> {
  const out = new Set<string>();
  const add = (v: number) => {
    for (let d = 0; d <= 4; d++) out.add(String(Math.abs(round(v, d))));
    out.add(String(Math.abs(v)));
  };
  [facts.rowCount, facts.profileCount, facts.floatCount, facts.realtimeProfiles, facts.syntheticProfiles].forEach(add);
  for (const n of facts.numeric) [n.count, n.min, n.max, n.mean, round(n.max - n.min, n.decimals)].forEach(add);
  for (const c of facts.categorical) Object.values(c.counts).forEach(add);
  for (const r of facts.sampleRows) for (const v of Object.values(r)) if (typeof v === "number") add(v);
  for (const g of facts.groups?.items ?? []) Object.values(g.values).forEach(add);
  const text = [facts.dateRange?.earliest ?? "", facts.dateRange?.latest ?? "", ...interpretationLines].join(" ");
  for (const t of text.match(NUM_RE) ?? []) add(toNumber(t));
  return out;
}

const JARGON = /\b(SQL|SELECT|JOIN|WMO|QC|dbar|PSU|profile_id|float_id|cycle_number|cycles?|data[ _-]mode|data_source|quality flags?|flagged|query|database|row|rows|mean across|stddev)\b/i;
const CAUSE = /\b(because|due to|caused by|driven by|as a result of)\b/i;

export function countSentences(text: string): number {
  return text.replace(/(\d)\.(\d)/g, "$1,$2").split(/[.!?](?:\s|$)/).map((s) => s.trim()).filter(Boolean).length;
}

export function checkAnswer(text: string, facts: Facts, interpretationLines: string[]): string | null {
  const t = text.trim();
  if (!t) return "empty answer";
  if (/^\s*[-*•]\s|\n\s*[-*•]\s/.test(t)) return "answer uses a list; write plain sentences";
  const n = countSentences(t);
  if (n < 2 || n > 4) return `answer has ${n} sentences (needs 2 to 4)`;
  const jargon = t.match(JARGON);
  if (jargon) return `answer contains jargon or identifier term "${jargon[0]}"`;
  const cause = t.match(CAUSE);
  if (cause) return `answer explains a cause ("${cause[0]}"); state only what the results show`;
  const allowed = allowedNumbers(facts, interpretationLines);
  for (const raw of t.match(NUM_RE) ?? []) {
    if (!allowed.has(String(toNumber(raw)))) return `answer contains number ${raw} that is not computed from the returned results`;
  }
  if (facts.rowCount > 0) {
    if (facts.capped && !/\bfirst\b/i.test(t)) return `answer must note that it covers only the first ${facts.rowCount} results`;
    if (facts.realtimeProfiles > 0 && !/\breal[- ]time\b/i.test(t)) return "answer must note that real-time data without a final quality review is included";
    if (facts.syntheticProfiles > 0 && !/\b(synthetic|imported)\b/i.test(t)) return "answer must note that some data was imported (synthetic)";
  }
  return null;
}

// ---------------- Template answer ----------------

export interface AnswerTerm { label: string; matchedText: string; interpretation: string; isProjectAssumption: boolean }
export interface AnswerContext { question: string; terms: AnswerTerm[] }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function fmtNum(v: number, kind: Kind): string {
  const d = DECIMALS[kind];
  const fixed = kind === "temperature" || kind === "salinity";
  return v.toLocaleString("en-US", { minimumFractionDigits: fixed ? d : 0, maximumFractionDigits: d });
}
function fmtVal(v: number, kind: Kind): string {
  if (kind === "temperature") return `${fmtNum(v, kind)} °C`;
  if (kind === "pressure") return `about ${fmtNum(v, kind)} metres`;
  return fmtNum(v, kind);
}

function focusKind(q: string): Kind | null {
  if (/salin|salt/.test(q)) return "salinity";
  if (/temperat|warm|cold|hot\b|hottest|heat/.test(q)) return "temperature";
  if (/pressure|how deep|depth of|depths/.test(q)) return "pressure";
  if (/how many|number of|\bcount\b/.test(q)) return "count";
  return null;
}
function focusStat(q: string): "max" | "min" | "mean" {
  if (/highest|maximum|\bmax\b|saltiest|warmest|hottest|deepest/.test(q)) return "max";
  if (/lowest|minimum|\bmin\b|coldest|freshest|shallowest/.test(q)) return "min";
  return "mean";
}
const STAT_HINT = { max: /max|highest|top/, min: /min|lowest/, mean: /avg|mean|average/ } as const;

function pick(cands: NumericFact[], stat: "max" | "min" | "mean"): NumericFact | undefined {
  return cands.find((c) => STAT_HINT[stat].test(c.column.toLowerCase())) ?? cands.find((c) => !/stddev|spread/.test(c.column.toLowerCase())) ?? cands[0];
}

/** "salinity (how salty the water is)" the first time salinity is named. */
function measureWord(kind: Kind, explained: { salinity: boolean }): string {
  if (kind === "salinity") {
    if (explained.salinity) return "salinity";
    explained.salinity = true;
    return "salinity (how salty the water is)";
  }
  return kind === "pressure" ? "depth" : kind === "other" ? "value" : kind;
}

function statWord(column: string): string {
  const c = column.toLowerCase();
  if (STAT_HINT.mean.test(c)) return "average ";
  if (STAT_HINT.max.test(c)) return "highest ";
  if (STAT_HINT.min.test(c)) return "lowest ";
  return "";
}

function place(label: string, labelColumn: string): string {
  if (labelColumn.toLowerCase() === "data_mode") return `among profiles that are ${label}`;
  if (/^(near|around|in|at|close|off|within|across)\b/i.test(label)) return label;
  if (/region|area|basin|zone|sea|ocean|place/i.test(labelColumn)) return /^the\b/i.test(label) ? `in ${label}` : `in the ${label}`;
  return `for "${label}"`;
}

function countNoun(column: string): string {
  const c = column.toLowerCase();
  if (c.includes("float")) return "floats";
  if (c.includes("measurement") || c.includes("reading") || c.includes("level")) return "readings";
  return "profiles";
}

function shortMeaning(t: AnswerTerm): string {
  let m = t.interpretation.replace(/^[^:]{1,40}:\s*/, "").split(";")[0] ?? "";
  m = m.replace(/\s*\(([^)]*)\)/g, (all, inner: string) => (/metre|\d\s*m\b/.test(inner) ? all : ""));
  m = m.replace(/\s+(stored\s+)?(in|from)\s+this database\b/gi, " stored here").replace(/\.\s*$/, "").trim();
  return /^[A-Z][a-z]/.test(m) ? m.charAt(0).toLowerCase() + m.slice(1) : m;
}

export function termsSentence(terms: AnswerTerm[]): string | null {
  if (terms.length === 0) return null;
  const assumption = terms.some((t) => t.isProjectAssumption);
  const full = `I took ${joinAnd(terms.map((t) => `"${t.matchedText}" to mean ${shortMeaning(t)}`))}${assumption ? (terms.length > 1 ? ", working definitions chosen for this app" : ", a working definition chosen for this app") : ""}.`;
  if (full.length <= 230) return full;
  return `I used ${assumption ? "working definitions chosen for this app" : "fixed definitions"} for ${joinAnd(terms.map((t) => `"${t.matchedText}"`))}, shown just below this answer.`;
}

export function notesSentence(f: Facts): string | null {
  if (f.rowCount === 0) return null;
  const parts: string[] = [];
  if (f.capped) parts.push(`this covers only the first ${f.rowCount.toLocaleString("en-US")} ${f.rowsAreReadings ? "readings" : "results"}`);
  if (f.realtimeProfiles > 0) {
    parts.push(f.profileCount > 0 && f.realtimeProfiles >= f.profileCount
      ? "all of the data is real-time and has not had its final quality review yet"
      : "some of the data is real-time and has not had its final quality review yet");
  }
  if (f.syntheticProfiles > 0) {
    parts.push(f.profileCount > 0 && f.syntheticProfiles >= f.profileCount
      ? "all of it was imported by a user rather than recorded by a real float, so treat it as test data"
      : `${f.syntheticProfiles.toLocaleString("en-US")} of the profiles were imported by a user rather than recorded by a real float`);
  }
  return parts.length ? `Note that ${joinAnd(parts)}.` : null;
}

function cannotCompute(kind: Kind): string {
  const w = kind === "pressure" ? "depth" : kind === "count" ? "count" : kind;
  return `These results don't include ${w}, so I can't give a ${w} figure from them.`;
}

function groupSentence(f: Facts, g: GroupFact, focus: Kind | null, stat: "max" | "min" | "mean", ex: { salinity: boolean }): string {
  const inGroups = f.numeric.filter((n) => g.items.some((i) => n.column in i.values));
  const measures = inGroups.filter((n) => n.kind !== "count" && n.kind !== "latitude" && n.kind !== "longitude");
  const counts = inGroups.filter((n) => n.kind === "count");
  let col: NumericFact | undefined;
  if (focus === "count") col = counts.find((c) => countNoun(c.column) === "profiles") ?? counts[0];
  else if (focus) col = pick(measures.filter((m) => m.kind === focus), stat);
  else col = pick(measures, stat) ?? counts.find((c) => countNoun(c.column) === "profiles") ?? counts[0];
  if (!col) return cannotCompute(focus ?? "other");
  const c = col;
  const items = g.items.filter((i) => typeof i.values[c.column] === "number").sort((a, b) => (b.values[c.column] ?? 0) - (a.values[c.column] ?? 0));
  const v = (i: (typeof items)[number]) => i.values[c.column] ?? 0;
  if (c.kind === "count") {
    const noun = countNoun(c.column);
    if (g.labelColumn.toLowerCase() === "data_mode") {
      return `Of the matching ${noun}, ${joinAnd(items.map((i) => `${fmtNum(v(i), "count")} ${plural(v(i), "is", "are")} ${i.label}`))}.`;
    }
    return `There ${plural(v(items[0]!), "was", "were")} ${joinAnd(items.map((i, k) => `${fmtNum(v(i), "count")}${k === 0 ? ` matching ${noun}` : ""} ${place(i.label, g.labelColumn)}`))}.`;
  }
  const subject = cap(`${statWord(c.column)}${measureWord(c.kind, ex)}`);
  const top = items[0]!;
  const bottom = items[items.length - 1]!;
  if (items.length === 1) return `${subject} was ${fmtVal(v(top), c.kind)} ${place(top.label, g.labelColumn)}.`;
  if (v(top) === v(bottom)) return `${subject} was about the same ${joinAnd(items.map((i) => place(i.label, g.labelColumn)))}, at ${fmtVal(v(top), c.kind)}.`;
  if (items.length === 2) return `${subject} was higher ${place(top.label, g.labelColumn)}, at ${fmtVal(v(top), c.kind)}, than ${place(bottom.label, g.labelColumn)}, at ${fmtVal(v(bottom), c.kind)}.`;
  return `${subject} was highest ${place(top.label, g.labelColumn)}, at ${fmtVal(v(top), c.kind)}, and lowest ${place(bottom.label, g.labelColumn)}, at ${fmtVal(v(bottom), c.kind)}.`;
}

function singleRowSentence(f: Facts, focus: Kind | null, stat: "max" | "min" | "mean", ex: { salinity: boolean }): string {
  const measures = f.numeric.filter((n) => n.kind !== "count" && n.kind !== "latitude" && n.kind !== "longitude");
  const counts = f.numeric.filter((n) => n.kind === "count");
  if (focus === "count" || (focus === null && measures.length === 0)) {
    const p = counts.find((c) => countNoun(c.column) === "profiles");
    const fl = counts.find((c) => countNoun(c.column) === "floats");
    if (p && fl) return `${fmtNum(p.max, "count")} matching ${plural(p.max, "profile", "profiles")} came from ${fmtNum(fl.max, "count")} ${plural(fl.max, "float", "floats")}.`;
    const c = p ?? fl ?? counts[0];
    if (c) return `There ${plural(c.max, "was", "were")} ${fmtNum(c.max, "count")} matching ${countNoun(c.column)}.`;
    return cannotCompute("count");
  }
  const chosen = focus ? [pick(measures.filter((m) => m.kind === focus), stat)].filter((x): x is NumericFact => Boolean(x)) : measures.slice(0, 2);
  if (chosen.length === 0) return cannotCompute(focus ?? "other");
  const phrase = (m: NumericFact) => {
    const name = m.kind === "other" ? m.label : `${statWord(m.column)}${measureWord(m.kind, ex)}`;
    return `the ${m.kind === "other" ? name : name.replace(/^(average |highest |lowest )?/, (s) => s)} was ${fmtVal(m.max, m.kind)}`;
  };
  // Prefer the column's own name when it carries extra meaning (e.g. "average surface temperature").
  const label = (m: NumericFact) => (m.kind !== "other" && m.label.split(" ").length > 2 && !m.label.includes("salinity") ? `the ${m.label} was ${fmtVal(m.max, m.kind)}` : phrase(m));
  return `${cap(joinAnd(chosen.map(label)))}.`;
}

function readingsSentence(f: Facts, focus: Kind | null, stat: "max" | "min" | "mean", ex: { salinity: boolean }): string {
  const measures = f.numeric.filter((n) => n.kind !== "count" && n.kind !== "latitude" && n.kind !== "longitude");
  let m: NumericFact | undefined;
  if (focus && focus !== "count") m = pick(measures.filter((x) => x.kind === focus), stat);
  else if (focus === "count") {
    return `There ${plural(f.rowCount, "was", "were")} ${f.rowCount.toLocaleString("en-US")} matching ${f.rowsAreReadings ? plural(f.rowCount, "reading", "readings") : plural(f.rowCount, "result", "results")}.`;
  } else m = measures.find((x) => x.kind === "temperature") ?? measures.find((x) => x.kind === "salinity") ?? measures.find((x) => x.kind === "other") ?? measures[0];
  if (!m) return cannotCompute(focus ?? "other");
  const word = measureWord(m.kind, ex);
  if (stat === "max") return `The highest ${word} in these results was ${fmtVal(m.max, m.kind)}.`;
  if (stat === "min") return `The lowest ${word} in these results was ${fmtVal(m.min, m.kind)}.`;
  if (m.min === m.max) return `${cap(word)} was ${fmtVal(m.min, m.kind)} in every result.`;
  if (m.kind === "pressure") return `Depths ranged from about ${fmtNum(m.min, "pressure")} to ${fmtNum(m.max, "pressure")} metres.`;
  return `${cap(word)} ranged from ${fmtVal(m.min, m.kind)} to ${fmtVal(m.max, m.kind)}, averaging ${fmtVal(m.mean, m.kind)}.`;
}

function contextSentence(f: Facts, focus: Kind | null, asksWhich: boolean): string | null {
  if (f.profileCount <= 0) return null;
  const depth = f.numeric.find((n) => n.kind === "pressure" && n.column.toLowerCase() === "pressure");
  const depthPart = depth && focus !== "pressure"
    ? depth.min === depth.max ? `, at a depth of about ${fmtNum(depth.min, "pressure")} metres` : `, at depths of about ${fmtNum(depth.min, "pressure")} to ${fmtNum(depth.max, "pressure")} metres`
    : "";
  const which = asksWhich ? ", and the floats are listed in the evidence panel" : "";
  return `This is based on ${fmtNum(f.profileCount, "count")} ${plural(f.profileCount, "profile", "profiles")} (sets of readings taken down through the water) from ${fmtNum(f.floatCount, "count")} drifting ${plural(f.floatCount, "float", "floats")}${depthPart}${which}.`;
}

export function templateAnswer(facts: Facts, ctx: AnswerContext = { question: "", terms: [] }): string {
  const q = ctx.question.toLowerCase();
  const terms = ctx.terms;
  const termLine = termsSentence(terms);
  if (facts.rowCount === 0) {
    const last = terms[terms.length - 1];
    const suggestion = last
      ? `Try asking again without "${last.matchedText}" to widen the search.`
      : "Try naming a region or a time period, for example the tropics or recent profiles.";
    return ["Nothing in the stored float data matched this question.", termLine, suggestion].filter(Boolean).join(" ");
  }
  const focus = focusKind(q);
  const stat = focusStat(q);
  const ex = { salinity: false };
  const first = facts.groups
    ? groupSentence(facts, facts.groups, focus, stat, ex)
    : facts.rowCount === 1
      ? singleRowSentence(facts, focus, stat, ex)
      : readingsSentence(facts, focus, stat, ex);
  const s = [first, contextSentence(facts, focus, /\b(which|what) floats?\b/.test(q)), termLine, notesSentence(facts)].filter((x): x is string => Boolean(x));
  if (s.length < 2) s.push("The full details are in the evidence panel below.");
  return s.slice(0, 4).join(" ");
}
