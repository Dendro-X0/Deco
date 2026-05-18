# Deco policy gallery

Copy one of these packs into your repo (or monorepo root) as `.deco/`:

```text
your-repo/
  .deco/
    disk-cleanup.json   ← from an example below
```

Deco merges `.deco/disk-cleanup.json` from each scan root and from the current working directory. Desktop and CLI both honor `excludeAbsPathContains`, `safety.*`, and `additionalDirNames`.

## Gallery

| Pack | Use when |
|------|----------|
| [monorepo-maintainer](monorepo-maintainer/.deco/disk-cleanup.json) | Large JS monorepo: balanced profile, extra excludes for vendored trees |
| [conservative-no-globals](conservative-no-globals/.deco/disk-cleanup.json) | Safe profile only; protect CI caches and local SDK paths |
| [ci-quick-scan](ci-quick-scan/.deco/disk-cleanup.json) | CI agent: shallow depth, narrow excludes |
| [python-data-science](python-data-science/.deco/disk-cleanup.json) | Python/conda notebooks: exclude venvs, protect env roots |
| [dotnet-solution](dotnet-solution/.deco/disk-cleanup.json) | .NET solution: exclude `.vs` / `packages`, MSVC output names |

Global package-manager caches (`check_npm_cache`, `check_composer_cache`, etc.) are **desktop/CLI flags**, not repo config keys — enable them in Settings → Discovery when you intend to review those paths.

## Validate before you copy

```bash
deco validate-policy examples/deco-policies/monorepo-maintainer
deco validate-policy examples/deco-policies/python-data-science
```

## Desktop

**Settings → Policy pack** lists this gallery, shows read-only JSON, replace preview when a target already has `.deco/disk-cleanup.json`, and **Reveal in Explorer** after apply.

See [config schema](../../apps/cli/config.schema.json) and [milestone 3](../../docs/milestones/milestone-3.md).
