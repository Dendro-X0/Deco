# Experiment: Windows NTFS USN journal inventory (v0.8.5)

**Manifest:** [v0.8.5-manifest.md](../product/v0.8.5-manifest.md)

## Goal

Use the NTFS **Update Sequence Number (USN) change journal** as a future signal for **incremental discovery** (skip unchanged subtrees, narrow rescans). v0.8.5 ships the **setting + journal probe** only; **candidate discovery remains the legacy directory walk** on every platform.

## Current behavior (v0.8.5)

| Platform | Setting: *NTFS USN journal probe* |
|----------|-----------------------------------|
| **Windows** | When enabled, each scan prepends **warnings** per drive-letter volume involved in the scan roots: NTFS + `FSCTL_QUERY_USN_JOURNAL` success, non-NTFS skip, or I/O failure. |
| **macOS / Linux** | Single informational warning that the option does not apply. |

No delete, quarantine, or classification paths use USN data.

## Safety

- Probe uses **read-only** volume queries (`GetVolumeInformationW`, `CreateFile` + `DeviceIoControl` with `FSCTL_QUERY_USN_JOURNAL`).
- Failure to open `\\.\X:` or query the journal **does not fail the scan**; a warning is recorded and the walk proceeds.

## Next steps (future versions)

1. Persist **(journal_id, next_usn)** checkpoints per volume + config fingerprint.
2. On quick/full scan, read `FSCTL_READ_USN_JOURNAL` and map changed parent FRNs to paths (may require MFT or handle enumeration).
3. Intersect changed paths with Deco’s **whitelist discovery** so we never expand the delete surface.

## Benchmark note

Until USN narrows the walk, **phase timings are unchanged** vs v0.8.4. Record any future win in [scan-performance.md](scan-performance.md) with the same protocol as other scan experiments.
