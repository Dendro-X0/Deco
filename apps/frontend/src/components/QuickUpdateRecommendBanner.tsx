import { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { dismissQuickUpdateHint } from '@/lib/quick-update-hint';

type Props = {
  onQuickUpdate: () => void;
  disabled?: boolean;
};

export function QuickUpdateRecommendBanner({ onQuickUpdate, disabled }: Props) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="py-4 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Zap className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold">{t('dashboard.quickUpdateBanner.title')}</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              {t('dashboard.quickUpdateBanner.description')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="font-semibold gap-1.5"
            disabled={disabled}
            onClick={onQuickUpdate}
          >
            <Zap className="h-3.5 w-3.5" />
            {t('dashboard.quickUpdateBanner.action')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              dismissQuickUpdateHint();
              setHidden(true);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            {t('dashboard.quickUpdateBanner.dismiss')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
