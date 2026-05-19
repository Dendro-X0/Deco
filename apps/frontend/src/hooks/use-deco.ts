import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import {
  cleanupProgressToScanProgress,
  readCleanupLiveProgress,
  type CleanupProgressPayload,
} from '../lib/cleanup-progress';
import {
  sumCandidateBytes,
  topKindsFromCandidates,
  type CleanupLiveProgress,
  type CleanupRunSummary,
} from '../lib/cleanup-statistics';
import { normalizeCandidate, normalizeScanReport, recomputeScanSummaryFromCandidates } from '../lib/scan-report';
import { normalizeSettings, readSelectedVolumes } from '../lib/settings-normalize';
import { formatBytes, formatDurationMs } from '../lib/format';
import { volumeMountsFromPaths } from '../lib/volume-from-path';
import { toast } from '../lib/toast';
import { formatCleanupResultSummary } from '../lib/cleanup-result';
import { computeScanProgressPercent, idleProgress, type ScanProgress } from '../lib/scan-progress';
import { readPhaseTimings, type ScanRunMetrics } from '../lib/scan-statistics';
import { useI18n } from '@/i18n';

export function useDeco() {
  const { t } = useI18n();
  const idle = useMemo(() => idleProgress(t('status.ready')), [t]);
  type StatusState = { text: string; type: 'active' | 'idle' | 'error' | 'done' };
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateMap, setCandidateMap] = useState<Map<string, Candidate>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>(idle);
  const [status, setStatus] = useState<StatusState>({
    text: t('status.systemReady'),
    type: 'idle',
  });

  useEffect(() => {
    setStatus((prev) =>
      prev.type === 'idle' ? { text: t('status.systemReady'), type: 'idle' } : prev,
    );
    setProgress((prev) => (prev.phase === null && prev.percent === 0 ? idle : prev));
  }, [t, idle]);
  const [summary, setSummary] = useState<ScanReport | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineEntry[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);
  const [includeProjectFolders, setIncludeProjectFolders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeScanIdRef = useRef<string | null>(null);
  const activeCleanupJobIdRef = useRef<string | null>(null);
  const cleanupWaitersRef = useRef<
    Map<
      string,
      {
        resolve: (value: ExecuteResponse | null) => void;
        candidateCount: number;
        candidateIds: string[];
      }
    >
  >(new Map());
  const [storageRefreshToken, setStorageRefreshToken] = useState(0);
  const bumpStorageRefresh = useCallback(() => {
    setStorageRefreshToken((t) => t + 1);
  }, []);
  const operationStartedAtRef = useRef<number | null>(null);
  const scanPhaseRef = useRef<string | null>(null);
  const [searchStopped, setSearchStopped] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cleanupPaused, setCleanupPaused] = useState(false);
  const [scanMetrics, setScanMetrics] = useState<ScanRunMetrics | null>(null);
  const [cleanupLive, setCleanupLive] = useState<CleanupLiveProgress | null>(null);
  const [lastCleanupSummary, setLastCleanupSummary] = useState<CleanupRunSummary | null>(null);
  const cleanupPlannedRef = useRef<{ totalFolders: number; plannedBytes: number }>({
    totalFolders: 0,
    plannedBytes: 0,
  });
  const cleanupRemovedSnapshotRef = useRef<Candidate[]>([]);
  const activeScanModeRef = useRef<'full' | 'quick'>('full');

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
      setStatus({ text: t('common.errorPrefix', { msg }), type: 'error' });
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
    scanPhaseRef.current = null;
    setSearchStopped(false);
    operationStartedAtRef.current = null;
    setElapsedMs(0);
  }, []);

  const cancelCleanup = async () => {
    const jobId = activeCleanupJobIdRef.current;
    if (!jobId) return;
    try {
      await invoke('cancel_cleanup', { jobId });
      setCleanupPaused(false);
      setStatus({ text: t('status.stoppingCleanup'), type: 'active' });
    } catch {
      /* surfaced via tauriInvoke */
    }
  };

  const pauseCleanup = async () => {
    const jobId = activeCleanupJobIdRef.current;
    if (!jobId) return;
    try {
      await invoke('pause_cleanup', { jobId });
      setCleanupPaused(true);
    } catch {
      /* surfaced via tauriInvoke */
    }
  };

  const resumeCleanup = async () => {
    const jobId = activeCleanupJobIdRef.current;
    if (!jobId) return;
    try {
      await invoke('resume_cleanup', { jobId });
      setCleanupPaused(false);
    } catch {
      /* surfaced via tauriInvoke */
    }
  };

  const cancelScan = async () => {
    const id = activeScanIdRef.current ?? scanId;
    if (!id) {
      finishScan();
      setProgress(idle);
      return;
    }
    try {
      const phase = scanPhaseRef.current;
      const stoppingAnalysis =
        searchStopped || phase === 'size' || phase === 'classify';
      await invoke('cancel_scan', { scanId: id });
      if (!stoppingAnalysis) {
        setSearchStopped(true);
        setStatus({
          text: t('status.searchStoppedClassifying'),
          type: 'active',
        });
        toast({
          title: 'Directory search stopped',
          description:
            'Deco will still classify and calculate sizes for paths already found. Use Stop analysis to skip the rest.',
          variant: 'info',
        });
      } else {
        setStatus({ text: t('status.stoppingAnalysis'), type: 'active' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/scan not found/i.test(msg)) {
        return;
      }
      setError(msg);
      finishScan();
      setProgress({ percent: 0, text: t('status.scanStopped'), phase: null });
    }
  };

  const scan = async (
    scanSettings?: Partial<Settings>,
    scanMode: 'full' | 'quick' = 'full',
  ) => {
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
        setStatus({ text: t('status.noCustomFolders'), type: 'error' });
        return null;
      }
      const fromRoots = volumeMountsFromPaths(rootsList);
      volumes = [...new Set([...volumes, ...fromRoots])].sort();
      if (volumes.length === 0) {
        setError('Could not map custom folders to a drive letter.');
        setStatus({ text: t('status.invalidCustomPaths'), type: 'error' });
        return null;
      }
    } else if (volumes.length === 0) {
      setError('Select at least one partition to scan.');
      setStatus({ text: t('status.noPartitionSelected'), type: 'error' });
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
    setScanMetrics(null);
    setLastCleanupSummary(null);
    activeScanModeRef.current = scanMode;
    setSearchStopped(false);
    scanPhaseRef.current = 'discover';
    setProgress({ percent: 2, text: t('status.startingScan'), phase: 'discover' });
    setStatus({ text: t('status.scanRunning'), type: 'active' });

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
        check_bun_cache: activeSettings.check_bun_cache ?? false,
        check_cargo_registry: activeSettings.check_cargo_registry ?? false,
        check_nuget_cache: activeSettings.check_nuget_cache ?? false,
        check_composer_cache: activeSettings.check_composer_cache ?? false,
        check_vcpkg_cache: activeSettings.check_vcpkg_cache ?? false,
        check_conan_cache: activeSettings.check_conan_cache ?? false,
        check_ccache: activeSettings.check_ccache ?? false,
        check_sccache: activeSettings.check_sccache ?? false,
        check_bazel_disk_cache: activeSettings.check_bazel_disk_cache ?? false,
        exclude_abs_path_contains: activeSettings.exclude_abs_path_contains ?? [],
        extra_protected_path_contains: activeSettings.extra_protected_path_contains ?? [],
        allow_path_contains: activeSettings.allow_path_contains ?? [],
        scan_mode: scanMode,
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
        title: scanMode === 'quick' ? t('status.quickUpdateStarted') : t('status.scanStarted'),
        description:
          scanMode === 'quick'
            ? 'Reusing cached sizes where paths are unchanged. Run a full scan after changing profile or discovery options.'
            : 'This may take a few minutes on large drives. You can stop anytime.',
        variant: 'info',
      });
      return { scan_id: id };
    } catch {
      finishScan();
      setProgress(idle);
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

  const applyCleanupResult = useCallback(
    async (
      result: ExecuteResponse,
      candidateIds: string[],
      durationMs?: number,
      removedSnapshot?: Candidate[],
    ) => {
      const bytesRemoved =
        result.freed_bytes ??
        (result as { freedBytes?: number }).freedBytes ??
        0;
      setCandidateMap((prev) => {
        const next = new Map(prev);
        for (const id of candidateIds) {
          next.delete(id);
        }
        const remaining = Array.from(next.values());
        setSummary((s) =>
          s
            ? {
                ...s,
                candidates: remaining,
                ...recomputeScanSummaryFromCandidates(remaining),
              }
            : s,
        );
        return next;
      });
      setSelectedIds(new Set());
      setCleanupLive(null);
      const moved = (result.quarantined_count ?? 0) + (result.deleted_count ?? 0);
      if (moved > 0) {
        setLastCleanupSummary({
          result,
          durationMs: durationMs ?? 0,
          requestedCount: candidateIds.length,
          removedKinds: topKindsFromCandidates(removedSnapshot ?? []),
        });
      }
      await refreshQuarantine();
      await refreshHistory();
      bumpStorageRefresh();
      const summaryMsg = formatCleanupResultSummary(t, result, candidateIds.length, durationMs);
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
        detail: undefined,
      });
      const timeHint =
        durationMs != null && durationMs > 0 ? ` · ${formatDurationMs(durationMs)}` : '';
      const freedLabel =
        bytesRemoved > 0
          ? `Freed ${formatBytes(bytesRemoved)}`
          : moved > 0
            ? 'Cleanup complete'
            : '';
      setStatus({
        text:
          moved > 0
            ? result.deleted_count > 0
              ? `${freedLabel} · ${result.deleted_count} deleted${timeHint}`
              : `${result.quarantined_count} in quarantine — open Quarantine tab to restore${timeHint}`
            : summaryMsg.description,
        type: moved > 0 ? 'done' : 'error',
      });
    },
    [refreshQuarantine, refreshHistory, bumpStorageRefresh, t],
  );

  const finishCleanupJob = useCallback(
    (jobId: string, result: ExecuteResponse | null) => {
      if (activeCleanupJobIdRef.current !== jobId) return;
      const startedAt = operationStartedAtRef.current;
      const durationMs = startedAt != null ? Date.now() - startedAt : undefined;
      activeCleanupJobIdRef.current = null;
      setBusy(false);
      setCleanupPaused(false);
      operationStartedAtRef.current = null;
      setElapsedMs(0);
      const waiter = cleanupWaitersRef.current.get(jobId);
      const candidateIds = waiter?.candidateIds ?? [];
      if (waiter) {
        cleanupWaitersRef.current.delete(jobId);
        waiter.resolve(result);
      }
      if (result) {
        void applyCleanupResult(
          result,
          candidateIds,
          durationMs,
          cleanupRemovedSnapshotRef.current,
        );
        cleanupRemovedSnapshotRef.current = [];
      } else {
        setProgress(idle);
        setStatus({ text: t('status.cleanupFailed'), type: 'error' });
      }
    },
    [applyCleanupResult],
  );

  const executeCleanup = async (
    candidateIds: string[],
    includeReview: boolean,
    deleteMode = 'quarantine',
  ): Promise<ExecuteResponse | null> => {
    if (!summary?.scan_id) return null;
    const deleting = deleteMode === 'delete' || deleteMode === 'hard-delete';
    const selected = candidateIds
      .map((id) => candidateMap.get(id))
      .filter((c): c is Candidate => c != null);
    cleanupRemovedSnapshotRef.current = selected;
    const plannedBytes = sumCandidateBytes(selected);
    cleanupPlannedRef.current = {
      totalFolders: candidateIds.length,
      plannedBytes,
    };
    setCleanupLive({
      foldersDone: 0,
      freedBytes: 0,
      totalFolders: candidateIds.length,
      plannedBytes,
    });
    setBusy(true);
    operationStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setProgress({
      percent: 5,
      text: deleting
        ? `Deleting ${candidateIds.length} item(s)…`
        : `Moving ${candidateIds.length} item(s) to quarantine…`,
      phase: 'cleanup',
    });
    setStatus({
      text: deleting ? t('status.deleting') : t('status.cleanupInProgress'),
      type: 'active',
    });
    toast({
      title: deleting ? 'Delete started' : 'Cleanup started',
      description: deleting
        ? 'Removing selected folders from disk. Large trees (e.g. node_modules) may take a minute — the UI stays responsive.'
        : 'Moving to .deco-quarantine on the same drive (rename, not copy).',
      variant: 'info',
    });

    return new Promise<ExecuteResponse | null>((resolve) => {
      void (async () => {
        try {
          const started = (await tauriInvoke('start_cleanup', {
            req: {
              scan_id: summary.scan_id,
              candidate_ids: candidateIds,
              delete_mode: deleteMode,
              include_review: includeReview,
            },
          })) as { job_id?: string; jobId?: string };
          const jobId = started.job_id ?? started.jobId ?? '';
          if (!jobId) {
            finishCleanupJob('', null);
            resolve(null);
            return;
          }
          activeCleanupJobIdRef.current = jobId;
          cleanupWaitersRef.current.set(jobId, {
            resolve,
            candidateCount: candidateIds.length,
            candidateIds: [...candidateIds],
          });
        } catch {
          finishCleanupJob('', null);
          resolve(null);
        }
      })();
    });
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
      bumpStorageRefresh();
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
      bumpStorageRefresh();
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
      const totalCandidates = Number(payload.total_size_candidates ?? 0);
      const processedSizes = Number(payload.processed_sizes ?? 0);
      const classifiedTargets = Number(payload.classified_targets ?? 0);
      const scannedDirs = Number(payload.scanned_dirs ?? 0);
      let percent = computeScanProgressPercent(progressPhase, {
        scannedDirs,
        classified: classifiedTargets,
        sized: processedSizes,
        total: totalCandidates,
      });
      const text = (payload.message as string) || t('status.scanningFallback');

      if (progressPhase === 'discover') {
        const found = Number(payload.discovered_targets ?? 0);
        if (!payload.message) {
          setProgress({
            percent,
            text: t('status.scanningDirsDetail', {
              scanned: scannedDirs,
              found,
            }),
            phase: 'discover',
          });
          setStatus({ text: t('status.scanningDirs', { dirs: scannedDirs }), type: 'active' });
          return;
        }
      } else if (progressPhase === 'done') {
        percent = 100;
        const dMs = Number(payload.discover_ms);
        const cMs = Number(payload.classify_ms);
        const sMs = Number(payload.size_ms);
        if (
          Number.isFinite(dMs) &&
          Number.isFinite(cMs) &&
          Number.isFinite(sMs) &&
          (dMs > 0 || cMs > 0 || sMs > 0)
        ) {
          setScanMetrics((prev) => ({
            discoverMs: dMs,
            classifyMs: cMs,
            sizeMs: sMs,
            inventoryReused: prev?.inventoryReused,
            wallMs: prev?.wallMs,
            scanMode: activeScanModeRef.current,
          }));
          const fmt = (ms: number) =>
            ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
          const timingText = t('status.scanCompleteTiming', {
            discover: fmt(dMs),
            classify: fmt(cMs),
            size: fmt(sMs),
          });
          if (!payload.message) {
            setProgress({
              percent: 100,
              text: timingText,
              phase: 'done',
            });
            setStatus({ text: timingText, type: 'done' });
            scanPhaseRef.current = progressPhase;
            return;
          }
        }
      }

      scanPhaseRef.current = progressPhase;
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
          setProgress(idle);
          return;
        }
        if (activeScanIdRef.current && report.scan_id !== activeScanIdRef.current) return;

        const list = report.candidates ?? [];
        setScanId(report.scan_id);
        setCandidates(list);
        setCandidateMap(new Map(list.filter((c) => c.id).map((c) => [c.id, c])));
        setSelectedIds(new Set(list.filter((c) => c.risk === 'safe' && c.id).map((c) => c.id)));
        setSummary(report);
        const phaseTimings = readPhaseTimings(report);
        const startedAt = operationStartedAtRef.current;
        const wallMs = startedAt != null ? Date.now() - startedAt : undefined;
        const reused = report.inventory_reused ?? 0;
        if (phaseTimings || reused > 0) {
          setScanMetrics({
            discoverMs: phaseTimings?.discoverMs ?? 0,
            classifyMs: phaseTimings?.classifyMs ?? 0,
            sizeMs: phaseTimings?.sizeMs ?? 0,
            inventoryReused: reused > 0 ? reused : undefined,
            wallMs,
            scanMode: activeScanModeRef.current,
          });
        }
        setProgress({ percent: 100, text: t('status.scanComplete'), phase: 'done' });
        const canceled = (report.warnings ?? []).some((w) => w.toLowerCase().includes('cancel'));
        const unsized = list.filter((c) => c.size_bytes === undefined).length;
        const bytes = report.total_bytes ?? 0;
        const sizeHint =
          bytes > 0 ? t('status.measuredSuffix', { size: formatBytes(bytes) }) : '';
        const unsizedHint =
          unsized > 0 ? t('status.unsizedSuffix', { count: unsized }) : '';
        const doneMs = wallMs ?? null;
        const timeHint = doneMs != null ? ` · ${formatDurationMs(doneMs)}` : '';
        setStatus({
          text: canceled
            ? t('status.scanCanceledSummary', {
                count: list.length,
                sizeHint,
                unsizedHint,
                timeHint,
              })
            : t('status.scanCompleteSummary', {
                count: list.length,
                sizeHint,
                unsizedHint,
                timeHint,
              }),
          type: 'done',
        });
        finishScan();
        void refreshHistory();
        bumpStorageRefresh();
      } catch (err) {
        console.error('[Deco] scan-complete handler failed', err);
        setError(err instanceof Error ? err.message : 'Failed to process scan results.');
        finishScan();
        setProgress(idle);
      }
    });

    const unlistenError = listen('scan-error', (event) => {
      const payload = event.payload as { scan_id?: string; scanId?: string; message?: string };
      const eventScanId = payload.scan_id ?? payload.scanId;
      if (eventScanId && activeScanIdRef.current && eventScanId !== activeScanIdRef.current) return;
      const msg = payload.message || 'Scan failed';
      setError(msg);
      setStatus({ text: t('common.errorPrefix', { msg }), type: 'error' });
      finishScan();
      setProgress(idle);
    });

    return () => {
      unlistenProgress.then((u) => u());
      unlistenBatch.then((u) => u());
      unlistenComplete.then((u) => u());
      unlistenError.then((u) => u());
    };
  }, [refreshHistory, finishScan, bumpStorageRefresh]);

  useEffect(() => {
    const unlistenCleanupProgress = listen('cleanup-progress', (event) => {
      const payload = (event.payload || {}) as Record<string, unknown>;
      const jobId = (payload.job_id ?? payload.jobId) as string | undefined;
      if (!jobId || activeCleanupJobIdRef.current !== jobId) return;

      const progressPayload: CleanupProgressPayload = {
        index: Number(payload.index ?? 0),
        total: Number(payload.total ?? 1),
        abs_path: String(payload.abs_path ?? payload.absPath ?? ''),
        action: String(payload.action ?? 'delete'),
        stage: payload.stage as string | undefined,
        kind: (payload.kind as string) ?? undefined,
        message: payload.message as string | undefined,
        detail: payload.detail as string | undefined,
        completed_count:
          payload.completed_count != null
            ? Number(payload.completed_count)
            : payload.completedCount != null
              ? Number(payload.completedCount)
              : undefined,
        in_flight_count:
          payload.in_flight_count != null
            ? Number(payload.in_flight_count)
            : payload.inFlightCount != null
              ? Number(payload.inFlightCount)
              : undefined,
        freed_bytes_so_far:
          payload.freed_bytes_so_far != null
            ? Number(payload.freed_bytes_so_far)
            : payload.freedBytesSoFar != null
              ? Number(payload.freedBytesSoFar)
              : undefined,
        folders_done_so_far:
          payload.folders_done_so_far != null
            ? Number(payload.folders_done_so_far)
            : payload.foldersDoneSoFar != null
              ? Number(payload.foldersDoneSoFar)
              : undefined,
      };
      const live =
        readCleanupLiveProgress(progressPayload, cleanupPlannedRef.current) ??
        undefined;
      if (live) setCleanupLive(live);
      const done =
        progressPayload.completed_count ?? progressPayload.index;
      const percent =
        live && live.plannedBytes > 0
          ? Math.min(
              99,
              Math.round((live.freedBytes / live.plannedBytes) * 100),
            )
          : progressPayload.total > 0
            ? Math.min(99, Math.round((done / progressPayload.total) * 100))
            : 50;
      const scanProgress = cleanupProgressToScanProgress(
        progressPayload,
        percent,
        live ?? cleanupLive,
      );
      setProgress(scanProgress);
      const statusLive = live ?? cleanupLive;
      setStatus({
        text: statusLive
          ? `${scanProgress.text} · ${statusLive.foldersDone} folder(s)`
          : scanProgress.text,
        type: 'active',
      });
    });

    const unlistenCleanupComplete = listen('cleanup-complete', (event) => {
      const payload = (event.payload || {}) as {
        job_id?: string;
        jobId?: string;
        result?: ExecuteResponse;
      };
      const jobId = payload.job_id ?? payload.jobId;
      if (!jobId || activeCleanupJobIdRef.current !== jobId || !payload.result) return;
      finishCleanupJob(jobId, payload.result);
    });

    const unlistenCleanupError = listen('cleanup-error', (event) => {
      const payload = (event.payload || {}) as {
        job_id?: string;
        jobId?: string;
        message?: string;
      };
      const jobId = payload.job_id ?? payload.jobId;
      if (!jobId || activeCleanupJobIdRef.current !== jobId) return;
      const msg = payload.message || 'Cleanup failed';
      setError(msg);
      finishCleanupJob(jobId, null);
    });

    return () => {
      unlistenCleanupProgress.then((u) => u());
      unlistenCleanupComplete.then((u) => u());
      unlistenCleanupError.then((u) => u());
    };
  }, [finishCleanupJob, cleanupLive]);

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
    const intervalMs = busy && !scanning ? 250 : 1000;
    const id = window.setInterval(tick, intervalMs);
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
    scanMetrics,
    cleanupLive,
    lastCleanupSummary,
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
    cancelCleanup,
    pauseCleanup,
    resumeCleanup,
    cleanupPaused,
    scanStopStage: searchStopped ? ('analysis' as const) : ('search' as const),
    searchStopped,
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
    storageRefreshToken,
    bumpStorageRefresh,
  };
}
