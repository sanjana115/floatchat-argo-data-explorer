
-- ===== Core ARGO hierarchy =====
CREATE TABLE public.floats (
  float_id text PRIMARY KEY,
  platform_type text,
  wmo_inst_type text,
  project_name text,
  pi_name text,
  data_centre text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.floats TO anon, authenticated;
GRANT ALL ON public.floats TO service_role;
ALTER TABLE public.floats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cycles (
  cycle_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  float_id text NOT NULL REFERENCES public.floats(float_id) ON DELETE CASCADE,
  cycle_number integer NOT NULL,
  UNIQUE (float_id, cycle_number)
);
GRANT SELECT ON public.cycles TO anon, authenticated;
GRANT ALL ON public.cycles TO service_role;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
CREATE INDEX cycles_float_idx ON public.cycles(float_id);

CREATE TABLE public.profiles (
  profile_id text PRIMARY KEY,
  cycle_id bigint NOT NULL REFERENCES public.cycles(cycle_id) ON DELETE CASCADE,
  direction char(1) CHECK (direction IN ('A','D')),
  profile_time timestamptz,
  juld_qc smallint,
  latitude double precision,
  longitude double precision,
  position_qc smallint,
  data_mode char(1) NOT NULL CHECK (data_mode IN ('R','A','D')),
  data_source text NOT NULL CHECK (data_source IN ('real','synthetic')),
  source_file text NOT NULL,
  vertical_sampling_scheme text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX profiles_cycle_idx ON public.profiles(cycle_id);
CREATE INDEX profiles_time_idx ON public.profiles(profile_time);
CREATE INDEX profiles_latlon_idx ON public.profiles(latitude, longitude);

CREATE TABLE public.measurements (
  measurement_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id text NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  level_index integer NOT NULL,
  pressure double precision NOT NULL,
  temperature double precision,
  salinity double precision,
  pres_qc smallint,
  temp_qc smallint,
  psal_qc smallint,
  is_adjusted boolean NOT NULL,
  UNIQUE (profile_id, level_index)
);
GRANT SELECT ON public.measurements TO anon, authenticated;
GRANT ALL ON public.measurements TO service_role;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
CREATE INDEX measurements_profile_pressure_idx ON public.measurements(profile_id, pressure);
CREATE INDEX measurements_pressure_idx ON public.measurements(pressure);

-- ===== Term definitions =====
CREATE TABLE public.term_definitions (
  term_id text PRIMARY KEY,
  label text NOT NULL,
  phrases text[] NOT NULL,
  category text NOT NULL,
  sql_condition text NOT NULL,
  required_tables text[] NOT NULL,
  plain_language text NOT NULL,
  threshold_source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.term_definitions TO anon, authenticated;
GRANT ALL ON public.term_definitions TO service_role;
ALTER TABLE public.term_definitions ENABLE ROW LEVEL SECURITY;

-- ===== Query log (server only) =====
CREATE TABLE public.query_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  question text NOT NULL,
  resolved_terms jsonb,
  execution_path text CHECK (execution_path IN ('LLM','RULE_BASED_FALLBACK')),
  fallback_reason text,
  model text,
  attempts jsonb,
  final_sql text,
  provenance_sql text,
  row_count integer,
  provenance jsonb,
  answer text,
  answer_path text,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error')),
  error text,
  duration_ms integer
);
GRANT ALL ON public.query_log TO service_role;
ALTER TABLE public.query_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX query_log_created_idx ON public.query_log(created_at DESC);

-- ===== Read-only role for AI-generated SQL =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'floatchat_readonly') THEN
    CREATE ROLE floatchat_readonly NOLOGIN NOINHERIT;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO floatchat_readonly;
GRANT SELECT ON public.floats, public.cycles, public.profiles, public.measurements TO floatchat_readonly;
GRANT floatchat_readonly TO service_role;

-- Public read policies (Argo data is public); readonly role reads the same rows.
CREATE POLICY "Public read floats" ON public.floats FOR SELECT TO anon, authenticated, floatchat_readonly USING (true);
CREATE POLICY "Public read cycles" ON public.cycles FOR SELECT TO anon, authenticated, floatchat_readonly USING (true);
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO anon, authenticated, floatchat_readonly USING (true);
CREATE POLICY "Public read measurements" ON public.measurements FOR SELECT TO anon, authenticated, floatchat_readonly USING (true);
CREATE POLICY "Public read term definitions" ON public.term_definitions FOR SELECT TO anon, authenticated USING (true);

-- Restricted executor: switches to the read-only role, read-only transaction, statement timeout.
CREATE OR REPLACE FUNCTION public.floatchat_exec_select(query text, max_rows integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET statement_timeout = '8s'
SET search_path = public, pg_temp
AS $$
DECLARE
  rec record;
  result jsonb := '[]'::jsonb;
  n integer := 0;
BEGIN
  IF query IS NULL OR length(query) > 20000 THEN
    RAISE EXCEPTION 'query missing or too long';
  END IF;
  SET LOCAL transaction_read_only = on;
  SET LOCAL ROLE floatchat_readonly;
  FOR rec IN EXECUTE query LOOP
    n := n + 1;
    EXIT WHEN n > LEAST(GREATEST(max_rows, 1), 5000);
    result := result || jsonb_build_array(to_jsonb(rec));
  END LOOP;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.floatchat_exec_select(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.floatchat_exec_select(text, integer) TO service_role;

-- ===== Read helpers for the map/dashboard =====
CREATE VIEW public.map_profiles WITH (security_invoker = true) AS
SELECT
  p.profile_id, p.latitude, p.longitude, p.profile_time, p.data_mode, p.position_qc,
  p.data_source, p.source_file, p.direction,
  c.cycle_number, c.float_id, c.float_id AS wmo_number,
  f.platform_type, f.data_centre AS country, f.project_name, f.pi_name,
  s.surface_temp, s.surface_salinity, s.max_depth, s.n_levels
FROM public.profiles p
JOIN public.cycles c ON c.cycle_id = p.cycle_id
JOIN public.floats f ON f.float_id = c.float_id
LEFT JOIN LATERAL (
  SELECT
    (SELECT m.temperature FROM public.measurements m WHERE m.profile_id = p.profile_id AND m.temperature IS NOT NULL ORDER BY m.pressure ASC LIMIT 1) AS surface_temp,
    (SELECT m.salinity FROM public.measurements m WHERE m.profile_id = p.profile_id AND m.salinity IS NOT NULL ORDER BY m.pressure ASC LIMIT 1) AS surface_salinity,
    (SELECT max(m.pressure) FROM public.measurements m WHERE m.profile_id = p.profile_id) AS max_depth,
    (SELECT count(*) FROM public.measurements m WHERE m.profile_id = p.profile_id) AS n_levels
) s ON true;
GRANT SELECT ON public.map_profiles TO anon, authenticated, service_role;

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
    'total_measurements', (SELECT count(*) FROM measurements),
    'profiles_by_mode', COALESCE((SELECT jsonb_object_agg(data_mode, n) FROM (SELECT data_mode, count(*) n FROM profiles GROUP BY 1) s), '{}'::jsonb),
    'measurements_by_mode', COALESCE((SELECT jsonb_object_agg(data_mode, n) FROM (SELECT p.data_mode, count(*) n FROM measurements m JOIN profiles p ON p.profile_id = m.profile_id GROUP BY 1) s), '{}'::jsonb),
    'profiles_by_source', COALESCE((SELECT jsonb_object_agg(data_source, n) FROM (SELECT data_source, count(*) n FROM profiles GROUP BY 1) s), '{}'::jsonb),
    'earliest_date', (SELECT min(profile_time) FROM profiles),
    'latest_date', (SELECT max(profile_time) FROM profiles),
    'source_files', COALESCE((SELECT jsonb_agg(f ORDER BY f) FROM (SELECT DISTINCT source_file f FROM profiles) s), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.floatchat_stats() TO anon, authenticated, service_role;

-- ===== Seed term definitions (NULL threshold_source = PROJECT ASSUMPTION) =====
INSERT INTO public.term_definitions (term_id, label, phrases, category, sql_condition, required_tables, plain_language, threshold_source) VALUES
('near_the_equator', 'near the equator', ARRAY['near the equator','close to the equator','around the equator','equatorial'], 'geographic',
 'p.latitude BETWEEN -5 AND 5', ARRAY['profiles'],
 'Near the equator: profiles taken between 5° south and 5° north latitude.', NULL),
('tropics', 'tropics', ARRAY['the tropics','tropics','tropical'], 'geographic',
 'p.latitude BETWEEN -23.44 AND 23.44', ARRAY['profiles'],
 'Tropics: profiles between the Tropic of Capricorn (23.44° S) and the Tropic of Cancer (23.44° N).',
 'Tropics of Cancer and Capricorn lie at Earth''s axial tilt (obliquity of the ecliptic), about 23.44° N/S.'),
('recent', 'recent', ARRAY['most recent','recently','recent'], 'time',
 'p.profile_time >= (SELECT max(p2.profile_time) FROM profiles p2) - INTERVAL ''30 days''', ARRAY['profiles'],
 'Recent: profiles taken within 30 days of the newest profile stored in this database (not today''s date).', NULL),
('surface', 'surface', ARRAY['near-surface','near surface','sea surface','surface'], 'depth',
 'm.pressure <= 10', ARRAY['measurements'],
 'Surface: readings from the top 10 decibars of each profile (roughly the top 10 metres).', NULL),
('deep_water', 'deep water', ARRAY['deep waters','deep water','deep ocean'], 'depth',
 'm.pressure >= 1000', ARRAY['measurements'],
 'Deep water: readings at 1,000 decibars or deeper (roughly 1,000 metres and below).',
 'NOAA ocean zones: the bathypelagic ("midnight") zone begins at 1,000 m. Pressure in decibars is used as an approximation of depth in metres.'),
('thermocline', 'thermocline', ARRAY['thermocline'], 'depth',
 'm.pressure BETWEEN 100 AND 400', ARRAY['measurements'],
 'Thermocline: a fixed layer from 100 to 400 decibars (about 100–400 m), standing in for the layer where temperature drops fastest; the real depth varies by place and season.', NULL),
('arabian_sea', 'Arabian Sea', ARRAY['arabian sea'], 'geographic',
 'p.latitude BETWEEN 8 AND 26 AND p.longitude BETWEEN 52 AND 77.5', ARRAY['profiles'],
 'Arabian Sea: a simplified box from 8° N to 26° N and 52° E to 77.5° E.', NULL),
('bay_of_bengal', 'Bay of Bengal', ARRAY['bay of bengal'], 'geographic',
 'p.latitude BETWEEN 5 AND 23 AND p.longitude BETWEEN 80 AND 96', ARRAY['profiles'],
 'Bay of Bengal: a simplified box from 5° N to 23° N and 80° E to 96° E.', NULL);
