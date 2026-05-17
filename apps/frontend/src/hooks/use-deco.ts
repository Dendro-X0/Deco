import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  BulkRestoreResponse,
  Candidate,
  ExecutePreviewResponse,
  ExecuteResponse,
  PlanResponse,
  QuarantineEntry,
  ScanReport,
  Settings,
  HistoryItem,
} from '../types';
import { normalizeCandidate, normalizeScanReport } from '../lib/scan-report';
import { normalizeSettings, readSelectedVolumes } from '../lib/settings-normalize';
import { formatBytes, formatDurationMs } from '../lib/format';
import { volumeMountsFromPaths } from '../lib/volume-from-path';
import { toast } from '../lib/toast';
import { formatCleanupResultSummary } from '../lib/cleanup-result';
import { IDLE_PROGRESS, type ScanProgress } from '../lib/scan-progress';

export function useDeco() {
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateMap, setCandidateMap] = useState<Map<string, Candidate>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>(IDLE_PROGRESS);
  const [status, setStatus] = useState({ text: 'System Ready', type: 'idle' as 'active' | 'idle' | 'error' | 'done' });
  const [summary, setSummary] = useState<ScanReport | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineEntry[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);
  const [includeProjectFolders, setIncludeProjectFolders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeScanIdRef = useRef<string | null>(null);
  const operationStartedAtRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

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
      const resp = (await tauriInvoke('scan_history', { limit: 100 })) as { items?: HistoryItem[] };
      setHistory(resp.items || []);
    } catch {
      /* surfaced via tauriInvoke */
    }
  }, []);

  const deleteScanHistory = useCallback(
    async (scanId: string) => {
      const resp = (await tauriInvoke('delete_scan_history', { scanId })) as { deleted?: boolean };
      await refreshHistory();
      return resp.deleted === true;
    },
    [refreshHistory],
  );

  const clearScanHistory = useCallback(async () => {
    const resp = (await tauriInvoke('clear_scan_history')) as { deleted_count?: number };
    await refreshHistory();
    return resp.deleted_count ?? 0;
  }, [refreshHistory]);

  const refreshQuarantine = useCallback(async () => {
    try {
      const entries = (await tauriInvoke('list_quarantine')) as QuarantineEntry[];
      setQuarantine(entries);
    } catch {
      /* surfaced via tauriInvoke */
    }
  }, []);

  const applySettings = useCallback((raw: unknown) => {
    const s = normalizeSettings(raw);
    setSettings(s);
    setSelectedVolumes(s.selected_volumes ?? []);
    setIncludeProjectFolders(s.include_project_folders ?? true);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await tauriInvoke('get_settings');
      applySettings(s);
    } catch {
      /* surfaced via tauriInvoke */
    }
  }, [applySettings]);

  const finishScan = useCallback(() => {
    setScanning(false);
    activeScanIdRef.current = null;
    operationStartedAtRef.current = null;
    setElapsedMs(0);
  }, []);

  const cancelScan = async () => {
    const id = activeScanIdRef.current ?? scanId;
    if (!id) {
      finishScan();
      setProgress(IDLE_PROGRESS);
      return;
    }
    try {
      await invoke('cancel_scan', { scanId: id });
      setStatus({ text: 'Cancel requested…', type: 'active' });
      toast({
        title: 'Scan stop requested',
        description: 'Finishing the current step, then returning partial results.',
        variant: 'info',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      finishScan();
      setProgress({ percent: 0, text: 'Scan stopped', phase: null });
    }
  };

  const scan = async (scanSettings?: Partial<Settings>) => {
    if (scanning) return null;
    if (!settings) {
      setError('Settings are still loading. Try again in a moment.');
      return null;
    }

    const useCustom = Boolean(
      scanSettings?.use_custom_scan_roots ?? settings.use_custom_scan_roots,
    );
    const rootsList = scanSettings?.roots ?? settings.roots ?? [];
    let volumes = readSelectedVolumes({
      selected_volumes: scanSettings?.selected_volumes ?? selectedVolumes,
    });

    if (useCustom) {
      if (rootsList.length === 0) {
        setError('Add at least one custom folder in Settings.');
        setStatus({ text: 'No custom folders configured', type: 'error' });
        return null;
      }
      const fromRoots = volumeMountsFromPaths(rootsList);
      volumes = [...new Set([...volumes, ...fromRoots])].sort();
      if (volumes.length === 0) {
        setError('Could not map custom folders to a drive letter.');
        setStatus({ text: 'Invalid custom paths', type: 'error' });
        return null;
      }
    } else if (volumes.length === 0) {
      setError('Select at least one partition to scan.');
      setStatus({ text: 'No partition selected', type: 'error' });
      return null;
    }

    const activeSettings: Settings = {
      ...normalizeSettings(settings),
      ...scanSettings,
      selected_volumes: volumes,
      include_project_folders:
        scanSettings?.include_project_folders ?? includeProjectFolders,
      roots: rootsList,
      use_custom_scan_roots: useCustom,
    };

    setScanning(true);
    operationStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setError(null);
    setCandidates([]);
    setCandidateMap(new Map());
    setSelectedIds(new Set());
    setSummary(null);
    setProgress({ percent: 2, text: 'Starting scan…', phase: 'discover' });
    setStatus({ text: 'Scan running in background', type: 'active' });

    try {
      await invoke('save_settings', { settings: activeSettings });
      applySettings(activeSettings);

      const req = {
        roots: [] as string[],
        max_depth: Number(activeSettings.max_depth),
        profile: activeSettings.profile,
        // Always compute directory sizes on desktop so candidates and summary show real bytes.
        include_size: true,
        stale_days: Number(activeSettings.stale_days),
        show_blocked: activeSettings.show_blocked,
        check_go_cache: activeSettings.check_go_cache,
        include_python_artifacts: activeSettings.include_python_artifacts ?? true,
        include_python_venv: activeSettings.include_python_venv ?? false,
        include_jvm_artifacts: activeSettings.include_jvm_artifacts ?? true,
        check_jvm_global_cache: activeSettings.check_jvm_global_cache ?? false,
        include_dotnet_artifacts: activeSettings.include_dotnet_artifacts ?? true,
        check_ide_global_cache: activeSettings.check_ide_global_cache ?? false,
        check_npm_cache: activeSettings.check_npm_cache ?? false,
        check_pnpm_store: activeSettings.check_pnpm_store ?? false,
        check_yarn_cache: activeSettings.check_yarn_cache ?? false,
        check_pip_cache: activeSettings.check_pip_cache ?? false,
        check_uv_cache: activeSettings.check_uv_cache ?? false,
        check_conda_pkgs_cache: activeSettings.check_conda_pkgs_cache ?? false,
        exclude_abs_path_contains: activeSettings.exclude_abs_path_contains ?? [],
        extra_protected_path_contains: activeSettings.extra_protected_path_contains ?? [],
        allow_path_contains: activeSettings.allow_path_contains ?? [],
      };

      const started = (await invoke('start_scan', { req })) as {
        scan_id?: string;
        scanId?: string;
      };
      const id = started.scanId ?? started.scan_id ?? '';
      if (!id) {
        setScanning(false);
        setError('Scan failed to start (no scan id returned).');
        return null;
      }
      activeScanIdRef.current = id;
      setScanId(id);
      toast({
        title: 'Scan started',
        description: 'This may take a few minutes on large drives. You can stop anytime.',
        variant: 'info',
      });
      return { scan_id: id };
    } catch {
      finishScan();
      setProgress(IDLE_PROGRESS);
      return null;
    }
  };

  const previewCleanup = async (
    candidateIds: string[],
    includeReview: boolean,
    deleteMode = 'quarantine',
  ): Promise<ExecutePreviewResponse | null> => {
    if (!summary?.scan_id) return null;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  const executeCleanup = async (
    candidateIds: string[],
    includeReview: boolean,
    deleteMode = 'quarantine',
  ): Promise<ExecuteResponse | null> => {
    if (!summary?.scan_id) return null;
    setBusy(true);
    operationStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setProgress({
      percent: 15,
      text: `Moving ${candidateIds.length} item(s) to quarantine…`,
      phase: 'cleanup',
    });
    setStatus({ text: 'Cleanup in progress…', type: 'active' });
    toast({
      title: 'Cleanup started',
      description: 'Moving selected folders to quarantine. Large trees may take several minutes.',
      variant: 'info',
    });
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
      const summaryMsg = formatCleanupResultSummary(result, candidateIds.length);
      toast({
        title: summaryMsg.title,
        description: summaryMsg.description,
        variant: summaryMsg.variant,
      });
      if (result.errors?.length) {
        setError(result.errors.slice(0, 3).join(' · '));
      }
      setProgress({
        percent: 100,
        text: summaryMsg.title,
        phase: 'cleanup',
      });
      setStatus({
        text:
          result.quarantined_count > 0
            ? `${result.quarantined_count} in quarantine — open Quarantine tab to restore`
            : summaryMsg.description,
        type: result.quarantined_count > 0 ? 'done' : 'error',
      });
      return result;
    } catch {
      setProgress(IDLE_PROGRESS);
      return null;
    } finally {
      setBusy(false);
      operationStartedAtRef.current = null;
      setElapsedMs(0);
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
    setBusy(true);
    try {
      const result = (await tauriInvoke('restore_quarantine_bulk', { ids })) as BulkRestoreResponse;
      await refreshQuarantine();
      return result;
    } catch {
      return null;
    } finally {
      setBusy(false);
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
      const eventScanId = (payload.scan_id ?? payload.scanId) as string | undefined;
      if (eventScanId && activeScanIdRef.current && eventScanId !== activeScanIdRef.current) return;

      const rawPhase = payload.phase as string | undefined;
      const progressPhase =
        rawPhase === 'discover' ||
        rawPhase === 'classify' ||
        rawPhase === 'size' ||
        rawPhase === 'done' ||
        rawPhase === 'cleanup'
          ? rawPhase
          : null;
      let percent = 0;
      const text = (payload.message as string) || 'Scanning...';

      if (progressPhase === 'discover') {
        const scanned = Number(payload.scanned_dirs ?? 0);
        const found = Number(payload.discovered_targets ?? 0);
        percent = Math.min(18, 5 + Math.log10(scanned + 10) * 3);
        if (!payload.message) {
          setProgress({
            percent,
            text: `Scanning directories… ${scanned} scanned, ${found} found`,
            phase: 'discover',
          });
          setStatus({ text: `Scanning… ${scanned} dirs`, type: 'active' });
          return;
        }
      } else if (progressPhase === 'classify') percent = 20;
      else if (progressPhase === 'size') {
        const total = Number(payload.total_size_candidates || 0);
        const done = Number(payload.processed_sizes || 0);
        percent = total > 0 ? 20 + (done / total) * 75 : 65;
      } else if (progressPhase === 'done') percent = 100;

      setProgress({ percent, text, phase: progressPhase });
      setStatus({ text, type: 'active' });
    });

    const unlistenBatch = listen('scan-candidate-batch', (event) => {
      const payload = (event.payload || {}) as {
        scan_id?: string;
        scanId?: string;
        candidates?: Candidate[];
      };
      const eventScanId = payload.scan_id ?? payload.scanId;
      if (eventScanId && activeScanIdRef.current && eventScanId !== activeScanIdRef.current) return;
      const batch = (payload.candidates || []).map(normalizeCandidate);
      setCandidateMap((prev) => {
        const next = new Map(prev);
        batch.forEach((c) => {
          if (c.id) next.set(c.id, c);
        });
        return next;
      });
    });

    const unlistenComplete = listen('scan-complete', (event) => {
      try {
        const report = normalizeScanReport(event.payload);
        if (!report.scan_id) {
          finishScan();
          setProgress(IDLE_PROGRESS);
          return;
        }
        if (activeScanIdRef.current && report.scan_id !== activeScanIdRef.current) return;

        const list = report.candidates ?? [];
        setScanId(report.scan_id);
        setCandidates(list);
        setCandidateMap(new Map(list.filter((c) => c.id).map((c) => [c.id, c])));
        setSelectedIds(new Set(list.filter((c) => c.risk === 'safe' && c.id).map((c) => c.id)));
        setSummary(report);
        setProgress({ percent: 100, text: 'Scan complete', phase: 'done' });
        const canceled = (report.warnings ?? []).some((w) => w.toLowerCase().includes('cancel'));
        const bytes = report.total_bytes ?? 0;
        const sizeHint = bytes > 0 ? ` · ${formatBytes(bytes)}` : '';
        const startedAt = operationStartedAtRef.current;
        const doneMs = startedAt != null ? Date.now() - startedAt : null;
        const timeHint = doneMs != null ? ` · ${formatDurationMs(doneMs)}` : '';
        setStatus({
          text: canceled
            ? `Scan canceled: ${list.length} partial items${sizeHint}${timeHint}.`
            : `Scan complete: ${list.length} items${sizeHint}${timeHint}.`,
          type: 'done',
        });
        finishScan();
        void refreshHistory();
      } catch (err) {
        console.error('[Deco] scan-complete handler failed', err);
        setError(err instanceof Error ? err.message : 'Failed to process scan results.');
        finishScan();
        setProgress(IDLE_PROGRESS);
      }
    });

    const unlistenError = listen('scan-error', (event) => {
      const payload = event.payload as { scan_id?: string; scanId?: string; message?: string };
      const eventScanId = payload.scan_id ?? payload.scanId;
      if (eventScanId && activeScanIdRef.current && eventScanId !== activeScanIdRef.current) return;
      const msg = payload.message || 'Scan failed';
      setError(msg);
      setStatus({ text: `Error: ${msg}`, type: 'error' });
      finishScan();
      setProgress(IDLE_PROGRESS);
    });

    return () => {
      unlistenProgress.then((u) => u());
      unlistenBatch.then((u) => u());
      unlistenComplete.then((u) => u());
      unlistenError.then((u) => u());
    };
  }, [refreshHistory, finishScan]);

  useEffect(() => {
    setCandidates(Array.from(candidateMap.values()));
  }, [candidateMap]);

  useEffect(() => {
    if (!scanning && !busy) return;
    const tick = () => {
      const start = operationStartedAtRef.current;
      if (start != null) setElapsedMs(Date.now() - start);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [scanning, busy]);

  return {
    scanId,
    scanning,
    candidates,
    selectedIds,
    setSelectedIds,
    busy,
    elapsedMs,
    progress,
    status,
    summary,
    quarantine,
    history,
    settings,
    selectedVolumes,
    setSelectedVolumes,
    includeProjectFolders,
    setIncludeProjectFolders,
    error,
    setError,
    scan,
    cancelScan,
    loadSettings,
    refreshQuarantine,
    refreshHistory,
    deleteScanHistory,
    clearScanHistory,
    previewCleanup,
    executeCleanup,
    planFreeSpace,
    bulkRestoreQuarantine,
    purgeQuarantine,
    tauriInvoke,
  };
}
