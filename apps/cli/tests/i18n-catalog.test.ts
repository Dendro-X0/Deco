import { describe, expect, it } from 'vitest';
import {
  interpolate,
  messagesForLocale,
  translate,
  UI_LOCALES,
} from '../../frontend/src/i18n/catalog';
import { collectMessageKeys, missingMessageKeys } from '../../frontend/src/i18n/catalog-parity';
import en from '../../frontend/src/i18n/messages/en.json';
import cn from '../../frontend/src/i18n/messages/cn.json';
import es from '../../frontend/src/i18n/messages/es.json';

describe('i18n catalog', () => {
  it('exports en, cn, and es locales', () => {
    expect(UI_LOCALES).toEqual(['en', 'cn', 'es']);
    expect(messagesForLocale('en').nav).toBeDefined();
    expect(messagesForLocale('cn').nav).toBeDefined();
    expect(messagesForLocale('es').nav).toBeDefined();
  });

  it('cn and es share the same keys as en', () => {
    expect(missingMessageKeys(en, cn)).toEqual([]);
    expect(missingMessageKeys(en, es)).toEqual([]);
    expect(collectMessageKeys(en).length).toBeGreaterThan(100);
  });

  it('translate returns localized nav labels', () => {
    expect(translate('es', 'nav.dashboard')).toBe('Panel');
    expect(translate('cn', 'nav.dashboard')).toBe('仪表盘');
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard');
  });

  it('falls back to English for missing keys', () => {
    expect(translate('es', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('interpolate replaces variables', () => {
    expect(interpolate('Hello {{name}}', { name: 'Deco' })).toBe('Hello Deco');
  });
});
