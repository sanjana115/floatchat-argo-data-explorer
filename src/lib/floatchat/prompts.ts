import type { ResolvedTerm } from "./termResolver";
import { termsSentence, notesSentence, type Facts, type AnswerTerm } from "./answer";
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

export const ANSWER_INSTRUCTIONS = `You explain ocean measurement results to someone with no oceanography background. They must understand the answer on first read.
Write 2 to 4 short, plain sentences. No lists, headings or markdown.
1. First sentence: the direct answer to the question.
2. Then at most one sentence of context, e.g. how many profiles (sets of readings taken down through the water) and floats it is based on, when FACTS gives those counts.
3. If TERMS SENTENCE is given, include it (you may shorten it) so the reader knows how a vague phrase was read.
4. If REQUIRED NOTE is given, include it in one short sentence; keep its key words ("first N", "real-time" with "final quality review", "imported").
Numbers: use only numbers that appear in FACTS, TERMS SENTENCE or REQUIRED NOTE, exactly as given. FACTS values are already rounded (temperature 1 decimal, salinity 2 decimals); do not add decimals, compute differences, percentages or new averages.
Words: say "salinity (how salty the water is)" the first time salinity appears. Give depth as "about X metres" using the pressure values (1 decibar is about 1 metre). Use °C for temperature.
Never mention float numbers, profile or cycle identifiers, WMO, SQL, databases, queries, rows, quality flags or QC, data-mode letters or the words "data mode", "cycle", "dbar" or "PSU". Describe data modes in plain words ("real-time", "adjusted by the data team", "fully reviewed by experts").
Do not explain causes (no "because", "due to", "caused by") and do not add scientific facts or trends that are not computed in FACTS.
If FACTS shows zero results, say nothing matched and suggest one way to rephrase the question.
If the question asks "which floats", say how many floats matched and that they are listed in the evidence panel.
Reply with the sentences only.`;

export function answerUserPrompt(question: string, interpretation: string[], facts: Facts, terms: AnswerTerm[] = []): string {
  const termLine = termsSentence(terms);
  const note = notesSentence(facts);
  return [
    `Question: ${question}`,
    `How the question was interpreted:\n${interpretation.length ? interpretation.map((l) => `- ${l}`).join("\n") : "- (no special terms)"}`,
    `TERMS SENTENCE: ${termLine ?? "(none)"}`,
    `REQUIRED NOTE: ${note ?? "(none)"}`,
    `FACTS (computed from the returned results):\n${JSON.stringify(facts)}`,
  ].join("\n\n");
}
