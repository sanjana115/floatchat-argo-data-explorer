import React, { useEffect, useMemo, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { X, Maximize2, Minimize2, Download, Info, Loader2, SearchX } from 'lucide-react';
import {
  groupProfiles,
  depthProfile,
  tsDiagram,
  timeSeries,
  toleranceFor,
  type ChartRow,
  type PlotResult,
} from '@/lib/floatchat/chartData';

export type ChartType = 'temp_depth' | 'sal_depth' | 'ts_diagram' | 'temp_time' | 'sal_time';

interface OceanChartProps {
  dataRows: any[];
  chartType: ChartType | 'time_series';
  title?: string;
  onClose?: () => void;
  isModal?: boolean;
  /** Render inline (no expand / fixed positioning), e.g. inside the map details panel. */
  compact?: boolean;
}

const TABS: Array<{ id: ChartType; label: string }> = [
  { id: 'temp_depth', label: 'Temp vs Pressure' },
  { id: 'sal_depth', label: 'Salinity vs Pressure' },
  { id: 'ts_diagram', label: 'T-S Diagram' },
  { id: 'temp_time', label: 'Temp vs Time' },
  { id: 'sal_time', label: 'Salinity vs Time' },
];
const PRESSURE_CHOICES = [5, 10, 20, 50, 100, 200, 500, 1000, 1500, 2000];

const normalise = (t: OceanChartProps['chartType']): ChartType => (t === 'time_series' ? 'temp_time' : t);
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : 'date unknown');

