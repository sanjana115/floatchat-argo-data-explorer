import { describe, it, expect } from "vitest";
import { computeFacts, checkAnswer, templateAnswer, countSentences } from "@/lib/floatchat/answer";
import { summarize } from "@/lib/floatchat/provenance";

const rows = [
  { profile_id: "1902785_002", float_id: "1902785", cycle_number: 2, data_mode: "R", data_source: "real", pressure: 4.2, temperature: 28.4, salinity: 35.12 },
  { profile_id: "1902785_002", float_id: "1902785", cycle_number: 2, data_mode: "R", data_source: "real", pressure: 9.8, temperature: 28.1, salinity: 35.2 },
  { profile_id: "5905643_296", float_id: "5905643", cycle_number: 296, data_mode: "A", data_source: "real", pressure: 5, temperature: 21.4, salinity: 35.8 },
];
const prov = summarize(rows as never, rows.length, { scope: "", method: "FROM_RESULT_ROWS", provenanceSql: null, truncated: false });
const facts = computeFacts(rows, prov);

describe("answer facts and guard", () => {
  it("computes numbers only from the returned rows", () => {
    const t = facts.numeric.find((n) => n.column === "temperature")!;
    expect(t).toMatchObject({ count: 3, min: 21.4, max: 28.4, mean: 25.97 });
    expect(facts.profileCount).toBe(2);
    expect(facts.floatCount).toBe(2);
  });

  it("accepts a 2-sentence answer whose numbers all come from the facts", () => {
    expect(checkAnswer("Surface water averaged 25.97 °C. That comes from 2 profiles by 2 floats, ranging from 21.4 °C to 28.4 °C.", facts, [])).toBeNull();
  });

  it("rejects a number that was not computed from the rows", () => {
    expect(checkAnswer("Surface water averaged 26.5 °C. That comes from 2 profiles.", facts, [])).toMatch(/number 26.5/);
  });

  it("rejects float IDs and jargon in the main text", () => {
    expect(checkAnswer("Float 1902785 measured 28.4 °C. It is warm.", facts, [])).toMatch(/1902785/);
    expect(checkAnswer("The SQL returned 3 results. It is warm.", facts, [])).toMatch(/jargon/);
  });

  it("requires 2 to 4 sentences", () => {
    expect(checkAnswer("It averaged 25.97 °C.", facts, [])).toMatch(/1 sentences/);
    expect(checkAnswer("A 2. B 2. C 2. D 2. E 2.", facts, [])).toMatch(/5 sentences/);
    expect(countSentences("Values ranged from 21.4 to 28.4. Done.")).toBe(2);
  });

  it("allows threshold numbers from the interpretation lines", () => {
    expect(checkAnswer("In the top 10 metres it averaged 25.97 °C. That is from 2 profiles.", facts, ["Surface: top 10 decibars"])).toBeNull();
  });

  it("template answer always passes the guard", () => {
    const text = templateAnswer(facts);
    expect(checkAnswer(text, facts, [])).toBeNull();
    const empty = computeFacts([], null);
    expect(checkAnswer(templateAnswer(empty), empty, [])).toBeNull();
  });
});
