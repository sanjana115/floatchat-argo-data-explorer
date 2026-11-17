<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## FloatChat architecture
- `/api/ask` is a TanStack server route (`src/routes/api/ask.ts` → `src/server/floatchat/ask.server.ts`), not a Supabase Edge Function — this stack runs server code on the Worker.
- `/api/ask` accepts `mode: "rules"` (Settings → Query Method) to skip the LLM for both SQL and answer and run the rule-based fallback; it is the only way to exercise that path on demand, so keep it.
- AI-generated SQL only runs through `public.floatchat_exec_select` (read-only role `floatchat_readonly`, read-only transaction, 8s timeout, service_role only); never execute LLM SQL any other way.
- The executed SQL is the re-serialised AST from `src/lib/floatchat/sqlValidator.ts`, so what was validated is exactly what runs; keep validator, prompt rules and fallback SQL in sync.
- Pipeline logic stays in pure modules under `src/lib/floatchat/` (terms, validator, loop, provenance, answer guard) so it is unit-testable; server files only wire I/O.
- Term meanings live in `public.term_definitions` columns `term`, `rule_text`, `sql_fragment`, `source_note` (older label/plain_language/sql_condition/threshold_source are deprecated); a source_note containing PROJECT ASSUMPTION (or empty) marks the threshold as an assumption. `src/test/floatchat/termDefinitions.fixture.ts` must mirror the table (the live test checks this).
- Dashboard figures read precomputed materialized views (`profile_level_summary`, `qc_flag_counts`); call `floatchat_refresh_summaries()` (service role) after any data load or import so they stay in step.
- QC flags are summarised by `src/lib/floatchat/qc.ts`; a missing flag or flag 0 is always `unknown`, never good.
- `query_log` is written via `log_id`, `asked_at`, `generated_sql`, `validator_ok`, `attempt_count`, `execution_ms`, `error_message` (id/created_at/final_sql/error are deprecated).
- Argo data is loaded with `scripts/ingest_argo.py` from NetCDF files; R mode uses raw values, A/D mode uses *_ADJUSTED values and flags.
- The original UI lives in `src/floatchat/` and is loaded client-only from `/` because Leaflet/Plotly need `window`.
- Argo tables (floats, cycles, profiles, measurements), their summaries and map_profiles are not readable by anon/authenticated; browsers reach them only through the fixed server endpoints in `data.server.ts` (service client) or `floatchat_exec_select` — never re-add public read policies.
