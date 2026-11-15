import React from 'react';
import { QC_LABELS } from '@/lib/floatchat/qc';
import type { QcBucket, QcTally } from '../../types/argo';

// Always shown so "unknown" is visibly separate from "good"; the rest only when non-zero.
const ALWAYS: QcBucket[] = ['good', 'probably_good', 'probably_bad', 'bad', 'unknown'];
const OPTIONAL: QcBucket[] = ['changed', 'estimated', 'missing_value'];

const BAR: Record<QcBucket, string> = {
  good: 'bg-emerald-500',
  probably_good: 'bg-teal-400',
  probably_bad: 'bg-amber-400',
  bad: 'bg-rose-500',
  changed: 'bg-sky-400',
  estimated: 'bg-indigo-300',
  missing_value: 'bg-slate-400',
  unknown: 'bg-slate-300',
};

export const QcSummary: React.FC<{ title: string; tally: QcTally | undefined | null; unit?: string }> = ({ title, tally, unit = 'readings' }) => {
  if (!tally || tally.total === 0) {
    return (
      <div className="text-[11px] text-slate-500">
        <span className="font-semibold text-slate-600">{title}:</span> no {unit} to summarise.
      </div>
    );
  }
  const buckets = [...ALWAYS, ...OPTIONAL.filter((b) => tally[b] > 0)];
  const pct = (n: number) => (tally.total ? `${((n / tally.total) * 100).toFixed(n && n / tally.total < 0.001 ? 2 : 1)}%` : '—');
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-600">{title}</span>
        <span className="font-mono text-slate-400">{tally.total.toLocaleString()} {unit}</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {buckets.map((b) => (tally[b] > 0 ? <div key={b} className={BAR[b]} style={{ width: `${(tally[b] / tally.total) * 100}%` }} /> : null))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px]">
        {buckets.map((b) => (
          <div key={b} className={`flex justify-between ${b === 'unknown' ? 'text-slate-500' : 'text-slate-700'}`}>
            <span className="flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${BAR[b]}`} />
              {QC_LABELS[b]}
            </span>
            <span className="font-bold">
              {tally[b].toLocaleString()} <span className="font-normal text-slate-400">({pct(tally[b])})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
