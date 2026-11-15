import React from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Database, 
  Radio, 
  Layers,
  Thermometer,
  Droplets,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { DatabaseStats } from '../../types/argo';

interface AnalyticsViewProps {
  stats: DatabaseStats | null;
  onRunQuery: (prompt: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats, onRunQuery }) => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Featured Section Stats (21st.dev reference pattern) */}
      <div className="bg-white rounded-2xl border border-[#CBDCE7] p-6 shadow-sm">
        <div className="max-w-2xl mb-6">
          <div className="flex items-center gap-2 text-teal-700 text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 text-teal-600" />
            Indian Ocean Observational Telemetry
          </div>
          <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Comprehensive ARGO Fleet Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Global Data Assembly Centre (GDAC) synchronization across the Northern Arabian Sea, Bay of Bengal, Equatorial Wyrtki Jet corridor, and Subtropical Gyre.
          </p>
        </div>

        {/* 4 Large Featured Section Stat Panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Profiling Floats</span>
              <Compass className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {stats?.total_floats ?? 14}
            </div>
            <div className="text-[11px] text-teal-700 font-medium mt-1">
              100% active telemetry nominal
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Descent Cycles</span>
              <Database className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {stats?.total_profiles ?? 112}
            </div>
            <div className="text-[11px] text-sky-700 font-medium mt-1">
              Avg 10-day vertical cycle cadence
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Delayed-Mode Obs</span>
              <CheckCircle2 className="w-4 h-4 text-teal-700" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {stats?.delayed_mode_obs?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[11px] text-teal-800 font-medium mt-1">
              Full CTD scientific reference recalibration
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FCFD] border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Real-Time Obs</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {stats?.real_time_obs?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              Fast satellite transmission (&lt; 24h)
            </div>
          </div>
        </div>
      </div>

      {/* Regional Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Water Mass Comparison */}
        <div className="bg-white rounded-2xl border border-[#CBDCE7] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Regional Water-Mass Contrast</h3>
              <p className="text-xs text-slate-500">Surface salinity & thermocline characteristics</p>
            </div>
            <Droplets className="w-4 h-4 text-cyan-600" />
          </div>

          <div className="space-y-3 text-xs">
            {/* Arabian Sea */}
            <div className="p-3 bg-[#F4F9FC] rounded-xl border border-slate-200/60">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-900">Arabian Sea (North & Central)</span>
                <span className="font-mono font-bold text-teal-700">36.2 – 36.8 PSU</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Excess evaporation creates dense, salty surface water that sinks to form Arabian Sea High Salinity Water (ASHSW).
              </p>
              <button
                onClick={() => onRunQuery('Show observations from the Arabian Sea')}
                className="mt-2 text-[11px] font-semibold text-teal-700 hover:text-teal-900"
              >
                Inspect Arabian Sea profiles →
              </button>
            </div>

            {/* Bay of Bengal */}
            <div className="p-3 bg-[#F4F9FC] rounded-xl border border-slate-200/60">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-900">Bay of Bengal (River Plume)</span>
                <span className="font-mono font-bold text-sky-700">31.5 – 33.5 PSU</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Ganges-Brahmaputra and Irrawaddy river discharge establishes a buoyant, fresh surface layer and barrier layer dynamics.
              </p>
              <button
                onClick={() => onRunQuery('Show observations from the Bay of Bengal')}
                className="mt-2 text-[11px] font-semibold text-teal-700 hover:text-teal-900"
              >
                Inspect Bay of Bengal profiles →
              </button>
            </div>

            {/* Equatorial Jet */}
            <div className="p-3 bg-[#F4F9FC] rounded-xl border border-slate-200/60">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-900">Equatorial Indian Ocean (Wyrtki Jet)</span>
                <span className="font-mono font-bold text-blue-700">34.6 – 35.0 PSU</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Semi-annual equatorial eastward jets drive massive mass transport between western and eastern basins.
              </p>
              <button
                onClick={() => onRunQuery('Show temperature profiles in the Indian Ocean')}
                className="mt-2 text-[11px] font-semibold text-teal-700 hover:text-teal-900"
              >
                Inspect Equatorial profiles →
              </button>
            </div>
          </div>
        </div>

        {/* Quality Control & Provenance Protocol */}
        <div className="bg-white rounded-2xl border border-[#CBDCE7] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">ARGO QC Verification Protocol</h3>
              <p className="text-xs text-slate-500">Standardized flags applied to PRES, TEMP, and PSAL</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-3 p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-200/60">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                1
              </span>
              <div>
                <strong className="text-emerald-950 block">Good Quality (QC = 1)</strong>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Passed all automated real-time tests (pressure inversion check, global range, spike check, gradient test, stuck value test).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 bg-blue-50/50 rounded-xl border border-blue-200/60">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                2
              </span>
              <div>
                <strong className="text-blue-950 block">Probably Good (QC = 2)</strong>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Values within climatological limits with minor sensor noise; retained by default per FloatChat specification.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/60">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                3
              </span>
              <div>
                <strong className="text-amber-950 block">Potentially Correctable (QC = 3)</strong>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Sensor drift detected; corrected during delayed-mode processing against reference shipboard CTD databases.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
