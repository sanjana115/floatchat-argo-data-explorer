// Generate -> validate -> execute loop with error feedback. Pure: the generator and executor are injected.
import { validateSql, type ValidationOk } from "./sqlValidator";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type Row = Record<string, unknown>;
export type ExecResult = { ok: true; rows: Row[]; ms: number } | { ok: false; error: string };

export interface Attempt {
  attempt: number | "fallback";
  source: "LLM" | "RULE_BASED_FALLBACK";
  generatedSql: string | null;
  executedSql: string | null;
  stage: "generate" | "validate" | "execute" | "ok";
  error: string | null;
}

export class GenerationError extends Error {
  constructor(message: string, public terminal: boolean) {
    super(message);
  }
}

export interface LoopResult {
  final: { v: ValidationOk; rows: Row[]; ms: number } | null;
  attempts: Attempt[];
  /** Why the loop ended without a result (null when it succeeded). */
  failureReason: string | null;
  /** True when the generator failed in a way that rules out further LLM calls (e.g. 402). */
  generatorTerminal: boolean;
}

export async function generateValidateExecute(opts: {
  generate: (messages: ChatTurn[]) => Promise<string>;
  execute: (sql: string, limit: number) => Promise<ExecResult>;
  firstPrompt: string;
  maxAttempts: number;
}): Promise<LoopResult> {
  const messages: ChatTurn[] = [{ role: "user", content: opts.firstPrompt }];
  const attempts: Attempt[] = [];
  for (let i = 1; i <= opts.maxAttempts; i++) {
    let generated: string;
    try {
      generated = await opts.generate(messages);
    } catch (e) {
      const terminal = e instanceof GenerationError ? e.terminal : false;
      const reason = `LLM call failed: ${(e as Error).message}`;
      attempts.push({ attempt: i, source: "LLM", generatedSql: null, executedSql: null, stage: "generate", error: reason });
      return { final: null, attempts, failureReason: reason, generatorTerminal: terminal };
    }
    const v = validateSql(generated);
    if (!v.ok) {
      attempts.push({ attempt: i, source: "LLM", generatedSql: generated, executedSql: null, stage: "validate", error: v.error });
      messages.push({ role: "assistant", content: generated }, { role: "user", content: `The validator rejected that SQL: ${v.error}\nReturn one corrected SELECT only.` });
      continue;
    }
    const ex = await opts.execute(v.sql, v.limit);
    if (!ex.ok) {
      attempts.push({ attempt: i, source: "LLM", generatedSql: generated, executedSql: v.sql, stage: "execute", error: ex.error });
      messages.push({ role: "assistant", content: generated }, { role: "user", content: `The database rejected that SQL: ${ex.error}\nReturn one corrected SELECT only.` });
      continue;
    }
    attempts.push({ attempt: i, source: "LLM", generatedSql: generated, executedSql: v.sql, stage: "ok", error: null });
    return { final: { v, rows: ex.rows, ms: ex.ms }, attempts, failureReason: null, generatorTerminal: false };
  }
  return {
    final: null,
    attempts,
    failureReason: `No valid SQL after ${opts.maxAttempts} LLM attempts. Last error: ${attempts[attempts.length - 1]?.error ?? "unknown"}`,
    generatorTerminal: false,
  };
}
