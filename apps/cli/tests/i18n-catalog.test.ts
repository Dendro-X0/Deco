import { describe, expect, it } from 'vitest';
import {
  interpolate,
  messagesForLocale,
  translate,
  UI_LOCALES,
} from '../../frontend/src/i18n/catalog';

describe('i18n catalog', () => {
  it('exports en and es locales', () => {
    expect(UI_LOCALES).toEqual(['en', 'es']);
    expect(messagesForLocale('en').nav).toBeDefined();
    expect(messagesForLocale('es').nav).toBeDefined();
  });

  it('translate returns Spanish nav labels', () => {
    expect(translate('es', 'nav.dashboard')).toBe('Panel');
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard');
  });

  it('falls back to English for missing keys', () => {
    expect(translate('es', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('interpolate replaces variables', () => {
    expect(interpolate('Hello {{name}}', { name: 'Deco' })).toBe('Hello Deco');
  });
});
