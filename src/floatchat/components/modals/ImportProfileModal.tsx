import React, { useState } from 'react';
import { X, Upload, Check, AlertCircle, Sparkles, FileJson } from 'lucide-react';

interface ImportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportProfileModal: React.FC<ImportProfileModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const sampleProfile = {
    wmo_number: "2903899",
    platform_type: "APEX",
    cycle_number: 1,
    latitude: 14.85,
    longitude: 68.25,
    data_mode: "R",
    measurements: [
      { pressure: 5.0, temperature: 29.4, salinity: 36.45 },
      { pressure: 25.0, temperature: 29.2, salinity: 36.42 },
      { pressure: 50.0, temperature: 28.7, salinity: 36.38 },
      { pressure: 100.0, temperature: 24.1, salinity: 36.15 },
      { pressure: 200.0, temperature: 18.2, salinity: 35.85 },
      { pressure: 400.0, temperature: 12.5, salinity: 35.32 },
      { pressure: 800.0, temperature: 7.8, salinity: 34.95 },
      { pressure: 1200.0, temperature: 5.1, salinity: 34.82 },
      { pressure: 1800.0, temperature: 2.8, salinity: 34.76 }
    ]
  };

  const handleLoadSample = () => {
    setJsonText(JSON.stringify(sampleProfile, null, 2));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      setError('Invalid JSON format: ' + err.message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/import-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import ARGO profile');
      }

      setSuccessMsg(`Imported profile ${data.profile_id} with ${data.count} measurements (stored as synthetic data, not from an Argo file).`);
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#F4F9FC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Import ARGO CTD Profile (JSON)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">
              Paste Profile JSON:
            </label>
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Arabian Sea Sample Profile
            </button>
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            placeholder={JSON.stringify(sampleProfile, null, 2)}
            className="w-full p-3 font-mono text-xs bg-[#F8FCFD] border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white leading-relaxed"
            required
          />

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !jsonText.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-50 shadow-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving profile...' : 'Ingest Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
