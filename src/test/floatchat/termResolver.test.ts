import { describe, it, expect } from "vitest";
import { resolveTerms, interpretationLines, PROJECT_ASSUMPTION } from "@/lib/floatchat/termResolver";
import { TERM_DEFINITIONS as defs } from "./termDefinitions.fixture";

const ids = (q: string) => resolveTerms(q, defs).map((t) => t.termId);

describe("term resolver", () => {
  it("finds all eight required terms", () => {
    const q = "Recent near the equator tropics surface deep water thermocline Arabian Sea Bay of Bengal";
    expect(ids(q).sort()).toEqual(["arabian_sea", "bay_of_bengal", "deep_water", "near_the_equator", "recent", "surface", "thermocline", "tropics"]);
  });

  it("is case-insensitive", () => {
    expect(ids("SALINITY IN THE BAY OF BENGAL")).toEqual(["bay_of_bengal"]);
  });

  it("matches the longest phrase first and does not re-use its words", () => {
    const r = resolveTerms("near-surface salinity", defs);
    expect(r).toHaveLength(1);
    expect(r[0]?.matchedText).toBe("near-surface");
    expect(resolveTerms("the most recent profiles", defs)[0]?.matchedText).toBe("most recent");
    expect(resolveTerms("deep waters of the tropics", defs).map((t) => t.matchedText)).toEqual(["deep waters", "the tropics"]);
  });

  it("only matches whole words", () => {
    expect(ids("the float resurfaced")).toEqual([]);
    expect(ids("deeper layers")).toEqual([]);
  });

  it("labels unsourced thresholds PROJECT ASSUMPTION and keeps sources for sourced ones", () => {
    const r = resolveTerms("surface temperature in the tropics", defs);
    const surface = r.find((t) => t.termId === "surface")!;
    const tropics = r.find((t) => t.termId === "tropics")!;
    expect(surface.isProjectAssumption).toBe(true);
    expect(surface.source).toBe(PROJECT_ASSUMPTION);
    expect(tropics.isProjectAssumption).toBe(false);
    expect(tropics.source).toContain("23.44");
  });

  it("produces one plain-language interpretation line per term", () => {
    const lines = interpretationLines(resolveTerms("surface temperature near the equator", defs));
    expect(lines).toEqual([
      "Surface: readings from the top 10 decibars of each profile (roughly the top 10 metres). (PROJECT ASSUMPTION)",
      "Near the equator: profiles taken between 5° south and 5° north latitude. (PROJECT ASSUMPTION)",
    ]);
  });
});

import { usesQualityFilter } from "@/lib/floatchat/termResolver";
import { validateSql } from "@/lib/floatchat/sqlValidator";

describe("quality interpretation line", () => {
  it("detects the default QC filter in executed (re-serialised) SQL", () => {
    const v = validateSql("SELECT max(m.salinity) AS s FROM measurements m JOIN profiles p ON m.profile_id = p.profile_id WHERE m.psal_qc IN (1, 2)");
    expect(v.ok && usesQualityFilter(v.sql)).toBe(true);
    const w = validateSql("SELECT max(m.salinity) AS s FROM measurements m JOIN profiles p ON m.profile_id = p.profile_id");
    expect(w.ok && usesQualityFilter(w.sql)).toBe(false);
  });
});
