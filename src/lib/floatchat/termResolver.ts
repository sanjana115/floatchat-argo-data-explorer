// Pure term resolver: reads rows from public.term_definitions (passed in) and finds them in a question.
// Case-insensitive, whole-phrase, longest phrase first; a matched span cannot be re-used by a shorter phrase.

export interface TermDefinition {
  term_id: string;
  /** Canonical term, e.g. "deep water". */
  term: string;
  phrases: string[];
  category: string;
  /** SQL condition using aliases p (profiles) / m (measurements). */
  sql_fragment: string;
  required_tables: string[];
  /** Plain-language rule shown to the user. */
  rule_text: string;
  /** Where the threshold comes from; contains "PROJECT ASSUMPTION" when it is the project's choice. */
  source_note: string;
}

export interface ResolvedTerm {
  termId: string;
  label: string;
  matchedText: string;
  category: string;
  sqlCondition: string;
  requiredTables: string[];
  /** Plain-language interpretation line shown to the user. */
  interpretation: string;
  /** source_note from term_definitions (citation and/or PROJECT ASSUMPTION label). */
  source: string;
  isProjectAssumption: boolean;
}

export const PROJECT_ASSUMPTION = "PROJECT ASSUMPTION";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ");
}

export function resolveTerms(question: string, defs: TermDefinition[]): ResolvedTerm[] {
  const text = normalize(question);
  const consumed = new Array<boolean>(text.length).fill(false);
  const candidates = defs
    .flatMap((d) => d.phrases.map((phrase) => ({ phrase: normalize(phrase.trim()), def: d })))
    .filter((c) => c.phrase.length > 0)
    .sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase));

  const hits = new Map<string, { index: number; matched: string; def: TermDefinition }>();
  for (const { phrase, def } of candidates) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRegex(phrase)}(?![a-z0-9])`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (consumed.slice(start, end).some(Boolean)) continue;
      for (let i = start; i < end; i++) consumed[i] = true;
      const prev = hits.get(def.term_id);
      if (!prev || start < prev.index) hits.set(def.term_id, { index: start, matched: m[0], def });
    }
  }

  return [...hits.values()]
    .sort((a, b) => a.index - b.index)
    .map(({ matched, def }) => {
      const note = (def.source_note ?? "").trim();
      const isProjectAssumption = note === "" || note.toUpperCase().includes(PROJECT_ASSUMPTION);
      return {
        termId: def.term_id,
        label: def.term,
        matchedText: matched,
        category: def.category,
        sqlCondition: def.sql_fragment,
        requiredTables: def.required_tables,
        interpretation: def.rule_text,
        source: note === "" ? PROJECT_ASSUMPTION : note,
        isProjectAssumption,
      };
    });
}

/** One plain-language line per term, e.g. "Surface: ... (PROJECT ASSUMPTION)". */
export function interpretationLines(terms: ResolvedTerm[]): string[] {
  return terms.map((t) =>
    t.isProjectAssumption ? `${t.interpretation} (${PROJECT_ASSUMPTION})` : `${t.interpretation} (Source: ${t.source})`,
  );
}

/** Interpretation line added when the executed SQL applied the default quality-flag filter. */
export const QUALITY_INTERPRETATION =
  "Quality: only readings whose quality flag is 1 (good) or 2 (probably good) were used. (PROJECT ASSUMPTION)";

export function usesQualityFilter(sql: string): boolean {
  return /\b(temp_qc|psal_qc|pres_qc)\s*\)?\s*(IN|=)\s*\(?\s*\(?1/i.test(sql);
}
