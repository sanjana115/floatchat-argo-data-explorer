// SQL validator for LLM-generated queries. Parses with pgsql-ast-parser and rejects anything it cannot parse.
// The SQL that is executed is the re-serialised AST, so what was validated is exactly what runs.
import { parse, toSql, astVisitor } from "pgsql-ast-parser";
import type { Expr, From, SelectFromStatement, Statement } from "pgsql-ast-parser";

export const ALLOWED_TABLES = ["floats", "cycles", "profiles", "measurements"] as const;
export const DEFAULT_MAX_LIMIT = 500;

const AGGREGATES = new Set([
  "count", "sum", "avg", "min", "max", "stddev", "stddev_samp", "stddev_pop", "variance", "var_samp",
  "var_pop", "percentile_cont", "percentile_disc", "mode", "bool_and", "bool_or", "corr", "regr_slope",
  "regr_intercept", "string_agg",
]);
const ALLOWED_FUNCTIONS = new Set([
  ...AGGREGATES,
  "round", "abs", "coalesce", "nullif", "greatest", "least", "floor", "ceil", "ceiling", "sqrt", "power",
  "ln", "log", "exp", "trunc", "sign", "width_bucket", "date_trunc", "date_part", "to_char", "now",
  "lower", "upper", "length", "concat", "row_number", "rank", "dense_rank", "lag", "lead", "first_value",
  "last_value", "ntile",
]);
const UNSAFE_FUNCTION_PATTERNS = [
  /^pg_/, /^lo_/, /^dblink/, /^set_config$/, /^current_setting$/, /^query_to_xml/, /^txid_/, /^copy$/,
  /^generate_series$/, /^repeat$/, /^nextval$/, /^setval$/, /^currval$/, /^version$/, /^inet_/, /^file_/,
];

export interface ValidationOk {
  ok: true;
  sql: string;
  ast: SelectFromStatement;
  limit: number;
  isAggregate: boolean;
  tables: string[];
  selectedColumns: string[];
}
export interface ValidationErr {
  ok: false;
  error: string;
}
export type ValidationResult = ValidationOk | ValidationErr;

const fail = (error: string): ValidationErr => ({ ok: false, error });

