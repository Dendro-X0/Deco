//! Shared classification fixtures (`tests/fixtures/classification/cases.json`).

#[cfg(test)]
mod tests {
    use super::super::classifier::{classify_targets, DEFAULT_CLASSIFY_PARALLEL_THRESHOLD};
    use super::super::path_policy::PathPolicy;
    use super::super::scanner::DiscoveredTarget;
    use super::super::types::{Kind, RiskLevel, SafetyClass};
    use serde::Deserialize;
    use std::fs::{create_dir_all, write};
    use std::path::{Path, PathBuf};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    #[derive(Debug, Deserialize)]
    struct Manifest {
        version: u32,
        stale_days: u32,
        cases: Vec<Case>,
    }

    #[derive(Debug, Deserialize)]
    struct Case {
        id: String,
        setup: Vec<SetupEntry>,
        targets: Vec<TargetSpec>,
        expect: Vec<ExpectSpec>,
    }

    #[derive(Debug, Deserialize)]
    struct SetupEntry {
        path: String,
        #[serde(default)]
        content: Option<String>,
        #[serde(rename = "type")]
        entry_type: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    struct TargetSpec {
        kind: String,
        rel_path: String,
        age_days: u32,
    }

    #[derive(Debug, Deserialize)]
    struct ExpectSpec {
        risk: String,
        safety_class: String,
        reason_codes: Vec<String>,
    }

    fn repo_root() -> PathBuf {
        std::env::current_dir()
            .expect("cwd")
            .join("..")
            .join("..")
            .join("..")
    }

    fn manifest_path() -> PathBuf {
        repo_root().join("tests/fixtures/classification/cases.json")
    }

    fn kind_from_wire(s: &str) -> Kind {
        match s {
            "node_modules" => Kind::NodeModules,
            "build-artifact" | "build_artifact" => Kind::BuildArtifact,
            "rust-artifact" | "rust_artifact" => Kind::RustArtifact,
            "go-artifact" | "go_artifact" => Kind::GoArtifact,
            "go-global-cache" | "go_global_cache" => Kind::GoGlobalCache,
            "playwright-artifact" | "playwright_artifact" => Kind::PlaywrightArtifact,
            "unknown-artifact" | "unknown_artifact" => Kind::UnknownArtifact,
            "python-artifact" | "python_artifact" => Kind::PythonArtifact,
            "python-venv" | "python_venv" => Kind::PythonVenv,
            "jvm-artifact" | "jvm_artifact" => Kind::JvmArtifact,
            "jvm-global-cache" | "jvm_global_cache" => Kind::JvmGlobalCache,
            "dotnet-artifact" | "dotnet_artifact" => Kind::DotNetArtifact,
            "ide-global-cache" | "ide_global_cache" => Kind::IdeGlobalCache,
            "npm-global-cache" | "npm_global_cache" => Kind::NpmGlobalCache,
            "pnpm-global-store" | "pnpm_global_store" => Kind::PnpmGlobalStore,
            "yarn-global-cache" | "yarn_global_cache" => Kind::YarnGlobalCache,
            "pip-global-cache" | "pip_global_cache" => Kind::PipGlobalCache,
            "uv-global-cache" | "uv_global_cache" => Kind::UvGlobalCache,
            "conda-pkgs-cache" | "conda_pkgs_cache" => Kind::CondaPkgsCache,
            "cargo-registry-cache" | "cargo_registry_cache" => Kind::CargoRegistryCache,
            "bun-global-cache" | "bun_global_cache" => Kind::BunGlobalCache,
            "nuget-global-cache" | "nuget_global_cache" => Kind::NugetGlobalCache,
            "composer-global-cache" | "composer_global_cache" => Kind::ComposerGlobalCache,
            "vcpkg-installed-cache" | "vcpkg_installed_cache" => Kind::VcpkgInstalledCache,
            "conan-global-cache" | "conan_global_cache" => Kind::ConanGlobalCache,
            "ccache-global-cache" | "ccache_global_cache" => Kind::CcacheGlobalCache,
            "sccache-global-cache" | "sccache_global_cache" => Kind::SccacheGlobalCache,
            "bazel-disk-cache" | "bazel_disk_cache" => Kind::BazelDiskCache,
            other => panic!("unknown kind in fixture: {other}"),
        }
    }

