import React from 'react';
import { ShieldCheck, ShieldAlert, Cpu, Wrench, Database, FlaskConical } from 'lucide-react';
import type { ChatMessage } from '../../types/argo';

const chip = 'inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded border';

export const PathBadge: React.FC<{ path?: ChatMessage['executionPath'] | undefined; reason?: string | null | undefined }> = ({ path, reason }) => {
  if (!path) return null;
  return path === 'LLM' ? (
    <span className={`${chip} bg-sky-50 text-sky-700 border-sky-200`} title="The AI wrote the query">
      <Cpu className="w-3 h-3" /> LLM
    </span>
  ) : (
    <span className={`${chip} bg-amber-50 text-amber-800 border-amber-200`} title={reason ?? 'Rule-based fallback'}>
      <Wrench className="w-3 h-3" /> RULE_BASED_FALLBACK
    </span>
  );
};

export const ValidationBadge: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const v = message.validation;
  if (!v) return null;
  if (!v.ok) {
    return (
      <span className={`${chip} bg-rose-50 text-rose-700 border-rose-200`}>
        <ShieldAlert className="w-3 h-3" /> Validation failed
      </span>
    );
  }
  const where = v.passedOn === 'fallback' ? 'fallback' : `attempt ${v.passedOn} of ${v.maxLlmAttempts}`;
  return (
    <span className={`${chip} bg-teal-50 text-teal-700 border-teal-200`} title={`Passed the safety checker on ${where}`}>
      <ShieldCheck className="w-3 h-3" /> Validated SELECT · {where}
    </span>
  );
};

export const SourceBadge: React.FC<{ real: number; synthetic: number }> = ({ real, synthetic }) => {
  if (real + synthetic === 0) return null;
  return synthetic === 0 ? (
    <span className={`${chip} bg-emerald-50 text-emerald-700 border-emerald-200`} title="Every contributing profile comes from a real Argo file">
      <Database className="w-3 h-3" /> Real Argo data · {real}
    </span>
  ) : (
    <span className={`${chip} bg-orange-50 text-orange-800 border-orange-300`} title="Some contributing profiles were imported by a user, not read from an Argo file">
      <FlaskConical className="w-3 h-3" /> Includes synthetic · {synthetic} of {real + synthetic}
    </span>
  );
};

export const ModeChip: React.FC<{ R: number; A: number; D: number }> = ({ R, A, D }) => (
  <span className={`${chip} bg-slate-50 text-slate-600 border-slate-200`} title="Data mode over distinct profiles: Real-time / Adjusted / Delayed">
    R {R} · A {A} · D {D}
  </span>
);
