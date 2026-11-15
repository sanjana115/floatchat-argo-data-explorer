import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Download, 
  Layers, 
  RefreshCw,
  Info
} from 'lucide-react';

interface OceanChartProps {
  dataRows: any[];
  chartType: 'temp_depth' | 'sal_depth' | 'ts_diagram' | 'time_series';
  title?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export const OceanChart: React.FC<OceanChartProps> = ({
  dataRows,
  chartType: initialType,
  title,
  onClose,
  isModal = false,
}) => {
  const chartDivRef = useRef<HTMLDivElement>(null);
  const [activeType, setActiveType] = useState(initialType);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setActiveType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (!chartDivRef.current || !dataRows || dataRows.length === 0) return;

    // Filter rows having necessary numeric measurements
    const validRows = dataRows.filter(
      (r) => (r.pressure !== undefined || r.pres !== undefined) &&
             (r.temperature !== undefined || r.temp !== undefined || r.salinity !== undefined || r.psal !== undefined)
    );

    if (validRows.length === 0) {
      // If no measurements found (e.g. metadata-only query), display clean empty state
      Plotly.purge(chartDivRef.current);
      return;
    }

    // Group observations by Float + Cycle for multi-profile overlay
    const profilesMap = new Map<string, any[]>();
    validRows.forEach((r) => {
      const key = `Float ${r.wmo_number || r.float_id || 'ARGO'} (Cycle ${r.cycle_number ?? '1'})`;
      if (!profilesMap.has(key)) profilesMap.set(key, []);
      profilesMap.get(key)!.push(r);
    });

    const traces: Plotly.Data[] = [];
    const colors = [
      '#0D9488', '#0284C7', '#6366F1', '#D97706', '#EC4899',
      '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6', '#06B6D4'
    ];
    let colorIdx = 0;

    profilesMap.forEach((rows, profileName) => {
      // Sort vertically by pressure ascending
      rows.sort((a, b) => (a.pressure || 0) - (b.pressure || 0));

      const pressures = rows.map((r) => r.pressure ?? r.pres ?? 0);
      const temps = rows.map((r) => r.temperature ?? r.temp ?? 0);
      const sals = rows.map((r) => r.salinity ?? r.psal ?? 0);
      const dates = rows.map((r) => r.profile_time ? r.profile_time.split('T')[0] : '');

      const traceColor = colors[colorIdx % colors.length];
      colorIdx++;

      if (activeType === 'temp_depth') {
        traces.push({
          x: temps,
          y: pressures,
          name: profileName,
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: traceColor ?? '#0D7377', width: 2.5, shape: 'spline' },
          marker: { size: 5, color: traceColor ?? '#0D7377' },
          hovertemplate: '<b>%{data.name}</b><br>Temp: %{x:.2f} °C<br>Depth: %{y:.1f} dbar<extra></extra>',
        });
      } else if (activeType === 'sal_depth') {
        traces.push({
          x: sals,
          y: pressures,
          name: profileName,
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: traceColor ?? '#0D7377', width: 2.5, shape: 'spline' },
          marker: { size: 5, color: traceColor ?? '#0D7377' },
          hovertemplate: '<b>%{data.name}</b><br>Salinity: %{x:.3f} PSU<br>Depth: %{y:.1f} dbar<extra></extra>',
        });
      } else if (activeType === 'ts_diagram') {
        traces.push({
          x: sals,
          y: temps,
          name: profileName,
          type: 'scatter',
          mode: 'markers',
          marker: {
            size: 6,
            color: pressures,
            colorscale: 'YlGnBu',
            ...(colorIdx === 1 ? { colorbar: {
              title: { text: 'Depth (dbar)' },
              thickness: 12,
              len: 0.8,
            } } : {}),
            showscale: colorIdx === 1,
          },
          hovertemplate: '<b>%{data.name}</b><br>Salinity: %{x:.3f} PSU<br>Temp: %{y:.2f} °C<br>Depth: %{marker.color:.1f} dbar<extra></extra>',
        });
      } else if (activeType === 'time_series') {
        traces.push({
          x: dates,
          y: temps,
          name: `${profileName} (Surface Temp)`,
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: traceColor ?? '#0D7377', width: 2 },
          marker: { size: 6, color: traceColor ?? '#0D7377' },
          hovertemplate: '<b>%{data.name}</b><br>Date: %{x}<br>Temp: %{y:.2f} °C<extra></extra>',
        });
      }
    });

    const isDepthAxis = activeType === 'temp_depth' || activeType === 'sal_depth';

    const layout: Partial<Plotly.Layout> = {
      autosize: true,
      paper_bgcolor: '#FFFFFF',
      plot_bgcolor: '#F8FCFD',
      margin: { l: 60, r: 30, t: 30, b: 50 },
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#1E293B' },
      xaxis: {
        title: {
          text: activeType === 'temp_depth' 
            ? 'Temperature (°C)' 
            : activeType === 'sal_depth' 
            ? 'Practical Salinity (PSU)' 
            : activeType === 'ts_diagram' 
            ? 'Practical Salinity (PSU)' 
            : 'Observation Date',
          font: { size: 12, color: '#334155' }
        },
        gridcolor: '#E2E8F0',
        zerolinecolor: '#CBD5E1',
      },
      yaxis: {
        title: {
          text: isDepthAxis 
            ? 'Pressure / Depth (dbar)' 
            : activeType === 'ts_diagram' 
            ? 'Temperature (°C)' 
            : 'Temperature (°C)',
          font: { size: 12, color: '#334155' }
        },
        // Invert Y-axis for oceanographic depth: 0 dbar surface at top, 2000 dbar deep ocean at bottom!
        autorange: isDepthAxis ? 'reversed' : true,
        gridcolor: '#E2E8F0',
        zerolinecolor: '#CBD5E1',
      },
      showlegend: profilesMap.size <= 8,
      legend: {
        orientation: 'h',
        y: -0.22,
        x: 0,
        font: { size: 10, color: '#475569' }
      },
      hovermode: 'closest',
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    };

    Plotly.react(chartDivRef.current, traces, layout, config);

    const handleResize = () => {
      if (chartDivRef.current) Plotly.Plots.resize(chartDivRef.current);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [dataRows, activeType]);

  const handleDownloadImage = () => {
    if (chartDivRef.current) {
      Plotly.downloadImage(chartDivRef.current, {
        format: 'png',
        filename: `floatchat_${activeType}_profile`,
        width: 1200,
        height: 700,
      });
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-[#CBDCE7] shadow-md flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50 shadow-2xl' : 'w-full'}`}>
      {/* Header & Chart Type Selector */}
      <div className="px-4 py-3 bg-[#F4F9FC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            {title || 'Scientific Ocean Profile'}
          </h3>
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            ({dataRows.length} measurements plotted)
          </span>
        </div>

        {/* Chart Mode Tabs */}
        <div className="flex items-center p-1 bg-white rounded-lg border border-[#E2E8F0] text-xs font-medium">
          <button
            onClick={() => setActiveType('temp_depth')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeType === 'temp_depth' ? 'bg-teal-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Temp vs Depth
          </button>
          <button
            onClick={() => setActiveType('sal_depth')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeType === 'sal_depth' ? 'bg-teal-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Salinity vs Depth
          </button>
          <button
            onClick={() => setActiveType('ts_diagram')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeType === 'ts_diagram' ? 'bg-teal-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            T-S Diagram
          </button>
          <button
            onClick={() => setActiveType('time_series')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeType === 'time_series' ? 'bg-teal-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Time Series
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownloadImage}
            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-white rounded-lg border border-transparent hover:border-[#E2E8F0] transition-colors"
            title="Download Publication PNG Chart"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-white rounded-lg border border-transparent hover:border-[#E2E8F0] transition-colors"
            title={isExpanded ? 'Restore size' : 'Expand full screen'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notice info on inverted axis */}
      <div className="px-4 py-1.5 bg-[#FAFDFE] border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-teal-600" />
          {activeType === 'temp_depth' || activeType === 'sal_depth'
            ? 'Depth axis is inverted: surface (0 dbar) at top down to deep ocean (2000 dbar).'
            : activeType === 'ts_diagram'
            ? 'Water mass distribution: warmer/fresh surface waters vs deep cold saline masses.'
            : 'Temporal observation history of Indian Ocean profiles.'}
        </span>
        <span className="text-teal-700 font-semibold">ARGO CTD Observations</span>
      </div>

      {/* Plotly Canvas */}
      <div 
        ref={chartDivRef} 
        className="w-full flex-1 min-h-[380px]"
        style={{ height: isExpanded ? 'calc(100vh - 120px)' : '380px' }}
      />
    </div>
  );
};
