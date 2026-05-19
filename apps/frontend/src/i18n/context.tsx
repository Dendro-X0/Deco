import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { readUiLocale, writeUiLocale } from '@/lib/ui-locale';
import { translate, type UiLocaleId } from './catalog';
import { I18nContext } from './i18n-context';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocaleId>(() => readUiLocale());

  const setLocale = useCallback((next: UiLocaleId) => {
    writeUiLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
