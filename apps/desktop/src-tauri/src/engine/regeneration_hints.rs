use super::types::Kind;

/// How to repopulate after cleanup (shown in candidate detail). Keep commands conservative.
pub fn regeneration_hint_for_kind(kind: &Kind) -> Option<&'static str> {
    match kind {
        Kind::GoGlobalCache => Some("`go clean -cache` / rebuild with `go build`"),
        Kind::JvmGlobalCache => Some("Re-download via Gradle/Maven on next build"),
        Kind::IdeGlobalCache => Some("Xcode rebuilds DerivedData on next compile"),
        Kind::NpmGlobalCache => Some("`npm cache clean --force`"),
        Kind::PnpmGlobalStore => Some("`pnpm store prune`; packages re-fetch on install"),
        Kind::YarnGlobalCache => Some("`yarn cache clean`; reinstall dependencies"),
        Kind::PipGlobalCache => Some("`pip cache purge`"),
        Kind::UvGlobalCache => Some("`uv cache clean`"),
        Kind::CondaPkgsCache => Some("`conda clean --all -p` (package cache only; does not remove envs)"),
        Kind::CargoRegistryCache => Some("`cargo cache -a`; crates re-download on next build"),
        Kind::BunGlobalCache => Some("`bun pm cache rm`; packages re-fetch on install"),
        Kind::NugetGlobalCache => Some("Restore with `dotnet restore` / `nuget restore`"),
        Kind::ComposerGlobalCache => Some("`composer clear-cache`; packages re-fetch on install"),
        Kind::VcpkgInstalledCache => Some("Reinstall ports with `vcpkg install` for your triplet"),
        Kind::ConanGlobalCache => Some("`conan remove \"*\" -c`; packages re-fetch on next build"),
        Kind::CcacheGlobalCache => Some("`ccache -C` or delete cache dir; objects rebuild on compile"),
        Kind::SccacheGlobalCache => Some("Clear sccache store; compiler cache repopulates on build"),
        Kind::BazelDiskCache => Some("Point Bazel `--disk_cache` at a new directory or delete this tree; rebuild repopulates the cache"),
        _ => None,
    }
}

pub fn display_with_regeneration_hint(kind: &Kind, reason_codes: &[String]) -> String {
    let base = if reason_codes.is_empty() {
        "Unspecified".to_string()
    } else {
        reason_codes
            .iter()
            .map(|code| code.to_lowercase().replace('_', " "))
            .collect::<Vec<_>>()
            .join(", ")
    };
    match regeneration_hint_for_kind(kind) {
        Some(hint) => format!("{base}. Regenerate: {hint}"),
        None => base,
    }
}
