// @vitest-environment node
// Live checks against the real backend. Skipped unless SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
// (server-side env only). The /api/ask checks also need the app running at FLOATCHAT_BASE_URL (default localhost:8080).
import { describe, it, expect, beforeAll } from "vitest";
import { TERM_DEFINITIONS } from "./termDefinitions.fixture";
import { buildFallbackSql } from "@/lib/floatchat/fallbackSql";
import { validateSql } from "@/lib/floatchat/sqlValidator";
import { resolveTerms } from "@/lib/floatchat/termResolver";
import { checkAnswer, countSentences } from "@/lib/floatchat/answer";

const URL = process.env["SUPABASE_URL"];
const KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const BASE = process.env["FLOATCHAT_BASE_URL"] ?? "http://localhost:8080";
const live = Boolean(URL && KEY);

const headers = () => ({ apikey: KEY!, "Content-Type": "application/json", ...(KEY!.startsWith("sb_") ? {} : { Authorization: `Bearer ${KEY}` }) });

async function execRpc(query: string, max_rows = 50) {
  const r = await fetch(`${URL}/rest/v1/rpc/floatchat_exec_select`, { method: "POST", headers: headers(), body: JSON.stringify({ query, max_rows }) });
  return { status: r.status, body: await r.json() };
}

describe.skipIf(!live)("read-only executor (live database)", () => {
  it("runs as the read-only role in a read-only transaction with an 8s timeout", async () => {
    const r = await execRpc("select current_user as who, current_setting('transaction_read_only') as ro, current_setting('statement_timeout') as st");
    console.log("executor session:", JSON.stringify(r.body));
    expect(r.status).toBe(200);
    expect(r.body[0]).toEqual({ who: "floatchat_readonly", ro: "on", st: "8s" });
  });

  it.each([
    "insert into public.floats(float_id) values ('WRITE_TEST') returning float_id",
    "update public.profiles set data_mode = 'D' where profile_id is not null returning profile_id",
    "delete from public.measurements where measurement_id > 0 returning measurement_id",
  ])("a write attempt fails: %s", async (sql) => {
    const r = await execRpc(sql);
    console.log("write attempt ->", r.status, r.body.code, r.body.message);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.body.code).toBe("25006");
  });

  it("cannot read tables outside its grant", async () => {
    const r = await execRpc("select count(*) from public.query_log");
    console.log("query_log read ->", r.status, r.body.code, r.body.message);
    expect(r.body.code).toBe("42501");
  });

  it("enforces the statement timeout", async () => {
    const t = Date.now();
    const r = await execRpc("select pg_sleep(12)");
    console.log("pg_sleep(12) ->", r.status, r.body.code, r.body.message, `${Date.now() - t}ms`);
    expect(r.body.code).toBe("57014");
    expect(Date.now() - t).toBeLessThan(11000);
  }, 20000);

  it("the write was really not applied", async () => {
    const r = await fetch(`${URL}/rest/v1/floats?float_id=eq.WRITE_TEST&select=float_id`, { headers: headers() });
    expect(await r.json()).toEqual([]);
  });

  it("term_definitions in the database match the test fixture", async () => {
    const r = await fetch(`${URL}/rest/v1/term_definitions?select=term_id,phrases,sql_condition,threshold_source&order=term_id`, { headers: headers() });
    const db = (await r.json()) as Array<{ term_id: string; phrases: string[]; sql_condition: string; threshold_source: string | null }>;
    const fx = TERM_DEFINITIONS.map((d) => ({ term_id: d.term_id, phrases: d.phrases, sql_condition: d.sql_condition, threshold_source: d.threshold_source })).sort((a, b) => a.term_id.localeCompare(b.term_id));
    expect(db).toEqual(fx);
  });

  it("rule-based fallback SQL validates and runs on real data", async () => {
    const q = "Compare salinity between the Arabian Sea and Bay of Bengal";
    const v = validateSql(buildFallbackSql(q, resolveTerms(q, TERM_DEFINITIONS)));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const r = await execRpc(v.sql, v.limit);
    console.log("fallback rows:", JSON.stringify(r.body));
    expect(r.status).toBe(200);
    expect(r.body.map((x: { region: string }) => x.region).sort()).toEqual(["Arabian Sea", "Bay of Bengal"]);
  });
});

describe.skipIf(!live)("/api/ask end-to-end (live app + LLM)", () => {
  let reachable = false;
  beforeAll(async () => {
    reachable = await fetch(`${BASE}/api/terms`).then((r) => r.ok).catch(() => false);
  });

  const ask = async (question: string) => {
    const r = await fetch(`${BASE}/api/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
    return { status: r.status, body: await r.json() };
  };

  it.each([
    "What is the average surface temperature near the equator?",
    "How many recent profiles are in the tropics, by data mode?",
    "Which floats recorded the highest salinity in deep water?",
  ])("answers with provenance and logs the request: %s", async (question) => {
    if (!reachable) return;
    const { status, body } = await ask(question);
    console.log(JSON.stringify({
      question,
      executionPath: body.executionPath,
      fallbackReason: body.fallbackReason,
      model: body.model,
      attempts: body.attempts?.map((a: { attempt: unknown; stage: string; error: string | null }) => `${a.attempt}:${a.stage}${a.error ? ` (${a.error})` : ""}`),
      interpretations: body.interpretations,
      sql: body.sql,
      answer: body.answer,
      answerPath: body.answerPath,
      provenance: body.provenance && {
        rowCount: body.provenance.rowCount, profileCount: body.provenance.profileCount, floatCount: body.provenance.floatCount,
        cycleCount: body.provenance.cycleCount, modeSummary: body.provenance.modeSummary, method: body.provenance.method,
        firstFloats: body.provenance.cycles.slice(0, 3),
      },
      queryLogId: body.queryLogId,
    }, null, 2));
    expect(status).toBe(200);
    expect(["LLM", "RULE_BASED_FALLBACK"]).toContain(body.executionPath);
    if (body.executionPath === "RULE_BASED_FALLBACK") expect(body.fallbackReason).toBeTruthy();
    expect(body.attempts.filter((a: { source: string }) => a.source === "LLM").length).toBeLessThanOrEqual(3);
    expect(validateSql(body.sql).ok).toBe(true);
    const n = countSentences(body.answer);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(4);
    for (const id of body.provenance.floatIds) expect(body.answer).not.toContain(id);
    const m = body.provenance.modeSummary;
    expect(m.R + m.A + m.D).toBe(body.provenance.profileCount);
    const log = await fetch(`${URL}/rest/v1/query_log?id=eq.${body.queryLogId}&select=question,execution_path,final_sql,status`, { headers: headers() }).then((r) => r.json());
    expect(log[0]).toMatchObject({ question, execution_path: body.executionPath, final_sql: body.sql, status: "ok" });
  }, 120000);

  it("rejects an empty question", async () => {
    if (!reachable) return;
    const { status, body } = await ask("   ");
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/);
  });
});

// Keep checkAnswer imported for parity with the server guard used on live answers.
void checkAnswer;
