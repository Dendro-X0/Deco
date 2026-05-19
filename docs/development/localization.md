# Localization (i18n)

Desktop UI strings live under `apps/frontend/src/i18n/`.

## Layout

| Path | Purpose |
|------|---------|
| `messages/en.json` | English baseline (required) |
| `messages/es.json` | Spanish (`v0.8.2` second locale) |
| `catalog.ts` | Lookup, fallback to English, `{{var}}` interpolation |
| `context.tsx` | `I18nProvider` |
| `use-i18n.ts` | `useI18n()` hook |

## Usage in components

```tsx
import { useI18n } from '@/i18n';

function MyPanel() {
  const { t, locale, setLocale } = useI18n();
  return <p>{t('nav.dashboard')}</p>;
}
```

## Language preference

Stored in `localStorage` (`deco_ui_locale_v1`) via `apps/frontend/src/lib/ui-locale.ts`.  
**Settings → Language** updates the preference. On first launch, the app uses the OS language when it is Spanish; otherwise English.

## Adding a locale

1. Copy `messages/en.json` to `messages/<code>.json` and translate values.
2. Add the code to `UI_LOCALES` in `catalog.ts` and import the JSON.
3. Add a label under `settings.language.<code>` in every locale file.
4. Run `pnpm check`.

## Verification

```bash
pnpm check
pnpm dev:desktop
```

Switch **Settings → Language** to Español and confirm sidebar labels update.
