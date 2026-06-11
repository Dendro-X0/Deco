import { useState } from 'react';
import { ArrowRight, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cleanupProfileLabel } from '@/i18n/preset-labels';
import {
  shouldSuggestProfileAlignment,
  suggestedProfileForAlignment,
} from '@/lib/persona-onboarding';
import type { Settings } from '@/types';

const DISMISS_KEY = 'deco-profile-suggestion-scan-id';

type Props = {
  settings: Settings | null;
  scanId: string | null | undefined;
  scanning: boolean;
  disabled?: boolean;
  onOpenSettings: () => void;
};

export function ProfileSuggestionBanner({
  settings,
  scanId,
  scanning,
  disabled,
  onOpenSettings,
}: Props) {
  const { t } = useI18n();
  const [dismissedScanId, setDismissedScanId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  if (!settings || scanning || !scanId || dismissedScanId === scanId) return null;
  if (!shouldSuggestProfileAlignment(settings)) return null;

  const suggested = suggestedProfileForAlignment(settings);
  const storedId = settings.cleanup_profile ?? 'custom';

  return (
    <div className="rounded-lg border border-amber-500/35 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            {t('dashboard.profileSuggestion.title')}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('dashboard.profileSuggestion.description', {
              stored: cleanupProfileLabel(t, storedId as 'custom' | 'first_scan' | 'monorepo_maintainer' | 'ci_agent'),
              derived: suggested ? cleanupProfileLabel(t, suggested) : t('common.custom'),
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 w-8 p-0"
          disabled={disabled}
          aria-label={t('common.dismiss')}
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, scanId);
            } catch {
              // ignore
            }
            setDismissedScanId(scanId);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
        disabled={disabled}
        onClick={onOpenSettings}
      >
        <Settings2 className="h-3.5 w-3.5" aria-hidden />
        {t('dashboard.profileSuggestion.openSettings')}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
