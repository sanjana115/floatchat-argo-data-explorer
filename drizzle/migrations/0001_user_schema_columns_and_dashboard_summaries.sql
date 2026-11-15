-- ===== profiles.ingested_at =====
ALTER TABLE public.profiles ADD COLUMN ingested_at timestamptz DEFAULT now();
UPDATE public.profiles SET ingested_at = created_at WHERE ingested_at IS DISTINCT FROM created_at;
ALTER TABLE public.profiles ALTER COLUMN ingested_at SET NOT NULL;
COMMENT ON COLUMN public.profiles.created_at IS 'DEPRECATED: replaced by ingested_at';

-- ===== term_definitions: user-specified columns =====
ALTER TABLE public.term_definitions
  ADD COLUMN term text,
  ADD COLUMN rule_text text,
  ADD COLUMN sql_fragment text,
  ADD COLUMN source_note text;

UPDATE public.term_definitions SET
  term = label,
  rule_text = plain_language,
  sql_fragment = sql_condition,
  source_note = CASE term_id
    WHEN 'tropics' THEN 'PROJECT ASSUMPTION — value confirmed by the project owner. Background: the Tropics of Cancer and Capricorn lie at about 23.44° N/S (Earth''s axial tilt).'
    WHEN 'deep_water' THEN 'PROJECT ASSUMPTION — value confirmed by the project owner. Background: NOAA ocean zones start the bathypelagic zone at 1,000 m; decibars are used as an approximation of metres.'
    ELSE 'PROJECT ASSUMPTION — value confirmed by the project owner; no external source.'
  END,
  updated_at = now()
WHERE term_id IN ('near_the_equator','tropics','recent','surface','deep_water','thermocline','arabian_sea','bay_of_bengal');

ALTER TABLE public.term_definitions ALTER COLUMN term SET NOT NULL;
ALTER TABLE public.term_definitions ALTER COLUMN rule_text SET NOT NULL;
ALTER TABLE public.term_definitions ALTER COLUMN sql_fragment SET NOT NULL;
ALTER TABLE public.term_definitions ALTER COLUMN source_note SET NOT NULL;
CREATE UNIQUE INDEX term_definitions_term_key ON public.term_definitions (lower(term));

COMMENT ON COLUMN public.term_definitions.label IS 'DEPRECATED: replaced by term';
COMMENT ON COLUMN public.term_definitions.plain_language IS 'DEPRECATED: replaced by rule_text';
COMMENT ON COLUMN public.term_definitions.sql_condition IS 'DEPRECATED: replaced by sql_fragment';
COMMENT ON COLUMN public.term_definitions.threshold_source IS 'DEPRECATED: replaced by source_note';

-- ===== query_log: user-specified columns =====
ALTER TABLE public.query_log
  ADD COLUMN log_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN asked_at timestamptz DEFAULT now(),
  ADD COLUMN generated_sql text,
  ADD COLUMN validator_ok boolean,
  ADD COLUMN attempt_count integer,
  ADD COLUMN execution_ms integer,
  ADD COLUMN error_message text;

UPDATE public.query_log SET
  log_id = id,
  asked_at = created_at,
  generated_sql = final_sql,
  validator_ok = (final_sql IS NOT NULL),
  attempt_count = CASE WHEN jsonb_typeof(attempts) = 'array' THEN jsonb_array_length(attempts) ELSE NULL END,
  error_message = error
WHERE id IS NOT NULL;

ALTER TABLE public.query_log ALTER COLUMN log_id SET NOT NULL;
ALTER TABLE public.query_log ALTER COLUMN asked_at SET NOT NULL;
CREATE UNIQUE INDEX query_log_log_id_key ON public.query_log (log_id);
CREATE INDEX query_log_asked_idx ON public.query_log (asked_at DESC);

COMMENT ON COLUMN public.query_log.id IS 'DEPRECATED: replaced by log_id';
COMMENT ON COLUMN public.query_log.created_at IS 'DEPRECATED: replaced by asked_at';
COMMENT ON COLUMN public.query_log.final_sql IS 'DEPRECATED: replaced by generated_sql';
COMMENT ON COLUMN public.query_log.error IS 'DEPRECATED: replaced by error_message';

-- ===== Dashboard summaries =====
-- QC flag tallies; NULL flags are returned as null and shown as "unknown" by the app.
CREATE OR REPLACE FUNCTION public.floatchat_qc_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'measurement_flags', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('pres_qc', pres_qc, 'temp_qc', temp_qc, 'psal_qc', psal_qc, 'n', n))
      FROM (SELECT pres_qc, temp_qc, psal_qc, count(*) AS n FROM measurements GROUP BY 1, 2, 3) s), '[]'::jsonb),
    'position_flags', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('position_qc', position_qc, 'n', n))
      FROM (SELECT position_qc, count(*) AS n FROM profiles GROUP BY 1) s), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.floatchat_qc_summary() TO anon, authenticated, service_role;

-- Per-region surface figures built from the region and surface rules stored in term_definitions.
CREATE OR REPLACE FUNCTION public.floatchat_region_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  surface_rule text;
  res jsonb;
  out jsonb := '[]'::jsonb;
BEGIN
  SELECT sql_fragment INTO surface_rule FROM term_definitions WHERE term_id = 'surface';
  IF surface_rule IS NULL THEN
    RETURN out;
  END IF;
  FOR r IN
    SELECT term_id, term, rule_text, source_note, sql_fragment
    FROM term_definitions
    WHERE term_id IN ('arabian_sea', 'bay_of_bengal', 'near_the_equator')
    ORDER BY array_position(ARRAY['arabian_sea', 'bay_of_bengal', 'near_the_equator'], term_id)
  LOOP
    EXECUTE format(
      'SELECT jsonb_build_object(
         ''term_id'', %L, ''term'', %L, ''rule_text'', %L, ''source_note'', %L,
         ''profiles'', (SELECT count(*) FROM profiles p WHERE %s),
         ''floats'', (SELECT count(DISTINCT c.float_id) FROM profiles p JOIN cycles c ON c.cycle_id = p.cycle_id WHERE %s),
         ''surface_readings'', count(*),
         ''avg_surface_temperature'', round((avg(m.temperature) FILTER (WHERE m.temp_qc IN (1, 2)))::numeric, 2),
         ''avg_surface_salinity'', round((avg(m.salinity) FILTER (WHERE m.psal_qc IN (1, 2)))::numeric, 3),
         ''min_surface_salinity'', round((min(m.salinity) FILTER (WHERE m.psal_qc IN (1, 2)))::numeric, 3),
         ''max_surface_salinity'', round((max(m.salinity) FILTER (WHERE m.psal_qc IN (1, 2)))::numeric, 3)
       )
       FROM profiles p JOIN measurements m ON m.profile_id = p.profile_id
       WHERE (%s) AND (%s) AND m.pres_qc IN (1, 2)',
      r.term_id, r.term, r.rule_text, r.source_note,
      r.sql_fragment, r.sql_fragment, r.sql_fragment, surface_rule
    ) INTO res;
    out := out || jsonb_build_array(res);
  END LOOP;
  RETURN out;
END;
$$;
GRANT EXECUTE ON FUNCTION public.floatchat_region_summary() TO anon, authenticated, service_role;