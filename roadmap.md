# Roadmap
- [x] Schema: floats, cycles, profiles, measurements, term_definitions, query_log
- [x] Load real Argo NetCDF files (8 files → 1,013 floats, 1,125 profiles, 730,547 levels)
- [x] Term resolver from term_definitions with PROJECT ASSUMPTION labels
- [x] LLM SQL (Lovable AI, openai/gpt-6-astra), validator, 3-attempt loop, rule-based fallback
- [x] Read-only executor with statement timeout; write attempts proven to fail
- [x] Provenance (floats, cycles, profiles, mode summary) with second validated query
- [x] Plain-language answer with number guard; query_log for every request
- [x] Port original UI; replace invented numbers with real stats
- [x] Unit + live integration tests
