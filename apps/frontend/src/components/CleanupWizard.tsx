import { useEffect, useState } from 'react';
import { ChevronRight, HardDrive, Play, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/i18n';
import { formatBytes } from '@/lib/format';
import type { ScanProgress } from '@/lib/scan-progress';
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
  progress: ScanProgress;
  summary: ScanReport | null;
  selectedCount: number;
  safeBytes: number;
  scanRootCount: number;
  scanScopeLabel: string;
};

const STEP_IDS: WizardStep[] = ['intro', 'scanning', 'results', 'preview'];

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
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  const steps = STEP_IDS.map((id) => ({ id, label: t(`wizard.steps.${id}`) }));

  useEffect(() => {
    if (step === 'scanning' && !scanning && summary && started) {
      onStepChange('results');
    }
  }, [step, scanning, summary, started, onStepChange]);

  if (!open) return null;

  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl rounded-xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            <div>
              <h3 className="text-lg font-bold">{t('wizard.title')}</h3>
              <p className="text-xs text-muted-foreground">{t('wizard.subtitle')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-1 mb-6">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>

          {step === 'intro' && (
            <div className="space-y-4 pb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">{t('wizard.introBody')}</p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>{t('wizard.introList1')}</li>
                <li>{t('wizard.introList2')}</li>
                <li>{t('wizard.introList3')}</li>
              </ol>
              <p className="text-xs text-muted-foreground rounded-lg border bg-muted/20 p-3">
                {t('wizard.scanRoots', {
                  count: scanRootCount,
                  suffix: scanRootCount === 1 ? '' : 's',
                  scope: scanScopeLabel,
                })}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onConfigurePaths}>
                  {t('wizard.configurePaths')}
                </Button>
                <Button
                  className="flex-1 gap-2 font-semibold"
                  onClick={() => {
                    setStarted(true);
                    onStartScan();
                  }}
                >
                  <Play size={16} fill="currentColor" /> {t('wizard.startScan')}
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
                  {t('wizard.continueBackground')}
                </Button>
              )}
            </div>
          )}

          {step === 'results' && summary && (
            <div className="space-y-4 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 bg-primary/5">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    {t('wizard.safeToClean')}
                  </p>
                  <p className="text-xl font-black text-primary">{formatBytes(safeBytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('wizard.folders', { count: summary.totals_by_risk?.safe?.count ?? 0 })}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    {t('wizard.needsReview')}
                  </p>
                  <p className="text-xl font-black text-amber-600">
                    {formatBytes(summary.totals_by_risk?.review?.bytes ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('wizard.folders', { count: summary.totals_by_risk?.review?.count ?? 0 })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('wizard.preSelected', { count: selectedCount })}
              </p>
              <Button className="w-full gap-2 font-semibold" onClick={onOpenPreview}>
                {t('wizard.continuePreview')} <ChevronRight size={16} />
              </Button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 pb-6 text-center">
              <div className="inline-flex w-12 h-12 rounded-full bg-primary/10 items-center justify-center mx-auto">
                <HardDrive className="text-primary" size={24} />
              </div>
              <p className="text-sm font-medium">{t('wizard.doneMessage')}</p>
              <Button className="w-full" onClick={onClose}>
                {t('wizard.done')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
