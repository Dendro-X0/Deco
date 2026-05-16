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
  show_blocked: boolean;
  check_go_cache: boolean;
  include_python_artifacts: boolean;
  include_python_venv: boolean;
  include_jvm_artifacts: boolean;
  check_jvm_global_cache: boolean;
  include_dotnet_artifacts: boolean;
  check_ide_global_cache: boolean;
  delete_mode: string;
  quarantine_retention_days: number;
  advanced_mode: boolean;
  default_target_gb: number;
  exclude_abs_path_contains?: string[];
  extra_protected_path_contains?: string[];
  allow_path_contains?: string[];
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
  skipped_blocked_count: number;
  errors: string[];
}

export type WizardStep = 'intro' | 'scanning' | 'results' | 'preview' | 'done';
