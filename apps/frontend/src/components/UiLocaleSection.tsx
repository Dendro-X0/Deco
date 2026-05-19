import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UI_LOCALES, type UiLocaleId } from '@/i18n/catalog';
import { useI18n } from '@/i18n';

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold tracking-tight">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
    </div>
  );
}

export function UiLocaleSection() {
  const { locale, setLocale, t } = useI18n();

  return (
    <section className="space-y-4">
      <SectionHeader
        title={t('settings.language.title')}
        description={t('settings.language.description')}
      />
      <div className="max-w-sm space-y-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="ui-locale">
          {t('settings.language.field')}
        </label>
        <Select value={locale} onValueChange={(v) => setLocale(v as UiLocaleId)}>
          <SelectTrigger id="ui-locale" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UI_LOCALES.map((id) => (
              <SelectItem key={id} value={id}>
                {t('settings.language.' + id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
