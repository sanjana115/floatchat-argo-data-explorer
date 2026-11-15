import { describe, it, expect } from "vitest";
import { generateValidateExecute, GenerationError } from "@/lib/floatchat/generationLoop";
import { buildFallbackSql } from "@/lib/floatchat/fallbackSql";
import { validateSql } from "@/lib/floatchat/sqlValidator";
import { resolveTerms } from "@/lib/floatchat/termResolver";
import { TERM_DEFINITIONS } from "./termDefinitions.fixture";

const okExec = async () => ({ ok: true as const, rows: [{ n: 1 }], ms: 1 });

describe("generate-validate loop", () => {
  it("feeds the validation error back and succeeds on attempt 3", async () => {
    const outputs = ["DELETE FROM floats", "SELECT * FROM query_log", "SELECT count(*) AS n FROM floats"];
    const seen: string[][] = [];
    const r = await generateValidateExecute({
      firstPrompt: "q",
      maxAttempts: 3,
      execute: okExec,
      generate: async (messages) => {
        seen.push(messages.map((m) => m.content));
        return outputs[seen.length - 1]!;
      },
    });
    expect(r.final).not.toBeNull();
    expect(r.attempts.map((a) => a.stage)).toEqual(["validate", "validate", "ok"]);
    expect(seen[1]!.at(-1)).toMatch(/validator rejected that SQL: Only SELECT/);
    expect(seen[2]!.at(-1)).toMatch(/Table "query_log" is not allowed/);
  });

  it("stops after exactly 3 failed attempts", async () => {
    let calls = 0;
    const r = await generateValidateExecute({ firstPrompt: "q", maxAttempts: 3, execute: okExec, generate: async () => { calls++; return "DROP TABLE floats"; } });
    expect(calls).toBe(3);
    expect(r.final).toBeNull();
    expect(r.failureReason).toMatch(/No valid SQL after 3 LLM attempts/);
  });

  it("feeds database errors back too", async () => {
    let n = 0;
    const r = await generateValidateExecute({
      firstPrompt: "q", maxAttempts: 3,
      execute: async () => (n++ === 0 ? { ok: false as const, error: 'column "depth" does not exist' } : { ok: true as const, rows: [], ms: 1 }),
      generate: async (m) => (m.length === 1 ? "SELECT count(*) FROM floats f WHERE f.depth > 1" : "SELECT count(*) FROM floats"),
    });
    expect(r.attempts.map((a) => a.stage)).toEqual(["execute", "ok"]);
  });

  it("marks terminal generator errors (e.g. no credits) so the pipeline falls back", async () => {
    const r = await generateValidateExecute({ firstPrompt: "q", maxAttempts: 3, execute: okExec, generate: async () => { throw new GenerationError("HTTP 402: out of credits", true); } });
    expect(r.attempts).toHaveLength(1);
    expect(r.generatorTerminal).toBe(true);
    expect(r.failureReason).toMatch(/402/);
  });
});

describe("rule-based fallback SQL", () => {
  it.each([
    "What is the average surface temperature near the equator?",
    "Compare salinity between the Arabian Sea and Bay of Bengal",
    "What is the real-time vs delayed-mode data distribution?",
    "Which floats recorded the highest salinity in deep water?",
    "Show recent profiles in the tropics",
    "Show thermocline temperatures",
  ])("passes the validator: %s", (q) => {
    const sql = buildFallbackSql(q, resolveTerms(q, TERM_DEFINITIONS));
    const v = validateSql(sql);
    expect(v.ok ? null : v.error).toBeNull();
  });
});
