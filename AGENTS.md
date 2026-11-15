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
- AI-generated SQL only runs through `public.floatchat_exec_select` (read-only role `floatchat_readonly`, read-only transaction, 8s timeout, service_role only); never execute LLM SQL any other way.
- The executed SQL is the re-serialised AST from `src/lib/floatchat/sqlValidator.ts`, so what was validated is exactly what runs; keep validator, prompt rules and fallback SQL in sync.
- Pipeline logic stays in pure modules under `src/lib/floatchat/` (terms, validator, loop, provenance, answer guard) so it is unit-testable; server files only wire I/O.
- Term meanings live in `public.term_definitions` (NULL `threshold_source` = PROJECT ASSUMPTION); `src/test/floatchat/termDefinitions.fixture.ts` must mirror it (the live test checks this).
- Argo data is loaded with `scripts/ingest_argo.py` from NetCDF files; R mode uses raw values, A/D mode uses *_ADJUSTED values and flags.
- The original UI lives in `src/floatchat/` and is loaded client-only from `/` because Leaflet/Plotly need `window`.
