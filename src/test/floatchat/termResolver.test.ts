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

  it("labels every confirmed threshold PROJECT ASSUMPTION and keeps background notes", () => {
    const r = resolveTerms("surface temperature in the tropics", defs);
    const surface = r.find((t) => t.termId === "surface")!;
    const tropics = r.find((t) => t.termId === "tropics")!;
    expect(surface.isProjectAssumption).toBe(true);
    expect(surface.source).toContain(PROJECT_ASSUMPTION);
    expect(tropics.isProjectAssumption).toBe(true);
    expect(tropics.source).toContain("23.44");
  });

  it("treats a term without a source note as PROJECT ASSUMPTION", () => {
    const bare = [{ ...defs[0]!, source_note: "" }];
    const [t] = resolveTerms("near the equator", bare);
    expect(t?.isProjectAssumption).toBe(true);
    expect(t?.source).toBe(PROJECT_ASSUMPTION);
  });

  it("uses the confirmed values", () => {
    const cond = (id: string) => defs.find((d) => d.term_id === id)!.sql_fragment;
    expect(cond("near_the_equator")).toBe("p.latitude BETWEEN -5 AND 5");
    expect(cond("tropics")).toBe("p.latitude BETWEEN -23.44 AND 23.44");
    expect(cond("arabian_sea")).toBe("p.latitude BETWEEN 8 AND 26 AND p.longitude BETWEEN 52 AND 77.5");
    expect(cond("bay_of_bengal")).toBe("p.latitude BETWEEN 5 AND 23 AND p.longitude BETWEEN 80 AND 96");
    expect(cond("surface")).toBe("m.pressure <= 10");
    expect(cond("deep_water")).toBe("m.pressure >= 1000");
    expect(cond("thermocline")).toBe("m.pressure BETWEEN 100 AND 400");
    expect(cond("recent")).toBe("p.profile_time >= (SELECT max(p2.profile_time) FROM profiles p2) - INTERVAL '30 days'");
    expect(defs.every((d) => d.source_note.startsWith("PROJECT ASSUMPTION"))).toBe(true);
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
