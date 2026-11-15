// Argo QC flag summaries. A missing flag (null/undefined/blank) or flag 0 ("no QC performed")
// is counted as UNKNOWN — never as good.

export type QcBucket =
  | "good"
  | "probably_good"
  | "probably_bad"
  | "bad"
  | "changed"
  | "estimated"
  | "missing_value"
  | "unknown";

export const QC_BUCKETS: QcBucket[] = ["good", "probably_good", "probably_bad", "bad", "changed", "estimated", "missing_value", "unknown"];

export const QC_LABELS: Record<QcBucket, string> = {
  good: "Good (1)",
  probably_good: "Probably good (2)",
  probably_bad: "Probably bad (3)",
  bad: "Bad (4)",
  changed: "Value changed (5)",
  estimated: "Estimated (8)",
  missing_value: "Value missing (9)",
  unknown: "Unknown (no flag / not checked)",
};

export type QcTally = Record<QcBucket, number> & { total: number };

export const QC_COLUMNS = ["pres_qc", "temp_qc", "psal_qc", "position_qc"] as const;
export type QcColumn = (typeof QC_COLUMNS)[number];

export function classifyQc(flag: unknown): QcBucket {
  if (flag === null || flag === undefined) return "unknown";
  const s = String(flag).trim();
  if (s === "") return "unknown";
  const n = Number(s);
  switch (n) {
    case 1: return "good";
    case 2: return "probably_good";
    case 3: return "probably_bad";
    case 4: return "bad";
    case 5: return "changed";
    case 8: return "estimated";
    case 9: return "missing_value";
    default: return "unknown"; // 0 = no QC performed, anything else is not a defined flag
  }
}

export function emptyTally(): QcTally {
  return { good: 0, probably_good: 0, probably_bad: 0, bad: 0, changed: 0, estimated: 0, missing_value: 0, unknown: 0, total: 0 };
}

/** Tally flags; each item can carry a weight (e.g. a GROUP BY count). */
export function tallyQc(items: Array<{ flag: unknown; n?: number }>): QcTally {
  const t = emptyTally();
  for (const { flag, n = 1 } of items) {
    const w = Number(n) || 0;
    t[classifyQc(flag)] += w;
    t.total += w;
  }
  return t;
}

/**
 * QC summary over result rows, only for QC columns that are actually present in the rows.
 * A column absent from the rows is reported as not available (not as unknown).
 */
export function summarizeRowsQc(rows: Record<string, unknown>[]): Partial<Record<QcColumn, QcTally>> {
  const out: Partial<Record<QcColumn, QcTally>> = {};
  if (rows.length === 0) return out;
  for (const col of QC_COLUMNS) {
    if (!rows.some((r) => col in r)) continue;
    out[col] = tallyQc(rows.map((r) => ({ flag: r[col] })));
  }
  return out;
}
