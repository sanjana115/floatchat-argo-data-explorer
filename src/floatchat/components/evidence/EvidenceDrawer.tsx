import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  ShieldCheck,
  Download,
  Table,
  ChevronDown,
  ChevronUp,
  Tag,
  Route as RouteIcon,
  Database,
} from 'lucide-react';
import { ChatMessage, ProvenanceInfo } from '../../types/argo';
import { QcSummary } from './QcSummary';
import { PathBadge, ValidationBadge, SourceBadge } from './StatusChips';

interface EvidenceDrawerProps {
  message?: ChatMessage | undefined;
  sql: string;
  provenance: ProvenanceInfo | undefined;
  rows: any[] | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onHighlightFloat?: ((floatId: string) => void) | undefined;
}

const SectionTitle: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 flex items-center gap-1.5 mb-1.5">
    {icon}
    {children}
  </span>
);

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  message,
  sql,
  provenance,
  rows,
  isOpen,
  onToggle,
  onHighlightFloat,
}) => {
  const [copied, setCopied] = useState(false);
  const [showRawTable, setShowRawTable] = useState(false);
  const [showAllCycles, setShowAllCycles] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'argo_observations_provenance.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const path = message?.executionPath;
  const cycles = provenance?.cycles ?? [];
  const visibleCycles = showAllCycles ? cycles : cycles.slice(0, 12);

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden mt-3 transition-all duration-200">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2.5 bg-[#F8FCFD] hover:bg-[#F1F8FB] border-b border-[#E2E8F0] flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-bold text-slate-800 tracking-tight">Scientific Evidence & SQL Provenance</span>
          {message && <ValidationBadge message={message} />}
          <PathBadge path={path} reason={message?.fallbackReason} />
        </div>
        <div className="flex items-center gap-3">
          {provenance && (
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              {provenance.rowCount} rows · {provenance.profileCount} profiles · {provenance.floatCount} floats · {provenance.executionTimeMs}ms
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 text-xs">
          {/* Execution path */}
          {message && (
            <div className="p-2.5 bg-[#FAFDFE] border border-slate-200 rounded-lg space-y-1">
              <SectionTitle icon={<RouteIcon className="w-3.5 h-3.5 text-slate-400" />}>Execution Path</SectionTitle>
              <div className="font-mono text-[11px] text-slate-700 space-y-0.5">
                <div><span className="font-semibold">executionPath:</span> {message.executionPath}</div>
                <div><span className="font-semibold">reason:</span> {message.fallbackReason ?? 'LLM produced a query that passed validation and executed.'}</div>
                <div><span className="font-semibold">model:</span> {message.model ?? 'not used'}</div>
                <div><span className="font-semibold">answer text:</span> {message.answerPath}{message.answerNote ? ` — ${message.answerNote}` : ''}</div>
                {message.queryLogId && <div><span className="font-semibold">query_log id:</span> {message.queryLogId}</div>}
              </div>
              {message.attempts && message.attempts.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  {message.attempts.map((a, i) => (
                    <div key={i} className="text-[11px] font-mono">
                      <span className={a.stage === 'ok' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                        {a.source === 'LLM' ? `Attempt ${a.attempt}` : 'Rule-based fallback'} · {a.stage === 'ok' ? 'passed' : `failed at ${a.stage}`}
                      </span>
                      {a.error && <span className="text-slate-600"> — {a.error}</span>}
                      {a.generatedSql && a.stage !== 'ok' && (
                        <pre className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-[10px] whitespace-pre-wrap text-slate-600">{a.generatedSql}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation status */}
          {message?.validation && (
            <div className={`p-2.5 border rounded-lg space-y-0.5 ${message.validation.ok ? 'bg-teal-50/40 border-teal-200' : 'bg-rose-50/50 border-rose-200'}`}>
              <SectionTitle icon={<ShieldCheck className="w-3.5 h-3.5 text-slate-400" />}>Validation Status</SectionTitle>
              <div className="font-mono text-[11px] text-slate-700 space-y-0.5">
                <div>
                  <span className="font-semibold">result:</span>{' '}
                  {message.validation.ok
                    ? `passed — exactly one read-only SELECT${message.validation.passedOn === 'fallback' ? ' (rule-based fallback)' : ` on LLM attempt ${message.validation.passedOn} of ${message.validation.maxLlmAttempts}`}`
                    : 'no query passed validation and execution'}
                </div>
                <div><span className="font-semibold">LLM attempts:</span> {message.validation.llmAttempts} of {message.validation.maxLlmAttempts} · rejected by checker: {message.validation.rejected}</div>
                {message.validation.ok && (
                  <>
                    <div><span className="font-semibold">tables:</span> {message.validation.tables.join(', ')}</div>
                    <div><span className="font-semibold">row limit enforced:</span> {message.validation.limit}</div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Executed SQL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <SectionTitle icon={<Code className="w-3.5 h-3.5 text-slate-400" />}>Executed Read-Only SQL (validated)</SectionTitle>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900 font-medium px-2 py-0.5 rounded hover:bg-teal-50 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#0F172A] text-slate-200 font-mono text-[11px] rounded-lg overflow-x-auto leading-relaxed border border-slate-800 shadow-inner whitespace-pre-wrap">
              {sql}
            </pre>
          </div>

          {/* Term definitions */}
          {message?.resolvedTerms && message.resolvedTerms.length > 0 && (
            <div>
              <SectionTitle>Resolved Terms (from term_definitions)</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {message.resolvedTerms.map((t, idx) => (
                  <div key={idx} className="p-2 bg-[#F4F9FC] border border-[#E2E8F0] rounded-lg text-slate-700 max-w-sm">
                    <div className="flex items-center gap-1.5 font-bold text-teal-900 text-xs">
                      <Tag className="w-3 h-3 text-teal-600" />
                      {t.label} <span className="font-normal text-slate-400">(matched “{t.matchedText}”)</span>
                    </div>
                    <code className="block mt-1 text-[10px] text-slate-600 font-mono">{t.sqlCondition}</code>
                    <div className={`mt-1 text-[10px] ${t.isProjectAssumption ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
                      {t.isProjectAssumption ? 'PROJECT ASSUMPTION' : `Source: ${t.source}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provenance */}
          {provenance && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-[#FAFDFE] border border-slate-200 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data Mode (distinct profiles)</span>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between"><span className="text-amber-700 font-semibold">Real-Time (R):</span><span className="font-bold text-slate-800">{provenance.modeSummary.R}</span></div>
                  <div className="flex justify-between"><span className="text-sky-700 font-semibold">Adjusted (A):</span><span className="font-bold text-slate-800">{provenance.modeSummary.A}</span></div>
                  <div className="flex justify-between"><span className="text-teal-700 font-semibold">Delayed (D):</span><span className="font-bold text-slate-800">{provenance.modeSummary.D}</span></div>
                </div>
              </div>

              <div className="p-2.5 bg-[#FAFDFE] border border-slate-200 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Counts & Source</span>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between"><span>Profiles:</span><span className="font-bold text-slate-800">{provenance.profileCount}</span></div>
                  <div className="flex justify-between"><span>Cycles:</span><span className="font-bold text-slate-800">{provenance.cycleCount}</span></div>
                  <div className="flex justify-between"><span>Real profiles:</span><span className="font-bold text-slate-800">{provenance.dataSourceSummary.real}</span></div>
                  <div className="flex justify-between"><span>Synthetic profiles:</span><span className={`font-bold ${provenance.dataSourceSummary.synthetic ? 'text-orange-700' : 'text-slate-800'}`}>{provenance.dataSourceSummary.synthetic}</span></div>
                  <div className="pt-0.5"><SourceBadge real={provenance.dataSourceSummary.real} synthetic={provenance.dataSourceSummary.synthetic} /></div>
                </div>
              </div>

              {/* QC summary */}
              <div className="p-2.5 bg-[#FAFDFE] border border-slate-200 rounded-lg col-span-2 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Quality-Control Summary</span>
                <QcSummary title="Position QC (distinct profiles)" tally={provenance.positionQc} unit="profiles" />
                {(['temp_qc', 'psal_qc', 'pres_qc'] as const).map((col) =>
                  provenance.measurementQc?.[col] ? (
                    <QcSummary
                      key={col}
                      title={`${col === 'temp_qc' ? 'Temperature' : col === 'psal_qc' ? 'Salinity' : 'Pressure'} QC (returned rows)`}
                      tally={provenance.measurementQc[col]}
                      unit="rows"
                    />
                  ) : null,
                )}
                {provenance.measurementQcNote && <div className="text-[10px] text-slate-500">{provenance.measurementQcNote}</div>}
                <div className="text-[10px] text-slate-400">A missing flag, or flag 0 (not checked), is counted as unknown — never as good.</div>
              </div>

              <div className="p-2.5 bg-[#FAFDFE] border border-slate-200 rounded-lg col-span-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Contributing Argo Floats ({provenance.floatCount}) & Cycle Numbers
                </span>
                <div className="text-[10px] text-slate-500 mb-1.5">
                  {provenance.scope} Method: <span className="font-mono">{provenance.method}</span>
                  {provenance.truncated ? ' (truncated)' : ''}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {visibleCycles.map((c) => (
                    <button
                      key={c.floatId}
                      onClick={() => onHighlightFloat && onHighlightFloat(c.floatId)}
                      className="px-2 py-0.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-teal-800 font-mono text-[10px] rounded font-semibold transition-colors"
                      title="Click to highlight float on map"
                    >
                      WMO {c.floatId} · cycle {c.cycleNumbers.join(', ')}
                    </button>
                  ))}
                </div>
                {cycles.length > 12 && (
                  <button onClick={() => setShowAllCycles(!showAllCycles)} className="mt-1.5 text-[11px] text-teal-700 font-medium">
                    {showAllCycles ? 'Show fewer' : `Show all ${cycles.length} floats`}
                  </button>
                )}
              </div>

              {provenance.provenanceSql && (
                <div className="col-span-2">
                  <SectionTitle icon={<Database className="w-3.5 h-3.5 text-slate-400" />}>Second (provenance) query — validated</SectionTitle>
                  <pre className="p-2.5 bg-slate-50 text-slate-600 font-mono text-[10px] rounded-lg border border-slate-200 whitespace-pre-wrap">{provenance.provenanceSql}</pre>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowRawTable(!showRawTable)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-teal-700 transition-colors"
            >
              <Table className="w-3.5 h-3.5" />
              <span>{showRawTable ? 'Hide Tabular Data' : `Inspect Tabular Observations (${rows?.length || 0})`}</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>
          </div>

          {showRawTable && rows && rows.length > 0 && (
            <div className="max-h-60 overflow-auto border border-slate-200 rounded-lg shadow-inner">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700 border-b border-slate-200">
                  <tr>
                    {Object.keys(rows[0]).map((h) => (
                      <th key={h} className="p-2 whitespace-nowrap font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-teal-50/40">
                      {Object.keys(rows[0]).map((h) => (
                        <td key={h} className="p-2 whitespace-nowrap text-slate-700">
                          {r[h] !== null && r[h] !== undefined ? String(r[h]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
