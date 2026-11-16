import React from 'react';
import { Settings, ShieldCheck, Database, Sliders, Check } from 'lucide-react';

interface SettingsViewProps {
  qcFilterStrict: boolean;
  onToggleQcStrict: (strict: boolean) => void;
  selectedMode: string;
  onSelectMode: (mode: string) => void;
  queryMethod: 'auto' | 'rules';
  onSelectQueryMethod: (method: 'auto' | 'rules') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  qcFilterStrict,
  onToggleQcStrict,
  selectedMode,
  onSelectMode,
  queryMethod,
  onSelectQueryMethod,
}) => {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto overflow-y-auto">
      <div className="bg-white p-6 rounded-2xl border border-[#CBDCE7] shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-600" />
          Observation Settings & Query Preferences
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure scientific defaults for ARGO data querying, QC filtering, and display modes
        </p>
      </div>

      <div className="space-y-4">
        {/* QC Flag Filter Setting */}
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Quality Control (QC) Default Filtering
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Specification default keeps all available QC flags (1, 2, 3) unless explicitly requested. Toggle strict mode to restrict queries automatically to QC = 1 (Good).
            </p>
          </div>

          <button
            onClick={() => onToggleQcStrict(!qcFilterStrict)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
              qcFilterStrict
                ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {qcFilterStrict ? 'Strict (QC = 1 Only)' : 'Standard (Retain All Flags)'}
          </button>
        </div>

        {/* Default Data Mode Filter */}
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Observation Data Mode Filter
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Filter incoming database queries to specific telemetry operational pipelines.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#F4F9FC] rounded-lg border border-[#E2E8F0] text-xs">
            {['ALL', 'D', 'R'].map((m) => (
              <button
                key={m}
                onClick={() => onSelectMode(m)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedMode === m
                    ? 'bg-teal-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'ALL' ? 'All Data' : m === 'D' ? 'Delayed Only (D)' : 'Real-Time Only (R)'}
              </button>
            ))}
          </div>
        </div>

        {/* Query method: AI with rule-based backup, or rule-based only */}
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Query Method
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              By default the AI writes each query and the rule-based method takes over only if it fails. Choose rule-based only to skip the AI; answers then carry the RULE_BASED_FALLBACK badge.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#F4F9FC] rounded-lg border border-[#E2E8F0] text-xs">
            {(['auto', 'rules'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onSelectQueryMethod(m)}
                aria-pressed={queryMethod === m}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  queryMethod === m
                    ? 'bg-teal-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'auto' ? 'AI + Rule-Based Backup' : 'Rule-Based Only'}
              </button>
            ))}
          </div>
        </div>

        {/* Database Status Info */}
        <div className="bg-[#F8FCFD] p-5 rounded-xl border border-[#CBDCE7] space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Database className="w-4 h-4 text-teal-600" />
            Postgres Database (read-only query role)
          </div>
          <p>
            AI-written queries are validated (single SELECT, table whitelist, row limit) and run through a read-only database role with a statement timeout. Model: openai/gpt-6-astra via Lovable AI, with a rule-based fallback.
          </p>
        </div>
      </div>
    </div>
  );
};
