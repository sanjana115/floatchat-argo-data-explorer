// RULE_BASED_FALLBACK: deterministic SQL built only from resolved term conditions and simple keywords.
import type { ResolvedTerm } from "./termResolver";

const QUALITY_OPT_OUT = /\b(all data|raw|unfiltered|including bad|any quality)\b/i;
const MEASURE_WORDS = /\b(temperature|temperatures|salinity|salty|saltiest|pressure|depth|warm|warmest|cold|coldest|hot|hottest)\b/i;

export function buildFallbackSql(question: string, terms: ResolvedTerm[]): string {
  const q = question.toLowerCase();
  const geo = terms.filter((t) => t.category === "geographic");
  const other = terms.filter((t) => t.category !== "geographic");
  const needsM = terms.some((t) => t.requiredTables.includes("measurements")) || MEASURE_WORDS.test(q);
  const conds: string[] = other.map((t) => `(${t.sqlCondition})`);
  if (geo.length === 1 && geo[0]) conds.push(`(${geo[0].sqlCondition})`);
  if (geo.length > 1) conds.push(`(${geo.map((g) => `(${g.sqlCondition})`).join(" OR ")})`);
  const regionCase = geo.length > 1
    ? `CASE ${geo.map((g) => `WHEN ${g.sqlCondition} THEN '${g.label.replace(/'/g, "")}'`).join(" ")} END`
    : null;
  if (needsM && !QUALITY_OPT_OUT.test(q)) conds.push("m.pres_qc IN (1, 2) AND m.temp_qc IN (1, 2) AND m.psal_qc IN (1, 2)");
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const from = needsM
    ? "FROM measurements m JOIN profiles p ON m.profile_id = p.profile_id JOIN cycles c ON p.cycle_id = c.cycle_id"
    : "FROM profiles p JOIN cycles c ON p.cycle_id = c.cycle_id";

  if (/\b(data mode|real-time|real time|delayed|adjusted)\b/.test(q) && !needsM) {
    return `SELECT p.data_mode, COUNT(DISTINCT p.profile_id) AS profiles, COUNT(DISTINCT c.float_id) AS floats ${from} ${where} GROUP BY p.data_mode ORDER BY p.data_mode LIMIT 10`;
  }
  if (regionCase || /\b(average|mean|compare|comparison|how many|count|number of)\b/.test(q)) {
    const group = regionCase ? `${regionCase} AS region, ` : "";
    const meas = needsM
      ? ", COUNT(*) AS measurements, ROUND(AVG(m.temperature)::numeric, 2) AS avg_temperature, ROUND(AVG(m.salinity)::numeric, 3) AS avg_salinity"
      : "";
    return `SELECT ${group}COUNT(DISTINCT c.float_id) AS floats, COUNT(DISTINCT p.profile_id) AS profiles${meas} ${from} ${where}${regionCase ? " GROUP BY 1 ORDER BY 1" : ""} LIMIT 50`;
  }
  const cols = "c.float_id, c.cycle_number, p.profile_id, p.profile_time, p.latitude, p.longitude, p.data_mode, p.data_source";
  if (needsM) {
    let order = "p.profile_time DESC, m.pressure ASC";
    let extra = "";
    if (/(highest|max|maximum|saltiest)\b.*salin|saltiest/.test(q)) { order = "m.salinity DESC"; extra = " AND m.salinity IS NOT NULL"; }
    else if (/(highest|max|maximum|warmest|hottest)\b/.test(q)) { order = "m.temperature DESC"; extra = " AND m.temperature IS NOT NULL"; }
    else if (/(lowest|min|minimum|coldest)\b/.test(q)) { order = "m.temperature ASC"; extra = " AND m.temperature IS NOT NULL"; }
    const w = where ? where + extra : extra ? `WHERE ${extra.replace(/^ AND /, "")}` : "";
    return `SELECT ${cols}, m.pressure, m.temperature, m.salinity, m.temp_qc, m.psal_qc ${from} ${w} ORDER BY ${order} LIMIT 200`;
  }
  return `SELECT ${cols} ${from} ${where} ORDER BY p.profile_time DESC LIMIT 200`;
}
