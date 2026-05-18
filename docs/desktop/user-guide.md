# Desktop user guide

## Main areas

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Scan results, selection, candidate detail, free-space planner |
| **Quarantine** | Restore, bulk restore, purge, audit export |
| **History** | Past scans; **Reuse Config** reruns with same roots/profile |
| **Settings** | Roots, profile, sizing, ecosystem opt-ins |

## Recommended flow: Free up space

1. **Free up space** (header) — guided wizard: welcome → scan → results.
2. Safe-tier items are pre-selected; adjust checkboxes if needed.
3. **Continue to preview** or **Clean selected…** on the dashboard.
4. **Preview cleanup** modal — confirm safe/review breakdown.
5. For review-tier rows: enable **Include review-tier** and type `DELETE REVIEW`.
6. **Quarantine selected** — files move to quarantine (not permanent delete).

## Free-space planner

1. Run a scan first.
2. Set **Target to free (GB)** in the sidebar card.
3. **Plan safe** — fills selection from largest safe candidates until target.
4. **Incl. review** — may add review-tier rows if needed to reach the goal.
5. **Preview cleanup** — same gate as manual cleanup.

## Quarantine center

- **Search** — filter by path or id.
- **Purge-eligible only** — items past retention (see Settings).
- **Restore selected** — bulk restore via native API.
- **Export log** — JSON audit of visible entries.
- **Purge eligible** — permanently remove old quarantine payloads.

## Settings worth knowing

| Setting | Effect |
|---------|--------|
| Calculate sizes | Off = faster scan (list only) |
| Check global Go / JVM / IDE caches | Adds review-tier global targets |
| Include Python venv | High-risk; review tier |
| Advanced Mode | Required for hard-delete (if exposed in your build) |

### Policy pack (Settings)

1. Open **Settings** → **Policy pack**.
2. Choose a built-in example (monorepo maintainer, conservative, CI quick scan) or **Browse policy folder…**.
3. **Choose project folder…** — where `.deco/disk-cleanup.json` should be written.
4. Review the validation preview (replaces an existing file if present).
5. **Apply policy pack** — Deco copies the validated JSON; global cache toggles remain in **Discovery** (not in repo config).

Validate from CLI before sharing: `deco validate-policy examples/deco-policies/monorepo-maintainer`.

## Manual QA before a release

Use the checklist in [Milestone 8 — UX](../milestones/milestone-8.md#manual-qa-checklist-windows-installer).
