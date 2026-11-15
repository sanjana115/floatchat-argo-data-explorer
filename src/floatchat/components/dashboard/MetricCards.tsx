import React from 'react';
import { Waves, Layers } from 'lucide-react';
import { DatabaseStats } from '../../types/argo';

interface MetricCardsProps {
  stats: DatabaseStats | null;
  loading: boolean;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ stats, loading }) => {
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
        </div>
      </div>
    </div>
  );
};

