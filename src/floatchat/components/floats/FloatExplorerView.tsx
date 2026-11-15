import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Layers, 
  Activity, 
  Eye, 
  Filter, 
  Compass,
  ArrowUpRight
} from 'lucide-react';
import { ArgoProfile } from '../../types/argo';

interface FloatExplorerViewProps {
  profiles: ArgoProfile[];
  onSelectFloat: (profile: ArgoProfile) => void;
  onInspectProfile: (profileId: string) => void;
  onAskAboutFloat: (wmoNumber: string) => void;
}

export const FloatExplorerView: React.FC<FloatExplorerViewProps> = ({
  profiles,
  onSelectFloat,
  onInspectProfile,
  onAskAboutFloat,
}) => {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');

  // Group latest profiles by float
  const floatsMap = new Map<string, { latestProfile: ArgoProfile; totalCycles: number }>();
  profiles.forEach((p) => {
    const id = p.wmo_number || p.float_id;
    const existing = floatsMap.get(id);
    if (!existing) {
      floatsMap.set(id, { latestProfile: p, totalCycles: 1 });
    } else {
      existing.totalCycles++;
      if (p.cycle_number > existing.latestProfile.cycle_number) {
        existing.latestProfile = p;
      }
    }
  });

  const floatList = Array.from(floatsMap.values());

  const filtered = floatList.filter(({ latestProfile: p }) => {
    const matchesSearch =
      p.wmo_number.toLowerCase().includes(search.toLowerCase()) ||
      p.platform_type.toLowerCase().includes(search.toLowerCase()) ||
      (p.country ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesMode = modeFilter === 'ALL' || p.data_mode === modeFilter;
    return matchesSearch && matchesMode;
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto overflow-y-auto">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#CBDCE7] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5 text-teal-600" />
            ARGO Float Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Indian Ocean profiling platforms, telemetry status, and cycle records
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by WMO (e.g. 2902123)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F4F9FC] border border-[#E2E8F0] rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center p-0.5 bg-[#EDF5FA] rounded-lg border border-[#E2E8F0] text-xs">
            {['ALL', 'D', 'R'].map((m) => (
              <button
                key={m}
                onClick={() => setModeFilter(m)}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  modeFilter === m ? 'bg-white text-teal-900 shadow-xs font-semibold' : 'text-slate-600'
                }`}
              >
                {m === 'ALL' ? 'All Modes' : m === 'D' ? 'Delayed (D)' : 'Real-Time (R)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floats Table / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(({ latestProfile: p, totalCycles }) => (
          <div
            key={p.wmo_number}
            className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:shadow-sm hover:border-teal-300 transition-all duration-200 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>WMO {p.wmo_number}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {p.platform_type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>{p.latitude.toFixed(2)}°N, {p.longitude.toFixed(2)}°E</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    p.data_mode === 'D'
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  Mode: {p.data_mode}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-100 my-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Cycles</span>
                  <span className="font-mono font-bold text-slate-800">{totalCycles}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Surface T</span>
                  <span className="font-mono font-bold text-slate-800">{p.surface_temp ?? '--'} °C</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Surface S</span>
                  <span className="font-mono font-bold text-slate-800">{p.surface_salinity ?? '--'} PSU</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => onSelectFloat(p)}
                className="flex-1 py-1.5 px-3 bg-[#F4F9FC] hover:bg-teal-50 text-teal-900 border border-[#E2E8F0] hover:border-teal-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span>Show on Map</span>
              </button>

              <button
                onClick={() => onInspectProfile(p.profile_id)}
                className="flex-1 py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Inspect Graphs</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
