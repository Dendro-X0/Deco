import en from './messages/en.json';
import es from './messages/es.json';

export const UI_LOCALES = ['en', 'es'] as const;
export type UiLocaleId = (typeof UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocaleId = 'en';

type MessageTree = { [key: string]: string | MessageTree };

const catalogs: Record<UiLocaleId, MessageTree> = { en, es };

export function isUiLocaleId(value: string): value is UiLocaleId {
  return (UI_LOCALES as readonly string[]).includes(value);
}

export function messagesForLocale(locale: UiLocaleId): MessageTree {
  return catalogs[locale] ?? catalogs[DEFAULT_UI_LOCALE];
}

/** Resolve dot-separated key; missing keys fall back to English then the key. */
export function translate(
  locale: UiLocaleId,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const primary = lookup(catalogs[locale], key);
  const fallback =
    locale === DEFAULT_UI_LOCALE ? undefined : lookup(catalogs[DEFAULT_UI_LOCALE], key);
  const template = primary ?? fallback ?? key;
  return interpolate(template, vars);
}

function lookup(tree: MessageTree | undefined, key: string): string | undefined {
  if (!tree) return undefined;
  let node: string | MessageTree = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined ? '' : String(v);
  });
}
