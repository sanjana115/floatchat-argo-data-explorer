export type DataMode = 'R' | 'A' | 'D';

export interface ArgoFloat {
  float_id: string;
  wmo_number: string;
  platform_type: string;
  launch_date: string;
  country: string;
  status: string;
}

export interface ArgoCycle {
  cycle_id: string;
  float_id: string;
  cycle_number: number;
  cycle_date: string;
}

export interface ArgoProfile {
  profile_id: string;
  cycle_id?: string;
  cycle_number: number;
  latitude: number;
  longitude: number;
  profile_time: string;
  position_qc: number;
  data_mode: DataMode;
  source_file?: string;
  data_source?: 'real' | 'synthetic';
  float_id: string;
  wmo_number: string;
  platform_type: string;
  country: string;
  surface_temp?: number;
  surface_salinity?: number;
  max_depth?: number;
}

export interface ArgoMeasurement {
  measurement_id: string;
  profile_id: string;
  pressure: number;
  temperature: number;
  salinity: number;
  pres_qc: number;
  temp_qc: number;
  psal_qc: number;
  is_adjusted: number;
}

export interface FloatTrackPoint {
  cycle_number: number;
  cycle_date: string;
  profile_id: string;
  latitude: number;
  longitude: number;
  profile_time: string;
  data_mode: DataMode;
}

export interface DatabaseStats {
  total_floats: number;
  total_cycles: number;
  total_profiles: number;
  total_measurements: number;
  profiles_by_mode: Partial<Record<DataMode, number>>;
  profiles_by_source: Partial<Record<'real' | 'synthetic', number>>;
  real_time_obs: number;
  delayed_mode_obs: number;
  adjusted_obs: number;
  earliest_date: string | null;
  latest_date: string | null;
  source_files: string[];
  qc: Record<'pres_qc' | 'temp_qc' | 'psal_qc' | 'position_qc', QcTally> | null;
  qc_error: string | null;
  regions: RegionSummary[] | null;
  regions_error: string | null;
}

export type QcBucket = 'good' | 'probably_good' | 'probably_bad' | 'bad' | 'changed' | 'estimated' | 'missing_value' | 'unknown';
export type QcTally = Record<QcBucket, number> & { total: number };

export interface RegionSummary {
  term_id: string;
  term: string;
  rule_text: string;
  source_note: string;
  profiles: number;
  floats: number;
  surface_readings: number;
  avg_surface_temperature: number | null;
  avg_surface_salinity: number | null;
  min_surface_salinity: number | null;
  max_surface_salinity: number | null;
}

export interface ValidationInfo {
  ok: boolean;
  statement: 'SELECT';
  passedOn: number | 'fallback' | null;
  llmAttempts: number;
  maxLlmAttempts: number;
  rejected: number;
  limit: number | null;
  tables: string[];
}

export interface ResolvedTerm {
  termId: string;
  label: string;
  matchedText: string;
  category: string;
  sqlCondition: string;
  requiredTables: string[];
  interpretation: string;
  source: string;
  isProjectAssumption: boolean;
}

export interface ProvenanceInfo {
  rowCount: number;
  floatIds: string[];
  floatCount: number;
  cycles: Array<{ floatId: string; cycleNumbers: number[] }>;
  cycleCount: number;
  profileIds: string[];
  profileCount: number;
  modeSummary: Record<DataMode, number>;
  dataSourceSummary: { real: number; synthetic: number };
  scope: string;
  method: 'FROM_RESULT_ROWS' | 'SECOND_QUERY_BY_IDS' | 'SECOND_QUERY_BY_FILTERS' | 'NONE';
  provenanceSql: string | null;
  truncated: boolean;
  positionQc: QcTally;
  executionTimeMs: number;
  measurementQc: Partial<Record<'pres_qc' | 'temp_qc' | 'psal_qc' | 'position_qc', QcTally>>;
  measurementQcNote: string | null;
}

export interface PipelineAttempt {
  attempt: number | 'fallback';
  source: 'LLM' | 'RULE_BASED_FALLBACK';
  generatedSql: string | null;
  executedSql: string | null;
  stage: 'generate' | 'validate' | 'execute' | 'ok';
  error: string | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  sql?: string;
  validation?: ValidationInfo;
  interpretations?: string[];
  resolvedTerms?: ResolvedTerm[];
  provenance?: ProvenanceInfo;
  rows?: any[];
  recommendedChart?: 'temp_depth' | 'sal_depth' | 'ts_diagram' | 'time_series' | 'none';
  executionPath?: 'LLM' | 'RULE_BASED_FALLBACK';
  fallbackReason?: string | null;
  model?: string | null;
  attempts?: PipelineAttempt[];
  answerPath?: 'LLM' | 'TEMPLATE';
  answerNote?: string | null;
  queryLogId?: string | null;
  error?: string;
}
