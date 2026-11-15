import type { ResolvedTerm } from "./termResolver";
import type { Facts } from "./answer";
import { DEFAULT_MAX_LIMIT } from "./sqlValidator";

export const SQL_INSTRUCTIONS = `You write exactly one PostgreSQL SELECT statement for FloatChat, a read-only explorer of real Argo float ocean profiles.

Tables (only these four are available):
- floats f(float_id text PK = WMO float number, platform_type, wmo_inst_type, project_name, pi_name, data_centre)
- cycles c(cycle_id bigint PK, float_id text -> floats.float_id, cycle_number int)
- profiles p(profile_id text PK, cycle_id -> cycles.cycle_id, direction 'A'|'D', profile_time timestamptz, juld_qc smallint, latitude double, longitude double (-180..180), position_qc smallint, data_mode 'R'|'A'|'D', data_source 'real'|'synthetic', source_file text, vertical_sampling_scheme text)
- measurements m(measurement_id bigint, profile_id -> profiles.profile_id, level_index int, pressure double (decibars), temperature double (deg C), salinity double (practical salinity), pres_qc, temp_qc, psal_qc smallint (Argo QC flags: 1 good, 2 probably good, 3 probably bad, 4 bad), is_adjusted boolean)

Hierarchy (enforced by a validator):
- measurements m JOIN profiles p ON m.profile_id = p.profile_id
- profiles p JOIN cycles c ON p.cycle_id = c.cycle_id
- float IDs come from c.float_id (profiles has no float_id). Join floats f ON c.float_id = f.float_id only for float metadata.

Rules:
1. Output only the SQL text. No prose, no markdown fences.
2. One plain SELECT: no WITH, UNION, subqueries or functions in FROM. Scalar subqueries in WHERE are allowed.
3. Allowed functions: count, sum, avg, min, max, stddev, percentile_cont, round, abs, coalesce, nullif, greatest, least, floor, ceil, date_trunc, date_part, to_char, lower, upper, row_number, rank. Cast to ::numeric before ROUND(x, n). EXTRACT(...) and CASE are fine.
4. Always end with LIMIT n where n <= ${DEFAULT_MAX_LIMIT}.
5. Non-aggregate queries must select c.float_id, c.cycle_number, p.profile_id, p.data_mode, p.data_source plus the columns the question is about.
6. When term definitions are listed, include each SQL condition exactly as written (same aliases). Do not invent thresholds that are not given.
7. Quality default: when using measured values, keep only readings whose QC flag is 1 or 2 for each measured column you use (m.temp_qc IN (1, 2) for temperature, m.psal_qc IN (1, 2) for salinity, m.pres_qc IN (1, 2) for pressure/depth). Skip this only if the user asks for all, raw or unfiltered data.
8. When comparing two regions, combine their conditions with OR and label each with CASE ... END AS region, grouping by it.
9. Use explicit JOIN ... ON with the aliases m, p, c, f.`;

export function sqlUserPrompt(question: string, terms: ResolvedTerm[]): string {
  const defs = terms.length
    ? terms.map((t) => `- "${t.label}": ${t.sqlCondition}   [needs: ${t.requiredTables.join(", ")}]`).join("\n")
    : "- (none matched)";
  return `Question: ${question}\n\nTerm definitions to apply:\n${defs}\n\nWrite the single SELECT now.`;
}

export const ANSWER_INSTRUCTIONS = `You explain ocean measurement results to a non-expert.
Write 2 to 4 short, plain-language sentences. Put the direct answer first, then say how many profiles and floats it is based on when FACTS gives those counts.
Use only numbers that appear in FACTS (you may round them to fewer decimals). Do not calculate new numbers, percentages or differences.
Never mention float numbers, profile or cycle identifiers, WMO, SQL, databases, queries, rows, QC flags, data-mode letters, "dbar" or "PSU". Say "decibars" for pressure, °C for temperature, and give salinity as a plain number.
If FACTS shows zero results, say nothing matched and suggest widening the search.
If the question asks "which floats", say how many floats matched and that their identifiers are listed in the evidence panel.
Reply with the sentences only.`;

export function answerUserPrompt(question: string, interpretation: string[], facts: Facts): string {
  return `Question: ${question}\n\nHow the question was interpreted:\n${interpretation.length ? interpretation.map((l) => `- ${l}`).join("\n") : "- (no special terms)"}\n\nFACTS (computed from the returned results):\n${JSON.stringify(facts)}`;
}
