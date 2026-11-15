-- Per-profile level summary (surface values, depth, level count), refreshed after loads/imports.
CREATE MATERIALIZED VIEW public.profile_level_summary AS
SELECT
  p.profile_id,
  (SELECT m.temperature FROM public.measurements m WHERE m.profile_id = p.profile_id AND m.temperature IS NOT NULL ORDER BY m.pressure ASC LIMIT 1) AS surface_temp,
  (SELECT m.salinity FROM public.measurements m WHERE m.profile_id = p.profile_id AND m.salinity IS NOT NULL ORDER BY m.pressure ASC LIMIT 1) AS surface_salinity,
  (SELECT max(m.pressure) FROM public.measurements m WHERE m.profile_id = p.profile_id) AS max_depth,
  (SELECT count(*) FROM public.measurements m WHERE m.profile_id = p.profile_id) AS n_levels
FROM public.profiles p
WITH DATA;
CREATE UNIQUE INDEX profile_level_summary_pk ON public.profile_level_summary (profile_id);
GRANT SELECT ON public.profile_level_summary TO anon, authenticated, service_role;

-- QC flag tallies (NULL flag kept as NULL; the app shows it as "unknown").
CREATE MATERIALIZED VIEW public.qc_flag_counts AS
SELECT 'measurement'::text AS kind, pres_qc, temp_qc, psal_qc, NULL::smallint AS position_qc, count(*)::bigint AS n
FROM public.measurements GROUP BY pres_qc, temp_qc, psal_qc
UNION ALL
SELECT 'profile'::text, NULL, NULL, NULL, position_qc, count(*)::bigint
FROM public.profiles GROUP BY position_qc
WITH DATA;
GRANT SELECT ON public.qc_flag_counts TO anon, authenticated, service_role;

-- Map view now reads the precomputed per-profile summary (same columns as before).
CREATE OR REPLACE VIEW public.map_profiles WITH (security_invoker = true) AS
SELECT
  p.profile_id, p.latitude, p.longitude, p.profile_time, p.data_mode, p.position_qc,
  p.data_source, p.source_file, p.direction,
  c.cycle_number, c.float_id, c.float_id AS wmo_number,
  f.platform_type, f.data_centre AS country, f.project_name, f.pi_name,
  s.surface_temp, s.surface_salinity, s.max_depth, s.n_levels
FROM public.profiles p
JOIN public.cycles c ON c.cycle_id = p.cycle_id
JOIN public.floats f ON f.float_id = c.float_id
LEFT JOIN public.profile_level_summary s ON s.profile_id = p.profile_id;
GRANT SELECT ON public.map_profiles TO anon, authenticated, service_role;

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
      FROM qc_flag_counts WHERE kind = 'measurement'), '[]'::jsonb),
    'position_flags', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('position_qc', position_qc, 'n', n))
      FROM qc_flag_counts WHERE kind = 'profile'), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.floatchat_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_floats', (SELECT count(*) FROM floats),
    'total_cycles', (SELECT count(*) FROM cycles),
    'total_profiles', (SELECT count(*) FROM profiles),
    'total_measurements', (SELECT COALESCE(sum(n), 0) FROM qc_flag_counts WHERE kind = 'measurement'),
    'profiles_by_mode', COALESCE((SELECT jsonb_object_agg(data_mode, n) FROM (SELECT data_mode, count(*) n FROM profiles GROUP BY 1) s), '{}'::jsonb),
    'measurements_by_mode', COALESCE((SELECT jsonb_object_agg(data_mode, n) FROM (SELECT p.data_mode, sum(s.n_levels) n FROM profiles p JOIN profile_level_summary s ON s.profile_id = p.profile_id GROUP BY 1) s), '{}'::jsonb),
    'profiles_by_source', COALESCE((SELECT jsonb_object_agg(data_source, n) FROM (SELECT data_source, count(*) n FROM profiles GROUP BY 1) s), '{}'::jsonb),
    'earliest_date', (SELECT min(profile_time) FROM profiles),
    'latest_date', (SELECT max(profile_time) FROM profiles),
    'source_files', COALESCE((SELECT jsonb_agg(f ORDER BY f) FROM (SELECT DISTINCT source_file f FROM profiles) s), '[]'::jsonb)
  );
$$;

-- Server-only refresh after a data load or import.
CREATE OR REPLACE FUNCTION public.floatchat_refresh_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.profile_level_summary;
  REFRESH MATERIALIZED VIEW public.qc_flag_counts;
END;
$$;
REVOKE ALL ON FUNCTION public.floatchat_refresh_summaries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.floatchat_refresh_summaries() TO service_role;