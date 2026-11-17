DROP POLICY IF EXISTS "Public read floats" ON public.floats;
DROP POLICY IF EXISTS "Public read cycles" ON public.cycles;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read measurements" ON public.measurements;

REVOKE ALL ON public.floats, public.cycles, public.profiles, public.measurements FROM anon, authenticated;
REVOKE ALL ON public.map_profiles, public.profile_level_summary, public.qc_flag_counts FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.floatchat_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.floatchat_qc_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.floatchat_region_summary() FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.map_profiles, public.profile_level_summary, public.qc_flag_counts TO service_role;
GRANT EXECUTE ON FUNCTION public.floatchat_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.floatchat_qc_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.floatchat_region_summary() TO service_role;

-- Only the read-only executor role (assumed inside service-role-only floatchat_exec_select) reads these via RLS.
CREATE POLICY "Read-only query role reads floats" ON public.floats FOR SELECT TO floatchat_readonly USING (current_user = 'floatchat_readonly');
CREATE POLICY "Read-only query role reads cycles" ON public.cycles FOR SELECT TO floatchat_readonly USING (current_user = 'floatchat_readonly');
CREATE POLICY "Read-only query role reads profiles" ON public.profiles FOR SELECT TO floatchat_readonly USING (current_user = 'floatchat_readonly');
CREATE POLICY "Read-only query role reads measurements" ON public.measurements FOR SELECT TO floatchat_readonly USING (current_user = 'floatchat_readonly');