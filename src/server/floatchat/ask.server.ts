// /api/ask pipeline: terms -> LLM SQL (max 3 attempts) or rule-based fallback -> validator ->
// read-only execution -> provenance -> plain-language answer -> query_log.
import type { ModelMessage } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveTerms, interpretationLines, usesQualityFilter, QUALITY_INTERPRETATION, type ResolvedTerm, type TermDefinition } from "@/lib/floatchat/termResolver";
import { validateSql, type ValidationOk } from "@/lib/floatchat/sqlValidator";
import { buildFallbackSql } from "@/lib/floatchat/fallbackSql";
import {
  summarize, rowsHaveIdentifiers, provenanceSqlForProfileIds, provenanceSqlFromFilters,
  PROVENANCE_LIMIT, type Provenance, type ProvenanceRow,
} from "@/lib/floatchat/provenance";
import { computeFacts, checkAnswer, templateAnswer } from "@/lib/floatchat/answer";
import { SQL_INSTRUCTIONS, sqlUserPrompt, ANSWER_INSTRUCTIONS, answerUserPrompt } from "@/lib/floatchat/prompts";
import { createGateway, streamToText, LlmError, FLOATCHAT_MODEL, type Gateway } from "./llm.server";
import { generateValidateExecute, GenerationError, type Attempt, type ExecResult } from "@/lib/floatchat/generationLoop";

export const MAX_LLM_ATTEMPTS = 3;
type Row = Record<string, unknown>;

const BodySchema = z.object({ question: z.string().trim().min(1, "Question is required").max(500, "Question is too long (max 500 characters)") });

async function execSelect(sql: string, maxRows: number): Promise<ExecResult> {
  const t = Date.now();
  const { data, error } = await supabaseAdmin.rpc("floatchat_exec_select", { query: sql, max_rows: maxRows });
  if (error) return { ok: false, error: `${error.code ?? ""} ${error.message}`.trim() };
  return { ok: true, rows: (data as Row[]) ?? [], ms: Date.now() - t };
}

function recommendChart(question: string, rows: Row[]): "temp_depth" | "sal_depth" | "ts_diagram" | "time_series" | "none" {
  const q = question.toLowerCase();
  const has = (k: string) => rows[0] !== undefined && k in rows[0];
  if (!has("pressure") && !(has("temperature") && has("salinity"))) return "none";
  if (/t-s|diagram/.test(q) || (/temperature/.test(q) && /salinity/.test(q) && has("temperature") && has("salinity"))) return "ts_diagram";
  if (/salin/.test(q) && has("salinity") && has("pressure")) return "sal_depth";
  if (has("temperature") && has("pressure")) return "temp_depth";
  if (has("salinity") && has("pressure")) return "sal_depth";
  return "none";
}

async function buildProvenance(v: ValidationOk, rows: Row[]): Promise<Provenance> {
  if (rowsHaveIdentifiers(rows)) {
    return summarize(rows as unknown as ProvenanceRow[], rows.length, {
      scope: "Profiles that appear in the returned results.", method: "FROM_RESULT_ROWS", provenanceSql: null, truncated: false,
    });
  }
  const profileIds = rows.map((r) => r["profile_id"]).filter((x): x is string => typeof x === "string");
  let sql: string | null;
  let method: Provenance["method"];
  let scope: string;
  if (profileIds.length > 0) {
    sql = provenanceSqlForProfileIds(profileIds);
    method = "SECOND_QUERY_BY_IDS";
    scope = "Profiles that appear in the returned results (identifiers looked up with a second query).";
  } else {
    const floatIds = rows.map((r) => r["float_id"]).filter((x): x is string => typeof x === "string");
    sql = provenanceSqlFromFilters(v.ast, floatIds);
    method = "SECOND_QUERY_BY_FILTERS";
    scope = floatIds.length
      ? "All profiles matching the question's filters for the floats in the results (second query)."
      : "All profiles matching the question's filters that the summary was computed from (second query).";
  }
  if (!sql) return summarize([], rows.length, { scope: "No profile identifiers available for this result.", method: "NONE", provenanceSql: null, truncated: false });
  const pv = validateSql(sql, { maxLimit: PROVENANCE_LIMIT });
  if (!pv.ok) throw new Error(`Provenance query failed validation: ${pv.error}`);
  const ex = await execSelect(pv.sql, PROVENANCE_LIMIT);
  if (!ex.ok) throw new Error(`Provenance query failed: ${ex.error}`);
  return summarize(ex.rows as unknown as ProvenanceRow[], rows.length, { scope, method, provenanceSql: pv.sql, truncated: ex.rows.length >= PROVENANCE_LIMIT });
}

