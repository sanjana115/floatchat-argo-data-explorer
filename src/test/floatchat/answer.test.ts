import { describe, it, expect } from "vitest";
import { computeFacts, checkAnswer, templateAnswer, countSentences, notesSentence, termsSentence } from "@/lib/floatchat/answer";
import { answerUserPrompt } from "@/lib/floatchat/prompts";
import { summarize } from "@/lib/floatchat/provenance";

type Row = Record<string, unknown>;
const provOf = (rows: Row[]) => summarize(rows as never, rows.length, { scope: "", method: "FROM_RESULT_ROWS", provenanceSql: null, truncated: false });

// Two profiles from two floats: one real-time (R), one adjusted (A).
const rows: Row[] = [
  { profile_id: "1902785_002", float_id: "1902785", cycle_number: 2, data_mode: "R", data_source: "real", pressure: 4.2, temperature: 28.4, salinity: 35.12 },
  { profile_id: "1902785_002", float_id: "1902785", cycle_number: 2, data_mode: "R", data_source: "real", pressure: 9.8, temperature: 28.1, salinity: 35.2 },
  { profile_id: "5905643_296", float_id: "5905643", cycle_number: 296, data_mode: "A", data_source: "real", pressure: 5, temperature: 21.4, salinity: 35.8 },
];
const prov = provOf(rows);
const facts = computeFacts(rows, prov);
const equator = { label: "near the equator", matchedText: "near the equator", interpretation: "Near the equator: profiles taken between 5° south and 5° north latitude.", isProjectAssumption: true };

describe("facts are computed only from the returned rows", () => {
  it("counts distinct profiles and floats", () => {
    expect(facts.profileCount).toBe(2);
    expect(facts.floatCount).toBe(2);
    expect(facts.realtimeProfiles).toBe(1);
  });
  it("rounds temperature to 1 decimal", () => {
    expect(facts.numeric.find((n) => n.column === "temperature")).toMatchObject({ count: 3, min: 21.4, max: 28.4, mean: 26 });
  });
  it("rounds salinity to 2 decimals", () => {
    expect(facts.numeric.find((n) => n.column === "salinity")).toMatchObject({ min: 35.12, max: 35.8, mean: 35.37 });
  });
  it("rounds depth (pressure) to whole metres", () => {
    expect(facts.numeric.find((n) => n.column === "pressure")).toMatchObject({ min: 4, max: 10 });
  });
  it("marks results as capped when the row limit is reached", () => {
    expect(computeFacts(rows, prov, { limit: 3 }).capped).toBe(true);
    expect(computeFacts(rows, prov, { limit: 500 }).capped).toBe(false);
  });
});

describe("answer guard", () => {
  it("accepts a plain answer whose numbers all come from the facts", () => {
    expect(checkAnswer("Surface water averaged 26.0 °C. That comes from 2 profiles by 2 floats, and some of it is real-time data without a final quality review.", facts, [])).toBeNull();
  });
  it("rejects a number that was not computed from the rows", () => {
    expect(checkAnswer("Surface water averaged 26.5 °C. Some of it is real-time data.", facts, [])).toMatch(/number 26.5/);
  });
  it("rejects unrounded values that are not in the facts", () => {
    expect(checkAnswer("Surface water averaged 25.97 °C. Some of it is real-time data.", facts, [])).toMatch(/number 25.97/);
  });
  it("rejects float IDs in the main text", () => {
    expect(checkAnswer("Float 1902785 measured 28.4 °C. Some of it is real-time data.", facts, [])).toMatch(/1902785/);
  });
  it.each(["The SQL returned 2 profiles", "Most profiles are in data mode A", "Readings came from 2 cycles", "Quality flags were good for 2 profiles"])(
    "rejects jargon: %s",
    (s) => expect(checkAnswer(`${s}. Some of it is real-time data.`, facts, [])).toMatch(/jargon/),
  );
  it("rejects lists", () => {
    expect(checkAnswer("- 26.0 °C on average.\n- 2 profiles, some real-time.", facts, [])).toMatch(/list/);
  });
  it("rejects explanations of causes", () => {
    expect(checkAnswer("It averaged 26.0 °C because of the sun. Some of it is real-time data.", facts, [])).toMatch(/cause/);
  });
  it("requires 2 to 4 sentences", () => {
    expect(checkAnswer("It averaged 26.0 °C with real-time data.", facts, [])).toMatch(/1 sentences/);
    expect(checkAnswer("A 2. B 2. C 2. D 2. E 2 real-time.", facts, [])).toMatch(/5 sentences/);
    expect(countSentences("Values ranged from 21.4 to 28.4. Done.")).toBe(2);
  });
  it("requires the real-time note when real-time profiles are included", () => {
    expect(checkAnswer("It averaged 26.0 °C. That comes from 2 profiles.", facts, [])).toMatch(/real-time/);
  });
  it("requires the 'first N' note when results hit the row limit", () => {
    const capped = computeFacts(rows, prov, { limit: 3 });
    expect(checkAnswer("It averaged 26.0 °C. Some of it is real-time data.", capped, [])).toMatch(/first 3/);
    expect(checkAnswer("It averaged 26.0 °C. This covers only the first 3 readings, and some is real-time data.", capped, [])).toBeNull();
  });
  it("requires the imported-data note when synthetic profiles are included", () => {
    const syn = rows.map((r) => ({ ...r, data_source: "synthetic", data_mode: "D" }));
    const f = computeFacts(syn, provOf(syn));
    expect(f.syntheticProfiles).toBe(2);
    expect(checkAnswer("It averaged 26.0 °C. That comes from 2 profiles.", f, [])).toMatch(/imported/);
  });
  it("allows threshold numbers from the interpretation lines", () => {
    expect(checkAnswer("In the top 10 metres it averaged 26.0 °C. Some of it is real-time data.", facts, ["Surface: top 10 decibars"])).toBeNull();
  });
});

