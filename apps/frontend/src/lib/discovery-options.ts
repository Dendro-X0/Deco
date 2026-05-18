import type { Settings } from '@/types';

/** Settings boolean keys shown in Discovery (excludes Safety / scan roots). */
export type DiscoveryOptionKey = Extract<
  keyof Settings,
  | 'include_size'
  | 'check_go_cache'
  | 'check_jvm_global_cache'
  | 'check_ide_global_cache'
  | 'check_npm_cache'
  | 'check_pnpm_store'
  | 'check_yarn_cache'
  | 'check_pip_cache'
  | 'check_uv_cache'
  | 'check_conda_pkgs_cache'
  | 'check_bun_cache'
  | 'check_cargo_registry'
  | 'check_nuget_cache'
  | 'check_composer_cache'
  | 'check_vcpkg_cache'
  | 'check_conan_cache'
  | 'check_ccache'
  | 'check_sccache'
  | 'include_python_venv'
  | 'smart_discovery_enabled'
>;

export type DiscoveryCategoryId =
  | 'general'
  | 'package_managers'
  | 'language_runtimes'
  | 'ide_tooling';

export type DiscoveryRow =
  | {
      type: 'option';
      key: DiscoveryOptionKey;
      label: string;
      description: string;
    }
  | {
      type: 'placeholder';
      id: string;
      label: string;
      description: string;
    };

export type DiscoveryCategoryDef = {
  id: DiscoveryCategoryId;
  label: string;
  description: string;
  rows: DiscoveryRow[];
};

export const DISCOVERY_CATEGORIES: DiscoveryCategoryDef[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Scan performance and high-risk project targets.',
    rows: [
      {
        type: 'option',
        key: 'include_size',
        label: 'Calculate sizes',
        description: 'Turn off for a faster scan (CLI: --no-size).',
      },
      {
        type: 'option',
        key: 'include_python_venv',
        label: 'Include Python venv',
        description: 'venv / .venv when a Python project is detected (high risk).',
      },
    ],
  },
  {
    id: 'package_managers',
    label: 'Package managers',
    description: 'Global caches for Node, Python, Conda, bun, NuGet, and Composer (review tier).',
    rows: [
      {
        type: 'option',
        key: 'check_npm_cache',
        label: 'npm cache',
        description: 'npm cache directory with _cacache (regenerate: npm cache clean).',
      },
      {
        type: 'option',
        key: 'check_pnpm_store',
        label: 'pnpm store',
        description:
          'Global store and project `.pnpm-store` folders (v3 marker); respects PNPM_STORE_PATH / pnpm store path.',
      },
      {
        type: 'option',
        key: 'check_yarn_cache',
        label: 'Yarn cache',
        description: 'Yarn Classic (v6) or Berry global cache; uses yarn cache dir when available.',
      },
      {
        type: 'option',
        key: 'check_pip_cache',
        label: 'pip cache',
        description: 'pip download cache (wheels/http); regen with pip cache purge.',
      },
      {
        type: 'option',
        key: 'check_uv_cache',
        label: 'uv cache',
        description: 'uv package cache; respects UV_CACHE_DIR / uv cache dir.',
      },
      {
        type: 'option',
        key: 'check_conda_pkgs_cache',
        label: 'Conda pkgs cache',
        description: 'Conda/Miniconda package cache (pkgs only; never envs/). Regenerate: conda clean.',
      },
      {
        type: 'option',
        key: 'check_bun_cache',
        label: 'bun cache',
        description: 'Global bun install cache; respects BUN_INSTALL_CACHE_DIR.',
      },
      {
        type: 'option',
        key: 'check_nuget_cache',
        label: 'NuGet global packages',
        description: 'NuGet package store (NUGET_PACKAGES or ~/.nuget/packages).',
      },
      {
        type: 'option',
        key: 'check_composer_cache',
        label: 'Composer cache',
        description: 'PHP Composer cache (COMPOSER_CACHE_DIR or ~/.composer/cache).',
      },
    ],
  },
  {
    id: 'language_runtimes',
    label: 'Language runtimes',
    description: 'Compiler and runtime caches outside individual projects.',
    rows: [
      {
        type: 'option',
        key: 'check_go_cache',
        label: 'Global Go cache',
        description: 'Opt-in scan for GOCACHE and GOMODCACHE via go env.',
      },
      {
        type: 'option',
        key: 'check_cargo_registry',
        label: 'Cargo registry cache',
        description: 'CARGO_HOME/registry with downloaded crates (regenerate: cargo cache -a).',
      },
      {
        type: 'option',
        key: 'check_vcpkg_cache',
        label: 'vcpkg installed tree',
        description: 'VCPKG_ROOT/installed ports (review; reinstall with vcpkg install).',
      },
      {
        type: 'option',
        key: 'check_conan_cache',
        label: 'Conan package cache',
        description: 'Conan 2 global package cache (.conan2/p; review tier).',
      },
      {
        type: 'option',
        key: 'check_ccache',
        label: 'ccache',
        description: 'Compiler object cache (CCACHE_DIR or ~/.cache/ccache; review tier).',
      },
      {
        type: 'option',
        key: 'check_sccache',
        label: 'sccache',
        description: 'Shared compiler cache (SCCACHE_DIR; review tier).',
      },
      {
        type: 'option',
        key: 'check_jvm_global_cache',
        label: 'Global JVM caches',
        description: '~/.m2/repository and ~/.gradle/caches (review tier).',
      },
    ],
  },
  {
    id: 'ide_tooling',
    label: 'IDE & tooling',
    description: 'Editor and SDK global caches.',
    rows: [
      {
        type: 'option',
        key: 'check_ide_global_cache',
        label: 'IDE global caches',
        description: 'Xcode DerivedData plus JetBrains/Android Studio caches when smart discovery is on.',
      },
      {
        type: 'option',
        key: 'smart_discovery_enabled',
        label: 'Smart discovery',
        description:
          'Match declarative path patterns (e.g. Android Studio caches) to registered kinds. Requires the matching opt-in flags.',
      },
    ],
  },
];

