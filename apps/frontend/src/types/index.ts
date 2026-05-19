export type RiskLevel = 'safe' | 'review' | 'blocked';

export interface Candidate {
  id: string;
  abs_path: string;
  kind: string;
  risk: RiskLevel;
  size_bytes?: number;
  display_reason_summary?: string;
  project_root?: string;
  stale_days?: number;
  mtime_ms?: number;
  reason_codes?: string[];
  can_delete?: boolean;
}

export interface ScanReport {
  schema_version?: string;
  scan_id: string;
  scanned_dirs?: number;
  candidates: Candidate[];
  total_bytes: number;
  totals_by_risk: {
    safe: { count: number; bytes: number };
    review: { count: number; bytes: number };
    blocked: { count: number; bytes: number };
  };
  totals_by_kind?: Record<string, { count: number; bytes: number }>;
  warnings?: string[];
  /** Quick-update rows reused from path inventory (v0.6.1). */
  inventory_reused?: number;
  /** Phase timings in ms (v0.6.4). */
  discover_ms?: number;
  classify_ms?: number;
  size_ms?: number;
}

export interface QuarantineEntry {
  id: string;
  original_path: string;
  quarantined_path?: string;
  timestamp_iso: string;
  size_bytes?: number;
  reason_summary?: string;
}

export interface QuarantineFilter {
  query?: string | null;
  from_iso?: string | null;
  to_iso?: string | null;
  only_purge_eligible?: boolean;
  retention_days?: number;
}

export interface HistoryItem {
  scan_id: string;
  created_at: string;
  roots: string[];
  profile: string;
  total_bytes: number;
  stale_days: number;
  candidate_count?: number;
  safe_count?: number;
  review_count?: number;
  scanned_dirs?: number;
}

export interface StorageVolume {
  mount_point: string;
  name: string;
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  volume_kind: string;
}

export interface Settings {
  roots: string[];
  /** When true, scan only `roots` instead of the full partition layout. */
  use_custom_scan_roots?: boolean;
  /** projects | drives | all — used when roots is empty */
  scan_scope?: string;
  selected_volumes?: string[];
  include_project_folders?: boolean;
  max_depth: number;
  profile: string;
  stale_days: number;
  include_size: boolean;
  /** `auto` | `low` | `high` — parallel sizing during scan (v0.6.0). */
  scan_concurrency_mode: string;
  /** When true, Quick update can reuse path inventory (v0.6.1). */
  incremental_inventory_enabled?: boolean;
  /** `thorough` | `balanced` | `fast` | `background` | `custom` (v0.6.3). */
  scan_strategy?: string;
  /** `first_scan` | `monorepo_maintainer` | `ci_agent` | `custom` (v0.7.0). */
  cleanup_profile?: string;
  /** Declarative IDE/tool path patterns (v0.6.5). */
  smart_discovery_enabled?: boolean;
  /** Rayon classify when chunk has at least this many targets (v0.6.5). */
  classify_parallel_threshold?: number;
  /** Sampled sizing for node_modules / target trees (v0.6.7). */
  fast_dependency_size_estimate?: boolean;
  show_blocked: boolean;
  check_go_cache: boolean;
  include_python_artifacts: boolean;
  include_python_venv: boolean;
  include_jvm_artifacts: boolean;
  check_jvm_global_cache: boolean;
  include_dotnet_artifacts: boolean;
  check_ide_global_cache: boolean;
  check_npm_cache: boolean;
  check_pnpm_store: boolean;
  check_yarn_cache: boolean;
  check_pip_cache: boolean;
  check_uv_cache: boolean;
  check_conda_pkgs_cache: boolean;
  check_bun_cache?: boolean;
  check_cargo_registry?: boolean;
  check_nuget_cache?: boolean;
  check_composer_cache?: boolean;
  check_vcpkg_cache?: boolean;
  check_conan_cache?: boolean;
  check_ccache?: boolean;
  check_sccache?: boolean;
  check_bazel_disk_cache?: boolean;
  /** Experimental: rmdir / rm -rf for node_modules when deleting in place (v0.6.5). */
  fast_tree_delete_enabled?: boolean;
  /** `auto` | `hdd` | `standard` — delete parallelism (v0.6.6). */
  cleanup_disk_mode?: string;
  delete_mode: string;
  /** per_drive | custom — only when delete_mode is quarantine */
  quarantine_layout?: string;
  quarantine_custom_path?: string;
  quarantine_retention_days: number;
  /** When true, fetch git last-commit age in candidate detail (v0.7.1). */
  check_git_dormancy?: boolean;
  advanced_mode: boolean;
  default_target_gb: number;
  exclude_abs_path_contains?: string[];
  extra_protected_path_contains?: string[];
  allow_path_contains?: string[];
  /** Windows: probe NTFS USN journal at scan start (v0.8.5 experimental). */
  experimental_windows_ntfs_usn_inventory?: boolean;
}

export interface ExecutePreviewResponse {
  selected_count: number;
  selected_bytes: number;
  mode: string;
  blocked_count: number;
  review_count: number;
  totals_by_risk: ScanReport['totals_by_risk'];
}

export interface PlanResponse {
  target_bytes: number;
  achievable_bytes: number;
  selected_count: number;
  used_review: boolean;
  selected_ids: string[];
}

export interface BulkRestoreResponse {
  restored_count: number;
  restored_paths: string[];
  failed_ids: string[];
  errors: string[];
}

export interface ExecuteResponse {
  quarantined_count: number;
  deleted_count: number;
  /** Bytes freed from successfully deleted or quarantined items (from scan sizing). */
  freed_bytes?: number;
  skipped_blocked_count: number;
  skipped_review_count?: number;
  skipped_not_found_count?: number;
  skipped_opt_in_count?: number;
  errors: string[];
}

export type WizardStep = 'intro' | 'scanning' | 'results' | 'preview' | 'done';
