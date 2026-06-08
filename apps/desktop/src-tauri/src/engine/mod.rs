pub mod ancestor_cache;
pub mod benchmark;
pub mod cleanup_batch;
pub mod cleanup_coalesce;
pub mod cleanup_disk_mode;
pub mod classifier;
#[cfg(test)]
mod classification_parity;
#[cfg(test)]
mod schema_audit;
pub mod delete_parallel;
pub mod discovery_patterns;
pub mod disk_cleanup_config;
pub mod ecosystem_globals;
pub mod inventory;
pub mod executor;
pub mod fast_tree_delete;
pub mod path_policy;
pub mod policy_validate;
pub mod project_detection;
pub mod quarantine_store;
pub mod regeneration_hints;
pub mod project_root_cache;
pub mod scan_concurrency;
pub mod scanner;
pub mod size_estimate;
pub mod sizer;
pub mod types;
