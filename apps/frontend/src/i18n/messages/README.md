# Locale message templates

| File | Role |
|------|------|
| `en.json` | **Canonical template** — all keys must exist here first |
| `cn.json` | Simplified Chinese (`cn`) |
| `es.json` | Spanish (`es`) |

## Adding a new language

1. Copy `en.json` to `<code>.json` (e.g. `fr.json`).
2. Translate every string value; keep keys and `{{variable}}` placeholders unchanged.
3. Register the locale in `../catalog.ts` (`UI_LOCALES` + import).
4. Add `settings.language.<code>` in **every** locale file.
5. Run `pnpm check` (parity test ensures `cn`/`es`/`en` share the same keys).

Regenerate baseline files after editing the generator:

```bash
node scripts/generate-locale-messages.mjs
```

Prefer editing `scripts/generate-locale-messages.mjs` for bulk structural changes, then re-run and merge manual translation tweaks into `cn.json` / `es.json` if needed.

## Key layout

- `nav`, `status`, `common` — shell chrome
- `header.*` — tab subtitles
- `dashboard.*` — Dashboard tab (scan targets, candidates, planner, …)
- `settings.*` — Settings tab (scan behavior, discovery, safety, updates, …)
