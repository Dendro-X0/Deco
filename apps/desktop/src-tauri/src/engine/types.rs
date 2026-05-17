use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Safe,
    Review,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SafetyClass {
    ProjectArtifact,
    GlobalCache,
    AppRuntime,
    System,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    NodeModules,
    BuildArtifact,
    RustArtifact,
    GoArtifact,
    GoGlobalCache,
    PlaywrightArtifact,
    UnknownArtifact,
    PythonArtifact,
    PythonVenv,
    JvmArtifact,
    JvmGlobalCache,
    DotNetArtifact,
    IdeGlobalCache,
    NpmGlobalCache,
    PnpmGlobalStore,
    YarnGlobalCache,
    PipGlobalCache,
    UvGlobalCache,
    CondaPkgsCache,
}

impl Kind {
    /// JSON / scan-contract key for this kind (matches `serde` `rename_all = "snake_case"`).
    pub fn wire_key(&self) -> &'static str {
        match self {
            Kind::NodeModules => "node_modules",
            Kind::BuildArtifact => "build_artifact",
            Kind::RustArtifact => "rust_artifact",
            Kind::GoArtifact => "go_artifact",
            Kind::GoGlobalCache => "go_global_cache",
            Kind::PlaywrightArtifact => "playwright_artifact",
            Kind::UnknownArtifact => "unknown_artifact",
            Kind::PythonArtifact => "python_artifact",
            Kind::PythonVenv => "python_venv",
            Kind::JvmArtifact => "jvm_artifact",
            Kind::JvmGlobalCache => "jvm_global_cache",
            Kind::DotNetArtifact => "dotnet_artifact",
            Kind::IdeGlobalCache => "ide_global_cache",
            Kind::NpmGlobalCache => "npm_global_cache",
            Kind::PnpmGlobalStore => "pnpm_global_store",
            Kind::YarnGlobalCache => "yarn_global_cache",
            Kind::PipGlobalCache => "pip_global_cache",
            Kind::UvGlobalCache => "uv_global_cache",
            Kind::CondaPkgsCache => "conda_pkgs_cache",
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_scan_scope() -> String {
    "projects".to_string()
}

/// Per-ecosystem discovery toggles (M7). Global caches stay opt-in via `check_*_global_cache` on scan request.
#[derive(Debug, Clone, Copy)]
pub struct EcosystemScanOptions {
    pub include_python_artifacts: bool,
    pub include_python_venv: bool,
    pub include_jvm_artifacts: bool,
    pub check_jvm_global_cache: bool,
    pub include_dotnet_artifacts: bool,
    pub check_ide_global_cache: bool,
    pub check_npm_cache: bool,
    pub check_pnpm_store: bool,
    pub check_yarn_cache: bool,
    pub check_pip_cache: bool,
    pub check_uv_cache: bool,
    pub check_conda_pkgs_cache: bool,
}

impl Default for EcosystemScanOptions {
    fn default() -> Self {
        Self {
            include_python_artifacts: true,
            include_python_venv: false,
            include_jvm_artifacts: true,
            check_jvm_global_cache: false,
            include_dotnet_artifacts: true,
            check_ide_global_cache: false,
            check_npm_cache: false,
            check_pnpm_store: false,
            check_yarn_cache: false,
            check_pip_cache: false,
            check_uv_cache: false,
            check_conda_pkgs_cache: false,
        }
    }
}

impl From<&ScanRequest> for EcosystemScanOptions {
    fn from(req: &ScanRequest) -> Self {
        Self {
            include_python_artifacts: req.include_python_artifacts,
            include_python_venv: req.include_python_venv,
            include_jvm_artifacts: req.include_jvm_artifacts,
            check_jvm_global_cache: req.check_jvm_global_cache,
            include_dotnet_artifacts: req.include_dotnet_artifacts,
            check_ide_global_cache: req.check_ide_global_cache,
            check_npm_cache: req.check_npm_cache,
            check_pnpm_store: req.check_pnpm_store,
            check_yarn_cache: req.check_yarn_cache,
            check_pip_cache: req.check_pip_cache,
            check_uv_cache: req.check_uv_cache,
            check_conda_pkgs_cache: req.check_conda_pkgs_cache,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct GlobalCacheAllow {
    pub go: bool,
    pub jvm: bool,
    pub ide: bool,
    pub npm: bool,
    pub pnpm: bool,
    pub yarn: bool,
    pub pip: bool,
    pub uv: bool,
    pub conda: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupCandidate {
    pub id: String,
    pub kind: Kind,
    pub abs_path: String,
    pub size_bytes: Option<u64>,
    pub mtime_ms: Option<i64>,
    pub risk: RiskLevel,
    pub safety_class: SafetyClass,
    pub reason_codes: Vec<String>,
    #[serde(default)]
    pub display_reason_summary: Option<String>,
    #[serde(default = "default_can_delete")]
    pub can_delete: bool,
    pub project_root: Option<String>,
    pub stale_days: Option<u32>,
}

fn default_can_delete() -> bool {
    true
}

#[cfg(test)]
mod kind_tests {
    use super::Kind;

    #[test]
    fn wire_key_matches_serde_snake_case() {
        assert_eq!(Kind::NodeModules.wire_key(), "node_modules");
        assert_eq!(Kind::GoGlobalCache.wire_key(), "go_global_cache");
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Totals {
    pub count: u64,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRequest {
    pub roots: Vec<String>,
    pub max_depth: u32,
    pub profile: String,
    pub include_size: bool,
    pub stale_days: u32,
    pub show_blocked: bool,
    pub check_go_cache: bool,
    #[serde(default = "default_true")]
    pub include_python_artifacts: bool,
    #[serde(default)]
    pub include_python_venv: bool,
    #[serde(default = "default_true")]
    pub include_jvm_artifacts: bool,
    #[serde(default)]
    pub check_jvm_global_cache: bool,
    #[serde(default = "default_true")]
    pub include_dotnet_artifacts: bool,
    #[serde(default)]
    pub check_ide_global_cache: bool,
    #[serde(default)]
    pub check_npm_cache: bool,
    #[serde(default)]
    pub check_pnpm_store: bool,
    #[serde(default)]
    pub check_yarn_cache: bool,
    #[serde(default)]
    pub check_pip_cache: bool,
    #[serde(default)]
    pub check_uv_cache: bool,
    #[serde(default)]
    pub check_conda_pkgs_cache: bool,
    #[serde(default)]
    pub exclude_abs_path_contains: Vec<String>,
    #[serde(default)]
    pub extra_protected_path_contains: Vec<String>,
    #[serde(default)]
    pub allow_path_contains: Vec<String>,
}

/// Bump together with CLI `SCAN_REPORT_SCHEMA_VERSION` and `docs/contract/changelog.md`.
pub const SCAN_REPORT_SCHEMA_VERSION: &str = "2.4.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResponse {
    pub schema_version: String,
    pub scan_id: String,
    pub scanned_dirs: u64,
    pub total_bytes: u64,
    pub candidates: Vec<CleanupCandidate>,
    pub totals_by_risk: RiskTotals,
    pub totals_by_kind: HashMap<String, Totals>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskTotals {
    pub safe: Totals,
    pub review: Totals,
    pub blocked: Totals,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub scan_id: String,
    pub candidate_ids: Vec<String>,
    pub delete_mode: String,
    pub include_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutePreviewResponse {
    pub selected_count: u32,
    pub selected_bytes: u64,
    pub mode: String,
    pub totals_by_risk: RiskTotals,
    pub totals_by_kind: HashMap<String, Totals>,
    pub blocked_count: u32,
    pub review_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteResponse {
    pub deleted_count: u32,
    pub quarantined_count: u32,
    pub skipped_blocked_count: u32,
    pub skipped_review_count: u32,
    pub skipped_not_found_count: u32,
    pub skipped_opt_in_count: u32,
    pub errors: Vec<String>,
    pub quarantine_entries: Vec<QuarantineEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineEntry {
    pub id: String,
    pub original_path: String,
    pub quarantined_path: String,
    pub timestamp_iso: String,
    pub size_bytes: Option<u64>,
    pub reason_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineFilterRequest {
    pub query: Option<String>,
    pub from_iso: Option<String>,
    pub to_iso: Option<String>,
    pub only_purge_eligible: Option<bool>,
    pub retention_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkRestoreResponse {
    pub restored_count: u32,
    pub restored_paths: Vec<String>,
    pub failed_ids: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurgeResponse {
    pub purged_count: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanHistoryItem {
    pub scan_id: String,
    pub created_at: String,
    pub roots: Vec<String>,
    pub profile: String,
    pub stale_days: u32,
    pub scanned_dirs: u64,
    pub total_bytes: u64,
    pub candidate_count: u64,
    pub safe_count: u64,
    pub review_count: u64,
    pub blocked_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanHistoryResponse {
    pub items: Vec<ScanHistoryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteScanHistoryResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearScanHistoryResponse {
    pub deleted_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanRequest {
    pub scan_id: String,
    pub target_gb: u32,
    pub include_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanResponse {
    pub target_bytes: u64,
    pub achievable_bytes: u64,
    pub selected_count: u32,
    pub selected_ids: Vec<String>,
    pub used_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub roots: Vec<String>,
    /// When true, scan only `roots` instead of the full partition layout.
    #[serde(default)]
    pub use_custom_scan_roots: bool,
    /// `projects` | `drives` | `all` — used when roots is empty to suggest scan paths.
    #[serde(default = "default_scan_scope")]
    pub scan_scope: String,
    /// Drive mount points selected for scanning (e.g. `C:\`, `D:\`).
    #[serde(default)]
    pub selected_volumes: Vec<String>,
    /// Also scan common dev folders under the user profile.
    #[serde(default = "default_true")]
    pub include_project_folders: bool,
    pub max_depth: u32,
    pub profile: String,
    pub stale_days: u32,
    pub include_size: bool,
    pub show_blocked: bool,
    pub check_go_cache: bool,
    #[serde(default = "default_true")]
    pub include_python_artifacts: bool,
    #[serde(default)]
    pub include_python_venv: bool,
    #[serde(default = "default_true")]
    pub include_jvm_artifacts: bool,
    #[serde(default)]
    pub check_jvm_global_cache: bool,
    #[serde(default = "default_true")]
    pub include_dotnet_artifacts: bool,
    #[serde(default)]
    pub check_ide_global_cache: bool,
    #[serde(default)]
    pub check_npm_cache: bool,
    #[serde(default)]
    pub check_pnpm_store: bool,
    #[serde(default)]
    pub check_yarn_cache: bool,
    #[serde(default)]
    pub check_pip_cache: bool,
    #[serde(default)]
    pub check_uv_cache: bool,
    #[serde(default)]
    pub check_conda_pkgs_cache: bool,
    pub delete_mode: String,
    pub quarantine_retention_days: u32,
    pub advanced_mode: bool,
    pub default_target_gb: u32,
    pub exclude_abs_path_contains: Vec<String>,
    pub extra_protected_path_contains: Vec<String>,
    pub allow_path_contains: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            roots: vec![],
            use_custom_scan_roots: false,
            scan_scope: default_scan_scope(),
            selected_volumes: vec![],
            include_project_folders: true,
            max_depth: 8,
            profile: "safe".to_string(),
            stale_days: 45,
            include_size: true,
            show_blocked: false,
            check_go_cache: false,
            include_python_artifacts: true,
            include_python_venv: false,
            include_jvm_artifacts: true,
            check_jvm_global_cache: false,
            include_dotnet_artifacts: true,
            check_ide_global_cache: false,
            check_npm_cache: false,
            check_pnpm_store: false,
            check_yarn_cache: false,
            check_pip_cache: false,
            check_uv_cache: false,
            check_conda_pkgs_cache: false,
            delete_mode: "quarantine".to_string(),
            quarantine_retention_days: 30,
            advanced_mode: false,
            default_target_gb: 10,
            exclude_abs_path_contains: vec![],
            extra_protected_path_contains: vec![],
            allow_path_contains: vec![],
        }
    }
}