export const OceanChart: React.FC<OceanChartProps> = ({ dataRows, chartType: initialType, title, onClose, compact = false }) => {
  const chartDivRef = useRef<HTMLDivElement>(null);
  const [activeType, setActiveType] = useState<ChartType>(normalise(initialType));
  const [isExpanded, setIsExpanded] = useState(false);
  const [includeAllQc, setIncludeAllQc] = useState(false);
  const [targetPressure, setTargetPressure] = useState(10);

  const profiles = useMemo(() => groupProfiles((dataRows ?? []) as ChartRow[]), [dataRows]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = profiles.find((p) => p.key === selectedKey) ?? profiles[0] ?? null;

  useEffect(() => setActiveType(normalise(initialType)), [initialType]);
  useEffect(() => setSelectedKey(null), [dataRows]);

  // Time graphs: fetch readings near the chosen pressure for every cycle of the selected float.
  const isTime = activeType === 'temp_time' || activeType === 'sal_time';
  const floatId = selected?.floatId ?? null;
  const [series, setSeries] = useState<{ key: string; readings: ChartRow[] } | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const seriesKey = `${floatId}|${targetPressure}`;

  useEffect(() => {
    if (!isTime || !floatId || series?.key === seriesKey) return;
    let cancelled = false;
    setSeriesLoading(true);
    setSeriesError(null);
    fetch(`/api/float/${encodeURIComponent(floatId)}/series?pressure=${targetPressure}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!cancelled) setSeries({ key: seriesKey, readings: data.readings ?? [] });
      })
      .catch((e) => !cancelled && setSeriesError(e.message))
      .finally(() => !cancelled && setSeriesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isTime, floatId, targetPressure, seriesKey, series?.key]);

  // Build the plot data for the active graph.
  const plot = useMemo(() => {
    const opts = { includeAllQc };
    if (!selected) return null;
    if (activeType === 'temp_depth') return { kind: 'depth' as const, res: depthProfile(selected.rows, 'temperature', opts) };
    if (activeType === 'sal_depth') return { kind: 'depth' as const, res: depthProfile(selected.rows, 'salinity', opts) };
    if (activeType === 'ts_diagram') return { kind: 'ts' as const, res: tsDiagram(selected.rows, opts) };
    if (!series || series.key !== seriesKey) return { kind: 'time' as const, points: null, cyclesSkipped: 0 };
    const variable = activeType === 'temp_time' ? 'temperature' : 'salinity';
    return { kind: 'time' as const, ...timeSeries(series.readings, variable, targetPressure, opts) };
  }, [selected, activeType, includeAllQc, series, seriesKey, targetPressure]);

  const plottedCount =
    plot === null ? 0 : plot.kind === 'time' ? plot.points?.length ?? 0 : (plot.res as PlotResult).plotted;

  let emptyMessage: string | null = null;
  if (!selected) emptyMessage = 'These results have no depth readings (pressure with temperature or salinity) to plot.';
  else if (plot?.kind === 'time') {
    if (!floatId) emptyMessage = 'This profile has no float identifier, so a time graph cannot be built.';
    else if (seriesError) emptyMessage = `Could not load this float's readings: ${seriesError}`;
    else if (plot.points === null) emptyMessage = null; // loading
    else if (plot.points.length < 2)
      emptyMessage = `This float has ${plot.points.length === 0 ? 'no cycles' : 'only 1 cycle'} with a usable reading near ${targetPressure} dbar, so there is no line to draw. A time graph needs at least 2 cycles.`;
  } else if (plottedCount === 0) {
    emptyMessage = includeAllQc
      ? 'No readings in this profile have a value for this graph.'
      : 'No readings in this profile pass the quality check (flags 1 or 2). Tick "Include all QC flags" to see them anyway.';
  }

  useEffect(() => {
    const el = chartDivRef.current;
    if (!el) return;
    if (!plot || emptyMessage || (plot.kind === 'time' && !plot.points)) {
      Plotly.purge(el);
      return;
    }
    const color = '#0D9488';
    let traces: Plotly.Data[] = [];
    let xTitle = '';
    let yTitle = '';
    let reversed = false;
    let xType: 'date' | '-' = '-';

    if (plot.kind === 'depth') {
      const isTemp = activeType === 'temp_depth';
      traces = [{
        x: plot.res.x, y: plot.res.y, type: 'scatter', mode: 'lines+markers', name: isTemp ? 'Temperature' : 'Salinity',
        line: { color, width: 2 }, marker: { size: 4, color },
        hovertemplate: isTemp
          ? 'Temp: %{x:.2f} °C<br>Pressure: %{y:.1f} dbar<extra></extra>'
          : 'Salinity: %{x:.3f} PSU<br>Pressure: %{y:.1f} dbar<extra></extra>',
      }];
      xTitle = isTemp ? 'Temperature (°C)' : 'Salinity (PSU)';
      yTitle = 'Pressure (dbar)';
      reversed = true;
    } else if (plot.kind === 'ts') {
      traces = [{
        x: plot.res.x, y: plot.res.y, type: 'scatter', mode: 'markers', name: 'Readings',
        marker: { size: 6, color: plot.res.c, colorscale: 'YlGnBu', reversescale: true, showscale: true,
          colorbar: { title: { text: 'Pressure (dbar)' }, thickness: 12, len: 0.8 } },
        hovertemplate: 'Salinity: %{x:.3f} PSU<br>Temp: %{y:.2f} °C<br>Pressure: %{marker.color:.1f} dbar<extra></extra>',
      }];
      xTitle = 'Salinity (PSU)';
      yTitle = 'Temperature (°C)';
    } else if (plot.points) {
      const isTemp = activeType === 'temp_time';
      traces = [{
        x: plot.points.map((p) => p.time), y: plot.points.map((p) => p.value),
        customdata: plot.points.map((p) => [p.cycleNumber ?? '?', p.pressure]),
        type: 'scatter', mode: 'lines+markers', name: isTemp ? 'Temperature' : 'Salinity',
        line: { color, width: 2 }, marker: { size: 6, color },
        hovertemplate: (isTemp ? 'Temp: %{y:.2f} °C' : 'Salinity: %{y:.3f} PSU') +
          '<br>%{x|%Y-%m-%d}<br>Cycle %{customdata[0]} · %{customdata[1]:.1f} dbar<extra></extra>',
      }];
      xTitle = 'Profile date';
      yTitle = isTemp ? 'Temperature (°C)' : 'Salinity (PSU)';
      xType = 'date';
    }

    const layout: Partial<Plotly.Layout> = {
      autosize: true,
      paper_bgcolor: '#FFFFFF',
      plot_bgcolor: '#F8FCFD',
      margin: { l: 64, r: 30, t: 20, b: 50 },
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#1E293B' },
      xaxis: { title: { text: xTitle, font: { size: 12, color: '#334155' } }, type: xType, gridcolor: '#E2E8F0', zerolinecolor: '#CBD5E1' },
      yaxis: { title: { text: yTitle, font: { size: 12, color: '#334155' } }, autorange: reversed ? 'reversed' : true, gridcolor: '#E2E8F0', zerolinecolor: '#CBD5E1' },
      showlegend: false,
      hovermode: 'closest',
    };
    Plotly.react(el, traces, layout, { responsive: true, displayModeBar: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });
    const onResize = () => chartDivRef.current && Plotly.Plots.resize(chartDivRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [plot, emptyMessage, activeType]);

  const handleDownloadImage = () => {
    if (chartDivRef.current && !emptyMessage) {
      Plotly.downloadImage(chartDivRef.current, { format: 'png', filename: `floatchat_${activeType}`, width: 1200, height: 700 });
    }
  };

  const qcNote =
    plot && plot.kind !== 'time' && !(plot.res as PlotResult).qcChecked && !includeAllQc
      ? ' These results do not include quality flags, so they could not be quality-checked here.'
      : '';
  const excludedNote =
    plot && plot.kind !== 'time'
      ? [
          plot.res.missing ? `${plot.res.missing} missing` : '',
          plot.res.qcRejected ? `${plot.res.qcRejected} failed QC` : '',
        ].filter(Boolean).join(', ')
      : plot?.kind === 'time' && plot.cyclesSkipped
      ? `${plot.cyclesSkipped} cycle${plot.cyclesSkipped === 1 ? '' : 's'} without a usable reading near ${targetPressure} dbar`
      : '';

  const heightStyle = isExpanded ? 'calc(100vh - 200px)' : compact ? '300px' : '380px';

  return (
    <div className={`bg-white rounded-2xl border border-[#CBDCE7] shadow-md flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50 shadow-2xl' : 'w-full'}`}>
      <div className="px-4 py-3 bg-[#F4F9FC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">{title || 'Ocean Profile'}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleDownloadImage} className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-white rounded-lg border border-transparent hover:border-[#E2E8F0] transition-colors" title="Download PNG">
            <Download className="w-4 h-4" />
          </button>
          {!compact && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-white rounded-lg border border-transparent hover:border-[#E2E8F0] transition-colors" title={isExpanded ? 'Restore size' : 'Expand full screen'}>
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors ml-1" aria-label="Close graph">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-b border-[#E2E8F0] flex flex-wrap items-center gap-2 text-xs">
        <div className="flex flex-wrap items-center p-1 bg-white rounded-lg border border-[#E2E8F0] font-medium">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeType === t.id ? 'bg-teal-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {profiles.length > 1 && (
          <label className="flex items-center gap-1.5 text-slate-600">
            <span>Profile</span>
            <select value={selected?.key ?? ''} onChange={(e) => setSelectedKey(e.target.value)}
              className="px-2 py-1 rounded-md border border-[#E2E8F0] bg-white text-slate-800 max-w-[260px]">
              {profiles.map((p) => (
                <option key={p.key} value={p.key}>
                  Float {p.floatId ?? '?'} · cycle {p.cycleNumber ?? '?'} · {fmtDate(p.profileTime)}
                </option>
              ))}
            </select>
          </label>
        )}
        {isTime && (
          <label className="flex items-center gap-1.5 text-slate-600">
            <span>Nearest to</span>
            <select value={targetPressure} onChange={(e) => setTargetPressure(Number(e.target.value))}
              className="px-2 py-1 rounded-md border border-[#E2E8F0] bg-white text-slate-800">
              {PRESSURE_CHOICES.map((p) => <option key={p} value={p}>{p} dbar</option>)}
            </select>
            <span className="text-slate-400">(±{toleranceFor(targetPressure)} dbar)</span>
          </label>
        )}
        <label className="flex items-center gap-1.5 text-slate-600 ml-auto">
          <input type="checkbox" checked={includeAllQc} onChange={(e) => setIncludeAllQc(e.target.checked)} className="accent-teal-600" />
          <span>Include all QC flags</span>
        </label>
      </div>

      <div className="px-4 py-1.5 bg-[#FAFDFE] border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-teal-600" />
          {isTime
            ? `Float ${floatId ?? '?'}: one point per cycle, reading nearest ${targetPressure} dbar.`
            : selected
            ? `Float ${selected.floatId ?? '?'} · cycle ${selected.cycleNumber ?? '?'} · ${fmtDate(selected.profileTime)}.`
            : 'No profile selected.'}
          {' '}{includeAllQc ? 'All QC flags shown.' : 'QC flags 1 and 2 only.'}{qcNote}
        </span>
        <span className="font-semibold text-teal-700">
          {plottedCount.toLocaleString()} points plotted{excludedNote ? ` · excluded: ${excludedNote}` : ''}
        </span>
      </div>

      <div className="relative w-full flex-1" style={{ minHeight: heightStyle }}>
        <div ref={chartDivRef} className="w-full" style={{ height: heightStyle }} />
        {(emptyMessage || (isTime && seriesLoading)) && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-white">
            {isTime && seriesLoading ? (
              <div role="status" className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> Loading this float's cycles…
              </div>
            ) : (
              <div className="flex items-start gap-2 max-w-md text-xs text-slate-600">
                <SearchX className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{emptyMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
