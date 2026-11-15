import { describe, it, expect } from "vitest";
import { classifyQc, tallyQc, summarizeRowsQc } from "@/lib/floatchat/qc";

describe("QC flag summary", () => {
  it("counts a missing QC flag as unknown, never as good", () => {
    expect(classifyQc(null)).toBe("unknown");
    expect(classifyQc(undefined)).toBe("unknown");
    expect(classifyQc("")).toBe("unknown");
    expect(classifyQc(" ")).toBe("unknown");
  });

  it("counts flag 0 (no QC performed) as unknown", () => {
    expect(classifyQc(0)).toBe("unknown");
  });

  it("maps the Argo flags 1, 2, 3, 4 to good, probably good, probably bad, bad", () => {
    expect([1, 2, 3, 4].map(classifyQc)).toEqual(["good", "probably_good", "probably_bad", "bad"]);
    expect(classifyQc("1")).toBe("good");
  });

  it("weights grouped counts and keeps unknown separate from good", () => {
    const t = tallyQc([{ flag: 1, n: 10 }, { flag: null, n: 3 }, { flag: 4, n: 1 }]);
    expect(t.good).toBe(10);
    expect(t.unknown).toBe(3);
    expect(t.bad).toBe(1);
    expect(t.total).toBe(14);
  });

  it("only summarises QC columns that are present in the rows", () => {
    const s = summarizeRowsQc([{ temp_qc: 1, salinity: 35 }, { temp_qc: null, salinity: 34 }]);
    expect(Object.keys(s)).toEqual(["temp_qc"]);
    expect(s.temp_qc?.good).toBe(1);
    expect(s.temp_qc?.unknown).toBe(1);
    expect(summarizeRowsQc([{ avg_temperature: 28.8 }])).toEqual({});
  });
});
