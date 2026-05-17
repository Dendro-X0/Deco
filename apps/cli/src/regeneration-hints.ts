import type { TargetDirKind } from './types.js';

const HINTS: Partial<Record<TargetDirKind, string>> = {
  'go-global-cache': '`go clean -cache` / rebuild with `go build`',
  'jvm-global-cache': 'Re-download via Gradle/Maven on next build',
  'ide-global-cache': 'Xcode rebuilds DerivedData on next compile',
  'npm-global-cache': '`npm cache clean --force`',
  'pnpm-global-store': '`pnpm store prune`; packages re-fetch on install',
  'yarn-global-cache': '`yarn cache clean`; reinstall dependencies',
  'pip-global-cache': '`pip cache purge`',
  'uv-global-cache': '`uv cache clean`',
  'conda-pkgs-cache': '`conda clean --all -p` (package cache only; does not remove envs)',
  'cargo-registry-cache': '`cargo cache -a`; crates re-download on next build',
  'bun-global-cache': '`bun pm cache rm`; packages re-fetch on install',
  'nuget-global-cache': 'Restore with `dotnet restore` / `nuget restore`',
};

export function regenerationHintForKind(kind: TargetDirKind): string | undefined {
  return HINTS[kind];
}

export function displayWithRegenerationHint(
  kind: TargetDirKind,
  reasonCodes: readonly string[],
): string {
  const base =
    reasonCodes.length === 0
      ? 'Unspecified'
      : reasonCodes.map((c) => c.toLowerCase().replace(/_/g, ' ')).join(', ');
  const hint = regenerationHintForKind(kind);
  return hint ? `${base}. Regenerate: ${hint}` : base;
}
