# Deco policy examples

Copy one of these folders into your repo (or monorepo root) as `.deco/`:

```text
your-repo/
  .deco/
    disk-cleanup.json   ← from an example below
```

Deco merges `.deco/disk-cleanup.json` from each scan root and from the current working directory. Desktop and CLI both honor `excludeAbsPathContains`, `safety.*`, and `additionalDirNames`.

| Example | Use when |
|---------|----------|
| [monorepo-maintainer](monorepo-maintainer/.deco/disk-cleanup.json) | Large JS monorepo: balanced profile, extra excludes for vendored trees |
| [conservative-no-globals](conservative-no-globals/.deco/disk-cleanup.json) | Safe profile only; protect CI caches and local SDK paths |
| [ci-quick-scan](ci-quick-scan/.deco/disk-cleanup.json) | CI agent: shallow depth, narrow excludes, no extra protected noise |

Global package-manager caches (`check_npm_cache`, `check_composer_cache`, etc.) are **desktop/CLI flags**, not repo config keys — enable them in Settings → Discovery or CLI flags when you intend to review those paths.

Validate before you copy:

```bash
deco validate-policy examples/deco-policies/monorepo-maintainer
```

See [config schema](../../apps/cli/config.schema.json) and [milestone 3](../../docs/milestones/milestone-3.md).
