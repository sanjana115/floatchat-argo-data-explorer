import React from 'react';
import { Waves, Layers, AlertTriangle, RefreshCw, Inbox } from 'lucide-react';
import { DatabaseStats } from '../../types/argo';

interface MetricCardsProps {
  stats: DatabaseStats | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ stats, loading, error, onRetry }) => {
  if (error && !stats) {
    return (
      <div role="alert" className="bg-white rounded-2xl p-4 border border-rose-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-[#0F2238]">Couldn't load the database figures</div>
            <div className="text-xs text-[#64748B]">{error}</div>
          </div>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E1F5F0] text-[#0D5C52] border border-[#B2E4D8] hover:bg-[#D0EFE8]">
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        )}
      </div>
    );
  }
  if (stats && stats.total_profiles === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-[#E2EEF5] shadow-xs flex items-start gap-2.5">
        <Inbox className="w-5 h-5 text-[#64748B] shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-[#0F2238]">No profiles in the database yet</div>
          <div className="text-xs text-[#64748B]">Load Argo NetCDF files to see floats, profiles and data-mode shares here.</div>
        </div>
      </div>
    );
  }
  // All values come from the database; nothing is shown until stats load.
  const floatCount = stats ? stats.total_floats.toLocaleString() : '—';
  const profileCount = stats ? stats.total_profiles.toLocaleString() : '—';
  // Share of profiles in each data mode.
  const pct = (mode: 'R' | 'A' | 'D') => {
    if (!stats || !stats.total_profiles) return '—';
    return `${Math.round(((stats.profiles_by_mode?.[mode] ?? 0) / stats.total_profiles) * 100)}%`;
  };
  const realTimePct = pct('R');
  const adjustedPct = pct('A');
  const delayedPct = pct('D');

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 select-none">
      {/* 1. Floats */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2EEF5] shadow-xs flex items-center gap-3.5 transition-all hover:border-[#CBDCE7]">
        <div className="w-10 h-10 rounded-xl bg-[#E0F2FE]/60 flex items-center justify-center shrink-0 text-[#0284C7]">
          <Waves className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs text-[#64748B] font-medium block leading-none">
            Floats
          </span>
          <span className={`text-xl lg:text-2xl font-bold text-[#0F2238] tracking-tight mt-1.5 block leading-none ${loading ? 'opacity-50' : ''}`}>
            {floatCount}
          </span>
          <span className="text-[10px] text-[#94A3B8] block mt-1">{stats ? `${stats.source_files.length} source file${stats.source_files.length === 1 ? '' : 's'}` : ''}</span>
        </div>
      </div>

      {/* 2. Profiles */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2EEF5] shadow-xs flex items-center gap-3.5 transition-all hover:border-[#CBDCE7]">
        <div className="w-10 h-10 rounded-xl bg-[#E0F2FE]/60 flex items-center justify-center shrink-0 text-[#0284C7]">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs text-[#64748B] font-medium block leading-none">
            Profiles
          </span>
          <span className={`text-xl lg:text-2xl font-bold text-[#0F2238] tracking-tight mt-1.5 block leading-none ${loading ? 'opacity-50' : ''}`}>
            {profileCount}
          </span>
          <span className="text-[10px] text-[#94A3B8] block mt-1">
            {stats ? `${(stats.profiles_by_source?.real ?? 0).toLocaleString()} real · ${(stats.profiles_by_source?.synthetic ?? 0).toLocaleString()} synthetic` : ''}
          </span>
        </div>
      </div>

      {/* 3. Real-time (R) */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2EEF5] shadow-xs flex items-center gap-3.5 transition-all hover:border-[#CBDCE7]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6] shrink-0 ml-1 mr-0.5" />
        <div>
          <span className="text-xs text-[#64748B] font-medium block leading-none">
            Real-time (R)
          </span>
          <span className="text-xl lg:text-2xl font-bold text-[#0F2238] tracking-tight mt-1.5 block leading-none">
            {realTimePct}
          </span>
          <span className="text-[10px] text-[#94A3B8] block mt-1">{stats ? `${(stats.profiles_by_mode?.R ?? 0).toLocaleString()} profiles` : ''}</span>
        </div>
      </div>

      {/* 4. Adjusted (A) */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2EEF5] shadow-xs flex items-center gap-3.5 transition-all hover:border-[#CBDCE7]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#0284C7] shrink-0 ml-1 mr-0.5" />
        <div>
          <span className="text-xs text-[#64748B] font-medium block leading-none">
            Adjusted (A)
          </span>
          <span className="text-xl lg:text-2xl font-bold text-[#0F2238] tracking-tight mt-1.5 block leading-none">
            {adjustedPct}
          </span>
          <span className="text-[10px] text-[#94A3B8] block mt-1">{stats ? `${(stats.profiles_by_mode?.A ?? 0).toLocaleString()} profiles` : ''}</span>
        </div>
      </div>

      {/* 5. Delayed-mode (D) */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2EEF5] shadow-xs flex items-center gap-3.5 transition-all hover:border-[#CBDCE7]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#9333EA] shrink-0 ml-1 mr-0.5" />
        <div>
          <span className="text-xs text-[#64748B] font-medium block leading-none">
            Delayed-mode (D)
          </span>
          <span className="text-xl lg:text-2xl font-bold text-[#0F2238] tracking-tight mt-1.5 block leading-none">
            {delayedPct}
          </span>
          <span className="text-[10px] text-[#94A3B8] block mt-1">{stats ? `${(stats.profiles_by_mode?.D ?? 0).toLocaleString()} profiles` : ''}</span>
        </div>
      </div>
    </div>
  );
};

