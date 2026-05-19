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

After structural key changes, merge new keys into all locales (see `scripts/merge-locale-v0.8.3*.mjs` or edit JSON by hand), then:

```bash
pnpm check
```

The CLI parity test ensures `cn` and `es` share the same keys as `en`.

## Usage in components

```tsx
import { useI18n } from '@/i18n';

function MyPanel() {
  const { t, locale, setLocale } = useI18n();
  return <p>{t('nav.dashboard')}</p>;
}
```

For non-React helpers (e.g. confirm copy, toast summaries), pass `t` from `useI18n()` or use `translate(locale, key)` from `catalog.ts`.

## Coverage (v0.8.3)

- **Shell** — nav, tab headers, status label, footer phase timings
- **Dashboard** — scan targets, partition/custom roots, stats, candidates, planner, cleanup results, workspace rollups, size filter
- **History / Quarantine** — full panels, filters, dialogs
- **Modals** — scan targets, onboarding, guided cleanup wizard
- **Settings** — global config, discovery, safety, updates, policy packs, language
- **Runtime** — core scan/cleanup status strings and toasts (`use-deco`, `cleanup-result`, `direct-delete`)

Still English in some places: clipboard diagnostic exports, backend error text, policy-pack example labels from the repo, size preset chip labels (`≥100 MB`), and scan event messages from the Rust engine when provided in `payload.message`.

## Language preference

Stored in `localStorage` (`deco_ui_locale_v1`) via `apps/frontend/src/lib/ui-locale.ts`.  
**Settings → Language** updates the preference. On first launch, the app picks **Chinese** when the OS language is `zh*`, **Spanish** for `es*`, otherwise **English**.

Dates in History and Quarantine use `localeToIntlTag()` → `Intl.DateTimeFormat`.

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

Switch **Settings → Language** to 中文 or Español and walk **Dashboard**, **Historial/Cuarentena**, scan-targets modal, guided wizard, and the status footer.