describe("rule-based answer wording", () => {
  const ask = (question: string, terms = [] as (typeof equator)[], f = facts) => templateAnswer(f, { question, terms });

  it("explains salinity once and gives salinity to 2 decimals", () => {
    const text = ask("What is the salinity at the surface?");
    expect(text).toContain("Salinity (how salty the water is) ranged from 35.12 to 35.80, averaging 35.37");
    expect(text.match(/how salty/g)).toHaveLength(1);
  });
  it("gives temperature to 1 decimal", () => {
    expect(ask("What is the temperature?")).toContain("ranged from 21.4 °C to 28.4 °C, averaging 26.0 °C");
  });
  it("gives depth as about X metres", () => {
    expect(ask("What is the temperature?")).toContain("at depths of about 4 to 10 metres");
  });
  it("answers the highest value when asked for the highest", () => {
    expect(ask("What was the highest temperature?")).toMatch(/^The highest temperature in these results was 28\.4 °C\./);
  });
  it("says how a vague term was interpreted", () => {
    expect(ask("Temperature near the equator?", [equator])).toContain(
      'I took "near the equator" to mean profiles taken between 5° south and 5° north latitude, a working definition chosen for this app.',
    );
  });
  it("compares two regions by their own values, not an average of averages", () => {
    const g = [
      { region: "Arabian Sea", avg_salinity: 35.434, n_profiles: 7 },
      { region: "Bay of Bengal", avg_salinity: 34.572, n_profiles: 4 },
    ];
    expect(ask("Compare salinity between the Arabian Sea and Bay of Bengal", [], computeFacts(g, null))).toMatch(
      /^Average salinity \(how salty the water is\) was higher in the Arabian Sea, at 35\.43, than in the Bay of Bengal, at 34\.57\./,
    );
  });
  it("notes capped results with the number shown", () => {
    expect(ask("What is the temperature?", [], computeFacts(rows, prov, { limit: 3 }))).toContain("this covers only the first 3 readings");
  });
  it("says nothing matched and suggests a rephrase", () => {
    const text = ask("Temperature near the equator?", [equator], computeFacts([], null));
    expect(text).toMatch(/^Nothing in the stored float data matched this question\./);
    expect(text).toContain('Try asking again without "near the equator"');
  });
  it("never shows float or profile IDs", () => {
    const text = ask("Which floats measured temperature?");
    for (const id of ["1902785", "5905643", "296"]) expect(text).not.toContain(id);
  });
  it("always passes the answer guard", () => {
    for (const q of ["What is the salinity?", "What was the highest temperature?", "How many profiles?", "Which floats?"]) {
      expect(checkAnswer(ask(q, [equator]), facts, [equator.interpretation])).toBeNull();
    }
    const empty = computeFacts([], null);
    expect(checkAnswer(ask("x"), empty, [])).toBeNull();
  });
});

describe("AI answer prompt", () => {
  it("passes the same interpretation sentence and required note the rule-based answer uses", () => {
    const capped = computeFacts(rows, prov, { limit: 3 });
    const prompt = answerUserPrompt("Temperature near the equator?", [equator.interpretation], capped, [equator]);
    expect(prompt).toContain(`TERMS SENTENCE: ${termsSentence([equator])}`);
    expect(prompt).toContain(`REQUIRED NOTE: ${notesSentence(capped)}`);
    expect(notesSentence(capped)).toContain("first 3 readings");
  });
});
