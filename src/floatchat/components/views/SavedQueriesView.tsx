import React from 'react';
import { BookmarkCheck, ArrowRight, Code, Database, Sparkles } from 'lucide-react';

interface SavedQueriesViewProps {
  onRunQuery: (question: string) => void;
}

export const SavedQueriesView: React.FC<SavedQueriesViewProps> = ({ onRunQuery }) => {
  const categories = [
    {
      category: 'Physical Oceanography & Stratification',
      queries: [
        {
          title: 'Indian Ocean Main Thermocline Depth',
          question: 'Plot temperature against depth across the Indian Ocean',
          description: 'Calculates vertical thermal decay and mixed layer depths (0–500 dbar).',
          sqlSnippet: 'SELECT ... FROM measurements WHERE pressure <= 500 ORDER BY pressure ASC',
        },
        {
          title: 'Deep Water Masses Below 1000m',
          question: 'Show temperature and salinity in deep ocean below 1000 dbar',
          description: 'Isotherm inspection of Antarctic Intermediate and Deep Water masses.',
          sqlSnippet: 'SELECT ... WHERE m.pressure >= 1000.0',
        },
      ],
    },
    {
      category: 'Regional Salinity & Water Mass Contrasts',
      queries: [
        {
          title: 'Arabian Sea Hypersaline Observations',
          question: 'Which floats recorded the highest salinity?',
          description: 'Identifies high evaporation signatures (> 36.2 PSU) in the Northern Arabian Sea.',
          sqlSnippet: 'SELECT ... WHERE m.salinity >= 36.0 ORDER BY m.salinity DESC',
        },
        {
          title: 'Bay of Bengal Monsoon River Plumes',
          question: 'Show observations from the Bay of Bengal',
          description: 'Examines freshwater lens cap (31.5–33.5 PSU) from Ganges-Brahmaputra runoff.',
          sqlSnippet: 'SELECT ... WHERE p.latitude BETWEEN 5 AND 23 AND p.longitude BETWEEN 80 AND 96',
        },
      ],
    },
    {
      category: 'Data Provenance & QC Calibration',
      queries: [
        {
          title: 'Real-Time vs. Delayed-Mode Distribution',
          question: 'Compare real-time and delayed-mode profiles',
          description: 'Contrasts raw satellite telemetry (R) against reference CTD calibrated archives (D).',
          sqlSnippet: 'SELECT p.data_mode, COUNT(*) FROM profiles GROUP BY p.data_mode',
        },
        {
          title: 'Quality-Controlled Good CTD Flags Only',
          question: 'Show observations with good QC in the Arabian Sea',
          description: 'Filters strictly for verified Flag = 1 data per ARGO international manual.',
          sqlSnippet: 'SELECT ... WHERE m.pres_qc = 1 AND m.temp_qc = 1 AND m.psal_qc = 1',
        },
      ],
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-white p-5 rounded-2xl border border-[#CBDCE7] shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-teal-600" />
          Curated Scientific Queries
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Peer-verified oceanographic queries optimized for Indian Ocean ARGO data discovery and Plotly visualization
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((cat, idx) => (
          <div key={idx} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {cat.category}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cat.queries.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:shadow-sm hover:border-teal-300 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                        {q.title}
                      </h4>
                      <Sparkles className="w-4 h-4 text-teal-500 shrink-0" />
                    </div>

                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                      {q.description}
                    </p>

                    <div className="p-2 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono mb-3 overflow-x-auto">
                      {q.sqlSnippet}
                    </div>
                  </div>

                  <button
                    onClick={() => onRunQuery(q.question)}
                    className="w-full py-2 px-3 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors"
                  >
                    <span className="truncate pr-2">Execute: "{q.question}"</span>
                    <ArrowRight className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
