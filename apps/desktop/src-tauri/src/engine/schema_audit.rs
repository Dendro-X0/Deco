//! JSON Schema ↔ Rust DTO parity checks (`docs/schemas/scan-report.schema.json`).

#[cfg(test)]
mod tests {
    use super::super::types::{Kind, RiskLevel, SafetyClass, SCAN_REPORT_SCHEMA_VERSION};
    use serde_json::Value;
    use std::path::PathBuf;

    fn repo_root() -> PathBuf {
        std::env::current_dir()
            .expect("cwd")
            .join("..")
            .join("..")
            .join("..")
    }

    fn load_schema() -> Value {
        let path = repo_root().join("docs/schemas/scan-report.schema.json");
        let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        serde_json::from_str(&text).expect("parse schema")
    }

    fn kind_enum(schema: &Value) -> Vec<String> {
        schema["$defs"]["candidate"]["properties"]["kind"]["enum"]
            .as_array()
            .expect("kind enum")
            .iter()
            .map(|v| v.as_str().expect("kind str").to_string())
            .collect()
    }

    #[test]
    fn kind_wire_keys_match_schema_enum() {
        let schema = load_schema();
        let enum_kinds: std::collections::HashSet<String> = kind_enum(&schema).into_iter().collect();

        let rust_kinds = [
            Kind::NodeModules,
            Kind::BuildArtifact,
            Kind::RustArtifact,
            Kind::GoArtifact,
            Kind::GoGlobalCache,
            Kind::PlaywrightArtifact,
            Kind::UnknownArtifact,
            Kind::PythonArtifact,
            Kind::PythonVenv,
            Kind::JvmArtifact,
            Kind::JvmGlobalCache,
            Kind::DotNetArtifact,
            Kind::IdeGlobalCache,
            Kind::NpmGlobalCache,
            Kind::PnpmGlobalStore,
            Kind::YarnGlobalCache,
            Kind::PipGlobalCache,
            Kind::UvGlobalCache,
            Kind::CondaPkgsCache,
            Kind::CargoRegistryCache,
            Kind::BunGlobalCache,
            Kind::NugetGlobalCache,
            Kind::ComposerGlobalCache,
            Kind::VcpkgInstalledCache,
            Kind::ConanGlobalCache,
            Kind::CcacheGlobalCache,
            Kind::SccacheGlobalCache,
            Kind::BazelDiskCache,
        ];

        assert_eq!(
            rust_kinds.len(),
            enum_kinds.len(),
            "Kind variant count vs schema enum"
        );
        for kind in rust_kinds {
            let wire = kind.wire_key();
            assert!(
                enum_kinds.contains(wire),
                "schema kind enum missing {wire}"
            );
            assert_eq!(Kind::from_wire_key(wire), Some(kind));
        }
    }

    #[test]
    fn risk_and_safety_enums_match_schema() {
        let schema = load_schema();
        let risks: Vec<&str> = schema["$defs"]["candidate"]["properties"]["risk"]["enum"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap())
            .collect();
        assert_eq!(risks, ["safe", "review", "blocked"]);
        for r in risks {
            assert!(RiskLevel::from_wire_key(r).is_some());
        }

        let classes: Vec<&str> = schema["$defs"]["candidate"]["properties"]["safety_class"]["enum"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap())
            .collect();
        assert_eq!(
            classes,
            [
                "project_artifact",
                "global_cache",
                "app_runtime",
                "system",
                "unknown"
            ]
        );
        for c in classes {
            assert!(SafetyClass::from_wire_key(c).is_some());
        }
    }

    #[test]
    fn schema_documents_desktop_scan_extensions() {
        let schema = load_schema();
        let props = schema["properties"].as_object().expect("root properties");
        for key in [
            "inventory_reused",
            "discover_ms",
            "classify_ms",
            "size_ms",
        ] {
            assert!(props.contains_key(key), "schema missing desktop field {key}");
        }
    }

    #[test]
    fn schema_version_constant_matches_pattern() {
        let parts: Vec<_> = SCAN_REPORT_SCHEMA_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3);
        for p in parts {
            assert!(p.parse::<u32>().is_ok(), "semver segment {p}");
        }
    }
}
