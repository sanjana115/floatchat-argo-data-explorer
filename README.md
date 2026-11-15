# Floatchat Argo Data Explorer

Keep the existing UI theme, layout, map and chat. Implement the backend with Supabase Postgres and edge functions. Do not invent data.

Schema: floats, cycles, profiles (with data_mode R/A/D, position_qc, data_source 'real'|'synthetic', source_file), measurements (pressure, temperature, salinity, pres_qc, temp_qc, psal_qc, is_adjusted), term_definitions, query_log.

Edge function /ask pipeline:

1. Term resolver reading term_definitions (case-insensitive, longest phrase first; terms: near the equator, tropics, recent, surface, deep water, thermocline, Arabian Sea, Bay of Bengal; label unsourced thresholds PROJECT ASSUMPTION). Show a plain-language interpretation line per term.

2. LLM generates exactly one SELECT. Use <Lovable AI | my own Gemini key> (tell me which and name the model you used; do not guess model names).

3. Validator: exactly one statement, SELECT only, table whitelist, enforce a row LIMIT, reject unsafe functions, and enforce the hierarchy (measurements must join through profiles; float IDs via cycles). Reject anything it cannot parse.

4. Execute through a read-only database role (or a restricted function) with a statement timeout. Prove a write attempt fails.

5. Provenance: distinct float IDs, cycle numbers, profile count, mode summary over DISTINCT profiles; run a second validated query if identifiers are missing.

6. Max 3 generate-validate attempts (send the validation error back to the LLM). Record executionPath ("LLM" or "RULE_BASED_FALLBACK") with a reason, and log every request in query_log (no secrets).

7. Answer text: 2 to 4 short plain-language sentences for a non-expert, answer first, numbers computed only from returned rows, no IDs or jargon in the main text (those go in the evidence panels).

Show real tests with actual output.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8310c7e9-091e-4a05-8f50-32ac515ef82e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
