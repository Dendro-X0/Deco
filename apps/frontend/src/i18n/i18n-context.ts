import { createContext } from 'react';
import type { UiLocaleId } from './catalog';

export type I18nContextValue = {
  locale: UiLocaleId;
  setLocale: (locale: UiLocaleId) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);
