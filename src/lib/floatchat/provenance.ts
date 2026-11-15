// Provenance: which floats, cycles and profiles stand behind an answer.
import type { Expr, From, SelectFromStatement } from "pgsql-ast-parser";
import { toSql } from "pgsql-ast-parser";
import { tallyQc, type QcTally } from "./qc";

export const PROVENANCE_LIMIT = 5000;

export interface ProvenanceRow {
  float_id: string;
  cycle_number: number;
  profile_id: string;
  data_mode: "R" | "A" | "D";
  data_source: "real" | "synthetic";
  /** Position QC flag of the profile; null means no flag (counted as unknown). */
  position_qc?: number | null;
}

export interface Provenance {
  rowCount: number;
  floatIds: string[];
  floatCount: number;
  cycles: Array<{ floatId: string; cycleNumbers: number[] }>;
  cycleCount: number;
  profileIds: string[];
  profileCount: number;
  /** Counts over DISTINCT profiles. */
  modeSummary: { R: number; A: number; D: number };
  dataSourceSummary: { real: number; synthetic: number };
  /** Position QC flags over DISTINCT profiles (missing flag = unknown). */
  positionQc: QcTally;
  /** Human-readable description of what the provenance covers. */
  scope: string;
  method: "FROM_RESULT_ROWS" | "SECOND_QUERY_BY_IDS" | "SECOND_QUERY_BY_FILTERS" | "NONE";
  provenanceSql: string | null;
  truncated: boolean;
}

const ref = (table: string, name: string): Expr => ({ type: "ref", table: { name: table }, name });
const eq = (l: Expr, r: Expr): Expr => ({ type: "binary", op: "=", left: l, right: r });
const SAFE_ID = /^[A-Za-z0-9_]+$/;

function aliasOf(from: From[], table: string): string | null {
  for (const f of from) if (f.type === "table" && f.name.name.toLowerCase() === table) return f.name.alias ?? f.name.name;
  return null;
}

export function summarize(rows: ProvenanceRow[], rowCount: number, meta: Pick<Provenance, "scope" | "method" | "provenanceSql" | "truncated">): Provenance {
  const byProfile = new Map<string, ProvenanceRow>();
  for (const r of rows) if (r.profile_id && !byProfile.has(r.profile_id)) byProfile.set(r.profile_id, r);
  const profiles = [...byProfile.values()];
  const cycles = new Map<string, Set<number>>();
  const modeSummary = { R: 0, A: 0, D: 0 };
  const dataSourceSummary = { real: 0, synthetic: 0 };
  for (const p of profiles) {
    if (!cycles.has(p.float_id)) cycles.set(p.float_id, new Set());
    cycles.get(p.float_id)!.add(Number(p.cycle_number));
    if (p.data_mode in modeSummary) modeSummary[p.data_mode]++;
    if (p.data_source in dataSourceSummary) dataSourceSummary[p.data_source]++;
  }
  const floatIds = [...cycles.keys()].sort();
  const cycleList = floatIds.map((f) => ({ floatId: f, cycleNumbers: [...cycles.get(f)!].sort((a, b) => a - b) }));
  return {
    rowCount,
    floatIds,
    floatCount: floatIds.length,
    cycles: cycleList,
    cycleCount: cycleList.reduce((n, c) => n + c.cycleNumbers.length, 0),
    profileIds: profiles.map((p) => p.profile_id).sort(),
    profileCount: profiles.length,
    modeSummary,
    dataSourceSummary,
    positionQc: tallyQc(profiles.map((p) => ({ flag: p.position_qc }))),
    ...meta,
  };
}

/** True when every result row already carries the identifiers provenance needs. */
export function rowsHaveIdentifiers(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  return rows.every(
    (r) => ["profile_id", "float_id", "cycle_number", "data_mode", "data_source"].every((k) => r[k] != null) && "position_qc" in r,
  );
}

/** Second query: identifiers for the exact profiles that appear in the result rows. */
export function provenanceSqlForProfileIds(profileIds: string[]): string | null {
  const ids = [...new Set(profileIds.filter((id) => SAFE_ID.test(id)))];
  if (ids.length === 0) return null;
  return `SELECT c.float_id, c.cycle_number, p.profile_id, p.data_mode, p.data_source, p.position_qc FROM profiles p JOIN cycles c ON p.cycle_id = c.cycle_id WHERE p.profile_id IN (${ids.map((i) => `'${i}'`).join(", ")}) LIMIT ${PROVENANCE_LIMIT}`;
}

/**
 * Second query for aggregate results without profile identifiers: re-uses the validated query's
 * FROM and WHERE, adds the cycles/profiles joins if missing, and selects DISTINCT identifiers.
 * If the result rows carry float_id values, provenance is narrowed to those floats.
 */
export function provenanceSqlFromFilters(ast: SelectFromStatement, resultFloatIds: string[]): string | null {
  const from = [...(ast.from ?? [])];
  if (from.length === 0) return null;
  let p = aliasOf(from, "profiles");
  let c = aliasOf(from, "cycles");
  const f = aliasOf(from, "floats");
  if (!p && !c && !f) return null;
  if (!c) {
    c = "pv_c";
    const on = p ? eq(ref(c, "cycle_id"), ref(p, "cycle_id")) : eq(ref(c, "float_id"), ref(f!, "float_id"));
    from.push({ type: "table", name: { name: "cycles", alias: c }, join: { type: "INNER JOIN", on } });
  }
  if (!p) {
    p = "pv_p";
    from.push({ type: "table", name: { name: "profiles", alias: p }, join: { type: "INNER JOIN", on: eq(ref(p, "cycle_id"), ref(c, "cycle_id")) } });
  }
  let where: Expr | null | undefined = ast.where;
  const fids = [...new Set(resultFloatIds.filter((id) => SAFE_ID.test(id)))];
  if (fids.length > 0) {
    const inExpr: Expr = { type: "binary", op: "IN", left: ref(c, "float_id"), right: { type: "list", expressions: fids.map((v) => ({ type: "string", value: v })) } };
    where = where ? { type: "binary", op: "AND", left: where, right: inExpr } : inExpr;
  }
  const stmt: SelectFromStatement = {
    type: "select",
    distinct: "distinct",
    columns: [
      { expr: ref(c, "float_id") },
      { expr: ref(c, "cycle_number") },
      { expr: ref(p, "profile_id") },
      { expr: ref(p, "data_mode") },
      { expr: ref(p, "data_source") },
      { expr: ref(p, "position_qc") },
    ],
    from,
    where,
    limit: { limit: { type: "integer", value: PROVENANCE_LIMIT } },
  };
  return toSql.statement(stmt);
}