function stripFences(raw: string) {
  let s = raw.trim();
  const fence = s.match(/^```(?:sql)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) s = fence[1].trim();
  return s;
}

interface TableInst { table: string; alias: string }
interface Eq { a: [string, string]; b: [string, string] }

/** Collect equality conditions `x.col = y.col` from an AND-chain. */
type Side = { t: string | undefined; c: string };
function collectEqualities(e: Expr | null | undefined, out: Array<{ l: Side; r: Side }>) {
  if (!e) return;
  if (e.type === "binary" && e.op === "AND") {
    collectEqualities(e.left, out);
    collectEqualities(e.right, out);
  } else if (e.type === "binary" && e.op === "=" && e.left.type === "ref" && e.right.type === "ref") {
    out.push({ l: { t: e.left.table?.name, c: e.left.name }, r: { t: e.right.table?.name, c: e.right.name } });
  }
}

function checkHierarchy(sel: SelectFromStatement): string | null {
  const from = sel.from ?? [];
  const insts: TableInst[] = [];
  const raw: Array<{ l: Side; r: Side }> = [];
  for (const f of from) {
    if (f.type !== "table") return "Subqueries or functions in FROM are not supported; join the tables directly.";
    const table = f.name.name.toLowerCase();
    insts.push({ table, alias: (f.name.alias ?? f.name.name).toLowerCase() });
    if (f.join?.using) return "JOIN ... USING is not allowed; write explicit ON conditions (e.g. ON m.profile_id = p.profile_id).";
    if (f.join?.on) collectEqualities(f.join.on, raw);
  }
  collectEqualities(sel.where, raw);
  const aliasTable = new Map(insts.map((i) => [i.alias, i.table]));
  const eqs: Eq[] = [];
  for (const r of raw) {
    if (!r.l.t || !r.r.t) continue;
    const lt = r.l.t.toLowerCase();
    const rt = r.r.t.toLowerCase();
    if (!aliasTable.has(lt) || !aliasTable.has(rt)) continue;
    eqs.push({ a: [lt, r.l.c.toLowerCase()], b: [rt, r.r.c.toLowerCase()] });
  }
  const joined = (a1: string, c1: string, a2: string, c2: string) =>
    eqs.some((e) => (e.a[0] === a1 && e.a[1] === c1 && e.b[0] === a2 && e.b[1] === c2) || (e.b[0] === a1 && e.b[1] === c1 && e.a[0] === a2 && e.a[1] === c2));
  const of = (t: string) => insts.filter((i) => i.table === t);

  for (const m of of("measurements")) {
    const ok = of("profiles").some((p) => joined(m.alias, "profile_id", p.alias, "profile_id"));
    if (!ok) return "Hierarchy violation: measurements must be joined through profiles (JOIN profiles p ON m.profile_id = p.profile_id).";
  }
  for (const p of of("profiles")) {
    for (const c of of("cycles")) {
      if (!joined(p.alias, "cycle_id", c.alias, "cycle_id"))
        return "Hierarchy violation: profiles and cycles must be joined on p.cycle_id = c.cycle_id.";
    }
  }
  if (of("floats").length > 0 && (of("profiles").length > 0 || of("measurements").length > 0 || of("cycles").length > 0)) {
    for (const f of of("floats")) {
      const ok = of("cycles").some((c) => joined(f.alias, "float_id", c.alias, "float_id"));
      if (!ok) return "Hierarchy violation: float IDs come via cycles (JOIN cycles c ON p.cycle_id = c.cycle_id JOIN floats f ON c.float_id = f.float_id).";
    }
  }
  return null;
}

function hasAggregate(sel: SelectFromStatement): boolean {
  if (sel.groupBy && sel.groupBy.length > 0) return true;
  let found = false;
  const v = astVisitor((map) => ({
    call: (c) => {
      if (!c.over && AGGREGATES.has(c.function.name.toLowerCase())) found = true;
      return map.super().call(c);
    },
    selection: () => null, // do not descend into nested subqueries
  }));
  for (const col of sel.columns ?? []) v.expr(col.expr);
  return found;
}

function intLiteral(e: Expr | null | undefined): number | null {
  if (!e) return null;
  if (e.type === "integer") return e.value;
  return null;
}

export function validateSql(rawSql: string, opts: { maxLimit?: number } = {}): ValidationResult {
  const maxLimit = opts.maxLimit ?? DEFAULT_MAX_LIMIT;
  if (typeof rawSql !== "string" || !rawSql.trim()) return fail("Empty SQL.");
  const text = stripFences(rawSql);
  if (text.length > 8000) return fail("SQL is too long (max 8000 characters).");

  let stmts: Statement[];
  try {
    stmts = parse(text);
  } catch (e) {
    return fail(`Could not parse SQL: ${String((e as Error).message).split("\n")[0]}`);
  }
  if (stmts.length !== 1) return fail(`Exactly one statement is allowed; found ${stmts.length}.`);
  const stmt = stmts[0] as Statement;
  if (stmt.type !== "select") {
    return fail(
      stmt.type === "union" || stmt.type === "union all" || stmt.type === "with" || stmt.type === "with recursive"
        ? `Only a single plain SELECT is allowed (no ${stmt.type.toUpperCase()}).`
        : `Only SELECT statements are allowed (got ${stmt.type.toUpperCase()}).`,
    );
  }
  const sel = stmt as SelectFromStatement;

  // Walk the whole tree: tables, functions, nested statements.
  let error: string | null = null;
  const tables = new Set<string>();
  const nestedSelects: SelectFromStatement[] = [];
  const visitor = astVisitor((map) => ({
    tableRef: (t) => {
      const schema = t.schema?.toLowerCase();
      const name = t.name.toLowerCase();
      if (schema && schema !== "public") error ??= `Schema "${schema}" is not allowed.`;
      if (!(ALLOWED_TABLES as readonly string[]).includes(name))
        error ??= `Table "${name}" is not allowed. Allowed tables: ${ALLOWED_TABLES.join(", ")}.`;
      tables.add(name);
      return t;
    },
    fromCall: () => {
      error ??= "Functions in FROM are not allowed.";
      return null;
    },
    fromStatement: () => {
      error ??= "Subqueries in FROM are not supported; join the tables directly.";
      return null;
    },
    call: (c) => {
      const name = c.function.name.toLowerCase();
      if (c.function.schema && c.function.schema.toLowerCase() !== "pg_catalog") error ??= `Schema-qualified function "${c.function.schema}.${name}" is not allowed.`;
      if (UNSAFE_FUNCTION_PATTERNS.some((re) => re.test(name))) error ??= `Unsafe function "${name}" is not allowed.`;
      else if (!ALLOWED_FUNCTIONS.has(name)) error ??= `Function "${name}" is not on the allowed list.`;
      return map.super().call(c);
    },
    selection: (s) => {
      if (s !== sel) nestedSelects.push(s);
      if (s.for || (s as { skip?: unknown }).skip) error ??= "Row locking clauses (FOR UPDATE/SHARE) are not allowed.";
      return map.super().selection(s);
    },
    with: () => {
      error ??= "WITH clauses are not allowed.";
      return null;
    },
    withRecursive: () => {
      error ??= "WITH RECURSIVE is not allowed.";
      return null;
    },
    union: () => {
      error ??= "UNION is not allowed.";
      return null;
    },
    values: () => {
      error ??= "VALUES lists are not allowed.";
      return null;
    },
    parameter: () => {
      error ??= "Query parameters are not allowed.";
      return null;
    },
  }));
  try {
    visitor.statement(sel);
  } catch (e) {
    return fail(`Could not analyse SQL: ${(e as Error).message}`);
  }
  if (error) return fail(error);
  if (!sel.from || sel.from.length === 0) return fail("The query must read from at least one allowed table.");

  for (const s of [sel, ...nestedSelects]) {
    const h = checkHierarchy(s);
    if (h) return fail(h);
  }

  const selectedColumns = (sel.columns ?? []).map((c) => (c.alias?.name ?? (c.expr.type === "ref" ? c.expr.name : "")).toLowerCase());
  const isAggregate = hasAggregate(sel);
  const touchesProfiles = tables.has("profiles") || tables.has("measurements");
  if (!isAggregate && touchesProfiles && !selectedColumns.includes("profile_id") && !selectedColumns.includes("*")) {
    return fail("Row-level queries over profiles/measurements must select p.profile_id so provenance can be traced.");
  }

  // Enforce LIMIT on the outer query.
  let limit = maxLimit;
  if (sel.limit?.limit) {
    const v = intLiteral(sel.limit.limit);
    if (v === null || v < 0) return fail("LIMIT must be a non-negative integer literal.");
    limit = Math.min(v, maxLimit);
  }
  if (sel.limit?.offset) {
    const o = intLiteral(sel.limit.offset);
    if (o === null || o < 0 || o > 100000) return fail("OFFSET must be an integer literal between 0 and 100000.");
  }
  const finalAst: SelectFromStatement = {
    ...sel,
    limit: { ...(sel.limit ?? {}), limit: { type: "integer", value: limit } },
  };

  return { ok: true, sql: toSql.statement(finalAst), ast: finalAst, limit, isAggregate, tables: [...tables], selectedColumns };
}

export type { From };
