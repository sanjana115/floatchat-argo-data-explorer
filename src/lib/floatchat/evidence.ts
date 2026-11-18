// Counts shown in "Supporting Evidence & Data Quality". Pure so the labels can be tested.
type Row = Record<string, unknown>;

const COUNT_COL = /(^|_)(measurements|readings|levels|n_measurements|n_readings|n_levels|measurement_count|reading_count)$/;

/**
 * Number of individual readings behind the result: the row count when rows are readings (they carry a
 * pressure), else the sum of an explicit readings/measurements count column, else null (not reported).
 */
export function measurementsUsed(rows: Row[] | undefined): number | null {
  if (!rows || rows.length === 0) return 0;
  const cols = Object.keys(rows[0] ?? {});
  if (cols.includes("pressure") || cols.includes("pres")) return rows.length;
  const col = cols.find((c) => COUNT_COL.test(c.toLowerCase()));
  if (!col) return null;
  let total = 0;
  for (const r of rows) {
    const n = Number(r[col]);
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}
