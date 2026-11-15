import React from 'react';
import {
  CheckCircle2,
  Clock,
  Database,
  Radio,
  Droplets,
  ShieldCheck,
  Compass,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { DatabaseStats } from '../../types/argo';
import { QcSummary } from '../evidence/QcSummary';

interface AnalyticsViewProps {
  stats: DatabaseStats | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRunQuery: (prompt: string) => void;
}

const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');
const share = (n: number | undefined, total: number | undefined) =>
  total ? `${(((n ?? 0) / total) * 100).toFixed(1)}% of all readings` : '—';

const REGION_QUERY: Record<string, string> = {
  arabian_sea: 'Show observations from the Arabian Sea',
  bay_of_bengal: 'Show observations from the Bay of Bengal',
  near_the_equator: 'What is the average surface temperature near the equator?',
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats, loading = false, error = null, onRetry, onRunQuery }) => {
  if (error && !stats) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div role="alert" className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Couldn't load analytics from the database</h2>
              <p className="text-xs text-slate-500 mt-0.5">{error}</p>
            </div>
          </div>
          {onRetry && (
            <button onClick={onRetry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E1F5F0] text-[#0D5C52] border border-[#B2E4D8]">
              <RefreshCw className="w-3.5 h-3.5" /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const v = (n: number | undefined | null) => (stats && n !== undefined && n !== null ? n.toLocaleString() : loading ? '…' : '—');
  const empty = stats && stats.total_profiles === 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#CBDCE7] p-6 shadow-sm">
        <div className="max-w-2xl mb-6">
          <div className="flex items-center gap-2 text-teal-700 text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 text-teal-600" />
            Computed from the database
          </div>
          <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">ARGO Fleet Analytics</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {stats
              ? `${stats.source_files.length} Argo file${stats.source_files.length === 1 ? '' : 's'} loaded · profiles dated ${fmtDate(stats.earliest_date)} to ${fmtDate(stats.latest_date)} · ${(stats.profiles_by_source?.real ?? 0).toLocaleString()} real and ${(stats.profiles_by_source?.synthetic ?? 0).toLocaleString()} synthetic profiles.`
              : loading
              ? 'Loading figures from the database…'
              : 'No figures available.'}
          </p>
          {empty && <p className="text-xs text-amber-700 mt-1">The database has no profiles yet. Load Argo NetCDF files to populate these figures.</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Profiling Floats</span>
              <Compass className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">{v(stats?.total_floats)}</div>
            <div className="text-[11px] text-teal-700 font-medium mt-1">Distinct float IDs</div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Profiles</span>
              <Database className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">{v(stats?.total_profiles)}</div>
            <div className="text-[11px] text-sky-700 font-medium mt-1">{stats ? `${stats.total_cycles.toLocaleString()} cycles · ${stats.total_measurements.toLocaleString()} readings` : ' '}</div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Delayed-Mode Readings</span>
              <CheckCircle2 className="w-4 h-4 text-teal-700" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">{v(stats?.delayed_mode_obs)}</div>
            <div className="text-[11px] text-teal-800 font-medium mt-1">{stats ? share(stats.delayed_mode_obs, stats.total_measurements) : ' '}</div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Real-Time Readings</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">{v(stats?.real_time_obs)}</div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              {stats ? `${share(stats.real_time_obs, stats.total_measurements)} · adjusted ${stats.adjusted_obs.toLocaleString()}` : ' '}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional comparison from stored readings */}
        <div className="bg-white rounded-2xl border border-[#CBDCE7] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Regional Surface Contrast</h3>
              <p className="text-xs text-slate-500">Surface readings (quality flags 1–2) in each region, using the stored term rules</p>
            </div>
            <Droplets className="w-4 h-4 text-cyan-600" />
          </div>

          {stats?.regions_error && (
            <div role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">Couldn't compute regional figures: {stats.regions_error}</div>
          )}
          {!stats && loading && <div className="text-xs text-slate-500">Loading regional figures…</div>}

          <div className="space-y-3 text-xs">
            {(stats?.regions ?? []).map((r) => (
              <div key={r.term_id} className="p-3 bg-[#F4F9FC] rounded-xl border border-slate-200/60">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <span className="font-bold text-slate-900">{r.term}</span>
                  <span className="font-mono font-bold text-teal-700">
                    {r.avg_surface_salinity !== null ? `avg ${r.avg_surface_salinity} PSU` : 'no surface salinity'}
                  </span>
                </div>
                {r.profiles === 0 ? (
                  <p className="text-[11px] text-slate-500">No stored profiles fall inside this region.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-600">
                    <span>Profiles: <b className="text-slate-800">{r.profiles}</b></span>
                    <span>Floats: <b className="text-slate-800">{r.floats}</b></span>
                    <span>Surface readings: <b className="text-slate-800">{r.surface_readings}</b></span>
                    <span>Avg surface temp: <b className="text-slate-800">{r.avg_surface_temperature ?? '—'} °C</b></span>
                    <span className="col-span-2">
                      Salinity range: <b className="text-slate-800">{r.min_surface_salinity ?? '—'} – {r.max_surface_salinity ?? '—'} PSU</b>
                    </span>
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                  {r.rule_text} <span className="font-semibold text-amber-700">PROJECT ASSUMPTION</span>
                </p>
                <button onClick={() => onRunQuery(REGION_QUERY[r.term_id] ?? `Show observations from ${r.term}`)} className="mt-2 text-[11px] font-semibold text-teal-700 hover:text-teal-900">
                  Ask about {r.term} →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* QC flags in the database */}
        <div className="bg-white rounded-2xl border border-[#CBDCE7] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quality-Control Flags in the Database</h3>
              <p className="text-xs text-slate-500">Argo flags on pressure, temperature, salinity and position</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>

          {stats?.qc_error && (
            <div role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">Couldn't compute QC summary: {stats.qc_error}</div>
          )}
          {!stats && loading && <div className="text-xs text-slate-500">Loading QC summary…</div>}

          {stats?.qc && (
            <div className="space-y-3">
              <QcSummary title="Temperature (TEMP_QC)" tally={stats.qc.temp_qc} />
              <QcSummary title="Salinity (PSAL_QC)" tally={stats.qc.psal_qc} />
              <QcSummary title="Pressure (PRES_QC)" tally={stats.qc.pres_qc} />
              <QcSummary title="Position (POSITION_QC)" tally={stats.qc.position_qc} unit="profiles" />
            </div>
          )}

          <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] text-slate-600">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              A missing flag, or flag 0 (no QC performed), is counted as <b>unknown</b> — never as good. Real-time (R) values use the raw
              fields; adjusted (A) and delayed-mode (D) values use the adjusted fields and their flags.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
