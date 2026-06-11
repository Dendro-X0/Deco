import { useCallback, useEffect, useState } from 'react';
import { HardDrive, Search, ShieldAlert, Sparkles, UserCircle2, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DecoLogo } from '@/components/DecoLogo';
import { useI18n } from '@/i18n';
import { cleanupProfileDescription, cleanupProfileLabel } from '@/i18n/preset-labels';
import { CLEANUP_PROFILE_PRESETS, type CleanupProfilePreset } from '@/lib/cleanup-profiles';
import { defaultSystemMount, suggestedProjectVolumes } from '@/lib/persona-onboarding';
import { formatBytes } from '@/lib/format';
import type { StorageVolume } from '@/types';

export type OnboardingStep = 'welcome' | 'projects' | 'profile';

export type PersonaOnboardingResult = {
  selectedVolumes: string[];
  profile: CleanupProfilePreset;
};

type Props = {
  open: boolean;
  initialStep?: OnboardingStep;
  onDismiss: () => void;
  onComplete: (result: PersonaOnboardingResult | null) => void;
};

const WELCOME_STEPS = [
  { icon: Search, id: 'scan' as const },
  { icon: ShieldAlert, id: 'review' as const },
  { icon: Sparkles, id: 'quarantine' as const },
];

export function OnboardingDialog({
  open,
  initialStep = 'welcome',
  onDismiss,
  onComplete,
}: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [volumes, setVolumes] = useState<StorageVolume[]>([]);
  const [loadingVolumes, setLoadingVolumes] = useState(false);
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);
  const [profile, setProfile] = useState<CleanupProfilePreset>('first_scan');

  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
  }, [open, initialStep]);

  const loadVolumes = useCallback(async () => {
    setLoadingVolumes(true);
    try {
      const list = (await invoke('list_storage_volumes_command')) as StorageVolume[];
      setVolumes(list);
      setSelectedVolumes(suggestedProjectVolumes(list, defaultSystemMount()));
    } finally {
      setLoadingVolumes(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (step === 'projects' && volumes.length === 0 && !loadingVolumes) {
      void loadVolumes();
    }
  }, [open, step, volumes.length, loadingVolumes, loadVolumes]);

  if (!open) return null;

  const toggleVolume = (mount: string, checked: boolean) => {
    const next = new Set(selectedVolumes);
    if (checked) next.add(mount);
    else next.delete(mount);
    setSelectedVolumes(Array.from(next).sort());
  };

  const finish = () => {
    if (selectedVolumes.length === 0) {
      onComplete(null);
      return;
    }
    onComplete({ selectedVolumes, profile });
  };

  const pctUsed = (v: StorageVolume) =>
    v.total_bytes > 0 ? Math.min(100, Math.round((v.used_bytes / v.total_bytes) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border/60 bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          aria-label={t('onboarding.closeAria')}
        >
          <X size={16} />
        </button>

        {step === 'welcome' ? (
          <>
            <DecoLogo size="sm" className="mb-4" />
            <h2 id="onboarding-title" className="text-xl font-bold tracking-tight">
              {t('onboarding.welcome')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {t('onboarding.subtitle')}
            </p>
            <ul className="mt-5 space-y-3">
              {WELCOME_STEPS.map(({ icon: Icon, id }) => (
                <li
                  key={id}
                  className="flex gap-3 rounded-lg border border-border/40 bg-muted/15 p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t(`onboarding.steps.${id}.title`)}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t(`onboarding.steps.${id}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                {t('onboarding.skip')}
              </Button>
              <Button size="sm" className="gap-2 font-semibold" onClick={() => setStep('projects')}>
                <Sparkles size={14} /> {t('onboarding.continue')}
              </Button>
            </div>
          </>
        ) : null}

        {step === 'projects' ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-5 w-5 text-primary" aria-hidden />
              <h2 id="onboarding-title" className="text-lg font-bold tracking-tight">
                {t('onboarding.projects.title')}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('onboarding.projects.subtitle')}
            </p>
            {loadingVolumes && volumes.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground text-center py-6">
                {t('dashboard.partition.detecting')}
              </p>
            ) : (
              <div className="mt-4 grid gap-2 max-h-48 overflow-y-auto">
                {volumes.map((vol) => {
                  const checked = selectedVolumes.includes(vol.mount_point);
                  return (
                    <div
                      key={vol.mount_point}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleVolume(vol.mount_point, !checked)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleVolume(vol.mount_point, !checked);
                        }
                      }}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer text-left ${
                        checked
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/50 bg-background/30 hover:bg-muted/20'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleVolume(vol.mount_point, v === true)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{vol.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{vol.mount_point}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatBytes(vol.available_bytes)} free · {pctUsed(vol)}% used
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                {t('onboarding.skip')}
              </Button>
              <div className="flex gap-2 justify-end">
                {initialStep === 'welcome' ? (
                  <Button variant="outline" size="sm" onClick={() => setStep('welcome')}>
                    {t('onboarding.back')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  disabled={selectedVolumes.length === 0}
                  onClick={() => setStep('profile')}
                >
                  {t('onboarding.continue')}
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {step === 'profile' ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <UserCircle2 className="h-5 w-5 text-primary" aria-hidden />
              <h2 id="onboarding-title" className="text-lg font-bold tracking-tight">
                {t('onboarding.profile.title')}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('onboarding.profile.subtitle')}
            </p>
            <div className="mt-4 space-y-2">
              {CLEANUP_PROFILE_PRESETS.map((preset) => {
                const selected = profile === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setProfile(preset.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      selected
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/50 hover:bg-muted/20'
                    }`}
                  >
                    <p className="text-sm font-semibold">{cleanupProfileLabel(t, preset.id)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {cleanupProfileDescription(t, preset.id)}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                {t('onboarding.skip')}
              </Button>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setStep('projects')}>
                  {t('onboarding.back')}
                </Button>
                <Button size="sm" className="gap-2 font-semibold" onClick={finish}>
                  <Sparkles size={14} /> {t('onboarding.getStarted')}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
