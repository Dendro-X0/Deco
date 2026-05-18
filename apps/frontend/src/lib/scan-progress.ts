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

/** Progress bar 0–100 aligned with where wall time is usually spent (size >> classify). */
export function computeScanProgressPercent(
  phase: ScanProgressPhase,
  counts: {
    scannedDirs?: number;
    classified?: number;
    sized?: number;
    total?: number;
  },
): number {
  const total = Math.max(0, counts.total ?? 0);
  const sized = Math.max(0, counts.sized ?? 0);
  const classified = Math.max(0, counts.classified ?? 0);
  const scanned = Math.max(0, counts.scannedDirs ?? 0);

  switch (phase) {
    case 'discover':
      return Math.min(38, 5 + Math.log10(scanned + 10) * 3);
    case 'classify':
      if (total > 0) return 38 + (classified / total) * 7;
      return 42;
    case 'size':
      if (total > 0) return 45 + (sized / total) * 53;
      return 70;
    case 'done':
      return 100;
    case 'cleanup':
      return 50;
    default:
      return 0;
  }
}
