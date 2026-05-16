import { useEffect, useState } from 'react';
import { ChevronRight, HardDrive, Play, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/format';
import type { ScanReport, WizardStep } from '@/types';

type Props = {
  open: boolean;
  step: WizardStep;
  onClose: () => void;
  onStepChange: (step: WizardStep) => void;
  onStartScan: () => void;
  onOpenPreview: () => void;
  onConfigurePaths: () => void;
  scanning: boolean;
  progress: { percent: number; text: string };
  summary: ScanReport | null;
  selectedCount: number;
  safeBytes: number;
  scanRootCount: number;
  scanScopeLabel: string;
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'intro', label: 'Welcome' },
  { id: 'scanning', label: 'Scan' },
  { id: 'results', label: 'Review' },
  { id: 'preview', label: 'Clean' },
];

export function CleanupWizard({
  open,
  step,
  onClose,
  onStepChange,
  onStartScan,
  onOpenPreview,
  onConfigurePaths,
  scanning,
  progress,
  summary,
  selectedCount,
  safeBytes,
  scanRootCount,
  scanScopeLabel,
}: Props) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (step === 'scanning' && !scanning && summary && started) {
      onStepChange('results');
    }
  }, [step, scanning, summary, started, onStepChange]);

  if (!open) return null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl rounded-xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            <div>
              <h3 className="text-lg font-bold">Free up space</h3>
              <p className="text-xs text-muted-foreground">Guided cleanup — safe by default</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-1 mb-6">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>

          {step === 'intro' && (
            <div className="space-y-4 pb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Deco finds development clutter — old <code className="text-xs bg-muted px-1 rounded">node_modules</code>
                , build folders, and caches — and moves them to <strong>quarantine</strong> so you can undo later.
              </p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Scan dev folders and local drives for reclaimable clutter</li>
                <li>Review what is safe vs needs caution</li>
                <li>Preview and quarantine selected items</li>
              </ol>
              <p className="text-xs text-muted-foreground rounded-lg border bg-muted/20 p-3">
                <strong className="text-foreground">{scanRootCount}</strong> scan root
                {scanRootCount === 1 ? '' : 's'} ({scanScopeLabel}). Adjust paths in Settings if needed.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onConfigurePaths}>
                  Configure paths
                </Button>
                <Button
                  className="flex-1 gap-2 font-semibold"
                  onClick={() => {
                    setStarted(true);
                    onStartScan();
                  }}
                >
                  <Play size={16} fill="currentColor" /> Start scan
                </Button>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div className="space-y-4 pb-8">
              <p className="text-sm text-muted-foreground">{progress.text}</p>
              <Progress value={progress.percent} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{progress.percent.toFixed(0)}%</p>
              {scanning && (
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Continue in background
                </Button>
              )}
            </div>
          )}

          {step === 'results' && summary && (
            <div className="space-y-4 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 bg-primary/5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Safe to clean</p>
                  <p className="text-xl font-black text-primary">{formatBytes(safeBytes)}</p>
                  <p className="text-xs text-muted-foreground">{summary.totals_by_risk?.safe?.count ?? 0} folders</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Needs review</p>
                  <p className="text-xl font-black text-amber-600">
                    {formatBytes(summary.totals_by_risk?.review?.bytes ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{summary.totals_by_risk?.review?.count ?? 0} folders</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                We pre-selected <strong>{selectedCount}</strong> safe items. Adjust the list on the dashboard before
                cleaning.
              </p>
              <Button className="w-full gap-2 font-semibold" onClick={onOpenPreview}>
                Continue to preview <ChevronRight size={16} />
              </Button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 pb-6 text-center">
              <div className="inline-flex w-12 h-12 rounded-full bg-primary/10 items-center justify-center mx-auto">
                <HardDrive className="text-primary" size={24} />
              </div>
              <p className="text-sm font-medium">Cleanup finished. Restored files live in Quarantine.</p>
              <Button className="w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