function qcBreakdown(rows: Row[]) {
  const first = rows[0];
  const col = first && "temp_qc" in first ? "temp_qc" : first && "psal_qc" in first ? "psal_qc" : null;
  if (!col) return null;
  const out = { column: col, good: 0, probably_good: 0, other: 0, missing: 0 };
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) out.missing++;
    else if (v === 1) out.good++;
    else if (v === 2) out.probably_good++;
    else out.other++;
  }
  return out;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function handleAsk(request: Request): Promise<Response> {
  const t0 = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be JSON: { question }" }, 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);
  const question = parsed.data.question;

  const attempts: Attempt[] = [];
  let terms: ResolvedTerm[] = [];
  let interpretation: string[] = [];
  let executionPath: "LLM" | "RULE_BASED_FALLBACK" = "LLM";
  let fallbackReason: string | null = null;
  let modelUsed: string | null = null;
  let final: { v: ValidationOk; rows: Row[]; ms: number } | null = null;

  const log = async (row: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin
      .from("query_log")
      .insert({
        question,
        resolved_terms: terms as never,
        execution_path: executionPath,
        fallback_reason: fallbackReason,
        model: modelUsed,
        attempts: attempts as never,
        duration_ms: Date.now() - t0,
        ...row,
      })
      .select("id")
      .single();
    if (error) console.error("query_log insert failed:", error.message);
    return data?.id ?? null;
  };

  try {
    const { data: defs, error: defsErr } = await supabaseAdmin.from("term_definitions").select("*");
    if (defsErr) throw new Error(`Could not load term definitions: ${defsErr.message}`);
    terms = resolveTerms(question, (defs ?? []) as TermDefinition[]);
    interpretation = interpretationLines(terms);

    // 1) LLM generate -> validate -> execute, up to 3 attempts with error feedback.
    const apiKey = process.env["LOVABLE_API_KEY"];
    let gw: Gateway | null = null;
    let llmUsable = Boolean(apiKey);
    if (!apiKey) fallbackReason = "LLM unavailable: LOVABLE_API_KEY is not configured.";
    else {
      gw = createGateway(apiKey);
      modelUsed = FLOATCHAT_MODEL;
      const g = gw;
      const loop = await generateValidateExecute({
        firstPrompt: sqlUserPrompt(question, terms),
        maxAttempts: MAX_LLM_ATTEMPTS,
        execute: execSelect,
        generate: async (messages) => {
          try {
            return await streamToText(g, SQL_INSTRUCTIONS, messages as ModelMessage[], request.signal);
          } catch (e) {
            const err = e instanceof LlmError ? e : new LlmError(String(e), null);
            throw new GenerationError(`${err.status ? `HTTP ${err.status}: ` : ""}${err.message}`, err.terminal);
          }
        },
      });
      attempts.push(...loop.attempts);
      final = loop.final;
      fallbackReason = loop.failureReason;
      if (loop.generatorTerminal) llmUsable = false;
    }

    // 2) Rule-based fallback, validated and executed the same way.
    if (!final) {
      executionPath = "RULE_BASED_FALLBACK";
      const generated = buildFallbackSql(question, terms);
      const v = validateSql(generated);
      if (!v.ok) {
        attempts.push({ attempt: "fallback", source: "RULE_BASED_FALLBACK", generatedSql: generated, executedSql: null, stage: "validate", error: v.error });
        throw new Error(`Fallback query failed validation: ${v.error}`);
      }
      const ex = await execSelect(v.sql, v.limit);
      if (!ex.ok) {
        attempts.push({ attempt: "fallback", source: "RULE_BASED_FALLBACK", generatedSql: generated, executedSql: v.sql, stage: "execute", error: ex.error });
        throw new Error(`Fallback query failed: ${ex.error}`);
      }
      attempts.push({ attempt: "fallback", source: "RULE_BASED_FALLBACK", generatedSql: generated, executedSql: v.sql, stage: "ok", error: null });
      final = { v, rows: ex.rows, ms: ex.ms };
    }

    if (usesQualityFilter(final.v.sql)) interpretation = [...interpretation, QUALITY_INTERPRETATION];

    // 3) Provenance.
    const provenance = await buildProvenance(final.v, final.rows);

    // 4) Answer text from computed facts only.
    const facts = computeFacts(final.rows, provenance);
    let answer = "";
    let answerPath: "LLM" | "TEMPLATE" = "TEMPLATE";
    let answerNote: string | null = null;
    if (gw && llmUsable) {
      const messages: ModelMessage[] = [{ role: "user", content: answerUserPrompt(question, interpretation, facts) }];
      for (let i = 0; i < 2 && answerPath !== "LLM"; i++) {
        try {
          const text = await streamToText(gw, ANSWER_INSTRUCTIONS, messages, request.signal);
          const problem = checkAnswer(text, facts, interpretation);
          if (!problem) {
            answer = text;
            answerPath = "LLM";
            answerNote = null;
          } else {
            answerNote = `LLM answer rejected: ${problem}`;
            messages.push({ role: "assistant", content: text }, { role: "user", content: `Rejected: ${problem}. Rewrite following the rules.` });
          }
        } catch (e) {
          answerNote = `LLM answer unavailable: ${(e as Error).message}`;
          break;
        }
      }
    } else {
      answerNote = "LLM not used for the answer (unavailable for this request).";
    }
    if (answerPath === "TEMPLATE") answer = templateAnswer(facts);

    const provenanceOut = { ...provenance, executionTimeMs: final.ms, qcBreakdown: qcBreakdown(final.rows) };
    const queryLogId = await log({
      final_sql: final.v.sql,
      provenance_sql: provenance.provenanceSql,
      row_count: final.rows.length,
      provenance: { ...provenance, profileIds: provenance.profileIds.slice(0, 500) },
      answer,
      answer_path: answerPath,
      status: "ok",
    });

    return json({
      question,
      answer,
      answerPath,
      answerNote,
      interpretations: interpretation,
      resolvedTerms: terms,
      sql: final.v.sql,
      executionPath,
      fallbackReason,
      model: modelUsed,
      attempts,
      provenance: provenanceOut,
      rows: final.rows,
      recommendedChart: recommendChart(question, final.rows),
      queryLogId,
      durationMs: Date.now() - t0,
    });
  } catch (e) {
    const message = (e as Error).message ?? "Unknown error";
    const queryLogId = await log({ status: "error", error: message }).catch(() => null);
    return json({ error: message, executionPath, fallbackReason, attempts, interpretations: interpretation, resolvedTerms: terms, queryLogId }, 500);
  }
}
