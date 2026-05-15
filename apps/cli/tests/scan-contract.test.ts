import { describe, expect, it } from 'vitest';
import {
  SCAN_REPORT_SCHEMA_VERSION,
  buildWireScanReport,
  summarizeReasonCodes,
  targetKindToWire,
} from '../src/scan-contract.js';
import type { CleanupCandidate, ScanReportV2 } from '../src/types.js';

describe('scan contract wire format', () => {
  it('maps CLI hyphen kinds to desktop wire keys', () => {
    expect(targetKindToWire('build-artifact')).toBe('build_artifact');
    expect(targetKindToWire('go-global-cache')).toBe('go_global_cache');
    expect(targetKindToWire('python-venv')).toBe('python_venv');
    expect(targetKindToWire('jvm-global-cache')).toBe('jvm_global_cache');
  });

  it('summarizes reason codes like the Rust classifier', () => {
    expect(summarizeReasonCodes([])).toBe('Unspecified');
    expect(summarizeReasonCodes(['NODE_MODULES_STALE'])).toBe('node modules stale');
  });

  it('buildWireScanReport uses snake_case envelope and schema_version', () => {
    const candidate: CleanupCandidate = {
      kind: 'build-artifact',
      absPath: '/tmp/x/dist',
      safetyClass: 'project_artifact',
      risk: 'safe',
      reasonCodes: ['PROJECT_MARKERS_PRESENT'],
      projectRoot: '/tmp/x',
      mtimeMs: 1000,
      size: 42,
    };
    const report: ScanReportV2 = {
      candidates: [candidate],
      totalsByRisk: {
        safe: { count: 1, bytes: 42 },
        review: { count: 0, bytes: 0 },
        blocked: { count: 0, bytes: 0 },
      },
      totalsByKind: { 'build-artifact': { count: 1, bytes: 42 } },
      totalBytes: 42,
      errors: ['note a'],
      scannedDirs: 3,
    };
    const wire = buildWireScanReport({
      report,
      scanId: '00000000-0000-4000-8000-000000000001',
      roots: ['/tmp'],
      profile: 'safe',
      maxDepth: 6,
      staleDays: 45,
      includeSize: true,
      showBlocked: false,
      checkGoCache: false,
    });
    expect(wire.schema_version).toBe(SCAN_REPORT_SCHEMA_VERSION);
    expect(wire.scan_id).toBe('00000000-0000-4000-8000-000000000001');
    expect(wire.scanned_dirs).toBe(3);
    expect(wire.warnings).toEqual(['note a']);
    expect(wire.totals_by_kind.build_artifact?.count).toBe(1);
    expect(wire.totals_by_kind.build_artifact?.bytes).toBe(42);
    expect(wire.candidates[0].kind).toBe('build_artifact');
    expect(wire.candidates[0].abs_path).toBe('/tmp/x/dist');
    expect(wire.candidates[0].size_bytes).toBe(42);
    expect(wire.scan_options?.roots).toEqual(['/tmp']);
  });
});