    fn risk_from_wire(s: &str) -> RiskLevel {
        match s {
            "safe" => RiskLevel::Safe,
            "review" => RiskLevel::Review,
            "blocked" => RiskLevel::Blocked,
            other => panic!("unknown risk in fixture: {other}"),
        }
    }

    fn safety_class_from_wire(s: &str) -> SafetyClass {
        match s {
            "project_artifact" => SafetyClass::ProjectArtifact,
            "global_cache" => SafetyClass::GlobalCache,
            "app_runtime" => SafetyClass::AppRuntime,
            "system" => SafetyClass::System,
            "unknown" => SafetyClass::Unknown,
            other => panic!("unknown safety_class in fixture: {other}"),
        }
    }

    fn materialize_case(root: &Path, case: &Case) {
        for entry in &case.setup {
            let abs = root.join(&entry.path);
            if entry.entry_type.as_deref() == Some("dir") {
                create_dir_all(&abs).expect("create setup dir");
            } else {
                if let Some(parent) = abs.parent() {
                    create_dir_all(parent).expect("create parent");
                }
                write(&abs, entry.content.as_deref().unwrap_or("")).expect("write setup file");
            }
        }
        for target in &case.targets {
            let abs = root.join(&target.rel_path);
            create_dir_all(&abs).expect("create target dir");
        }
    }

    fn mtime_ms_for_age_days(age_days: u32) -> i64 {
        (SystemTime::now() - Duration::from_secs(age_days as u64 * 24 * 60 * 60))
            .duration_since(UNIX_EPOCH)
            .expect("mtime")
            .as_millis() as i64
    }

    #[test]
    fn matches_shared_classification_fixtures() {
        let manifest_text = std::fs::read_to_string(manifest_path()).expect("read manifest");
        let manifest: Manifest = serde_json::from_str(&manifest_text).expect("parse manifest");
        assert_eq!(manifest.version, 1);

        let policy = PathPolicy::new(vec![], vec![]);
        let tmp_base = repo_root().join(".tmp-rust-tests");
        create_dir_all(&tmp_base).expect("tmp base");

        for case in manifest.cases {
            let root = tmp_base.join(format!("deco-classify-{}-{}", case.id, uuid::Uuid::new_v4()));
            create_dir_all(&root).expect("case root");
            materialize_case(&root, &case);

            let discovered: Vec<DiscoveredTarget> = case
                .targets
                .iter()
                .map(|t| {
                    let abs = root.join(&t.rel_path);
                    let mtime_ms = mtime_ms_for_age_days(t.age_days);
                    DiscoveredTarget {
                        kind: kind_from_wire(&t.kind),
                        abs_path: abs.to_string_lossy().to_string(),
                        mtime_ms: Some(mtime_ms),
                    }
                })
                .collect();

            let roots = vec![root.to_string_lossy().to_string()];
            let classified = classify_targets(
                discovered,
                &roots,
                manifest.stale_days,
                &policy,
                DEFAULT_CLASSIFY_PARALLEL_THRESHOLD,
            );

            assert_eq!(
                classified.len(),
                case.expect.len(),
                "case {} length",
                case.id
            );

            for (i, exp) in case.expect.iter().enumerate() {
                let got = &classified[i];
                assert_eq!(
                    got.risk,
                    risk_from_wire(&exp.risk),
                    "case {} [{}] risk",
                    case.id,
                    i
                );
                assert_eq!(
                    got.safety_class,
                    safety_class_from_wire(&exp.safety_class),
                    "case {} [{}] safety_class",
                    case.id,
                    i
                );
                for code in &exp.reason_codes {
                    assert!(
                        got.reason_codes.contains(code),
                        "case {} [{}] missing reason code {}",
                        case.id,
                        i,
                        code
                    );
                }
            }

            std::fs::remove_dir_all(&root).ok();
        }
    }
}
