import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MetricCards } from './components/dashboard/MetricCards';
import { OceanMap } from './components/map/OceanMap';
import { AskFloatChatView } from './components/chat/AskFloatChatView';
import { OceanChart } from './components/charts/OceanChart';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { FloatExplorerView } from './components/floats/FloatExplorerView';
import { SavedQueriesView } from './components/views/SavedQueriesView';
import { AboutDocsView } from './components/views/AboutDocsView';
import { SettingsView } from './components/views/SettingsView';
import { ImportProfileModal } from './components/modals/ImportProfileModal';
import { 
  ArgoProfile, 
  DatabaseStats, 
  ChatMessage, 
  FloatTrackPoint 
} from './types/argo';

export default function FloatChatApp() {
  const [currentTab, setCurrentTab] = useState<NavTab>('explore');

  // Data states
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profiles, setProfiles] = useState<ArgoProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ArgoProfile | null>(null);
  const [selectedFloatTrack, setSelectedFloatTrack] = useState<FloatTrackPoint[] | null>(null);
  const [activeHighlightedFloatId, setActiveHighlightedFloatId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBasin, setSelectedBasin] = useState('all');
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [qcFilterStrict, setQcFilterStrict] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  // Chart Modal State
  const [chartState, setChartState] = useState<{
    isOpen: boolean;
    dataRows: any[];
    chartType: 'temp_depth' | 'sal_depth' | 'ts_diagram' | 'time_series';
    title: string;
  }>({
    isOpen: false,
    dataRows: [],
    chartType: 'temp_depth',
    title: '',
  });

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Fetch Database Stats
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const res = await fetch('/api/stats');
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      setStatsError(err?.message ?? 'Unknown error');
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Profiles
  const fetchProfiles = async () => {
    try {
      setProfilesLoading(true);
      setProfilesError(null);
      const res = await fetch('/api/map/profiles');
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || `HTTP ${res.status}`);
      }
      setProfiles(data);
      if (data.length > 0 && !selectedProfile) {
        setSelectedProfile(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch profiles:', err);
      setProfilesError(err?.message ?? 'Unknown error');
    } finally {
      setProfilesLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchProfiles();
  }, []);

  // Fetch Track when selected profile changes
  useEffect(() => {
    if (!selectedProfile) return;
    const loadTrack = async () => {
      try {
        const res = await fetch(`/api/float/${selectedProfile.float_id}/track`);
        if (res.ok) {
          const track = await res.json();
          setSelectedFloatTrack(track);
        }
      } catch (err) {
        console.error('Failed to load float track:', err);
      }
    };
    loadTrack();
  }, [selectedProfile]);

  // Inspect profile measurements and show Plotly chart modal
  const handleInspectFloatProfile = async (profileId: string) => {
    try {
      const res = await fetch(`/api/profile/${profileId}`);
      if (res.ok) {
        const data = await res.json();
        const rowsWithMeta = (data.measurements || []).map((m: any) => ({
          ...m,
          ...data.profile,
        }));
        setChartState({
          isOpen: true,
          dataRows: rowsWithMeta,
          chartType: 'temp_depth',
          title: `Float WMO ${data.profile.wmo_number} (Cycle #${data.profile.cycle_number})`,
        });
      }
    } catch (err) {
      console.error('Failed to load profile details:', err);
    }
  };

  // Chat message submission
  const handleSendMessage = async (text: string) => {
    const userMsgId = 'msg-' + Date.now();
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text,
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsAiLoading(true);
    setLoadingStep('Resolving oceanographic terms...');

    try {
      setTimeout(() => setLoadingStep('Generating & validating a read-only SQL query...'), 400);
      setTimeout(() => setLoadingStep('Executing query on the Argo database...'), 1500);

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(`The server returned an unreadable response (HTTP ${res.status}).`);
      }
      if (!res.ok) {
        // Pipeline error: keep its evidence (path, attempts, validation) for the error card.
        setMessages((prev) => [
          ...prev,
          {
            id: 'msg-' + (Date.now() + 1),
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: data?.error || `Query pipeline failed (HTTP ${res.status}).`,
            error: data?.error || `HTTP ${res.status}`,
            executionPath: data?.executionPath,
            fallbackReason: data?.fallbackReason,
            attempts: data?.attempts,
            validation: data?.validation,
            interpretations: data?.interpretations,
            resolvedTerms: data?.resolvedTerms,
            queryLogId: data?.queryLogId,
          },
        ]);
        return;
      }

      setLoadingStep('Synthesizing scientific provenance...');

      const aiMsgId = 'msg-' + (Date.now() + 1);
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: data.answer,
        sql: data.sql,
        validation: data.validation,
        interpretations: data.interpretations,
        resolvedTerms: data.resolvedTerms,
        provenance: data.provenance,
        rows: data.rows,
        recommendedChart: data.recommendedChart,
        executionPath: data.executionPath,
        fallbackReason: data.fallbackReason,
        model: data.model,
        attempts: data.attempts,
        answerPath: data.answerPath,
        answerNote: data.answerNote,
        queryLogId: data.queryLogId,
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (data.provenance?.floatIds && data.provenance.floatIds.length > 0) {
        setActiveHighlightedFloatId(data.provenance.floatIds[0]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Could not reach the FloatChat server: ${err.message}. Check your connection and try again.`,
        error: err.message,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
      setLoadingStep('');
    }
  };

  // Filter profiles for display on map
  const filteredProfiles = profiles.filter((p) => {
    if (selectedMode !== 'ALL' && p.data_mode !== selectedMode) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        p.wmo_number.toLowerCase().includes(q) ||
        p.platform_type.toLowerCase().includes(q) ||
        String(p.cycle_number).includes(q);
      if (!match) return false;
    }

    if (selectedBasin === 'arabian') {
      return p.latitude >= 8.0 && p.latitude <= 26.0 && p.longitude >= 52.0 && p.longitude <= 77.5;
    }
    if (selectedBasin === 'bengal') {
      return p.latitude >= 5.0 && p.latitude <= 23.0 && p.longitude >= 80.0 && p.longitude <= 96.0;
    }
    if (selectedBasin === 'equatorial') {
      return p.latitude >= -5.0 && p.latitude <= 5.0;
    }
    if (selectedBasin === 'southern') {
      return p.latitude < -15.0;
    }

    return true;
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#EDF6FA] p-4 lg:p-5 gap-4 lg:gap-5 text-[#0F172A] antialiased select-none font-sans">
      {/* 1. Left Sidebar: Floating White Card (~300px) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
      />

      {/* 2. Center Column: Header + Metric Cards + Interactive Map */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden justify-between gap-3">
        {/* Top Header */}
        <Header
          pageTitle={
            currentTab === 'explore'
              ? 'Explore ARGO Observations'
              : currentTab === 'chat'
              ? 'Ask FloatChat AI'
              : currentTab === 'analytics'
              ? 'ARGO Fleet Analytics & Telemetry'
              : currentTab === 'floats'
              ? 'Indian Ocean Float Explorer'
              : currentTab === 'queries'
              ? 'Saved Scientific Queries'
              : currentTab === 'about'
              ? 'About FloatChat & Data Standards'
              : 'Settings & Defaults'
          }
          pageSubtitle={
            currentTab === 'chat'
              ? 'Explore ARGO observations using natural language.'
              : 'Visualize floats, profiles and ocean conditions across the Indian Ocean.'
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3">
          {currentTab === 'explore' && (
            <div className="flex-1 min-h-0 flex flex-col space-y-3">
              {/* 5 Compact Horizontal Metric Cards (Full Width) */}
              <MetricCards stats={stats} loading={statsLoading} error={statsError} onRetry={fetchStats} />

              {/* Main Interactive Indian Ocean Map (Full Width) */}
              <div className="flex-1 min-h-0 flex flex-col">
                <OceanMap
                  profiles={filteredProfiles}
                  selectedProfile={selectedProfile}
                  onSelectProfile={(p) => {
                    setSelectedProfile(p);
                    setActiveHighlightedFloatId(p.wmo_number);
                  }}
                  selectedBasin={selectedBasin}
                  onSelectBasin={setSelectedBasin}
                  selectedFloatTrack={selectedFloatTrack}
                  activeHighlightedFloatId={activeHighlightedFloatId}
                  onInspectFloatProfile={handleInspectFloatProfile}
                  loading={profilesLoading}
                  error={profilesError}
                  totalLoaded={profiles.length}
                  onRetry={fetchProfiles}
                />
              </div>
            </div>
          )}

          {(currentTab === 'chat' || currentTab === 'history') && (
            <AskFloatChatView
              messages={messages}
              onSendMessage={handleSendMessage}
              onClearChat={() => setMessages([])}
              isLoading={isAiLoading}
              loadingStep={loadingStep}
              onOpenChart={(rows, chartType, title) => {
                setChartState({
                  isOpen: true,
                  dataRows: rows,
                  chartType,
                  title: title || 'Observation Profile Chart',
                });
              }}
              onHighlightFloat={(floatId) => {
                setActiveHighlightedFloatId(floatId);
                const found = profiles.find((p) => p.wmo_number === floatId || p.float_id === floatId);
                if (found) setSelectedProfile(found);
                setCurrentTab('explore');
              }}
              onNavigateToMap={() => setCurrentTab('explore')}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              stats={stats}
              loading={statsLoading}
              error={statsError}
              onRetry={fetchStats}
              onRunQuery={(q) => {
                setCurrentTab('chat');
                handleSendMessage(q);
              }}
            />
          )}

          {currentTab === 'floats' && (
            <FloatExplorerView
              profiles={profiles}
              loading={profilesLoading}
              error={profilesError}
              onSelectFloat={(p) => {
                setSelectedProfile(p);
                setActiveHighlightedFloatId(p.wmo_number);
                setCurrentTab('explore');
              }}
              onInspectProfile={(profileId) => {
                handleInspectFloatProfile(profileId);
              }}
              onAskAboutFloat={(wmo) => {
                setCurrentTab('chat');
                handleSendMessage(`Show observations and trajectory for float WMO ${wmo}`);
              }}
            />
          )}

          {currentTab === 'queries' && (
            <SavedQueriesView
              onRunQuery={(q) => {
                setCurrentTab('chat');
                handleSendMessage(q);
              }}
            />
          )}

          {currentTab === 'about' && <AboutDocsView />}

          {currentTab === 'settings' && (
            <SettingsView
              qcFilterStrict={qcFilterStrict}
              onToggleQcStrict={setQcFilterStrict}
              selectedMode={selectedMode}
              onSelectMode={setSelectedMode}
            />
          )}
        </div>
      </div>

      {/* Plotly Chart Modal when user clicks "View Scientific Plotly Chart" */}
      {chartState.isOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-[#CBDCE7]">
            <OceanChart
              dataRows={chartState.dataRows}
              chartType={chartState.chartType}
              title={chartState.title}
              onClose={() => setChartState((prev) => ({ ...prev, isOpen: false }))}
            />
          </div>
        </div>
      )}

      {/* Custom Profile Import Modal */}
      <ImportProfileModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          fetchStats();
          fetchProfiles();
        }}
      />
    </div>
  );
}

