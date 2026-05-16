import { useMemo, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  LayoutDashboard,
  ShieldAlert,
  History as HistoryIcon,
  Settings2,
  Search,
  Trash2,
  Play,
  X,
  ChevronRight,
  Info,
  AlertTriangle,
  Sparkles,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FolderOpen,
} from 'lucide-react';
import { useDeco } from './hooks/use-deco';
import { CleanupPreviewModal } from './components/CleanupPreviewModal';
import { CleanupWizard } from './components/CleanupWizard';
import { ScanTargetsDashboardCard } from './components/ScanTargetsDashboardCard';
import { DisabledActionHint } from './components/DisabledActionHint';
import { cleanSelectedDisabledReason } from './lib/disabled-reasons';
import type { ScanMode } from './components/ScanModeSelector';
import { volumeMountsFromPaths } from './lib/volume-from-path';
import { ScanTargetsModal } from './components/ScanTargetsModal';
import { QuarantinePanel } from './components/QuarantinePanel';
import { ScanHistoryPanel } from './components/ScanHistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { LastScanSummaryCard } from './components/LastScanSummaryCard';
import { SelectionActionBar } from './components/SelectionActionBar';
import {
  historyReuseError,
  settingsFromHistoryItem,
} from './lib/history-reuse';
import type { HistoryItem } from './types';
import { TitleBar } from './components/TitleBar';
import { DecoLogo } from './components/DecoLogo';
import {
  candidateSizeIsKnown,
  formatBytes,
  formatStatBytes,
} from './lib/format';
import {
  compareCandidatesSorted,
  DEFAULT_SORT,
  toggleSortColumn,
  type CandidateSortColumn,
  type CandidateSortState,
} from './lib/candidate-sort';
import {
  EMPTY_CANDIDATE_FILTERS,
  filterCandidates,
  filtersAreActive,
  parseSizeInput,
  uniqueKinds,
  type CandidateFilterState,
} from './lib/candidate-filter';
import { normalizeSettings } from './lib/settings-normalize';
import type { ExecutePreviewResponse, Settings, WizardStep } from './types';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CandidateFilterBar } from '@/components/CandidateFilterBar';
import { StatusFooter } from '@/components/StatusFooter';
import { FreeSpacePlannerCard } from '@/components/FreeSpacePlannerCard';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { hasCompletedOnboarding, markOnboardingCompleted } from '@/lib/client-prefs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function SortHeading({
  column,
  sort,
  onToggleSort,
  children,
  className,
  alignEnd,
}: {
  column: CandidateSortColumn;
  sort: CandidateSortState;
  onToggleSort: (column: CandidateSortColumn) => void;
  children: ReactNode;
  className?: string;
  alignEnd?: boolean;
}) {
  const active = sort.column === column;
  const dir = active ? sort.dir : null;
  return (
    <TableHead className={className}>
      <button
        type="button"
        title={active ? 'Click to reverse sort direction' : 'Click to sort by this column'}
        onClick={() => onToggleSort(column)}
        className={cn(
          'inline-flex items-center gap-1.5 font-semibold tracking-tight text-foreground hover:text-primary transition-colors select-none rounded-sm leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          alignEnd && 'w-full justify-end',
          active && 'text-primary',
        )}
      >
        <span>{children}</span>
        {active && dir ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-70" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        )}
      </button>
    </TableHead>
  );
}

export default function App() {
  const {
    scan,
    candidates,
    selectedIds,
    setSelectedIds,
    scanning,
    busy,
    elapsedMs,
    progress,
    status,
    summary,
    quarantine,
    history,
    settings,
    error,
    setError,
    loadSettings,
    selectedVolumes,
    setSelectedVolumes,
    includeProjectFolders,
    setIncludeProjectFolders,
    refreshQuarantine,
    previewCleanup,
    executeCleanup,
    planFreeSpace,
    bulkRestoreQuarantine,
    purgeQuarantine,
    deleteScanHistory,
    clearScanHistory,
    tauriInvoke,
    cancelScan,
  } = useDeco();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [sizeMinInput, setSizeMinInput] = useState('');
  const [sizeMaxInput, setSizeMaxInput] = useState('');
  const [sort, setSort] = useState<CandidateSortState>(DEFAULT_SORT);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('intro');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<ExecutePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [plannerGb, setPlannerGb] = useState(settings?.default_target_gb ?? 10);
  const [plannerMessage, setPlannerMessage] = useState<string | null>(null);
  const [scanTargetsModalOpen, setScanTargetsModalOpen] = useState(false);
  const [scanTargetsAfterWizard, setScanTargetsAfterWizard] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasCompletedOnboarding());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const dismissOnboarding = () => {
    markOnboardingCompleted();
    setOnboardingOpen(false);
  };

  const customScanRoots = settings?.roots ?? [];
  const useCustomScanRoots = settings?.use_custom_scan_roots ?? false;
  const scanMode: ScanMode = useCustomScanRoots ? 'custom' : 'partition';
  const hasScanTargetsReady = useCustomScanRoots
    ? customScanRoots.length > 0
    : selectedVolumes.length > 0;

  const cleanSelectedReason = useMemo(
    () =>
      cleanSelectedDisabledReason({
        selectedCount: selectedIds.size,
        scanning,
        busy,
        hasScanResults: Boolean(summary?.scan_id),
      }),
    [selectedIds.size, scanning, busy, summary?.scan_id],
  );

  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const c of candidates) {
      if (selectedIds.has(c.id)) sum += c.size_bytes ?? 0;
    }
    return sum;
  }, [candidates, selectedIds]);

  const lastHistoryItem = history.length > 0 ? history[0] : null;

  const applyHistoryReuse = async (item: HistoryItem) => {
    if (!settings) return;
    const next = settingsFromHistoryItem(item, settings);
    const err = historyReuseError(item, next);
    if (err) {
      setError(err);
      return;
    }
    await tauriInvoke('save_settings', { settings: next });
    await loadSettings();
    setActiveTab('dashboard');
    void scan({
      selected_volumes: next.selected_volumes,
      include_project_folders: next.include_project_folders,
      roots: next.roots,
      use_custom_scan_roots: next.use_custom_scan_roots,
      profile: next.profile,
      stale_days: next.stale_days,
    });
  };

  const persistScanTargets = (patch: {
    selected_volumes?: string[];
    include_project_folders?: boolean;
    roots?: string[];
    use_custom_scan_roots?: boolean;
  }) => {
    if (!settings || scanning) return;
    const roots = patch.roots ?? customScanRoots;
    const useCustom = patch.use_custom_scan_roots ?? useCustomScanRoots;
    let volumes = patch.selected_volumes ?? selectedVolumes;
    const rootsPatch = patch.roots ?? (patch.use_custom_scan_roots !== undefined ? roots : undefined);
    if (rootsPatch) {
      const fromRoots = volumeMountsFromPaths(rootsPatch);
      volumes = [...new Set([...volumes, ...fromRoots])].sort();
    }
    const next: Settings = {
      ...normalizeSettings(settings),
      selected_volumes: volumes,
      include_project_folders:
        patch.include_project_folders ?? includeProjectFolders,
      roots,
      use_custom_scan_roots: useCustom,
    };
    setSelectedVolumes(volumes);
    if (patch.include_project_folders !== undefined) {
      setIncludeProjectFolders(patch.include_project_folders);
    }
    void invoke('save_settings', { settings: next })
      .then(() => loadSettings())
      .catch(() => undefined);
  };

  const setScanMode = (mode: ScanMode) => {
    persistScanTargets({ use_custom_scan_roots: mode === 'custom' });
  };

  const runScan = async (afterWizard = false) => {
    const started = await scan({
      selected_volumes: selectedVolumes,
      include_project_folders: includeProjectFolders,
    });
    if (started && afterWizard) {
      setWizardOpen(true);
      setWizardStep('scanning');
    }
  };

  const requestScan = (opts?: { wizard?: boolean }) => {
    if (scanning) return;
    if (!hasScanTargetsReady) {
      setScanTargetsAfterWizard(!!opts?.wizard);
      if (opts?.wizard) setWizardOpen(true);
      setScanTargetsModalOpen(true);
      return;
    }
    if (opts?.wizard) {
      setWizardOpen(true);
      setWizardStep('scanning');
    }
    void runScan(!!opts?.wizard);
  };

  const scanScopeLabel =
    settings?.scan_scope === 'projects'
      ? 'project folders'
      : settings?.scan_scope === 'drives'
        ? 'local drives'
        : 'projects + drives';

  const availableKinds = useMemo(() => uniqueKinds(candidates), [candidates]);

  const filterState: CandidateFilterState = useMemo(
    () => ({
      searchQuery: search,
      riskFilter: riskFilter as CandidateFilterState['riskFilter'],
      kindFilter,
      sizeMinBytes: parseSizeInput(sizeMinInput),
      sizeMaxBytes: parseSizeInput(sizeMaxInput),
    }),
    [search, riskFilter, kindFilter, sizeMinInput, sizeMaxInput],
  );

  const effectiveKindFilter =
    kindFilter !== 'all' && !availableKinds.includes(kindFilter) ? 'all' : kindFilter;

  const activeFilterState: CandidateFilterState = useMemo(
    () => ({ ...filterState, kindFilter: effectiveKindFilter }),
    [filterState, effectiveKindFilter],
  );

  const filtersActive = filtersAreActive(activeFilterState);

  const filteredCandidates = useMemo(
    () =>
      filterCandidates(candidates, activeFilterState).sort((a, b) =>
        compareCandidatesSorted(a, b, sort),
      ),
    [candidates, activeFilterState, sort],
  );

  const clearFilters = () => {
    setSearch(EMPTY_CANDIDATE_FILTERS.searchQuery);
    setRiskFilter(EMPTY_CANDIDATE_FILTERS.riskFilter);
    setKindFilter(EMPTY_CANDIDATE_FILTERS.kindFilter);
    setSizeMinInput('');
    setSizeMaxInput('');
  };

  const shortcutsEnabled =
    !wizardOpen && !previewOpen && !scanTargetsModalOpen && !onboardingOpen;

  useKeyboardShortcuts({
    enabled: shortcutsEnabled,
    onFocusSearch: () => {
      if (activeTab !== 'dashboard') setActiveTab('dashboard');
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    onStartScan: () => {
      if (activeTab !== 'dashboard') setActiveTab('dashboard');
      requestScan();
    },
    onShowShortcuts: () => setShortcutsOpen(true),
    onClearFilters: () => {
      if (filtersActive) clearFilters();
    },
  });

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);

  const hasScanResults = Boolean(summary?.scan_id);

  const anySizingPending =
    scanning &&
    (candidates.length === 0 ||
      candidates.some((c) => !candidateSizeIsKnown(c.size_bytes)));

  const statByteLabel = (bytes: number | undefined) =>
    anySizingPending ? 'Sizing…' : formatStatBytes(bytes, hasScanResults);

  const statCountLabel = (count: number) => {
    if (!hasScanResults && !scanning) return 'No scan yet';
    return `${count} items discovered`;
  };

  const countByRisk = (risk: string) =>
    candidates.filter((c) => c.risk === risk).length;

  const toggleSortHeader = (col: CandidateSortColumn) => {
    setSort((current) => toggleSortColumn(current, col));
  };

  const revealInExplorer = async (path: string) => {
    try {
      await invoke('reveal_path_in_explorer', { path });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const handleSelectAll = (checked: boolean | string) => {
    if (checked === true) {
      const selectable = candidates.filter(c => c.risk !== 'blocked' && c.can_delete !== false);
      setSelectedIds(new Set(selectable.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleCandidate = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCleanupPreview = async () => {
    if (scanning || busy || !summary?.scan_id || selectedIds.size === 0) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreview(null);
    const ids = Array.from(selectedIds);
    const hasReview = candidates.some((c) => ids.includes(c.id) && c.risk === 'review');
    const result = await previewCleanup(ids, hasReview);
    setPreview(result);
    setPreviewLoading(false);
  };

  const confirmCleanup = async (includeReview: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setPreviewOpen(false);
    const result = await executeCleanup(ids, includeReview);
    if (result) {
      setWizardStep('done');
      if (wizardOpen) setWizardOpen(true);
    }
  };

  const applyPlanner = async (includeReview: boolean) => {
    if (!summary?.scan_id) {
      setPlannerMessage('Run a scan first.');
      return;
    }
    const plan = await planFreeSpace(plannerGb, includeReview);
    if (!plan) return;
    setSelectedIds(new Set(plan.selected_ids));
    setPlannerMessage(
      plan.selected_count > 0
        ? `Selected ${plan.selected_count} folders (~${formatBytes(plan.achievable_bytes)}). Target was ${formatBytes(plan.target_bytes)}.`
        : 'Could not reach that target with current scan results. Try a lower goal or include review-tier items.',
    );
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <TitleBar />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 min-h-0 w-full">
        {/* Sidebar */}
        <aside className="w-64 flex flex-col border-r bg-card/50 backdrop-blur-md">
          <div className="px-4 pt-5 pb-3">
            <DecoLogo size="md" className="px-1" />
          </div>

          <TabsList className="bg-transparent flex flex-col h-auto p-0 px-4 space-y-2 flex-1 items-stretch">
            <TabsTrigger 
              value="dashboard" 
              className="justify-start gap-3 h-11 px-3 data-[state=active]:bg-secondary transition-all"
            >
              <LayoutDashboard size={18} /> Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="quarantine" 
              className="justify-start gap-3 h-11 px-3 data-[state=active]:bg-secondary transition-all"
            >
              <ShieldAlert size={18} /> Quarantine
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="justify-start gap-3 h-11 px-3 data-[state=active]:bg-secondary transition-all"
            >
              <HistoryIcon size={18} /> History
            </TabsTrigger>
            <Separator className="my-4" />
            <TabsTrigger 
              value="settings" 
              className="justify-start gap-3 h-11 px-3 data-[state=active]:bg-secondary transition-all"
            >
              <Settings2 size={18} /> Settings
            </TabsTrigger>
          </TabsList>

          <div className="p-4 border-t bg-card/30">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full shadow-sm ${
                status.type === 'active' ? 'bg-primary animate-pulse' : 
                status.type === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
              }`} />
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Status</span>
            </div>
            <p
              className="text-xs font-medium min-w-0 break-words leading-snug"
              title={status.text}
            >
              {status.text}
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-dot-pattern min-w-0">
          <header className="h-20 border-b flex items-center justify-between px-8 bg-background/80 backdrop-blur-md z-10">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold tracking-tight capitalize">{activeTab}</h2>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'dashboard' && 'Scan, review candidates, and reclaim disk space.'}
                {activeTab === 'quarantine' && 'Restore or permanently purge held folders.'}
                {activeTab === 'history' && 'Review past scans and reuse configurations.'}
                {activeTab === 'settings' && 'Configure scan targets, safety, and discovery options.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                className="gap-2 font-semibold"
                onClick={() => {
                  setWizardOpen(true);
                  setWizardStep('intro');
                }}
              >
                <Sparkles size={16} /> Free up space
              </Button>
              {scanning ? (
                <Button variant="destructive" className="gap-2" onClick={() => cancelScan()}>
                  <X size={16} /> Stop scan
                </Button>
              ) : (
                <Button variant="default" className="gap-2 font-semibold px-6" onClick={() => requestScan()}>
                  <Play size={16} fill="currentColor" /> Scan Now
                </Button>
              )}
              <DisabledActionHint reason={cleanSelectedReason}>
                <Button
                  variant="outline"
                  className="gap-2 border-primary/20 hover:border-primary/50 text-primary"
                  disabled={cleanSelectedReason !== null}
                  onClick={openCleanupPreview}
                >
                  <Trash2 size={16} /> Clean selected…
                </Button>
              </DisabledActionHint>
            </div>
          </header>

          <ScrollArea className="flex-1">
            <div className="px-8 py-6 max-w-7xl mx-auto space-y-6 pb-12">
              <TabsContent
                value="dashboard"
                className={`m-0 space-y-6 ${selectedIds.size > 0 ? 'pb-24' : ''}`}
              >
                <ScanTargetsDashboardCard
                  mode={scanMode}
                  onModeChange={setScanMode}
                  selectedVolumes={selectedVolumes}
                  includeProjectFolders={includeProjectFolders}
                  customScanRoots={customScanRoots}
                  onSelectedVolumesChange={(mounts) =>
                    persistScanTargets({ selected_volumes: mounts })
                  }
                  onIncludeProjectFoldersChange={(value) =>
                    persistScanTargets({ include_project_folders: value })
                  }
                  onCustomScanRootsChange={(roots) => persistScanTargets({ roots })}
                  profile={settings?.profile}
                  ready={hasScanTargetsReady}
                  disabled={scanning}
                  onEditSettings={() => setActiveTab('settings')}
                  onError={setError}
                />

                {lastHistoryItem && !scanning ? (
                  <LastScanSummaryCard
                    item={lastHistoryItem}
                    onViewHistory={() => setActiveTab('history')}
                    onReuse={() => void applyHistoryReuse(lastHistoryItem)}
                  />
                ) : null}

                {!summary && !scanning && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-lg">Need more disk space?</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                          Run the guided flow to scan your projects, review safe targets, and quarantine clutter with one
                          click — nothing is permanently deleted until you purge quarantine.
                        </p>
                      </div>
                      <Button
                        className="gap-2 font-semibold shrink-0"
                        onClick={() => {
                          setWizardOpen(true);
                          setWizardStep('intro');
                        }}
                      >
                        <Sparkles size={16} /> Start guided cleanup
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Safe"
                    value={statByteLabel(summary?.totals_by_risk?.safe?.bytes)}
                    countLabel={statCountLabel(
                      scanning
                        ? countByRisk('safe')
                        : (summary?.totals_by_risk?.safe?.count ?? 0),
                    )}
                    color="text-primary"
                    muted={!hasScanResults && !scanning}
                  />
                  <StatCard
                    label="Review"
                    value={statByteLabel(summary?.totals_by_risk?.review?.bytes)}
                    countLabel={statCountLabel(
                      scanning
                        ? countByRisk('review')
                        : (summary?.totals_by_risk?.review?.count ?? 0),
                    )}
                    color="text-amber-500"
                    muted={!hasScanResults && !scanning}
                  />
                  <StatCard
                    label="Blocked"
                    value={statByteLabel(summary?.totals_by_risk?.blocked?.bytes)}
                    countLabel={statCountLabel(
                      scanning
                        ? countByRisk('blocked')
                        : (summary?.totals_by_risk?.blocked?.count ?? 0),
                    )}
                    color="text-destructive"
                    muted={!hasScanResults && !scanning}
                  />
                  <StatCard
                    label="Total Reclaimable"
                    value={statByteLabel(summary?.total_bytes)}
                    countLabel={statCountLabel(candidates.length)}
                    color="text-foreground"
                    muted={!hasScanResults && !scanning}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <Card className="lg:col-span-2 border-border/40 bg-card/30 min-w-0">
                    <CardHeader className="space-y-3 pb-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="relative w-full sm:max-w-md">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            ref={searchInputRef}
                            placeholder="Search path or kind…"
                            className="pl-8 bg-background/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-0.5 shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {selectedIds.size} selected
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-snug">
                          {filtersActive
                              ? `Showing ${filteredCandidates.length} of ${candidates.length}`
                              : `${candidates.length} candidates`}
                            {' · '}Click headers to sort
                        </span>
                      </div>
                      </div>
                      <CandidateFilterBar
                        riskFilter={riskFilter}
                        onRiskFilterChange={setRiskFilter}
                        kindFilter={kindFilter}
                        onKindFilterChange={setKindFilter}
                        availableKinds={availableKinds}
                        sizeMinInput={sizeMinInput}
                        sizeMaxInput={sizeMaxInput}
                        onSizeMinChange={setSizeMinInput}
                        onSizeMaxChange={setSizeMaxInput}
                        filtersActive={filtersActive}
                        onClearFilters={clearFilters}
                        sizeFilterDisabled={candidates.length === 0}
                      />
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="w-12 text-center">
                              <Checkbox 
                                onCheckedChange={handleSelectAll}
                                checked={candidates.length > 0 && Array.from(selectedIds).length === candidates.filter(c => c.risk !== 'blocked').length}
                              />
                            </TableHead>
                            <SortHeading
                              column="risk"
                              sort={sort}
                              onToggleSort={toggleSortHeader}
                              className="w-24"
                            >
                              Risk
                            </SortHeading>
                            <SortHeading
                              column="kind"
                              sort={sort}
                              onToggleSort={toggleSortHeader}
                              className="min-w-[9rem]"
                            >
                              Kind
                            </SortHeading>
                            <SortHeading
                              column="path"
                              sort={sort}
                              onToggleSort={toggleSortHeader}
                            >
                              Path
                            </SortHeading>
                            <SortHeading
                              column="size"
                              sort={sort}
                              onToggleSort={toggleSortHeader}                              alignEnd
                              className="text-right w-[7.5rem]"
                            >
                              Size
                            </SortHeading>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCandidates.map((c) => (
                            <TableRow 
                              key={c.id} 
                              className={`cursor-pointer hover:bg-muted/20 transition-colors ${selectedCandidateId === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                              onClick={() => setSelectedCandidateId(c.id)}
                            >
                              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={selectedIds.has(c.id)} 
                                  onCheckedChange={() => toggleCandidate(c.id)}
                                  disabled={c.risk === 'blocked'}
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`font-semibold ${
                                  c.risk === 'safe' ? 'text-primary border-primary/20' : 
                                  c.risk === 'review' ? 'text-amber-500 border-amber-500/20' : 
                                  'text-destructive border-destructive/20'
                                }`}>
                                  {c.risk}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-[11px] font-semibold opacity-70 uppercase tracking-tighter">{c.kind}</TableCell>
                              <TableCell className="font-mono text-[11px] truncate max-w-xs">{c.abs_path}</TableCell>
                              <TableCell className="text-right">
                                {candidateSizeIsKnown(c.size_bytes) ? (
                                  <span className="font-semibold tabular-nums">
                                    {formatBytes(c.size_bytes)}
                                  </span>
                                ) : (
                                  <span className="font-medium text-muted-foreground tabular-nums text-xs">
                                    Sizing…
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {filteredCandidates.length === 0 && (
                        <div className="py-20 text-center space-y-3">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/30">
                            <Info size={24} className="text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground font-medium">No candidates found.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="lg:col-span-1 space-y-6 sticky top-4 self-start w-full max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-1 deco-scrollbar">
                    <Card className="border-border/40 bg-card/30">
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <ChevronRight size={14} /> Candidate Detail
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedCandidate ? (
                          <div className="space-y-4 animate-in fade-in duration-300">
                             <div className="space-y-1">
                               <p className="text-[10px] uppercase font-bold text-muted-foreground">Path</p>
                               <p className="text-xs font-mono break-all leading-relaxed bg-muted/20 p-2 rounded border">
                                 {selectedCandidate.abs_path}
                               </p>
                               <Button
                                 type="button"
                                 variant="secondary"
                                 size="sm"
                                 className="w-full gap-2 h-8 text-xs font-semibold"
                                 onClick={() => void revealInExplorer(selectedCandidate.abs_path)}
                               >
                                 <FolderOpen size={14} />
                                 Show in File Explorer
                               </Button>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1">
                                 <p className="text-[10px] uppercase font-bold text-muted-foreground">Reason</p>
                                 <p className="text-xs font-semibold">{selectedCandidate.display_reason_summary || 'N/A'}</p>
                               </div>
                               <div className="space-y-1">
                                 <p className="text-[10px] uppercase font-bold text-muted-foreground">Project</p>
                                 <p className="text-xs font-semibold">{selectedCandidate.project_root || 'N/A'}</p>
                               </div>
                             </div>
                             <div className="space-y-1">
                               <p className="text-[10px] uppercase font-bold text-muted-foreground">Size</p>
                               <p className="text-xs font-black tabular-nums">
                                 {candidateSizeIsKnown(selectedCandidate.size_bytes) ? (
                                   formatBytes(selectedCandidate.size_bytes)
                                 ) : (
                                   <span className="font-medium text-muted-foreground">Sizing…</span>
                                 )}
                               </p>
                             </div>
                             <div className="space-y-1">
                               <p className="text-[10px] uppercase font-bold text-muted-foreground">Reason Codes</p>
                               <div className="flex flex-wrap gap-1 pt-1">
                                 {selectedCandidate.reason_codes?.map(code => (
                                   <Badge key={code} variant="secondary" className="text-[9px] font-mono px-1.5 py-0">{code}</Badge>
                                 ))}
                               </div>
                             </div>
                          </div>
                        ) : (
                          <div className="py-12 text-center">
                            <p className="text-xs text-muted-foreground italic">Select an item to inspect its metadata.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <FreeSpacePlannerCard
                      summary={summary}
                      plannerGb={plannerGb}
                      onPlannerGbChange={setPlannerGb}
                      plannerMessage={plannerMessage}
                      onPlanSafe={() => void applyPlanner(false)}
                      onPlanReview={() => void applyPlanner(true)}
                      cleanDisabledReason={cleanSelectedReason}
                      onPreview={() => void openCleanupPreview()}
                      disabled={scanning || busy}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="quarantine" className="m-0">
                <QuarantinePanel
                  entries={quarantine}
                  retentionDays={settings?.quarantine_retention_days ?? 30}
                  onReload={() => refreshQuarantine()}
                  onRestore={async (id) => {
                    await tauriInvoke('restore_quarantine', { id });
                    await refreshQuarantine();
                  }}
                  onBulkRestore={bulkRestoreQuarantine}
                  onPurge={async () => {
                    await purgeQuarantine();
                  }}
                  onGoToDashboard={() => setActiveTab('dashboard')}
                />
              </TabsContent>

              <TabsContent value="history" className="m-0">
                <ScanHistoryPanel
                  items={history}
                  onReuse={(item) => void applyHistoryReuse(item)}
                  onDelete={deleteScanHistory}
                  onClearAll={clearScanHistory}
                />
              </TabsContent>


              <TabsContent value="settings" className="m-0">
                <SettingsPanel
                  settings={settings}
                  scanning={scanning}
                  onSave={async (next) => {
                    await tauriInvoke('save_settings', { settings: next });
                    await loadSettings();
                  }}
                  onDiscard={() => loadSettings()}
                  onError={setError}
                />
              </TabsContent>
            </div>
          </ScrollArea>

          <StatusFooter
            progress={progress}
            scanning={scanning}
            busy={busy}
            elapsedMs={elapsedMs}
          />
        </div>
      </Tabs>

      {wizardOpen && (
        <CleanupWizard
          open
          step={wizardStep}
          onClose={() => setWizardOpen(false)}
          onStepChange={setWizardStep}
          onStartScan={() => requestScan({ wizard: true })}
          onOpenPreview={() => {
            setWizardOpen(false);
            openCleanupPreview();
          }}
          onConfigurePaths={() => {
            setWizardOpen(false);
            setActiveTab('settings');
          }}
          scanning={scanning}
          progress={progress}
          summary={summary}
          selectedCount={selectedIds.size}
          safeBytes={summary?.totals_by_risk?.safe?.bytes ?? 0}
          scanRootCount={
            selectedVolumes.length + (includeProjectFolders ? 1 : 0)
          }
          scanScopeLabel={scanScopeLabel}
        />
      )}

      {previewOpen && (
        <CleanupPreviewModal
          open
          onClose={() => setPreviewOpen(false)}
          selectedIds={selectedIds}
          candidates={candidates}
          preview={preview}
          loading={previewLoading}
          onConfirm={confirmCleanup}
        />
      )}

      <ScanTargetsModal
        open={scanTargetsModalOpen}
        onClose={() => setScanTargetsModalOpen(false)}
        mode={scanMode}
        onModeChange={setScanMode}
        selectedVolumes={selectedVolumes}
        includeProjectFolders={includeProjectFolders}
        customScanRoots={customScanRoots}
        onSelectedVolumesChange={(mounts) => persistScanTargets({ selected_volumes: mounts })}
        onIncludeProjectFoldersChange={(value) =>
          persistScanTargets({ include_project_folders: value })
        }
        onCustomScanRootsChange={(roots) => persistScanTargets({ roots })}
        onError={setError}
        onConfirm={() => {
          if (selectedVolumes.length === 0) return;
          if (scanMode === 'custom' && customScanRoots.length === 0) return;
          persistScanTargets({});
          setScanTargetsModalOpen(false);
          if (scanTargetsAfterWizard) {
            setWizardOpen(true);
            setWizardStep('scanning');
          }
          void runScan(scanTargetsAfterWizard);
          setScanTargetsAfterWizard(false);
        }}
      />

      {activeTab === 'dashboard' ? (
        <SelectionActionBar
          selectedCount={selectedIds.size}
          selectedBytes={selectedBytes}
          cleanDisabledReason={cleanSelectedReason}
          busy={scanning || busy}
          onClean={openCleanupPreview}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      ) : null}

      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <OnboardingDialog
        open={onboardingOpen}
        onDismiss={dismissOnboarding}
        onGetStarted={() => {
          dismissOnboarding();
          setWizardOpen(true);
          setWizardStep('intro');
        }}
      />

      {error && (
        <div className="fixed bottom-20 right-8 max-w-md bg-destructive text-destructive-foreground p-4 rounded-lg shadow-2xl animate-in fade-in slide-in-from-bottom-5 border-2 border-white/10 z-50">
           <div className="flex items-start gap-3">
             <AlertTriangle size={20} />
             <div className="flex-1">
               <p className="font-bold text-sm">Operation Failed</p>
               <p className="text-xs opacity-90 leading-relaxed mt-1 line-clamp-3">{error}</p>
             </div>
             <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100"><X size={16} /></button>
           </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  countLabel,
  color,
  muted,
}: {
  label: string;
  value: string;
  countLabel: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-black tabular-nums',
            muted ? 'text-muted-foreground' : color,
          )}
        >
          {value}
        </div>
        <p className="text-[10px] font-bold text-muted-foreground/60">{countLabel}</p>
      </CardContent>
    </Card>
  );
}
