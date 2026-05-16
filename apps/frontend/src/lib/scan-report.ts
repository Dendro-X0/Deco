import type { ScanReport, Candidate, RiskLevel } from '../types';

type RiskBucket = { count: number; bytes: number };

const RISK_LEVELS: RiskLevel[] = ['safe', 'review', 'blocked'];

function normalizeRisk(value: unknown): RiskLevel {
  const s = String(value ?? 'review').toLowerCase();
  return RISK_LEVELS.includes(s as RiskLevel) ? (s as RiskLevel) : 'review';
}

/** Normalize a single candidate from Tauri events (snake_case or camelCase). */
export function normalizeCandidate(raw: unknown): Candidate {
  const c = (raw ?? {}) as Record<string, unknown>;
  const size = c.size_bytes ?? c.sizeBytes;
  return {
    id: String(c.id ?? ''),
    abs_path: String(c.abs_path ?? c.absPath ?? ''),
    kind: String(c.kind ?? 'unknown'),
    risk: normalizeRisk(c.risk),
    size_bytes: size === null || size === undefined ? undefined : Number(size),
    display_reason_summary: (c.display_reason_summary ?? c.displayReasonSummary) as string | undefined,
    project_root: (c.project_root ?? c.projectRoot) as string | undefined,
    stale_days: c.stale_days ?? c.staleDays ? Number(c.stale_days ?? c.staleDays) : undefined,
    reason_codes: Array.isArray(c.reason_codes)
      ? (c.reason_codes as string[])
      : Array.isArray(c.reasonCodes)
        ? (c.reasonCodes as string[])
        : [],
    can_delete: c.can_delete !== false && c.canDelete !== false,
  };
}

function bucket(raw: Record<string, unknown> | undefined, key: string): RiskBucket {
  const b = raw?.[key] as { count?: number; bytes?: number } | undefined;
  return {
    count: Number(b?.count ?? 0),
    bytes: Number(b?.bytes ?? 0),
  };
}

function normalizeRiskTotals(raw: unknown): ScanReport['totals_by_risk'] {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    safe: bucket(t, 'safe'),
    review: bucket(t, 'review'),
    blocked: bucket(t, 'blocked'),
  };
}

/** Normalize Tauri event/command payloads (snake_case or camelCase) into ScanReport. */
export function normalizeScanReport(raw: unknown): ScanReport {
  const r = (raw ?? {}) as Record<string, unknown>;
  const candidates = (Array.isArray(r.candidates) ? r.candidates : []).map(normalizeCandidate);

  return {
    schema_version: (r.schema_version ?? r.schemaVersion) as string | undefined,
    scan_id: String(r.scan_id ?? r.scanId ?? ''),
    scanned_dirs: Number(r.scanned_dirs ?? r.scannedDirs ?? 0),
    total_bytes: Number(r.total_bytes ?? r.totalBytes ?? 0),
    candidates,
    totals_by_risk: normalizeRiskTotals(r.totals_by_risk ?? r.totalsByRisk),
    totals_by_kind: (r.totals_by_kind ?? r.totalsByKind ?? {}) as ScanReport['totals_by_kind'],
    warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
  };
}

/** Extract Windows drive mount points (e.g. C:\) from scan root paths. */
export function volumesFromRoots(roots: string[]): string[] {
  const mounts = new Set<string>();
  for (const root of roots) {
    const win = /^([A-Za-z]):[\\/]/.exec(root.trim());
    if (win) {
      mounts.add(`${win[1].toUpperCase()}:\\`);
      continue;
    }
    if (root.startsWith('/')) {
      mounts.add(root.replace(/\/+$/, '') || '/');
    }
  }
  return Array.from(mounts).sort();
}
