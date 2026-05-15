import { useState } from 'react';
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
  HardDrive,
  Info,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useDeco } from './hooks/use-deco';
import { CleanupPreviewModal } from './components/CleanupPreviewModal';
import { CleanupWizard } from './components/CleanupWizard';
import { QuarantinePanel } from './components/QuarantinePanel';
import { TitleBar } from './components/TitleBar';
import { DecoLogo } from './components/DecoLogo';
import { formatBytes } from './lib/format';
import type { ExecutePreviewResponse, WizardStep } from './types';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

export default function App() {
  const {
    scan,
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
    loadSettings,
    refreshQuarantine,
    previewCleanup,
    executeCleanup,
    planFreeSpace,
    bulkRestoreQuarantine,
    purgeQuarantine,
    tauriInvoke,
    cancelScan,
    scanId,
  } = useDeco();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sortOrder] = useState('size_desc');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('intro');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<ExecutePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [plannerGb, setPlannerGb] = useState(settings?.default_target_gb ?? 10);
  const [plannerMessage, setPlannerMessage] = useState<string | null>(null);

  const filteredCandidates = candidates
    .filter(c => {
      const matchesSearch = c.abs_path.toLowerCase().includes(search.toLowerCase()) || 
                             c.kind.toLowerCase().includes(search.toLowerCase());
      const matchesRisk = riskFilter === 'all' || c.risk === riskFilter;
      return matchesSearch && matchesRisk;
    })
    .sort((a, b) => {
      if (sortOrder === 'size_desc') return (b.size_bytes || 0) - (a.size_bytes || 0);
      if (sortOrder === 'size_asc') return (a.size_bytes || 0) - (b.size_bytes || 0);
      return 0;
    });

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);

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
    if (busy || !summary?.scan_id || selectedIds.size === 0) return;
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
            <p className="text-xs truncate font-medium">{status.text}</p>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-dot-pattern min-w-0">
          <header className="h-20 border-b flex items-center justify-between px-8 bg-background/80 backdrop-blur-md z-10">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold tracking-tight capitalize">{activeTab}</h2>
              <p className="text-sm text-muted-foreground">Manage and clean your development environment.</p>
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
              {busy ? (
                <Button variant="destructive" className="gap-2" onClick={() => cancelScan()} disabled={!scanId}>
                  <X size={16} /> Cancel
                </Button>
              ) : (
                <Button variant="default" className="gap-2 font-semibold px-6" onClick={() => scan()}>
                  <Play size={16} fill="currentColor" /> Scan Now
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2 border-primary/20 hover:border-primary/50 text-primary"
                disabled={selectedIds.size === 0 || busy}
                onClick={openCleanupPreview}
              >
                <Trash2 size={16} /> Clean selected…
              </Button>
            </div>
          </header>

          <ScrollArea className="flex-1">
            <div className="px-8 py-6 max-w-7xl mx-auto space-y-6 pb-12">
              <TabsContent value="dashboard" className="m-0 space-y-6">
                {!summary && !busy && (
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
                  <StatCard label="Safe" value={formatBytes(summary?.totals_by_risk.safe.bytes)} count={summary?.totals_by_risk.safe.count} color="text-primary" />
                  <StatCard label="Review" value={formatBytes(summary?.totals_by_risk.review.bytes)} count={summary?.totals_by_risk.review.count} color="text-amber-500" />
                  <StatCard label="Blocked" value={formatBytes(summary?.totals_by_risk.blocked.bytes)} count={summary?.totals_by_risk.blocked.count} color="text-destructive" />
                  <StatCard label="Total Reclaimable" value={formatBytes(summary?.total_bytes)} count={candidates.length} color="text-foreground" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 border-border/40 bg-card/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <div className="flex items-center gap-4 flex-1 max-w-sm">
                        <div className="relative w-full">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="Filter candidates..." 
                            className="pl-8 bg-background/50" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <Select value={riskFilter} onValueChange={setRiskFilter}>
                          <SelectTrigger className="w-[140px] bg-background/50">
                            <SelectValue placeholder="All Risks" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Risks</SelectItem>
                            <SelectItem value="safe">Safe</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm font-medium text-primary">
                        {selectedIds.size} selected
                      </div>
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
                            <TableHead className="w-24">Risk</TableHead>
                            <TableHead className="w-32">Kind</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead className="text-right w-24">Size</TableHead>
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
                              <TableCell className="text-right font-semibold">{formatBytes(c.size_bytes)}</TableCell>
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

                  <div className="space-y-6">
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
                               <p className="text-xs font-mono break-all leading-relaxed bg-muted/20 p-2 rounded border">{selectedCandidate.abs_path}</p>
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

                    <Card className="border-border/40 bg-card/30">
                       <CardHeader>
                         <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                           <HardDrive size={14} /> Free Space Planner
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4">
                         <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase text-muted-foreground">Target to Free (GB)</label>
                           <Input
                             type="number"
                             min={1}
                             value={plannerGb}
                             onChange={(e) => setPlannerGb(Number(e.target.value) || 1)}
                             className="bg-background/50"
                           />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <Button variant="secondary" size="sm" className="text-xs h-9" onClick={() => applyPlanner(false)}>
                             Plan safe
                           </Button>
                           <Button variant="secondary" size="sm" className="text-xs h-9" onClick={() => applyPlanner(true)}>
                             Incl. review
                           </Button>
                         </div>
                         {plannerMessage && (
                           <p className="text-xs text-muted-foreground leading-relaxed">{plannerMessage}</p>
                         )}
                         <Button
                           className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 h-10 font-bold"
                           disabled={selectedIds.size === 0}
                           onClick={openCleanupPreview}
                         >
                           Preview cleanup
                         </Button>
                       </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="quarantine" className="m-0">
                <QuarantinePanel
                  entries={quarantine}
                  retentionDays={settings?.quarantine_retention_days ?? 30}
                  onRefresh={(filter) => refreshQuarantine(filter)}
                  onRestore={async (id) => {
                    await tauriInvoke('restore_quarantine', { id });
                    await refreshQuarantine();
                  }}
                  onBulkRestore={bulkRestoreQuarantine}
                  onPurge={() => purgeQuarantine()}
                />
              </TabsContent>

              <TabsContent value="history" className="m-0">
                <Card className="border-border/40 bg-card/30">
                  <CardHeader>
                    <CardTitle>Scan History</CardTitle>
                    <CardDescription>Review previous scan sessions and their reclaimed space.</CardDescription>
                  </CardHeader>
                  <CardContent>
                     {history.length > 0 ? (
                       <div className="space-y-4">
                          {history.map(item => (
                            <div key={item.scan_id} className="p-4 rounded-lg border bg-background/50 flex items-center justify-between group">
                              <div className="space-y-1">
                                <p className="font-bold text-sm tracking-tight">{new Date(item.created_at).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground opacity-70">Roots: {item.roots.join(', ')}</p>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Recovered</p>
                                  <p className="text-sm font-black text-primary">{formatBytes(item.total_bytes)}</p>
                                </div>
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="h-8 font-semibold"
                                  onClick={() => {
                                    setActiveTab('dashboard');
                                    scan({ roots: item.roots, profile: item.profile, stale_days: item.stale_days });
                                  }}
                                >
                                  Reuse Config
                                </Button>
                              </div>
                            </div>
                          ))}
                       </div>
                     ) : (
                       <div className="py-20 text-center flex flex-col items-center gap-3">
                         <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                           <HistoryIcon className="text-muted-foreground/50" />
                         </div>
                         <p className="text-muted-foreground font-medium">No history available.</p>
                       </div>
                     )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="m-0">
                 <Card className="border-border/40 bg-card/30">
                    <CardHeader>
                      <CardTitle>Global Configuration</CardTitle>
                      <CardDescription>Configure root directories, profile behaviors, and safety thresholds.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Scanning Roots (paths/line)</label>
                          <textarea 
                            className="w-full h-32 bg-background/50 border rounded-md p-3 font-mono text-xs focus:ring-1 focus:ring-primary outline-none resize-none"
                            defaultValue={settings?.roots.join('\n')}
                            id="rootsInput"
                          />
                        </div>
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Safety Profile</label>
                            <Select defaultValue={settings?.profile || 'safe'}>
                              <SelectTrigger className="bg-background/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="safe">Safe (Conservative)</SelectItem>
                                <SelectItem value="balanced">Balanced</SelectItem>
                                <SelectItem value="aggressive">Aggressive (Maximum Space)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Stale Threshold (Days)</label>
                               <Input type="number" defaultValue={settings?.stale_days || 45} className="bg-background/50" />
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Max Search Depth</label>
                               <Input type="number" defaultValue={settings?.max_depth || 6} className="bg-background/50" />
                             </div>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />

                      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">Calculate sizes</p>
                          <p className="text-xs text-muted-foreground">
                            Turn off for a faster scan (CLI: --no-size).
                          </p>
                        </div>
                        <Checkbox id="includeSize" defaultChecked={settings?.include_size ?? true} />
                      </div>

                      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">Check global Go cache</p>
                          <p className="text-xs text-muted-foreground">
                            Opt-in scan for GOCACHE and GOMODCACHE via go env. Never included by default.
                          </p>
                        </div>
                        <Checkbox id="checkGoCache" defaultChecked={settings?.check_go_cache ?? false} />
                      </div>

                      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">Global JVM caches</p>
                          <p className="text-xs text-muted-foreground">~/.m2/repository and ~/.gradle/caches (review tier).</p>
                        </div>
                        <Checkbox id="checkJvmGlobalCache" defaultChecked={settings?.check_jvm_global_cache ?? false} />
                      </div>

                      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">Xcode DerivedData</p>
                          <p className="text-xs text-muted-foreground">IDE global cache (review tier; opt-in).</p>
                        </div>
                        <Checkbox id="checkIdeGlobalCache" defaultChecked={settings?.check_ide_global_cache ?? false} />
                      </div>

                      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">Include Python venv</p>
                          <p className="text-xs text-muted-foreground">venv / .venv when a Python project is detected (high risk).</p>
                        </div>
                        <Checkbox id="includePythonVenv" defaultChecked={settings?.include_python_venv ?? false} />
                      </div>
                      
                      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">Advanced Mode</p>
                          <p className="text-xs text-muted-foreground">Enables destructive actions and experimental classifiers.</p>
                        </div>
                        <Checkbox defaultChecked={settings?.advanced_mode} />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => loadSettings()}>Discard Changes</Button>
                        <Button
                          className="font-bold px-8"
                          onClick={() => {
                            const rootsInput = document.getElementById('rootsInput') as HTMLTextAreaElement;
                            const checkGoCache =
                              (document.getElementById('checkGoCache') as HTMLInputElement)?.checked ?? false;
                            const includeSize =
                              (document.getElementById('includeSize') as HTMLInputElement)?.checked ?? true;
                            const checkJvmGlobalCache =
                              (document.getElementById('checkJvmGlobalCache') as HTMLInputElement)?.checked ?? false;
                            const checkIdeGlobalCache =
                              (document.getElementById('checkIdeGlobalCache') as HTMLInputElement)?.checked ?? false;
                            const includePythonVenv =
                              (document.getElementById('includePythonVenv') as HTMLInputElement)?.checked ?? false;
                            tauriInvoke('save_settings', {
                              settings: {
                                ...settings,
                                roots: rootsInput.value.split('\n').filter(Boolean),
                                check_go_cache: checkGoCache,
                                include_size: includeSize,
                                check_jvm_global_cache: checkJvmGlobalCache,
                                check_ide_global_cache: checkIdeGlobalCache,
                                include_python_venv: includePythonVenv,
                              },
                            });
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </CardContent>
                 </Card>
              </TabsContent>
            </div>
          </ScrollArea>

          <footer className="h-14 border-t px-8 flex items-center gap-6 bg-background/80 backdrop-blur-md">
             <div className="flex items-center gap-2 min-w-[120px]">
               <Play size={12} className={busy ? 'animate-spin text-primary' : 'text-muted-foreground'} />
               <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-all duration-300">
                 {progress.text}
               </span>
             </div>
             <div className="flex-1 relative">
               <Progress value={progress.percent} className={`h-2 overflow-hidden ${busy ? 'shimmer-progress' : ''}`} />
             </div>
             <div className="min-w-[40px] text-right">
               <span className="text-xs font-mono font-bold tracking-tighter">{progress.percent.toFixed(0)}%</span>
             </div>
          </footer>
        </div>
      </Tabs>

      {wizardOpen && (
        <CleanupWizard
          open
          step={wizardStep}
          onClose={() => setWizardOpen(false)}
          onStepChange={setWizardStep}
          onStartScan={() => scan()}
          onOpenPreview={() => {
            setWizardOpen(false);
            openCleanupPreview();
          }}
          busy={busy}
          progress={progress}
          summary={summary}
          selectedCount={selectedIds.size}
          safeBytes={summary?.totals_by_risk.safe.bytes ?? 0}
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

function StatCard({ label, value, count, color }: { label: string, value: string | undefined, count: number | undefined, color: string }) {
  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-black ${color}`}>{value || '0.00 B'}</div>
        <p className="text-[10px] font-bold text-muted-foreground/60">{count || 0} items discovered</p>
      </CardContent>
    </Card>
  );
}
