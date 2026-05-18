import type { Settings } from '../types';
import { deriveScanStrategy, normalizeScanStrategyId } from './scan-strategy';

type RawSettings = Record<string, unknown>;

/** Read partition selection from either snake_case or camelCase settings payloads. */
export function readSelectedVolumes(source: unknown): string[] {
  if (!source || typeof source !== 'object') return [];
  const s = source as { selected_volumes?: unknown; selectedVolumes?: unknown };
  const v = s.selected_volumes ?? s.selectedVolumes;
  return Array.isArray(v) ? (v as string[]).filter(Boolean) : [];
}

/** Normalize settings from Tauri invoke (may use camelCase) into our Settings shape. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as RawSettings;
  const num = (key: string, camel: string, fallback: number) =>
    Number(r[key] ?? r[camel] ?? fallback);
  const bool = (key: string, camel: string, fallback: boolean) =>
    Boolean(r[key] ?? r[camel] ?? fallback);
  const str = (key: string, camel: string, fallback: string) =>
    String(r[key] ?? r[camel] ?? fallback);
  const strList = (key: string, camel: string) => {
    const v = r[key] ?? r[camel];
    return Array.isArray(v) ? (v as string[]) : [];
  };

  const roots = strList('roots', 'roots');
  const useCustomRaw = r.use_custom_scan_roots ?? r.useCustomScanRoots;
  const use_custom_scan_roots =
    typeof useCustomRaw === 'boolean' ? useCustomRaw : roots.length > 0;

  const max_depth = num('max_depth', 'maxDepth', 8);
  const scan_concurrency_mode = str('scan_concurrency_mode', 'scanConcurrencyMode', 'auto');
  const incremental_inventory_enabled = bool(
    'incremental_inventory_enabled',
    'incrementalInventoryEnabled',
    true,
  );
  const tuningSlice = {
    max_depth,
    scan_concurrency_mode,
    incremental_inventory_enabled,
  };
  const scan_strategy = deriveScanStrategy({
    ...tuningSlice,
    scan_strategy: normalizeScanStrategyId(
      r.scan_strategy ?? r.scanStrategy ?? 'balanced',
    ),
  } as Settings);

  return {
    roots,
    use_custom_scan_roots,
    scan_scope: str('scan_scope', 'scanScope', 'projects'),
    selected_volumes: readSelectedVolumes(r),
    include_project_folders: bool('include_project_folders', 'includeProjectFolders', true),
    max_depth,
    profile: str('profile', 'profile', 'safe'),
    stale_days: num('stale_days', 'staleDays', 45),
    include_size: bool('include_size', 'includeSize', true),
    scan_concurrency_mode,
    incremental_inventory_enabled,
    scan_strategy,
    smart_discovery_enabled: bool(
      'smart_discovery_enabled',
      'smartDiscoveryEnabled',
      false,
    ),
    classify_parallel_threshold: num(
      'classify_parallel_threshold',
      'classifyParallelThreshold',
      8,
    ),
    fast_dependency_size_estimate: bool(
      'fast_dependency_size_estimate',
      'fastDependencySizeEstimate',
      true,
    ),
    show_blocked: bool('show_blocked', 'showBlocked', false),
    check_go_cache: bool('check_go_cache', 'checkGoCache', false),
    include_python_artifacts: bool('include_python_artifacts', 'includePythonArtifacts', true),
    include_python_venv: bool('include_python_venv', 'includePythonVenv', false),
    include_jvm_artifacts: bool('include_jvm_artifacts', 'includeJvmArtifacts', true),
    check_jvm_global_cache: bool('check_jvm_global_cache', 'checkJvmGlobalCache', false),
    include_dotnet_artifacts: bool('include_dotnet_artifacts', 'includeDotnetArtifacts', true),
    check_ide_global_cache: bool('check_ide_global_cache', 'checkIdeGlobalCache', false),
    check_npm_cache: bool('check_npm_cache', 'checkNpmCache', false),
    check_pnpm_store: bool('check_pnpm_store', 'checkPnpmStore', false),
    check_yarn_cache: bool('check_yarn_cache', 'checkYarnCache', false),
    check_pip_cache: bool('check_pip_cache', 'checkPipCache', false),
    check_uv_cache: bool('check_uv_cache', 'checkUvCache', false),
    check_conda_pkgs_cache: bool('check_conda_pkgs_cache', 'checkCondaPkgsCache', false),
    check_bun_cache: bool('check_bun_cache', 'checkBunCache', false),
    check_cargo_registry: bool('check_cargo_registry', 'checkCargoRegistry', false),
    check_nuget_cache: bool('check_nuget_cache', 'checkNugetCache', false),
    check_composer_cache: bool('check_composer_cache', 'checkComposerCache', false),
    check_vcpkg_cache: bool('check_vcpkg_cache', 'checkVcpkgCache', false),
    check_conan_cache: bool('check_conan_cache', 'checkConanCache', false),
    check_ccache: bool('check_ccache', 'checkCcache', false),
    check_sccache: bool('check_sccache', 'checkSccache', false),
    fast_tree_delete_enabled: bool(
      'fast_tree_delete_enabled',
      'fastTreeDeleteEnabled',
      true,
    ),
    cleanup_disk_mode: str('cleanup_disk_mode', 'cleanupDiskMode', 'auto'),
    delete_mode: str('delete_mode', 'deleteMode', 'delete'),
    quarantine_layout: str('quarantine_layout', 'quarantineLayout', 'per_drive'),
    quarantine_custom_path: str('quarantine_custom_path', 'quarantineCustomPath', ''),
    quarantine_retention_days: num('quarantine_retention_days', 'quarantineRetentionDays', 30),
    advanced_mode: bool('advanced_mode', 'advancedMode', false),
    default_target_gb: num('default_target_gb', 'defaultTargetGb', 10),
    exclude_abs_path_contains: strList('exclude_abs_path_contains', 'excludeAbsPathContains'),
    extra_protected_path_contains: strList('extra_protected_path_contains', 'extraProtectedPathContains'),
    allow_path_contains: strList('allow_path_contains', 'allowPathContains'),
  };
}
