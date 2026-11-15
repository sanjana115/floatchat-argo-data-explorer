import { describe, it, expect } from "vitest";
import { summarize, provenanceSqlFromFilters, provenanceSqlForProfileIds, rowsHaveIdentifiers } from "@/lib/floatchat/provenance";
import { validateSql } from "@/lib/floatchat/sqlValidator";

describe("provenance", () => {
  it("summarises modes over DISTINCT profiles, not rows", () => {
    const rows = [
      { float_id: "A", cycle_number: 1, profile_id: "A_001", data_mode: "R", data_source: "real" },
      { float_id: "A", cycle_number: 1, profile_id: "A_001", data_mode: "R", data_source: "real" },
      { float_id: "A", cycle_number: 2, profile_id: "A_002", data_mode: "D", data_source: "real" },
      { float_id: "B", cycle_number: 7, profile_id: "B_007", data_mode: "A", data_source: "synthetic" },
    ];
    const p = summarize(rows as never, 4, { scope: "", method: "FROM_RESULT_ROWS", provenanceSql: null, truncated: false });
    expect(p.profileCount).toBe(3);
    expect(p.modeSummary).toEqual({ R: 1, A: 1, D: 1 });
    expect(p.dataSourceSummary).toEqual({ real: 2, synthetic: 1 });
    expect(p.floatIds).toEqual(["A", "B"]);
    expect(p.cycles).toEqual([{ floatId: "A", cycleNumbers: [1, 2] }, { floatId: "B", cycleNumbers: [7] }]);
    expect(p.cycleCount).toBe(3);
  });

  it("counts a profile with no position QC flag as unknown, not good", () => {
    const rows = [
      { float_id: "A", cycle_number: 1, profile_id: "A_001", data_mode: "R", data_source: "real", position_qc: 1 },
      { float_id: "A", cycle_number: 2, profile_id: "A_002", data_mode: "R", data_source: "real", position_qc: null },
      { float_id: "A", cycle_number: 2, profile_id: "A_002", data_mode: "R", data_source: "real", position_qc: null },
    ];
    const p = summarize(rows as never, 3, { scope: "", method: "FROM_RESULT_ROWS", provenanceSql: null, truncated: false });
    expect(p.positionQc.good).toBe(1);
    expect(p.positionQc.unknown).toBe(1);
    expect(p.positionQc.total).toBe(2);
  });

  it("detects when identifiers are missing so a second query is needed", () => {
    expect(rowsHaveIdentifiers([{ avg_temperature: 28.8 }])).toBe(false);
    expect(rowsHaveIdentifiers([{ float_id: "A", cycle_number: 1, profile_id: "A_001", data_mode: "R", data_source: "real" }])).toBe(false);
    expect(rowsHaveIdentifiers([{ float_id: "A", cycle_number: 1, profile_id: "A_001", data_mode: "R", data_source: "real", position_qc: null }])).toBe(true);
  });

  it("builds a validated second query from an aggregate query's filters", () => {
    const v = validateSql("SELECT avg(m.temperature) AS t FROM measurements m JOIN profiles p ON m.profile_id = p.profile_id WHERE m.pressure <= 10 AND p.latitude BETWEEN -5 AND 5");
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const sql = provenanceSqlFromFilters(v.ast, [])!;
    expect(sql).toContain("DISTINCT");
    expect(sql).toMatch(/pressure <= \(10\)/);
    expect(sql).toMatch(/INNER JOIN cycles\s+AS pv_c ON \(pv_c \.cycle_id = p \.cycle_id\)/);
    const pv = validateSql(sql, { maxLimit: 5000 });
    expect(pv.ok).toBe(true);
  });

  it("builds an ID lookup that rejects unsafe identifiers", () => {
    const sql = provenanceSqlForProfileIds(["1902785_002", "x'); DROP TABLE floats;--"])!;
    expect(sql).toContain("'1902785_002'");
    expect(sql).not.toContain("DROP");
    expect(validateSql(sql, { maxLimit: 5000 }).ok).toBe(true);
  });
});
