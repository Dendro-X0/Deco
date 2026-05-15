import { randomUUID } from 'node:crypto';
import type { CleanupCandidate, ScanReportV2, TargetDirKind } from './types.js';

/** Keep in sync with `SCAN_REPORT_SCHEMA_VERSION` in `apps/desktop/src-tauri/src/engine/types.rs`. */
export const SCAN_REPORT_SCHEMA_VERSION = '2.1.0' as const;

const KIND_TO_WIRE: Record<TargetDirKind, string> = {
  'node_modules': 'node_modules',
  'build-artifact': 'build_artifact',
  'rust-artifact': 'rust_artifact',
  'go-artifact': 'go_artifact',
  'go-global-cache': 'go_global_cache',
  'playwright-artifact': 'playwright_artifact',
  'unknown-artifact': 'unknown_artifact',
  'python-artifact': 'python_artifact',
  'python-venv': 'python_venv',
  'jvm-artifact': 'jvm_artifact',
  'jvm-global-cache': 'jvm_global_cache',
  'dotnet-artifact': 'dotnet_artifact',
  'ide-global-cache': 'ide_global_cache',
};

export function targetKindToWire(kind: TargetDirKind): string {
  return KIND_TO_WIRE[kind];
}

/** Mirrors desktop `reason_summary` (Rust classifier). */
export function summarizeReasonCodes(codes: readonly string[]): string {
  if (codes.length === 0) return 'Unspecified';
  return codes.map((code) => code.toLowerCase().replace(/_/g, ' ')).join(', ');
}

export type WireScanCandidate = {
  id: string;
  kind: string;
  abs_path: string;
  size_bytes: number | null;
  mtime_ms: number | null;
  risk: string;
  safety_class: string;
  reason_codes: readonly string[];
  display_reason_summary: string;
  can_delete: boolean;
  project_root: string | null;
  stale_days: number | null;
};

export type WireScanReport = {
  schema_version: string;
  scan_id: string;
  scanned_dirs: number;
  total_bytes: number;
  candidates: WireScanCandidate[];
  totals_by_risk: {
    safe: { count: number; bytes: number };
    review: { count: number; bytes: number };
    blocked: { count: number; bytes: number };
  };
  totals_by_kind: Record<string, { count: number; bytes: number }>;
  warnings: readonly string[];
  /** Optional CLI-only provenance (desktop may omit). */
  scan_options?: {
    roots: readonly string[];
    profile: string;
    max_depth: number;
    stale_days: number;
    include_size: boolean;
    show_blocked: boolean;
    check_go_cache: boolean;
  };
};

function candidateToWire(c: CleanupCandidate): WireScanCandidate {
  const canDelete = c.risk !== 'blocked';
  return {
    id: randomUUID(),
    kind: targetKindToWire(c.kind),
    abs_path: c.absPath,
    size_bytes: typeof c.size === 'number' ? c.size : null,
    mtime_ms: typeof c.mtimeMs === 'number' ? c.mtimeMs : null,
    risk: c.risk,
    safety_class: c.safetyClass,
    reason_codes: [...c.reasonCodes],
    display_reason_summary: summarizeReasonCodes(c.reasonCodes),
    can_delete: canDelete,
    project_root: c.projectRoot ?? null,
    stale_days: typeof c.staleDays === 'number' ? c.staleDays : null,
  };
}

function totalsByKindFromCandidates(candidates: readonly CleanupCandidate[]): Record<string, { count: number; bytes: number }> {
  const out: Record<string, { count: number; bytes: number }> = {};
  for (const c of candidates) {
    const key = targetKindToWire(c.kind);
    if (!out[key]) out[key] = { count: 0, bytes: 0 };
    out[key].count += 1;
    out[key].bytes += c.size ?? 0;
  }
  return out;
}

export function buildWireScanReport(input: {
  report: ScanReportV2;
  scanId: string;
  roots: readonly string[];
  profile: string;
  maxDepth: number;
  staleDays: number;
  includeSize: boolean;
  showBlocked: boolean;
  checkGoCache: boolean;
  includeScanOptions?: boolean;
}): WireScanReport {
  const { report, scanId, roots, profile, maxDepth, staleDays, includeSize, showBlocked, checkGoCache } = input;
  const wire: WireScanReport = {
    schema_version: SCAN_REPORT_SCHEMA_VERSION,
    scan_id: scanId,
    scanned_dirs: report.scannedDirs,
    total_bytes: report.totalBytes,
    candidates: report.candidates.map(candidateToWire),
    totals_by_risk: {
      safe: { ...report.totalsByRisk.safe },
      review: { ...report.totalsByRisk.review },
      blocked: { ...report.totalsByRisk.blocked },
    },
    totals_by_kind: totalsByKindFromCandidates([...report.candidates]),
    warnings: [...report.errors],
  };
  if (input.includeScanOptions !== false) {
    wire.scan_options = {
      roots: [...roots],
      profile,
      max_depth: maxDepth,
      stale_days: staleDays,
      include_size: includeSize,
      show_blocked: showBlocked,
      check_go_cache: checkGoCache,
    };
  }
  return wire;
}
