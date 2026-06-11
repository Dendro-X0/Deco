import type { ScanReport } from '../types';
import { volumeMountsFromPaths } from './volume-from-path';

/** Post-1.0 U1: below this reclaimable total we nudge users on cramped system volumes. */
export const LOW_YIELD_RECLAIM_THRESHOLD_BYTES = 100 * 1024 * 1024;

export type ScanInsightContext = {
  scanMode: 'partition' | 'custom';
  selectedVolumes: readonly string[];
  customScanRoots: readonly string[];
  systemMount: string;
};

function normalizeMount(mount: string): string {
  const t = mount.trim();
  if (/^[A-Za-z]:/i.test(t)) {
    return `${t[0]!.toUpperCase()}:\\`;
  }
  return t.endsWith('/') && t.length > 1 ? t.slice(0, -1) : t;
}

export function reclaimableBytesFromReport(report: ScanReport | null | undefined): number {
  if (!report?.totals_by_risk) return 0;
  return (report.totals_by_risk.safe?.bytes ?? 0) + (report.totals_by_risk.review?.bytes ?? 0);
}

/** True when the last scan configuration targeted only the OS / system volume. */
export function scanTargetedSystemVolumeOnly(ctx: ScanInsightContext): boolean {
  const system = normalizeMount(ctx.systemMount);

  if (ctx.scanMode === 'custom') {
    if (ctx.customScanRoots.length === 0) return false;
    const mounts = volumeMountsFromPaths([...ctx.customScanRoots]);
    if (mounts.length === 0) {
      return ctx.customScanRoots.every((r) => {
        const n = normalizeMount(r);
        return n === system || n.startsWith(`${system}/`) || n.startsWith(system);
      });
    }
    return mounts.every((m) => normalizeMount(m) === system);
  }

  if (ctx.selectedVolumes.length === 0) return false;
  const vols = ctx.selectedVolumes.map(normalizeMount);
  return vols.length === 1 && vols[0] === system;
}

export function shouldShowLowYieldScanInsight(
  report: ScanReport | null | undefined,
  ctx: ScanInsightContext,
): boolean {
  if (!report?.scan_id) return false;
  if (!scanTargetedSystemVolumeOnly(ctx)) return false;
  return reclaimableBytesFromReport(report) < LOW_YIELD_RECLAIM_THRESHOLD_BYTES;
}
