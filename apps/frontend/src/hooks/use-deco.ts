import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  BulkRestoreResponse,
  Candidate,
  ExecutePreviewResponse,
  ExecuteResponse,
  PlanResponse,
  QuarantineEntry,
  QuarantineFilter,
  ScanReport,
  Settings,
  HistoryItem,
} from '../types';

export function useDeco() {
  const [scanId, setScanId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateMap, setCandidateMap] = useState<Map<string, Candidate>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, text: 'Ready' });
  const [status, setStatus] = useState({ text: 'System Ready', type: 'idle' as 'active' | 'idle' | 'error' | 'done' });
  const [summary, setSummary] = useState<ScanReport | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineEntry[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tauriInvoke = async (command: string, payload: Record<string, unknown> = {}) => {
    try {
      return await invoke(command, payload);
    } catch (err: unknown) {
      const msg =
        typeof err === 'string'
          ? err
          : err instanceof Error
            ? err.message
            : JSON.stringify(err);
      setError(msg);
      setStatus({ text: `Error: ${msg}`, type: 'error' });
      throw err;
    }
  };

  const refreshHistory = useCallback(async () => {
    try {
      const resp = (await tauriInvoke('scan_history', { limit: 20 })) as { items?: HistoryItem[] };
      setHistory(resp.items || []);
    } catch {
      /* surfaced via tauriInvoke */
    }
  }, []);

  const refreshQuarantine = useCallback(
    async (filterOverride?: QuarantineFilter) => {
      if (!settings) return;
      try {
        const filter: QuarantineFilter = filterOverride ?? {
          query: null,
          from_iso: null,
          to_iso: null,
          only_purge_eligible: false,
          retention_days: settings.quarantine_retention_days,
        };
        const entries = (await tauriInvoke('list_quarantine_filtered', { filter })) as QuarantineEntry[];
        setQuarantine(entries);
      } catch {
        /* surfaced via tauriInvoke */
      }
    },
    [settings],
  );

  const loadSettings = useCallback(async () => {
    try {
      const s = (await tauriInvoke('get_settings')) as Settings;
      setSettings(s);
    } catch {
      /* surfaced via tauriInvoke */
    }
  }, []);

  const cancelScan = async () => {
    if (!scanId) return;
    try {
      await tauriInvoke('cancel_scan', { scan_id: scanId });
      setStatus({ text: 'Cancel requested…', type: 'active' });
    } catch {
      /* surfaced via tauriInvoke */
    }
  };

  const scan = async (scanSettings?: Partial<Settings>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCandidates([]);
    setCandidateMap(new Map());
    setSelectedIds(new Set());
    setProgress({ percent: 2, text: 'Initializing...' });
    setStatus({ text: 'Preparing Scan...', type: 'active' });

    try {
      const activeSettings = { ...settings, ...scanSettings } as Settings;
      const req = {
        roots: activeSettings.roots,
        max_depth: Number(activeSettings.max_depth),
        profile: activeSettings.profile,
        include_size: activeSettings.include_size,
        stale_days: Number(activeSettings.stale_days),
        show_blocked: activeSettings.show_blocked,
        check_go_cache: activeSettings.check_go_cache,
        include_python_artifacts: activeSettings.include_python_artifacts ?? true,
        include_python_venv: activeSettings.include_python_venv ?? false,
        include_jvm_artifacts: activeSettings.include_jvm_artifacts ?? true,
        check_jvm_global_cache: activeSettings.check_jvm_global_cache ?? false,
        include_dotnet_artifacts: activeSettings.include_dotnet_artifacts ?? true,
        check_ide_global_cache: activeSettings.check_ide_global_cache ?? false,
        exclude_abs_path_contains: activeSettings.exclude_abs_path_contains ?? [],
        extra_protected_path_contains: activeSettings.extra_protected_path_contains ?? [],
        allow_path_contains: activeSettings.allow_path_contains ?? [],
      };

      const report = (await tauriInvoke('scan_roots', { req })) as ScanReport;
      setScanId(report.scan_id);
      setCandidates(report.candidates);
      setCandidateMap(new Map(report.candidates.map((c) => [c.id, c])));
      setSelectedIds(new Set(report.candidates.filter((c) => c.risk === 'safe').map((c) => c.id)));
      setSummary(report);
      setProgress({ percent: 100, text: 'Done' });
      const canceled = (report.warnings ?? []).some((w) => w.toLowerCase().includes('canceled'));
      setStatus({
        text: canceled
          ? `Scan canceled: ${report.candidates.length} partial items.`
          : `Scan complete: ${report.candidates.length} items.`,
        type: 'done',
      });
      await refreshHistory();
      return report;
    } catch {
      return null;
    } finally {
      setBusy(false);
    }
  };

  const previewCleanup = async (
    candidateIds: string[],
    includeReview: boolean,
    deleteMode = 'quarantine',
  ): Promise<ExecutePreviewResponse | null> => {
    if (!summary?.scan_id) return null;
    try {
      return (await tauriInvoke('preview_execute', {
        req: {
          scan_id: summary.scan_id,
          candidate_ids: candidateIds,
          delete_mode: deleteMode,
          include_review: includeReview,
        },
      })) as ExecutePreviewResponse;
    } catch {
      return null;
    }
  };

  const executeCleanup = async (
    candidateIds: string[],
    includeReview: boolean,
    deleteMode = 'quarantine',
  ): Promise<ExecuteResponse | null> => {
    if (!summary?.scan_id) return null;
    try {
      const result = (await tauriInvoke('execute_cleanup_command', {
        req: {
          scan_id: summary.scan_id,
          candidate_ids: candidateIds,
          delete_mode: deleteMode,
          include_review: includeReview,
        },
      })) as ExecuteResponse;
      setSelectedIds(new Set());
      await refreshQuarantine();
      await refreshHistory();
      setStatus({
        text: `Cleanup complete: ${result.quarantined_count} quarantined.`,
        type: 'done',
      });
      return result;
    } catch {
      return null;
    }
  };

  const planFreeSpace = async (
    targetGb: number,
    includeReview: boolean,
  ): Promise<PlanResponse | null> => {
    if (!summary?.scan_id) return null;
    try {
      return (await tauriInvoke('plan_free_space', {
        req: {
          scan_id: summary.scan_id,
          target_gb: targetGb,
          include_review: includeReview,
        },
      })) as PlanResponse;
    } catch {
      return null;
    }
  };

  const bulkRestoreQuarantine = async (ids: string[]): Promise<BulkRestoreResponse | null> => {
    if (ids.length === 0) return null;
    try {
      const result = (await tauriInvoke('restore_quarantine_bulk', { ids })) as BulkRestoreResponse;
      await refreshQuarantine();
      return result;
    } catch {
      return null;
    }
  };

  const purgeQuarantine = async (retentionDays?: number) => {
    try {
      await tauriInvoke('purge_quarantine', {
        retentionDays: retentionDays ?? settings?.quarantine_retention_days ?? 30,
      });
      await refreshQuarantine();
    } catch {
      /* surfaced via tauriInvoke */
    }
  };

  useEffect(() => {
    loadSettings();
    refreshHistory();
  }, [loadSettings, refreshHistory]);

  useEffect(() => {
    if (settings) refreshQuarantine();
  }, [settings, refreshQuarantine]);

  useEffect(() => {
    const unlistenProgress = listen('scan-progress', (event) => {
      const payload = (event.payload || {}) as Record<string, unknown>;
      const phase = payload.phase as string | undefined;
      let percent = 0;
      const text = (payload.message as string) || 'Scanning...';

      if (phase === 'discover') percent = 5;
      else if (phase === 'classify') percent = 20;
      else if (phase === 'size') {
        const total = Number(payload.total_size_candidates || 0);
        const done = Number(payload.processed_sizes || 0);
        percent = total > 0 ? 20 + (done / total) * 75 : 65;
      } else if (phase === 'done') percent = 100;

      setProgress({ percent, text });
      setStatus({ text, type: 'active' });
    });

    const unlistenBatch = listen('scan-candidate-batch', (event) => {
      const payload = (event.payload || {}) as { candidates?: Candidate[] };
      const batch = payload.candidates || [];
      setCandidateMap((prev) => {
        const next = new Map(prev);
        batch.forEach((c) => next.set(c.id, c));
        return next;
      });
    });

    return () => {
      unlistenProgress.then((u) => u());
      unlistenBatch.then((u) => u());
    };
  }, []);

  useEffect(() => {
    setCandidates(Array.from(candidateMap.values()));
  }, [candidateMap]);

  return {
    scanId,
    candidates,
    selectedIds,
    setSelectedIds,
    busy,
    progress,
    status,
    summary,
    quarantine,
    history,
    settings,
    error,
    setError,
    scan,
    cancelScan,
    loadSettings,
    refreshQuarantine,
    refreshHistory,
    previewCleanup,
    executeCleanup,
    planFreeSpace,
    bulkRestoreQuarantine,
    purgeQuarantine,
    tauriInvoke,
  };
}
