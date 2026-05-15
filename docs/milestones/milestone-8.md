# Milestone 8 — UX depth (desktop-first) + polish

## Goal

A non-technical user can free disk space in a few guided steps: scan → review safe targets → preview → quarantine, with strong copy when review-tier items are involved. Quarantine management supports filter, bulk restore, purge, and audit export.

## What shipped

### Guided cleanup wizard

- Header **Free up space** opens a step-by-step overlay: welcome → scan progress → results summary → continue to preview.
- Dashboard empty state prompts **Start guided cleanup** when no scan has run yet.
- Safe-tier candidates are pre-selected after each scan (unchanged engine behavior).

### Preview before execute

- **Clean selected…** opens a preview modal backed by `preview_execute` (Rust).
- Shows safe / review / total bytes and counts; blocks execute if blocked items are in the selection.
- Review-tier rows require opting in and typing **`DELETE REVIEW`** (matches product safety model).

### Free-space planner (wired)

- Sidebar **Free Space Planner**: target GB, **Plan safe** / **Incl. review** call `plan_free_space`.
- Applies returned `selected_ids` to the dashboard selection; **Preview cleanup** opens the same modal.

### Quarantine center

- Search filter (path / id) via `list_quarantine_filtered`.
- **Purge-eligible only** toggle (retention-based).
- Select all + **Restore selected** via `restore_quarantine_bulk`.
- **Export log** downloads JSON audit of visible entries (client-side).
- **Purge eligible** uses `purge_quarantine`.

### Hook / types

- `use-deco`: `previewCleanup`, `executeCleanup`, `planFreeSpace`, `bulkRestoreQuarantine`, `purgeQuarantine`, filterable `refreshQuarantine`.
- Components: `CleanupWizard`, `CleanupPreviewModal`, `QuarantinePanel`, `lib/format.ts`.

## Manual QA checklist (Windows installer)

- [ ] Fresh install: open app → empty dashboard shows guided CTA → wizard completes scan.
- [ ] After scan: safe items pre-selected; preview shows correct totals.
- [ ] Cleanup with safe-only selection: no phrase required; items appear in Quarantine.
- [ ] Select a review-tier row: preview requires checkbox + `DELETE REVIEW`.
- [ ] Quarantine: search filters list; bulk restore works; export JSON downloads.
- [ ] Planner: Plan safe selects enough rows; preview + cleanup succeeds.
- [ ] History **Reuse Config** still triggers scan.

## Acceptance checklist

- [x] Guided flow from “need space” to preview to quarantine execute
- [x] Review-tier typed confirmation (`DELETE REVIEW`)
- [x] Quarantine filter, bulk restore, purge, audit export
- [x] Planner wired to `plan_free_space` with safe-first default
- [x] Manual QA checklist documented (run on release candidate)