export type DiscoveryRowId = DiscoveryOptionKey | `placeholder:${string}`;

export function discoveryRowId(row: DiscoveryRow): DiscoveryRowId {
  return row.type === 'option' ? row.key : `placeholder:${row.id}`;
}

export function selectableRowIds(categoryId: DiscoveryCategoryId): DiscoveryRowId[] {
  const category = DISCOVERY_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return [];
  return category.rows.filter((r) => r.type === 'option').map((r) => discoveryRowId(r));
}

export const DISCOVERY_OPTION_KEYS: DiscoveryOptionKey[] = [
  ...new Set(
    DISCOVERY_CATEGORIES.flatMap((c) =>
      c.rows.filter((r): r is Extract<DiscoveryRow, { type: 'option' }> => r.type === 'option').map((r) => r.key),
    ),
  ),
];

export function discoveryCategoryById(id: DiscoveryCategoryId): DiscoveryCategoryDef | undefined {
  return DISCOVERY_CATEGORIES.find((c) => c.id === id);
}

export function countEnabledInCategory(
  settings: Settings,
  categoryId: DiscoveryCategoryId,
): { enabled: number; total: number } {
  const category = discoveryCategoryById(categoryId);
  if (!category) return { enabled: 0, total: 0 };
  const options = category.rows.filter(
    (r): r is Extract<DiscoveryRow, { type: 'option' }> => r.type === 'option',
  );
  const enabled = options.filter((r) => settings[r.key]).length;
  return { enabled, total: options.length };
}

export function patchCategorySelection(
  categoryId: DiscoveryCategoryId,
  enabled: boolean,
): Partial<Settings> {
  const category = discoveryCategoryById(categoryId);
  if (!category) return {};
  const patch: Partial<Settings> = {};
  for (const row of category.rows) {
    if (row.type === 'option') patch[row.key] = enabled;
  }
  return patch;
}
