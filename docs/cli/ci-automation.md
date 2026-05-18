# CLI automation (CI)

Use the Deco CLI in **dry-run** mode to audit developer workspaces in CI without deleting anything. Output is the versioned [scan contract](../contract/scan-contract.md) JSON (`schema_version` **2.8.0**).

## Minimal scan job

```bash
pnpm build:cli
node apps/cli/dist/cli.js \
  --dry-run \
  --root "$CI_WORKSPACE" \
  --max-depth 6 \
  --no-size \
  --json > scan-report.json
```

- **`--dry-run`** — default for non-interactive runs; no `--delete`.
- **`--json`** — machine-readable report; validate against [`docs/schemas/scan-report.schema.json`](../schemas/scan-report.schema.json).
- **`--no-size`** — skip sizing (faster CI); totals use `0` bytes unless you omit this flag.

## Exit codes

| Code | When |
|------|------|
| **0** | Scan completed; validate-policy OK; delete finished with no errors |
| **1** | Parse/usage error; validate-policy failure; delete had errors; missing `validate-policy` path |

Dry-run scans that complete normally exit **0** even when candidates are found. Gate on JSON fields (below), not on “found junk”.

## Reclaim threshold gate (example)

Fail the job when **safe-tier reclaim** exceeds a budget (e.g. 500 MiB):

```bash
node scripts/ci-scan-gate.mjs scan-report.json --max-safe-mb 500
```

The script reads `totals_by_risk.safe.bytes` from the wire report. Adjust the limit per runner or repo.

### GitHub Actions snippet

```yaml
- name: Install and scan
  run: |
    pnpm install --frozen-lockfile
    pnpm build:cli
    node apps/cli/dist/cli.js --dry-run --root "${{ github.workspace }}" --max-depth 6 --no-size --json > scan-report.json

- name: Reclaim gate
  run: node scripts/ci-scan-gate.mjs scan-report.json --max-safe-mb 500
```

## Policy packs in CI

Validate team `.deco` presets before merge:

```bash
deco validate-policy examples/deco-policies/monorepo-maintainer
```

See [Configuration](configuration.md) and [examples/deco-policies](../../examples/deco-policies/).

## Classification parity

CLI and Rust engines share fixture-driven tests at [`tests/fixtures/classification/cases.json`](../../tests/fixtures/classification/cases.json). Coverage includes Node/npm globals, Rust/Python/Go/JVM/.NET project artifacts, path-policy blocked Electron runtimes, and opt-in global caches (`v0.7.4`–`v0.7.5`). When changing classification rules, update the manifest and run:

```bash
pnpm -F @dendro-x0/deco-cli test classification-parity
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml classification_parity
```

## Related docs

- [CLI usage](usage.md)  
- [Scan contract](../contract/scan-contract.md)  
- [GitHub Releases](../distribution/github-releases.md)  
