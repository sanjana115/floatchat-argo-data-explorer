import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Image as ImageIcon,
  Thermometer, 
  TrendingUp, 
  Layers, 
  Crosshair, 
  User, 
  BarChart2, 
  Loader2, 
  Trash2,
  Map,
  HelpCircle,
  Database,
  ArrowRight,
  Mic,
  MicOff
} from 'lucide-react';
import { ChatMessage } from '../../types/argo';
import { EvidenceDrawer } from '../evidence/EvidenceDrawer';
import { PathBadge, ValidationBadge, SourceBadge, ModeChip } from '../evidence/StatusChips';
import { AlertTriangle, SearchX } from 'lucide-react';
import { groupProfiles } from '@/lib/floatchat/chartData';

interface AskFloatChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  isLoading: boolean;
  loadingStep: string;
  onOpenChart: (rows: any[], chartType: any, title?: string) => void;
  onHighlightFloat?: (floatId: string) => void;
  onNavigateToMap: () => void;
}

export const AskFloatChatView: React.FC<AskFloatChatViewProps> = ({
  messages,
  onSendMessage,
  onClearChat,
  isLoading,
  loadingStep,
  onOpenChart,
  onHighlightFloat,
  onNavigateToMap,
}) => {
  const [input, setInput] = useState('');
  const [activeEvidenceMsgId, setActiveEvidenceMsgId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Web Speech API Voice Query Handler
  const toggleSpeechRecognition = () => {
    if (isLoading) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari.');
      setTimeout(() => setSpeechError(null), 5000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      setSpeechError(null);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access blocked. Please permit microphone access in your browser settings.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice input issue: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setSpeechError(null), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
      setSpeechError('Could not start microphone. Please check permissions.');
      setTimeout(() => setSpeechError(null), 5000);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Suggested questions from the approved FloatChat oceanographic query corpus
  const suggestedQueries = [
    {
      icon: Thermometer,
      title: 'Arabian Sea Profiles',
      text: 'Show temperature profiles in the Arabian Sea.',
      category: 'Thermal Structure',
    },
    {
      icon: TrendingUp,
      title: 'Regional Salinity Contrast',
      text: 'Compare salinity between the Arabian Sea and Bay of Bengal.',
      category: 'Halocline & Runoff',
    },
    {
      icon: Layers,
      title: 'Data Quality Modes',
      text: 'What is the real-time vs delayed-mode data distribution?',
      category: 'GDAC Telemetry',
    },
    {
      icon: Crosshair,
      title: 'Equatorial Dynamics',
      text: 'Find observations near the equator.',
      category: 'Zonal Currents',
    },
  ];

  const quickPills = [
    'Plot temperature against depth across the Indian Ocean',
    'Which floats recorded the highest salinity?',
    'Show observations from the Bay of Bengal',
    'Show observations with good QC in the Arabian Sea',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, loadingStep]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleSuggestedClick = (q: string) => {
    if (isLoading) return;
    onSendMessage(q);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-[#E2EEF5] shadow-xs overflow-hidden select-none relative">
      {/* 1. Header Bar: Ask FloatChat AI with Actions */}
      <div className="px-6 py-4 border-b border-[#E2EEF5] flex items-center justify-between gap-4 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E6F7F5] flex items-center justify-center text-[#0D7377] shrink-0 border border-[#B2E4D8]/60 shadow-2xs">
            <Sparkles className="w-5 h-5 text-[#0D7377]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg lg:text-xl font-bold text-[#0F2238] tracking-tight">
                Ask FloatChat AI
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E1F5F0] text-[#0D5C52] border border-[#B2E4D8]/70">
                ARGO Natural Language
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">
              Explore ARGO observations using natural language.
            </p>
          </div>
        </div>

        {/* Action Controls: History Count, Clear Chat, Jump to Map */}
        <div className="flex items-center gap-2.5">
          {messages.length > 0 && (
            <>
              <span className="hidden sm:inline-block text-xs font-mono text-[#64748B] bg-[#F1F6FA] px-3 py-1.5 rounded-full border border-[#E2EEF5]">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </span>
              <button
                type="button"
                onClick={onClearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-[#E2EEF5] hover:border-rose-200"
                title="Clear current conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onNavigateToMap}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0D5C52] bg-[#E1F5F0] hover:bg-[#D0EFE8] border border-[#B2E4D8] rounded-xl transition-all shadow-2xs"
            title="Switch back to interactive Indian Ocean map"
          >
            <Map className="w-3.5 h-3.5 text-[#0D7377]" />
            <span>Explore Map</span>
          </button>
        </div>
      </div>

      {/* 2. Spacious Conversation Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 bg-[#FAFDFE]/60">
        <div className="max-w-4xl mx-auto w-full space-y-5">
          {messages.length === 0 ? (
            /* Welcome / Empty State with Spacious 2x2 Suggested Cards */
            <div className="py-6 space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-[#E6F7F5] text-[#0D7377] border border-[#B2E4D8] shadow-xs mb-1">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h4 className="text-xl font-bold text-[#0F2238] tracking-tight">
                  What would you like to discover in the Indian Ocean?
                </h4>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  FloatChat turns your question into one validated, read-only SQL query over real Argo float profiles, then explains the result with full provenance.
                </p>
              </div>

              {/* 4 Suggested Question Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                {suggestedQueries.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggestedClick(item.text)}
                      className="text-left p-4 rounded-2xl bg-white hover:bg-[#F3FAF9] border border-[#E2EEF5] hover:border-[#14B8A6] transition-all flex items-start gap-3.5 shadow-2xs hover:shadow-xs group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#E6F7F5] group-hover:bg-[#D3F3EF] flex items-center justify-center shrink-0 text-[#0D7377] transition-colors border border-[#B2E4D8]/60">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-[#0D7377] uppercase tracking-wider block mb-0.5">
                          {item.category}
                        </span>
                        <div className="text-xs font-semibold text-[#0F2238] group-hover:text-[#0D5C52] transition-colors leading-snug">
                          {item.text}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0D7377] shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>

              {/* Quick Prompt Pills */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-[#64748B] block mb-2">
                  Additional scientific queries:
                </span>
                <div className="flex flex-wrap gap-2">
                  {quickPills.map((pill, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggestedClick(pill)}
                      className="px-3 py-1.5 rounded-full text-xs bg-white hover:bg-[#E1F5F0] border border-[#E2EEF5] hover:border-[#B2E4D8] text-[#334155] hover:text-[#0D5C52] font-medium transition-all shadow-2xs"
                    >
                      {pill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Messages Stream */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Info Badge */}
                <div className="flex items-center gap-1.5 mb-1.5 px-1 text-[11px] text-slate-400 font-medium">
                  {msg.sender === 'user' ? (
                    <>
                      <span>You</span>
                      <User className="w-3.5 h-3.5 text-slate-500" />
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#0D7377]" />
                      <span className="font-semibold text-slate-700">FloatChat AI</span>
                      <span className="text-[10px] font-mono text-slate-400">· {msg.timestamp}</span>
                    </>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed shadow-xs transition-all ${
                    msg.sender === 'user'
                      ? 'bg-[#0D7377] text-white rounded-tr-none max-w-[85%] md:max-w-[75%]'
                      : 'bg-white border border-[#E2EEF5] text-slate-800 rounded-tl-none max-w-[92%] md:max-w-[85%]'
                  }`}
                >
                  {msg.error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-1.5" role="alert">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
                        <AlertTriangle className="w-4 h-4" /> I couldn't answer this question.
                      </div>
                      <p className="text-xs text-rose-900/80">{msg.text}</p>
                      {(msg.executionPath || msg.validation) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <PathBadge path={msg.executionPath} reason={msg.fallbackReason} />
                          <ValidationBadge message={msg} />
                        </div>
                      )}
                      {msg.attempts && msg.attempts.length > 0 && (
                        <ul className="pt-1 space-y-0.5 text-[11px] font-mono text-rose-900/70">
                          {msg.attempts.map((a, i) => (
                            <li key={i}>
                              {a.source === 'LLM' ? `Attempt ${a.attempt}` : 'Rule-based fallback'}: {a.stage === 'ok' ? 'passed' : `failed at ${a.stage}`}
                              {a.error ? ` — ${a.error}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {/* Resolved Oceanographic Terms */}
                  {((msg.resolvedTerms?.length ?? 0) > 0 || (msg.interpretations?.length ?? 0) > 0) && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        How I read your question
                      </span>
                      {(msg.resolvedTerms ?? []).map((t, idx) => (
                        <div key={idx} className="text-[11px] text-slate-600 leading-snug flex items-start gap-1.5">
                          <span className="font-mono font-medium px-1.5 py-0.5 rounded bg-[#E1F5F0] text-[#0D5C52] border border-[#B2E4D8] shrink-0">
                            {t.label}
                          </span>
                          <span>
                            {t.interpretation}{' '}
                            {t.isProjectAssumption ? (
                              <span className="text-[10px] font-semibold text-amber-700 whitespace-nowrap">PROJECT ASSUMPTION</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Source: {t.source}</span>
                            )}
                          </span>
                        </div>
                      ))}
                      {(msg.interpretations ?? []).slice(msg.resolvedTerms?.length ?? 0).map((line, idx) => (
                        <div key={`extra-${idx}`} className="text-[11px] text-slate-600 leading-snug flex items-start gap-1.5">
                          <span className="font-mono font-medium px-1.5 py-0.5 rounded bg-[#E1F5F0] text-[#0D5C52] border border-[#B2E4D8] shrink-0">
                            quality
                          </span>
                          <span>
                            {line.replace(' (PROJECT ASSUMPTION)', '')}{' '}
                            {line.includes('PROJECT ASSUMPTION') && (
                              <span className="text-[10px] font-semibold text-amber-700 whitespace-nowrap">PROJECT ASSUMPTION</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Evidence status strip: path, validation, data source, mode summary */}
                  {msg.sender === 'assistant' && !msg.error && msg.provenance && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PathBadge path={msg.executionPath} reason={msg.fallbackReason} />
                        <ValidationBadge message={msg} />
                        <SourceBadge real={msg.provenance.dataSourceSummary.real} synthetic={msg.provenance.dataSourceSummary.synthetic} />
                        {msg.provenance.profileCount > 0 && <ModeChip {...msg.provenance.modeSummary} />}
                        {msg.provenance.positionQc && msg.provenance.positionQc.unknown > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                            position QC unknown · {msg.provenance.positionQc.unknown}
                          </span>
                        )}
                      </div>
                      {msg.executionPath === 'RULE_BASED_FALLBACK' && msg.fallbackReason && (
                        <div className="text-[11px] text-amber-800">Fallback reason: {msg.fallbackReason}</div>
                      )}
                    </div>
                  )}

                  {/* Empty result */}
                  {msg.sender === 'assistant' && !msg.error && msg.rows && msg.rows.length === 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
                      <SearchX className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>The query ran safely but no stored observations matched these conditions, so there is nothing to chart.</span>
                    </div>
                  )}

                  {/* Plotly Chart Launcher Button if rows exist */}
                  {msg.rows && groupProfiles(msg.rows).length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenChart(
                            msg.rows!,
                            msg.recommendedChart && msg.recommendedChart !== 'none' ? msg.recommendedChart : 'temp_depth',
                            `Observation Profile (${msg.provenance?.profileCount ?? 0} profiles)`
                          )
                        }
                        className="flex items-center gap-2 px-3.5 py-1.5 bg-[#E1F5F0] hover:bg-[#D0EFE8] text-[#0D5C52] border border-[#B2E4D8] rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                      >
                        <BarChart2 className="w-4 h-4 text-[#0D5C52]" />
                        <span>View Scientific Plotly Chart</span>
                      </button>

                      <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                        {msg.rows.length} rows returned
                      </span>
                    </div>
                  )}

                  {/* SQL Provenance Drawer */}
                  {msg.sql && (
                    <EvidenceDrawer
                      message={msg}
                      sql={msg.sql}
                      provenance={msg.provenance}
                      rows={msg.rows}
                      isOpen={activeEvidenceMsgId === msg.id}
                      onToggle={() =>
                        setActiveEvidenceMsgId(activeEvidenceMsgId === msg.id ? null : msg.id)
                      }
                      onHighlightFloat={onHighlightFloat}
                    />
                  )}
                </div>
              </div>
            ))
          )}

          {/* Live Loading Phase Feedback */}
          {isLoading && (
            <div className="flex items-start gap-3 p-4 bg-[#F0FDF4] border border-[#B2E4D8] rounded-2xl shadow-xs max-w-lg">
              <Loader2 className="w-5 h-5 text-[#0D9488] animate-spin shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-[#0F2238]">
                  Analyzing ARGO Observations...
                </div>
                <div className="text-[11px] font-mono text-[#0D5C52] animate-pulse">
                  {loadingStep || 'Running the query pipeline...'}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Bottom Message Input Bar */}
      <div className="p-4 sm:p-5 pt-3 bg-white border-t border-[#E2EEF5] shrink-0">
        <div className="max-w-4xl mx-auto w-full">
          {/* Quick Suggestion Chips if Conversation is Ongoing */}
          {messages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-1 scrollbar-none text-[11px]">
              <span className="text-slate-400 shrink-0 font-medium">Suggestions:</span>
              {quickPills.slice(0, 3).map((pill, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestedClick(pill)}
                  className="px-2.5 py-1 rounded-full bg-[#F3FAF9] hover:bg-[#E1F5F0] text-[#0D5C52] border border-[#B2E4D8]/70 whitespace-nowrap transition-colors"
                >
                  {pill}
                </button>
              ))}
            </div>
          )}

          {/* Voice Error Notification */}
          {speechError && (
            <div className="mb-2 p-2 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-in fade-in">
              <span>{speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-rose-500 hover:text-rose-800 text-xs font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={`w-full flex items-center bg-white border rounded-full p-1.5 pl-4 shadow-xs transition-all ${
              isListening
                ? 'border-rose-400 ring-2 ring-rose-100'
                : 'border-[#CBDCE7] focus-within:border-[#0D7377]'
            }`}
          >
            {/* Attachment icon */}
            <button
              type="button"
              className="text-[#94A3B8] hover:text-[#0F2238] transition-colors p-1.5 shrink-0"
              title="Attach reference image or document"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Main Text Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? 'Listening to your voice... Speak your question now'
                  : 'Ask a question about ARGO data (e.g., salinity in Bay of Bengal)...'
              }
              disabled={isLoading}
              className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-transparent text-[#0F2238] placeholder-[#94A3B8] focus:outline-none disabled:opacity-50"
            />

            {/* Voice Input Microphone Button (Web Speech API) */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              disabled={isLoading}
              className={`p-2 rounded-full transition-all duration-200 shrink-0 mr-1 relative flex items-center justify-center ${
                isListening
                  ? 'bg-rose-500 text-white ring-4 ring-rose-200 shadow-xs'
                  : 'text-[#64748B] hover:text-[#0D7377] hover:bg-[#E1F5F0]'
              }`}
              title={
                isListening
                  ? 'Listening to microphone... Click to stop voice input'
                  : 'Ask question using your microphone (Web Speech API)'
              }
              aria-label={isListening ? 'Stop voice recording' : 'Start microphone voice input'}
            >
              {isListening ? (
                <>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <MicOff className="w-4 h-4" />
                </>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Circular Teal Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-full bg-[#0D7377] hover:bg-[#0A5C5F] disabled:opacity-40 disabled:hover:bg-[#0D7377] text-white flex items-center justify-center transition-colors shrink-0 shadow-2xs"
              title="Send query"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-[#64748B] mt-2 px-3">
            <span className="flex items-center gap-2">
              {isListening ? (
                <span className="text-rose-600 font-semibold flex items-center gap-2 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 animate-in fade-in">
                  <span className="flex gap-0.5 items-center">
                    <span className="w-1 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                    <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce" />
                    <span className="w-1 h-2 bg-rose-500 rounded-full animate-pulse" />
                  </span>
                  <span>Listening... Speak your ARGO question now (click 🎙️ to stop)</span>
                </span>
              ) : (
                <span>Press Enter ↵ to query FloatChat or click the 🎙️ microphone icon to speak</span>
              )}
            </span>
            <span className="hidden sm:inline">Web Speech API Voice Recognition • Argo Postgres Database</span>
          </div>
        </div>
      </div>
    </div>
  );
};
