import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Map as MapIcon, 
  Layers, 
  Plus, 
  Minus, 
  Crosshair, 
  Maximize2, 
  Minimize2, 
  Info,
  Waves,
  Activity,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Loader2,
  SearchX
} from 'lucide-react';
import { ArgoProfile, FloatTrackPoint } from '../../types/argo';
import { 
  INDIAN_OCEAN_BATHYMETRY, 
  MAP_TYPOGRAPHY_LABELS,
} from '../../data/indianOceanGeography';

const CLUSTER_CELL_DEG = 10;
const CLUSTER_MIN_FLOATS = 5;

const fmtLat = (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'N' : 'S'}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'E' : 'W'}`;
const MODE_LABEL: Record<string, string> = { R: 'Real-Time (R)', A: 'Adjusted (A)', D: 'Delayed-Mode (D)' };

/** Clusters computed from the loaded profiles: distinct floats per 10° cell (no preset counts). */
function buildClusters(profiles: ArgoProfile[]) {
  const cells = new Map<string, { floats: Set<string>; synthetic: Set<string>; n: number; lat: number; lon: number; cellLat: number; cellLon: number }>();
  for (const p of profiles) {
    const cellLat = Math.floor(p.latitude / CLUSTER_CELL_DEG) * CLUSTER_CELL_DEG;
    const cellLon = Math.floor(p.longitude / CLUSTER_CELL_DEG) * CLUSTER_CELL_DEG;
    const key = `${cellLat}:${cellLon}`;
    let c = cells.get(key);
    if (!c) {
      c = { floats: new Set(), synthetic: new Set(), n: 0, lat: 0, lon: 0, cellLat, cellLon };
      cells.set(key, c);
    }
    c.floats.add(p.float_id);
    if (p.data_source === 'synthetic') c.synthetic.add(p.profile_id);
    c.n++;
    c.lat += p.latitude;
    c.lon += p.longitude;
  }
  return [...cells.entries()]
    .map(([id, c]) => ({
      id,
      count: c.floats.size,
      profiles: c.n,
      synthetic: c.synthetic.size,
      lat: c.lat / c.n,
      lon: c.lon / c.n,
      region: `${fmtLat(c.cellLat).replace('.00', '')}–${fmtLat(c.cellLat + CLUSTER_CELL_DEG).replace('.00', '')}, ${fmtLon(c.cellLon).replace('.00', '')}–${fmtLon(c.cellLon + CLUSTER_CELL_DEG).replace('.00', '')}`,
    }))
    .filter((c) => c.count >= CLUSTER_MIN_FLOATS);
}

interface OceanMapProps {
  profiles: ArgoProfile[];
  selectedProfile: ArgoProfile | null;
  onSelectProfile: (profile: ArgoProfile) => void;
  selectedBasin: string;
  onSelectBasin: (basin: string) => void;
  selectedFloatTrack: FloatTrackPoint[] | null;
  activeHighlightedFloatId: string | null;
  onInspectFloatProfile: (profileId: string) => void;
  loading?: boolean;
  error?: string | null;
  /** Number of profiles loaded before filters, to tell "no data" from "filtered out". */
  totalLoaded?: number;
  onRetry?: () => void;
}

export const OceanMap: React.FC<OceanMapProps> = ({
  profiles,
  selectedProfile,
  onSelectProfile,
  selectedBasin,
  onSelectBasin,
  selectedFloatTrack,
  activeHighlightedFloatId,
  onInspectFloatProfile,
  loading = false,
  error = null,
  totalLoaded = 0,
  onRetry,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const bathymetryLayerRef = useRef<L.LayerGroup | null>(null);
  const clustersLayerRef = useRef<L.LayerGroup | null>(null);
  const trackLayerRef = useRef<L.Polyline | null>(null);
  const trackPointsLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeLayerMode, setActiveLayerMode] = useState<'map' | 'layers'>('map');
  const [showContours, setShowContours] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLegendInfo, setShowLegendInfo] = useState(false);
  const [isLegendVisible, setIsLegendVisible] = useState(true);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Indian Ocean as shown in Image 2
    const map = L.map(mapContainerRef.current, {
      center: [2.0, 78.0],
      zoom: 4,
      minZoom: 2,
      maxZoom: 9,
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: true,
      zoomAnimationThreshold: 8,
      fadeAnimation: true,
      markerZoomAnimation: true,
      wheelPxPerZoomLevel: 100,
    });

    // Clean Esri Ocean Basemap with authentic bathymetry and coastlines
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 13,
        opacity: 0.85,
      }
    ).addTo(map);

    // 1. Add Visible Depth Contours & Isobath Labels (-1,000, -2,000, -3,000, -5,000, -7,000)
    const bathyGroup = L.layerGroup().addTo(map);
    bathymetryLayerRef.current = bathyGroup;

    INDIAN_OCEAN_BATHYMETRY.forEach((feat) => {
      // Contour polyline
      const polyline = L.polyline(feat.coordinates, {
        color: '#0284C7',
        weight: 1.1,
        opacity: 0.45,
        smoothFactor: 1.5,
      });
      bathyGroup.addLayer(polyline);

      // Depth number label along contour (Image 2 style: -1,000, -2,000, -3,000, -5,000)
      const midIdx = Math.floor(feat.coordinates.length * 0.45);
      const labelCoord = feat.coordinates[midIdx];
      
      const labelIcon = L.divIcon({
        className: 'depth-contour-badge',
        html: `<span style="font-family: system-ui, -apple-system, sans-serif; font-size: 10px; font-weight: 600; color: #0284C7; opacity: 0.75; letter-spacing: 0.02em; pointer-events: none; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">${feat.depthLabel}</span>`,
        iconSize: [40, 14],
        iconAnchor: [20, 7],
      });
      if (!labelCoord) return;
      const labelMarker = L.marker(labelCoord, { icon: labelIcon, interactive: false });
      bathyGroup.addLayer(labelMarker);
    });

    // 3. Map Typography Labels (INDIA, AUSTRALIA, ARABIAN SEA, BAY OF BENGAL, INDIAN OCEAN)
    const typoGroup = L.layerGroup().addTo(map);

    MAP_TYPOGRAPHY_LABELS.forEach((lbl) => {
      let labelHtml = '';
      let size: [number, number] = [120, 30];

      if (lbl.type === 'land') {
        // Crisp Land Label (INDIA, AUSTRALIA)
        labelHtml = `
          <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; color: #334155; text-align: center; pointer-events: none;">
            ${lbl.text}
          </div>
        `;
      } else if (lbl.type === 'sea') {
        // Arabian Sea / Bay of Bengal
        labelHtml = `
          <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: #0369A1; text-align: center; line-height: 1.3; pointer-events: none; opacity: 0.85;">
            ${lbl.text.replace('\n', '<br/>')}
          </div>
        `;
      } else if (lbl.type === 'ocean') {
        // Wide-spaced INDIAN OCEAN label
        size = [240, 40];
        labelHtml = `
          <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.35em; color: #0369A1; text-align: center; line-height: 1.4; pointer-events: none; opacity: 0.85;">
            ${lbl.text.replace('\n', '<br/>')}
          </div>
        `;
      }

      const typoIcon = L.divIcon({
        className: 'ocean-typo-label',
        html: labelHtml,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1] / 2],
      });
      const typoMarker = L.marker([lbl.lat, lbl.lon], { icon: typoIcon, interactive: false });
      typoGroup.addLayer(typoMarker);
    });

    // 4. Clusters & Float Markers Layer
    const clusterGroup = L.layerGroup().addTo(map);
    clustersLayerRef.current = clusterGroup;

    // Resize observer to ensure tiles always fill container when expanded
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    mapInstanceRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Clusters and Float Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clustersLayerRef.current;
    if (!map || !clusterGroup) return;

    clusterGroup.clearLayers();

    // 1. Clusters computed from the loaded profiles (distinct floats per 10° cell)
    buildClusters(profiles).forEach((c) => {
      // Dynamic halo & diameter based on count
      const isHuge = c.count >= 100;
      const innerSize = isHuge ? 44 : c.count >= 60 ? 38 : 34;
      const haloSize = isHuge ? 72 : c.count >= 60 ? 62 : 54;
      const fontSize = isHuge ? 14 : 12;

      const clusterHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${haloSize}px; height: ${haloSize}px;">
          <!-- Translucent glowing outer halo -->
          <div style="width: ${haloSize}px; height: ${haloSize}px; background: rgba(13, 115, 119, 0.22); border-radius: 9999px; position: absolute; transform: scale(1); transition: transform 0.25s ease;"
               class="group-hover:scale-115"></div>
          <!-- Solid Teal Inner Badge -->
          <div style="width: ${innerSize}px; height: ${innerSize}px; background-color: #0D7377; border-radius: 9999px; position: relative; z-index: 10; display: flex; align-items: center; justify-center; color: #FFFFFF; font-size: ${fontSize}px; font-weight: 700; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 4px 12px rgba(13, 115, 119, 0.35); text-align: center; line-height: 1;">
            <span style="width: 100%; text-align: center;">${c.count}</span>
          </div>
        </div>
      `;

      const clusterIcon = L.divIcon({
        className: 'reference-cluster-icon',
        html: clusterHtml,
        iconSize: [haloSize, haloSize],
        iconAnchor: [haloSize / 2, haloSize / 2],
      });

      const clusterMarker = L.marker([c.lat, c.lon], { icon: clusterIcon });

      clusterMarker.on('click', () => {
        map.flyTo([c.lat, c.lon], Math.min(map.getZoom() + 2, 7), { duration: 0.8 });
      });

      clusterMarker.bindTooltip(
        `<div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 3px 6px;">
          <strong style="color: #0D7377;">${c.count} floats · ${c.profiles} profiles</strong><br/>
          <span>${c.region}</span><br/>
          ${c.synthetic ? `<span style="color:#C2410C;font-weight:600;">${c.synthetic} synthetic profile${c.synthetic === 1 ? '' : 's'}</span><br/>` : ''}
          <span style="font-size: 10px; color: #64748B;">Click to zoom into basin</span>
        </div>`,
        { direction: 'top', offset: [0, -innerSize / 2] }
      );

      clusterGroup.addLayer(clusterMarker);
    });

    // 2. Render Scattered Individual Float Dots (small teal dots with white border)
    profiles.forEach((p) => {
      const isSelected = selectedProfile?.profile_id === p.profile_id;
      const isHighlighted = activeHighlightedFloatId === p.wmo_number || activeHighlightedFloatId === p.float_id;

      const isSynthetic = p.data_source === 'synthetic';
      const dotColor = p.data_mode === 'D' ? '#0D7377' : p.data_mode === 'A' ? '#0284C7' : '#14B8A6';
      const size = isSelected || isHighlighted ? 12 : isSynthetic ? 9 : 7;

      // Real profiles: solid dot with white border. Synthetic (user-imported): hollow dot with an orange dashed ring.
      const dotStyle = isSynthetic
        ? `width: ${size}px; height: ${size}px; background-color: #FFFFFF; border: 2px dashed #EA580C; border-radius: 9999px; box-shadow: 0 1px 4px rgba(234, 88, 12, 0.35);`
        : `width: ${size}px; height: ${size}px; background-color: ${dotColor}; border: 1.5px solid #FFFFFF; border-radius: 9999px; box-shadow: 0 1px 4px rgba(13, 115, 119, 0.3);`;
      const dotHtml = `
        <div class="relative flex items-center justify-center cursor-pointer" style="width: 18px; height: 18px;" title="${isSynthetic ? 'Synthetic (user-imported) profile' : 'Real Argo profile'}">
          ${isSelected || isHighlighted ? '<div class="absolute inset-0 rounded-full bg-teal-400 opacity-70 marker-pulse"></div>' : ''}
          <div style="${dotStyle}"></div>
        </div>
      `;

      const dotIcon = L.divIcon({
        className: 'reference-float-dot',
        html: dotHtml,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([p.latitude, p.longitude], { icon: dotIcon });

      marker.on('click', () => {
        onSelectProfile(p);
      });

      // Bind details popup
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 200px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <strong style="color: #0F2238; font-size: 13px;">Float WMO ${p.wmo_number}</strong>
            <span style="font-size: 10px; color: #64748B; font-family: monospace;">Cycle #${p.cycle_number}</span>
          </div>
          <div style="margin-bottom: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
            <span style="background: #E1F5F0; color: #0D5C52; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px;">
              ${MODE_LABEL[p.data_mode] ?? p.data_mode}
            </span>
            ${isSynthetic
              ? '<span style="background: #FFF7ED; color: #C2410C; border: 1px dashed #EA580C; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">SYNTHETIC · user import</span>'
              : '<span style="background: #ECFDF5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px;">REAL · Argo file</span>'}
          </div>
          <div style="font-size: 11px; color: #334155; line-height: 1.5; border-top: 1px solid #E2E8F0; padding-top: 5px;">
            <div>Lat/Lon: ${fmtLat(p.latitude)}, ${fmtLon(p.longitude)}</div>
            <div>Date: ${p.profile_time ? p.profile_time.split('T')[0] : 'unknown'}</div>
            <div>Position QC: ${p.position_qc === null || p.position_qc === undefined ? 'unknown' : p.position_qc}</div>
            ${p.source_file ? `<div style="font-size: 10px; color: #64748B; word-break: break-all;">File: ${p.source_file}</div>` : ''}
            ${p.surface_temp ? `<div>Surface Temp: ${p.surface_temp} °C</div>` : ''}
            ${p.surface_salinity ? `<div>Surface Salinity: ${p.surface_salinity} PSU</div>` : ''}
          </div>
          <button id="pop-inspect-${p.profile_id}" 
                  style="width: 100%; margin-top: 8px; background: #0D7377; color: #FFFFFF; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
            Inspect CTD Profile →
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`pop-inspect-${p.profile_id}`);
        if (btn) {
          btn.onclick = () => onInspectFloatProfile(p.profile_id);
        }
      });

      clusterGroup.addLayer(marker);
    });
  }, [profiles, selectedProfile, activeHighlightedFloatId]);

  // Handle Float Trajectory Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (trackLayerRef.current) {
      map.removeLayer(trackLayerRef.current);
      trackLayerRef.current = null;
    }
    if (trackPointsLayerRef.current) {
      map.removeLayer(trackPointsLayerRef.current);
      trackPointsLayerRef.current = null;
    }

    if (selectedFloatTrack && selectedFloatTrack.length > 1) {
      const latlngs: [number, number][] = selectedFloatTrack.map((pt) => [pt.latitude, pt.longitude]);

      const polyline = L.polyline(latlngs, {
        color: '#0D7377',
        weight: 2.5,
        opacity: 0.85,
        dashArray: '4, 4',
      }).addTo(map);

      trackLayerRef.current = polyline;

      const pointsGroup = L.layerGroup().addTo(map);
      selectedFloatTrack.forEach((pt) => {
        const circle = L.circleMarker([pt.latitude, pt.longitude], {
          radius: 3,
          fillColor: '#FFFFFF',
          color: '#0D7377',
          weight: 2,
          opacity: 1,
          fillOpacity: 1,
        });
        pointsGroup.addLayer(circle);
      });
      trackPointsLayerRef.current = pointsGroup;
    }
  }, [selectedFloatTrack]);

  // Map Controls Helpers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn(1, { animate: true });
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut(1, { animate: true });
  };

  const handleRecenter = () => {
    mapInstanceRef.current?.flyTo([2.0, 78.0], 4, { duration: 1 });
    onSelectBasin('all');
  };

  const toggleContours = () => {
    setShowContours(!showContours);
    if (bathymetryLayerRef.current && mapInstanceRef.current) {
      if (showContours) {
        mapInstanceRef.current.removeLayer(bathymetryLayerRef.current);
      } else {
        mapInstanceRef.current.addLayer(bathymetryLayerRef.current);
      }
    }
  };

  return (
    <div
      className={`relative w-full flex-1 min-h-[500px] lg:min-h-[540px] h-full bg-[#D4EBF5] rounded-3xl overflow-hidden border border-[#D5E6F0] shadow-xs select-none transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl h-auto' : ''
      }`}
    >
      {/* 1. Top-Right Segmented Pill: [Map icon] Map | [Layers icon] Layers */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center bg-white rounded-full p-1 border border-[#E2EEF5] shadow-sm">
        <button
          onClick={() => setActiveLayerMode('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeLayerMode === 'map'
              ? 'bg-[#0D7377] text-white shadow-2xs'
              : 'text-[#64748B] hover:text-[#0F2238]'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Map</span>
        </button>

        <button
          onClick={() => {
            setActiveLayerMode('layers');
            toggleContours();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeLayerMode === 'layers'
              ? 'bg-[#0D7377] text-white shadow-2xs'
              : 'text-[#64748B] hover:text-[#0F2238]'
          }`}
          title="Toggle Depth Contours & Bathymetry Layer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Layers</span>
        </button>
      </div>

      {/* 2. Right-Side Zoom & Tool Rail (Exact Match to Image 2) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] bg-white rounded-2xl border border-[#E2EEF5] shadow-sm flex flex-col items-center p-1 gap-1 text-[#475569]">
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-[#F3FAF9] hover:text-[#0D7377] rounded-xl transition-colors"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-[#F3FAF9] hover:text-[#0D7377] rounded-xl transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-4 h-[1px] bg-slate-200 my-0.5" />

        {/* Recenter Crosshair */}
        <button
          onClick={handleRecenter}
          className="p-2 hover:bg-[#F3FAF9] hover:text-[#0D7377] rounded-xl transition-colors"
          title="Center Indian Ocean View"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Fullscreen Expand */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 hover:bg-[#F3FAF9] hover:text-[#0D7377] rounded-xl transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Contours Toggle */}
        <button
          onClick={toggleContours}
          className={`p-2 rounded-xl transition-colors ${
            showContours ? 'text-[#0D7377] bg-[#E1F5F0]' : 'hover:bg-[#F3FAF9]'
          }`}
          title="Toggle Depth Contours"
        >
          <Waves className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Bottom-Left Scale Bar (Exact Match to Image 2) */}
      <div className="absolute bottom-5 left-5 z-[1000] pointer-events-none select-none">
        {/* Distance Numbers */}
        <div className="flex justify-between text-[10px] text-[#475569] font-medium font-mono pl-0.5 mb-0.5 w-44">
          <span>0</span>
          <span>1,000</span>
          <span>2,000</span>
          <span>4,000 km</span>
        </div>
        {/* Scale Line with tick marks */}
        <div className="relative w-44 h-1.5 border-b border-l border-r border-[#475569]">
          <div className="absolute top-0 left-1/4 h-1.5 border-r border-[#475569]" />
          <div className="absolute top-0 left-1/2 h-1.5 border-r border-[#475569]" />
        </div>
      </div>

      {/* 4. Bottom-Right Floating Legend Card with Collapse/Expand Toggle Switch */}
      {isLegendVisible ? (
        <div className="absolute bottom-5 right-5 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl border border-[#E2EEF5] shadow-sm p-4 min-w-[220px] pointer-events-auto transition-all duration-200 animate-in fade-in zoom-in-95">
          {/* Legend Header with Title, Info Icon, and Toggle Switch */}
          <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-[#0F2238]">
              ARGO Floats ({profiles.length.toLocaleString()} profiles)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLegendInfo(!showLegendInfo)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                title="ARGO profiling float cluster methodology"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {/* Toggle switch to collapse legend */}
              <button
                type="button"
                role="switch"
                aria-checked={true}
                onClick={() => setIsLegendVisible(false)}
                className="relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-[#0D7377] transition-colors duration-200 ease-in-out focus:outline-none"
                title="Collapse map legend"
              >
                <span className="sr-only">Toggle map legend</span>
                <span className="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out translate-x-3" />
              </button>
            </div>
          </div>

          {/* Legend Rows */}
          <div className="space-y-2 text-xs text-[#334155]">
            {/* Row 1: Cluster (number of floats) */}
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-[#0D7377] shrink-0" />
              <span className="text-xs font-medium text-[#475569]">
                Cluster (number of floats)
              </span>
            </div>

            {/* Row 2: Individual profile (real) */}
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[#0D7377] shrink-0 ml-1 mr-1" />
              <span className="text-xs font-medium text-[#475569]">
                Real Argo profile (R / A / D)
              </span>
            </div>

            {/* Row 2b: Synthetic profile */}
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-dashed border-orange-600 shrink-0 ml-[3px] mr-[3px]" />
              <span className="text-xs font-medium text-[#475569]">
                Synthetic profile (user import)
              </span>
            </div>

            {/* Row 3: Depth Contours (m) */}
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-0.5 bg-[#0284C7] shrink-0" />
              <span className="text-xs font-medium text-[#475569]">
                Depth Contours (m)
              </span>
            </div>
          </div>

          {/* Expandable methodology info */}
          {showLegendInfo && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed animate-in fade-in duration-150">
              Clusters count distinct floats in each 10° cell of the loaded profiles (shown when a cell has {CLUSTER_MIN_FLOATS}+ floats). Click a cluster to zoom in.
            </div>
          )}
        </div>
      ) : (
        /* Collapsed pill state giving users maximum viewable map area */
        <div
          onClick={() => setIsLegendVisible(true)}
          className="absolute bottom-5 right-5 z-[1000] bg-white/95 backdrop-blur-md rounded-full border border-[#E2EEF5] shadow-sm px-3.5 py-1.5 flex items-center gap-2.5 cursor-pointer hover:bg-white hover:border-[#CBDCE7] transition-all duration-200 pointer-events-auto select-none group"
          title="Click or toggle to expand map legend"
        >
          <span className="text-xs font-semibold text-[#0F2238] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#0D7377]" />
            Legend
          </span>
          {/* Toggle Switch to Expand */}
          <button
            type="button"
            role="switch"
            aria-checked={false}
            onClick={(e) => {
              e.stopPropagation();
              setIsLegendVisible(true);
            }}
            className="relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-300 group-hover:bg-slate-400 transition-colors duration-200 ease-in-out focus:outline-none"
            title="Expand map legend"
          >
            <span className="sr-only">Toggle map legend</span>
            <span className="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out translate-x-0" />
          </button>
        </div>
      )}

      {/* Loading / error / empty overlays */}
      {(loading || error || profiles.length === 0) && (
        <div className="absolute inset-x-0 top-16 z-[1000] flex justify-center pointer-events-none">
          <div
            role={error ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-md rounded-2xl border bg-white/95 backdrop-blur-md shadow-sm px-4 py-3 flex items-start gap-2.5 ${error ? 'border-rose-200' : 'border-[#E2EEF5]'}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 text-[#0D7377] animate-spin shrink-0 mt-0.5" />
                <span className="text-xs text-[#334155]">Loading profiles from the database…</span>
              </>
            ) : error ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-[#334155]">
                  <div className="font-semibold text-[#0F2238]">Couldn't load map profiles</div>
                  <div className="text-[#64748B]">{error}</div>
                  {onRetry && (
                    <button onClick={onRetry} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D7377]">
                      <RefreshCw className="w-3 h-3" /> Try again
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <SearchX className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
                <div className="text-xs text-[#334155]">
                  {totalLoaded === 0 ? (
                    <>
                      <div className="font-semibold text-[#0F2238]">No profiles in the database yet</div>
                      <div className="text-[#64748B]">Load Argo NetCDF files to see floats on the map.</div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-[#0F2238]">No profiles match the current filters</div>
                      <div className="text-[#64748B]">{totalLoaded.toLocaleString()} profiles are loaded; clear the search or change the data-mode filter in Settings.</div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Leaflet Map DOM element */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

