# Localization (i18n)

Desktop UI strings live under `apps/frontend/src/i18n/messages/`.

## Layout

| Path | Purpose |
|------|---------|
| `messages/en.json` | English baseline and **community template** (required) |
| `messages/cn.json` | Simplified Chinese |
| `messages/es.json` | Spanish |
| `messages/README.md` | How to add a locale |
| `catalog.ts` | Lookup, fallback to English, `{{var}}` interpolation |
| `context.tsx` | `I18nProvider` |
| `use-i18n.ts` | `useI18n()` hook |
| `preset-labels.ts` | Helpers for cleanup profile / scan strategy presets |

Regenerate all locale files from the generator after structural changes:

```bash
node scripts/generate-locale-messages.mjs
```

## Usage in components

```tsx
import { useI18n } from '@/i18n';

function MyPanel() {
  const { t, locale, setLocale } = useI18n();
  return <p>{t('nav.dashboard')}</p>;
}
```

## Coverage (v0.8.2)

- **Dashboard** — header actions, scan targets, stats, candidate list/detail, planner, last scan card
- **Settings** — global config, scan behavior, discovery, safety, updates, policy packs, language

Other tabs and nested panels still use English when the shell is localized — tracked in [localization-backlog.md](../development/localization-backlog.md) for **v0.8.3**.

## Language preference

Stored in `localStorage` (`deco_ui_locale_v1`) via `apps/frontend/src/lib/ui-locale.ts`.  
**Settings → Language** updates the preference. On first launch, the app picks **Chinese** when the OS language is `zh*`, **Spanish** for `es*`, otherwise **English**.

## Adding a locale

1. Copy `messages/en.json` to `messages/<code>.json` and translate values.
2. Add the code to `UI_LOCALES` in `catalog.ts` and import the JSON.
3. Add a label under `settings.language.<code>` in every locale file.
4. Run `pnpm check` (parity test ensures all shipped locales share the same keys as `en`).

## Verification

```bash
pnpm check
pnpm dev:desktop
```

Switch **Settings → Language** to 中文 or Español and confirm Dashboard + Settings labels update.
