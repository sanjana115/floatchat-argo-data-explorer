// Lovable AI Gateway (OpenAI Responses API) — server only. LOVABLE_API_KEY never leaves the server.
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { createLovableAiGatewayRunIdFetch } from "./run-id";

/** Exact model id, confirmed in the authenticated gateway model listing. */
export const FLOATCHAT_MODEL = "openai/gpt-6-astra";
const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";

export class LlmError extends Error {
  constructor(message: string, public status: number | null) {
    super(message);
  }
  /** 401/402/403: credentials, credits or policy — further calls in this request will not succeed. */
  get terminal() {
    return this.status === 401 || this.status === 402 || this.status === 403;
  }
}

function toLlmError(e: unknown): LlmError {
  if (e instanceof LlmError) return e;
  const err = e as { statusCode?: number; message?: string; cause?: unknown; responseBody?: string };
  const status = typeof err?.statusCode === "number" ? err.statusCode : null;
  let message = err?.message ?? String(e);
  if (err?.responseBody) {
    try {
      const body = JSON.parse(err.responseBody);
      message = body?.error?.message ?? body?.message ?? message;
    } catch {
      /* keep message */
    }
  }
  return new LlmError(message.slice(0, 300), status);
}

export function createGateway(apiKey: string, runId?: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(runId);
  const provider = createOpenAI({
    baseURL: GATEWAY_BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { model: provider.responses(FLOATCHAT_MODEL), getRunId: runIdFetch.getRunId };
}

export type Gateway = ReturnType<typeof createGateway>;

/** Streams one Responses call and returns the final text. */
export async function streamToText(gw: Gateway, instructions: string, messages: ModelMessage[], signal?: AbortSignal): Promise<string> {
  let streamError: unknown = null;
  const result = streamText({
    model: gw.model,
    instructions,
    messages,
    ...(signal ? { abortSignal: signal } : {}),
    maxRetries: 2,
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text: string;
  try {
    text = await result.text;
  } catch (e) {
    throw toLlmError(streamError ?? e);
  }
  if (streamError) throw toLlmError(streamError);
  if (!text.trim()) throw new LlmError("The model returned an empty response.", null);
  return text.trim();
}
