import React, { useState } from 'react';
import { Code, Copy, Check, ShieldCheck, Download, Table, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { ChatMessage, ProvenanceInfo } from '../../types/argo';
import { QcSummary } from './QcSummary';
import { measurementsUsed } from '@/lib/floatchat/evidence';

interface EvidenceDrawerProps {
  message?: ChatMessage | undefined;
  sql: string;
  provenance: ProvenanceInfo | undefined;
  rows: any[] | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onHighlightFloat?: ((floatId: string) => void) | undefined;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{children}</span>
);
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-2.5 bg-[#FAFDFE] border border-slate-200 rounded-lg ${className}`}>{children}</div>
);
const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-3"><span className="text-slate-600">{label}</span><span className="font-mono font-bold text-slate-800">{value}</span></div>
);
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? 'not reported' : n.toLocaleString());

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ message, sql, provenance, rows, isOpen, onToggle, onHighlightFloat }) => {
  const [copied, setCopied] = useState(false);
  const [showRawTable, setShowRawTable] = useState(false);
  const [showAllCycles, setShowAllCycles] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'argo_observations.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cycles = provenance?.cycles ?? [];
  const visibleCycles = showAllCycles ? cycles : cycles.slice(0, 12);
  const measurements = measurementsUsed(rows);
  const interpretations = message?.interpretations ?? [];

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden mt-3 transition-all duration-200">
      <button onClick={onToggle} aria-expanded={isOpen}
        className="w-full px-4 py-2.5 bg-[#F8FCFD] hover:bg-[#F1F8FB] border-b border-[#E2E8F0] flex items-center justify-between text-left transition-colors">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-bold text-slate-800 tracking-tight">Supporting Evidence & Data Quality</span>
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-3 text-xs">
          {provenance && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card>
                <SectionTitle>Counts</SectionTitle>
                <div className="space-y-1 text-[11px]">
                  <Stat label="Matching profiles" value={fmt(provenance.profileCount)} />
                  <Stat label="Unique floats" value={fmt(provenance.floatCount)} />
                  <Stat label="Rows returned" value={fmt(provenance.rowCount)} />
                  <Stat label="Measurements used" value={fmt(measurements)} />
                </div>
                {provenance.truncated && <div className="mt-1 text-[10px] text-amber-700">Identifier list was cut at the lookup limit.</div>}
              </Card>

              <Card>
                <SectionTitle>Data mode (distinct profiles)</SectionTitle>
                <div className="space-y-1 text-[11px]">
                  <Stat label="Real-time (R)" value={provenance.modeSummary.R} />
                  <Stat label="Adjusted (A)" value={provenance.modeSummary.A} />
                  <Stat label="Delayed-mode (D)" value={provenance.modeSummary.D} />
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-600">
                  Data source:{' '}
                  {provenance.dataSourceSummary.synthetic > 0
                    ? <span className="font-semibold text-orange-700">{provenance.dataSourceSummary.real} real, {provenance.dataSourceSummary.synthetic} imported (synthetic) profiles</span>
                    : <span className="font-semibold text-slate-800">real Argo profiles only</span>}
                </div>
              </Card>

              {interpretations.length > 0 && (
                <Card className="sm:col-span-2">
                  <SectionTitle>How the question was read</SectionTitle>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {interpretations.map((line, i) => (
                      <li key={i}>
                        {line.replace(' (PROJECT ASSUMPTION)', '')}
                        {line.includes('PROJECT ASSUMPTION') && <span className="ml-1 text-[10px] font-semibold text-amber-700">Project assumption</span>}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="sm:col-span-2 space-y-2.5">
                <SectionTitle>Quality-control summary</SectionTitle>
                <QcSummary title="Position QC (distinct profiles)" tally={provenance.positionQc} unit="profiles" />
                {(['temp_qc', 'psal_qc', 'pres_qc'] as const).map((col) =>
                  provenance.measurementQc?.[col] ? (
                    <QcSummary key={col}
                      title={`${col === 'temp_qc' ? 'Temperature' : col === 'psal_qc' ? 'Salinity' : 'Pressure'} QC (returned rows)`}
                      tally={provenance.measurementQc[col]} unit="rows" />
                  ) : null,
                )}
                {provenance.measurementQcNote && <div className="text-[10px] text-slate-500">{provenance.measurementQcNote}</div>}
                <div className="text-[10px] text-slate-400">A missing flag, or flag 0 (not checked), is counted as unknown — never as good.</div>
              </Card>

              <Card className="sm:col-span-2">
                <SectionTitle>Floats ({provenance.floatCount}) and cycle numbers</SectionTitle>
                {cycles.length === 0 ? (
                  <div className="text-[11px] text-slate-500">No float identifiers are available for this result.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {visibleCycles.map((c) => (
                      <button key={c.floatId} onClick={() => onHighlightFloat && onHighlightFloat(c.floatId)} title="Show this float on the map"
                        className="px-2 py-0.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-teal-800 font-mono text-[10px] rounded font-semibold transition-colors">
                        WMO {c.floatId} · cycle {c.cycleNumbers.join(', ')}
                      </button>
                    ))}
                  </div>
                )}
                {cycles.length > 12 && (
                  <button onClick={() => setShowAllCycles(!showAllCycles)} className="mt-1.5 text-[11px] text-teal-700 font-medium">
                    {showAllCycles ? 'Show fewer' : `Show all ${cycles.length} floats`}
                  </button>
                )}
                {provenance.profileIds.length > 0 && (
                  <div className="mt-2">
                    <button onClick={() => setShowProfiles(!showProfiles)} className="text-[11px] text-teal-700 font-medium">
                      {showProfiles ? 'Hide profile identifiers' : `Show ${provenance.profileIds.length} profile identifiers`}
                    </button>
                    {showProfiles && (
                      <div className="mt-1 max-h-28 overflow-y-auto font-mono text-[10px] text-slate-600 leading-relaxed">
                        {provenance.profileIds.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button onClick={() => setShowRawTable(!showRawTable)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-teal-700 transition-colors">
              <Table className="w-3.5 h-3.5" />
              <span>{showRawTable ? 'Hide returned rows' : `Show returned rows (${rows?.length || 0})`}</span>
            </button>
            <button onClick={handleExportCsv} className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors">
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>
          </div>

          {showRawTable && rows && rows.length > 0 && (
            <div className="max-h-60 overflow-auto border border-slate-200 rounded-lg shadow-inner">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700 border-b border-slate-200">
                  <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="p-2 whitespace-nowrap font-bold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-teal-50/40">
                      {Object.keys(rows[0]).map((h) => (
                        <td key={h} className="p-2 whitespace-nowrap text-slate-700">{r[h] !== null && r[h] !== undefined ? String(r[h]) : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && <div className="p-2 text-[10px] text-slate-500">Showing the first 50 of {rows.length} rows; Export CSV has all of them.</div>}
            </div>
          )}

          {/* Nested technical details, collapsed by default */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setShowTech(!showTech)} aria-expanded={showTech}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><Wrench className="w-3.5 h-3.5 text-slate-400" /> Technical details</span>
              {showTech ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            {showTech && (
              <TechnicalDetails message={message} sql={sql} provenance={provenance} copied={copied} onCopy={handleCopySql} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const TechnicalDetails: React.FC<{
  message?: ChatMessage | undefined;
  sql?: string | undefined;
  provenance?: ProvenanceInfo | undefined;
  copied?: boolean;
  onCopy?: () => void;
}> = ({ message, sql, provenance, copied, onCopy }) => (
  <div className="p-3 space-y-3 text-[11px]">
    {message && (
      <div className="font-mono text-slate-700 space-y-0.5">
        <div><span className="font-semibold">Query written by:</span> {message.executionPath === 'LLM' ? `AI (${message.model ?? 'model unknown'})` : message.executionPath === 'RULE_BASED_FALLBACK' ? 'rule-based fallback' : 'not reached'}</div>
        {message.fallbackReason && <div><span className="font-semibold">Fallback reason:</span> {message.fallbackReason}</div>}
        {message.answerPath && <div><span className="font-semibold">Answer written by:</span> {message.answerPath === 'LLM' ? 'AI' : 'fixed template'}{message.answerNote ? ` — ${message.answerNote}` : ''}</div>}
        {message.validation && (
          <div>
            <span className="font-semibold">Validation:</span>{' '}
            {message.validation.ok
              ? `one read-only SELECT passed ${message.validation.passedOn === 'fallback' ? 'on the rule-based fallback' : `on AI attempt ${message.validation.passedOn} of ${message.validation.maxLlmAttempts}`}; tables ${message.validation.tables.join(', ')}; row limit ${message.validation.limit}`
              : 'no query passed validation and execution'}
            {` · AI attempts ${message.validation.llmAttempts}/${message.validation.maxLlmAttempts}, rejected ${message.validation.rejected}`}
          </div>
        )}
        {provenance && <div><span className="font-semibold">Execution time:</span> {provenance.executionTimeMs} ms</div>}
        {provenance && <div><span className="font-semibold">Identifier method:</span> {provenance.method} — {provenance.scope}</div>}
        {message.queryLogId && <div><span className="font-semibold">Query log id:</span> {message.queryLogId}</div>}
      </div>
    )}
    {message?.attempts && message.attempts.length > 0 && (
      <div className="space-y-1">
        {message.attempts.map((a, i) => (
          <div key={i} className="font-mono">
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
    {sql && (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 font-semibold text-slate-600"><Code className="w-3.5 h-3.5 text-slate-400" /> Executed SQL (validated, read-only)</span>
          {onCopy && (
            <button onClick={onCopy} className="flex items-center gap-1 text-teal-700 hover:text-teal-900 font-medium px-2 py-0.5 rounded hover:bg-teal-50">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy SQL'}</span>
            </button>
          )}
        </div>
        <pre className="p-3 bg-[#0F172A] text-slate-200 font-mono text-[11px] rounded-lg overflow-x-auto leading-relaxed whitespace-pre-wrap">{sql}</pre>
      </div>
    )}
    {provenance?.provenanceSql && (
      <div>
        <span className="font-semibold text-slate-600 block mb-1">Second (identifier) query — validated</span>
        <pre className="p-2.5 bg-slate-50 text-slate-600 font-mono text-[10px] rounded-lg border border-slate-200 whitespace-pre-wrap">{provenance.provenanceSql}</pre>
      </div>
    )}
  </div>
);
