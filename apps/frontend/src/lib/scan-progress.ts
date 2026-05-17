export type ScanProgressPhase = 'discover' | 'classify' | 'size' | 'done' | 'cleanup' | null;

export type ScanProgress = {
  percent: number;
  text: string;
  phase: ScanProgressPhase;
  /** Secondary line for cleanup overlay / status (e.g. node_modules explanation). */
  detail?: string;
};

export const IDLE_PROGRESS: ScanProgress = {
  percent: 0,
  text: 'Ready',
  phase: null,
};

const PHASE_LABELS: Record<Exclude<ScanProgressPhase, null>, string> = {
  discover: 'Discover',
  classify: 'Classify',
  size: 'Size',
  done: 'Done',
  cleanup: 'Cleanup',
};

export function scanProgressPhaseLabel(phase: ScanProgressPhase): string | null {
  if (!phase) return null;
  return PHASE_LABELS[phase] ?? null;
}
