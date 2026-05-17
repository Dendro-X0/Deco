import { formatBytes, formatDurationMs } from './format';
import type { ScanReport } from '../types';

export type ScanPhaseTimings = {
  discoverMs: number;
  classifyMs: number;
  sizeMs: number;
};

export type ScanRunMetrics = ScanPhaseTimings & {
  inventoryReused?: number;
  wallMs?: number;
  scanMode?: 'full' | 'quick';
};

export type PhaseShare = {
  phase: keyof ScanPhaseTimings;
  label: string;
  ms: number;
  percent: number;
};

export type KindStatRow = {
  kind: string;
  label: string;
  count: number;
  bytes: number;
};

const PHASE_LABELS: Record<keyof ScanPhaseTimings, string> = {
  discoverMs: 'Discover',
  classifyMs: 'Classify',
  sizeMs: 'Size',
};

export function humanizeKind(kind: string): string {
  return kind
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function readPhaseTimings(source: {
  discover_ms?: unknown;
  discoverMs?: unknown;
  classify_ms?: unknown;
  classifyMs?: unknown;
  size_ms?: unknown;
  sizeMs?: unknown;
}): ScanPhaseTimings | null {
  const discoverMs = Number(source.discover_ms ?? source.discoverMs ?? 0);
  const classifyMs = Number(source.classify_ms ?? source.classifyMs ?? 0);
  const sizeMs = Number(source.size_ms ?? source.sizeMs ?? 0);
  if (![discoverMs, classifyMs, sizeMs].every(Number.isFinite)) return null;
  if (discoverMs <= 0 && classifyMs <= 0 && sizeMs <= 0) return null;
  return { discoverMs, classifyMs, sizeMs };
}

export function phaseTimingTotalMs(timings: ScanPhaseTimings): number {
  return timings.discoverMs + timings.classifyMs + timings.sizeMs;
}

export function phaseShares(timings: ScanPhaseTimings): PhaseShare[] {
  const total = phaseTimingTotalMs(timings);
  const keys: (keyof ScanPhaseTimings)[] = ['discoverMs', 'classifyMs', 'sizeMs'];
  if (total <= 0) {
    return keys.map((phase) => ({
      phase,
      label: PHASE_LABELS[phase],
      ms: timings[phase],
      percent: 0,
    }));
  }
  return keys.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    ms: timings[phase],
    percent: Math.round((timings[phase] / total) * 100),
  }));
}

export function formatPhaseTimingLine(timings: ScanPhaseTimings): string {
  const fmt = (ms: number) => (ms >= 1000 ? formatDurationMs(ms) : `${Math.round(ms)}ms`);
  return `Discover ${fmt(timings.discoverMs)} · Classify ${fmt(timings.classifyMs)} · Size ${fmt(timings.sizeMs)}`;
}

export function inventoryReusePercent(reused: number, candidateCount: number): number | null {
  if (candidateCount <= 0 || reused <= 0) return null;
  return Math.min(100, Math.round((reused / candidateCount) * 100));
}

export function topKindsByBytes(
  report: Pick<ScanReport, 'totals_by_kind'>,
  limit = 6,
): KindStatRow[] {
  const entries = Object.entries(report.totals_by_kind ?? {});
  return entries
    .map(([kind, totals]) => ({
      kind,
      label: humanizeKind(kind),
      count: totals?.count ?? 0,
      bytes: totals?.bytes ?? 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.bytes - a.bytes || b.count - a.count)
    .slice(0, limit);
}

export function formatScanDiagnostics(
  report: ScanReport,
  metrics: ScanRunMetrics | null,
  extra?: { appVersion?: string },
): string {
  const lines: string[] = ['Deco scan diagnostics'];
  if (extra?.appVersion) lines.push(`Version: ${extra.appVersion}`);
  lines.push(`Scan ID: ${report.scan_id}`);
  if (report.scanned_dirs != null) lines.push(`Directories scanned: ${report.scanned_dirs}`);
  lines.push(`Candidates: ${report.candidates.length}`);
  lines.push(`Total reclaimable: ${formatBytes(report.total_bytes)}`);
  const risk = report.totals_by_risk;
  lines.push(
    `By risk — safe: ${risk.safe.count} (${formatBytes(risk.safe.bytes)}), review: ${risk.review.count}, blocked: ${risk.blocked.count}`,
  );
  if (metrics?.scanMode) lines.push(`Scan mode: ${metrics.scanMode}`);
  if (metrics && (metrics.inventoryReused ?? 0) > 0) {
    const pct = inventoryReusePercent(metrics.inventoryReused ?? 0, report.candidates.length);
    lines.push(
      `Inventory reused: ${metrics.inventoryReused}${pct != null ? ` (${pct}%)` : ''}`,
    );
  }
  if (metrics && phaseTimingTotalMs(metrics) > 0) {
    lines.push(formatPhaseTimingLine(metrics));
    if (metrics.wallMs != null && metrics.wallMs > 0) {
      lines.push(`Wall time: ${formatDurationMs(metrics.wallMs)}`);
    }
  }
  const kinds = topKindsByBytes(report, 8);
  if (kinds.length > 0) {
    lines.push('Top kinds by size:');
    for (const row of kinds) {
      lines.push(`  ${row.label}: ${row.count} · ${formatBytes(row.bytes)}`);
    }
  }
  const warnings = report.warnings ?? [];
  if (warnings.length > 0) {
    lines.push('Warnings:');
    warnings.slice(0, 5).forEach((w) => lines.push(`  ${w}`));
  }
  return lines.join('\n');
}
