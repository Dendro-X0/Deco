import type { Candidate } from '../types';

export type DormancyTone = 'stale' | 'recent' | 'unknown';

export type DormancySummary = {
  headline: string;
  detail: string;
  tone: DormancyTone;
};

export type GitDormancyHint = {
  days_since_commit: number;
  summary: string;
};

const MS_PER_DAY = 86_400_000;

export function ageDaysFromMtimeMs(mtimeMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - mtimeMs) / MS_PER_DAY));
}

function hasCode(codes: readonly string[] | undefined, code: string): boolean {
  return (codes ?? []).includes(code);
}

/** Explain-only dormancy copy from classifier age + settings threshold. */
export function dormancySummary(
  candidate: Candidate,
  staleThresholdDays: number,
  nowMs = Date.now(),
): DormancySummary {
  const threshold = Math.max(1, staleThresholdDays);
  const codes = candidate.reason_codes;

  let ageDays = candidate.stale_days;
  if (ageDays == null && candidate.mtime_ms != null) {
    ageDays = ageDaysFromMtimeMs(candidate.mtime_ms, nowMs);
  }

  if (ageDays != null && Number.isFinite(ageDays)) {
    const meetsThreshold = ageDays >= threshold;
    if (hasCode(codes, 'NODE_MODULES_STALE') || (meetsThreshold && hasCode(codes, 'PROJECT_MARKERS_PRESENT'))) {
      return {
        headline: `Likely stale — ${ageDays} day(s) since last modified`,
        detail: `Stale threshold is ${threshold} days (Settings). Classifier marked this safe when project markers are present.`,
        tone: 'stale',
      };
    }
    if (hasCode(codes, 'NODE_MODULES_NOT_STALE')) {
      return {
        headline: `Recently touched — ${ageDays} day(s) since last modified`,
        detail: `Below stale threshold (${threshold} days). Left as review until older.`,
        tone: 'recent',
      };
    }
    return {
      headline: meetsThreshold
        ? `Last modified ${ageDays} day(s) ago — at or above threshold`
        : `Last modified ${ageDays} day(s) ago — below threshold (${threshold} days)`,
      detail: 'Explain-only; risk tier is unchanged by this label.',
      tone: meetsThreshold ? 'stale' : 'recent',
    };
  }

  return {
    headline: 'Modification time unavailable',
    detail:
      'Dormancy age uses folder mtime when the scanner records it. Global caches and some artifacts may omit age.',
    tone: 'unknown',
  };
}

export function formatGitDormancyHint(hint: GitDormancyHint): string {
  const days = hint.days_since_commit;
  const tail = hint.summary ? ` — ${hint.summary}` : '';
  return `Last git commit touching this tree: ${days} day(s) ago${tail}`;
}
