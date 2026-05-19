import { DEFAULT_UI_LOCALE, isUiLocaleId, type UiLocaleId } from '@/i18n/catalog';

const STORAGE_KEY = 'deco_ui_locale_v1';

export function detectSystemUiLocale(): UiLocaleId {
  if (typeof navigator === 'undefined') return DEFAULT_UI_LOCALE;
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh') || lang === 'cn') return 'cn';
  if (lang.startsWith('es')) return 'es';
  return DEFAULT_UI_LOCALE;
}

export function readStoredUiLocale(): UiLocaleId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isUiLocaleId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function readUiLocale(): UiLocaleId {
  return readStoredUiLocale() ?? detectSystemUiLocale();
}

export function writeUiLocale(locale: UiLocaleId): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

/** BCP 47 tag for `Intl` formatters from UI locale id. */
export function localeToIntlTag(locale: UiLocaleId): string {
  switch (locale) {
    case 'cn':
      return 'zh-CN';
    case 'es':
      return 'es';
    default:
      return 'en';
  }
}
