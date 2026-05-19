import { ShieldAlert, Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecoLogo } from '@/components/DecoLogo';
import { useI18n } from '@/i18n';

type Props = {
  open: boolean;
  onGetStarted: () => void;
  onDismiss: () => void;
};

const STEPS = [
  { icon: Search, id: 'scan' as const },
  { icon: ShieldAlert, id: 'review' as const },
  { icon: Sparkles, id: 'quarantine' as const },
];

export function OnboardingDialog({ open, onGetStarted, onDismiss }: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          aria-label={t('onboarding.closeAria')}
        >
          <X size={16} />
        </button>
        <DecoLogo size="sm" className="mb-4" />
        <h2 id="onboarding-title" className="text-xl font-bold tracking-tight">
          {t('onboarding.welcome')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {t('onboarding.subtitle')}
        </p>
        <ul className="mt-5 space-y-3">
          {STEPS.map(({ icon: Icon, id }) => (
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
          <Button size="sm" className="gap-2 font-semibold" onClick={onGetStarted}>
            <Sparkles size={14} /> {t('onboarding.getStarted')}
          </Button>
        </div>
      </div>
    </div>
  );
}
