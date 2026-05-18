use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct ProjectEvidence {
    pub project_root: String,
    pub score: u32,
}

const LOCK_FILES: &[&str] = &[
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
];
const TOOLING_PREFIXES: &[&str] = &[
    "vite.config.",
    "next.config.",
    "svelte.config.",
    "astro.config.",
];

pub fn detect_project_root(
    start_dir: &Path,
    max_ascend: u32,
    stop_at: Option<&Path>,
) -> Option<ProjectEvidence> {
    let mut current = start_dir.to_path_buf();
    let mut best: Option<ProjectEvidence> = None;

    for _ in 0..=max_ascend {
        if let Some(ev) = detect_at_dir(&current) {
            if best.as_ref().map(|b| ev.score > b.score).unwrap_or(true) {
                if ev.score >= 95 {
                    return Some(ev);
                }
                best = Some(ev);
            }
        }

        if let Some(stop) = stop_at {
            if current == stop {
                break;
            }
        }

        let parent = match current.parent() {
            Some(parent) => parent.to_path_buf(),
            None => break,
        };
        if parent == current {
            break;
        }
        if let Some(stop) = stop_at {
            if !is_within_or_equal(&parent, stop) {
                break;
            }
        }
        current = parent;
    }

    best
}

fn detect_at_dir(dir: &PathBuf) -> Option<ProjectEvidence> {
    let has_package_json = exists(dir.join("package.json"));
    let has_lock = LOCK_FILES.iter().any(|file| exists(dir.join(file)));

    if has_package_json && has_lock {
        return Some(ProjectEvidence {
            project_root: dir.to_string_lossy().to_string(),
            score: 100,
        });
    }

    if exists(dir.join("Cargo.toml")) {
        return Some(ProjectEvidence {
            project_root: dir.to_string_lossy().to_string(),
            score: 95,
        });
    }

    if exists(dir.join("go.mod")) {
        return Some(ProjectEvidence {
            project_root: dir.to_string_lossy().to_string(),
            score: 95,
        });
    }

    let has_git = exists(dir.join(".git"));
    let has_tsconfig = exists(dir.join("tsconfig.json"));
    let has_tooling = std::fs::read_dir(dir)
        .ok()
        .map(|entries| {
            entries.flatten().any(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                TOOLING_PREFIXES
                    .iter()
                    .any(|prefix| name.starts_with(prefix))
            })
        })
        .unwrap_or(false);

    if has_package_json && (has_tsconfig || has_tooling || has_git) {
        return Some(ProjectEvidence {
            project_root: dir.to_string_lossy().to_string(),
            score: 80,
        });
    }

    if has_git && (has_tsconfig || has_tooling) {
        return Some(ProjectEvidence {
            project_root: dir.to_string_lossy().to_string(),
            score: 65,
        });
    }

    None
}

fn exists(path: PathBuf) -> bool {
    path.exists()
}

fn is_within_or_equal(path: &Path, base: &Path) -> bool {
    path == base || path.starts_with(base)
}

fn dir_has_python_marker(dir: &Path) -> bool {
    const FILES: &[&str] = &[
        "pyproject.toml",
        "requirements.txt",
        "setup.py",
        "Pipfile",
        "poetry.lock",
    ];
    FILES.iter().any(|f| exists(dir.join(f)))
}

fn dir_has_jvm_marker(dir: &Path) -> bool {
    const FILES: &[&str] = &[
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
        "settings.gradle",
        "settings.gradle.kts",
        "gradlew",
        "gradlew.bat",
    ];
    FILES.iter().any(|f| exists(dir.join(f)))
}

fn dir_has_dotnet_marker(dir: &Path) -> bool {
    const FILES: &[&str] = &["global.json", "Directory.Build.props", "Directory.Build.targets"];
    if FILES.iter().any(|f| exists(dir.join(f))) {
        return true;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries.flatten().any(|entry| {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        name.ends_with(".csproj")
            || name.ends_with(".fsproj")
            || name.ends_with(".vbproj")
            || name.ends_with(".sln")
    })
}

fn has_marker_ancestor(
    start_dir: &Path,
    max_ascend: u32,
    marker: fn(&Path) -> bool,
) -> bool {
    let mut current = start_dir.to_path_buf();
    for _ in 0..=max_ascend {
        if marker(&current) {
            return true;
        }
        let parent = match current.parent() {
            Some(parent) => parent.to_path_buf(),
            None => break,
        };
        if parent == current {
            break;
        }
        current = parent;
    }
    false
}

/// True when `go.mod` exists on `start_dir` or up to `max_ascend` parents (used to gate Go artifact dirs).
pub fn has_go_mod_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    let mut current = start_dir.to_path_buf();
    for _ in 0..=max_ascend {
        if exists(current.join("go.mod")) {
            return true;
        }
        let parent = match current.parent() {
            Some(parent) => parent.to_path_buf(),
            None => break,
        };
        if parent == current {
            break;
        }
        current = parent;
    }
    false
}

pub fn has_python_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_python_marker)
}

pub fn has_jvm_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_jvm_marker)
}

pub fn has_dotnet_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_dotnet_marker)
}

fn dir_has_cmake_marker(dir: &Path) -> bool {
    exists(dir.join("CMakeLists.txt")) || exists(dir.join("CMakeCache.txt"))
}

fn dir_has_meson_marker(dir: &Path) -> bool {
    exists(dir.join("meson.build"))
}

fn dir_has_vcxproj_marker(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries.flatten().any(|entry| {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        name.ends_with(".vcxproj")
            || name.ends_with(".vcxproj.filters")
            || name.ends_with(".sln")
    })
}

pub fn dir_has_cpp_native_marker(dir: &Path) -> bool {
    dir_has_cmake_marker(dir) || dir_has_vcxproj_marker(dir) || dir_has_meson_marker(dir)
}

pub fn has_cmake_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_cmake_marker)
}

pub fn has_meson_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_meson_marker)
}

pub fn has_cpp_native_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_cpp_native_marker)
}

pub fn is_meson_build_dir_name(name: &str) -> bool {
    matches!(name, "builddir" | "_build")
}

pub fn is_cpp_ide_dir_name(name: &str) -> bool {
    name == ".vs"
}

fn dir_has_bazel_marker(dir: &Path) -> bool {
    exists(dir.join("WORKSPACE"))
        || exists(dir.join("WORKSPACE.bazel"))
        || exists(dir.join("MODULE.bazel"))
}

pub fn has_bazel_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_bazel_marker)
}

pub fn is_bazel_output_dir_name(name: &str) -> bool {
    name.starts_with("bazel-")
}

fn dir_has_xmake_marker(dir: &Path) -> bool {
    exists(dir.join("xmake.lua"))
}

fn dir_has_premake_marker(dir: &Path) -> bool {
    exists(dir.join("premake5.lua")) || exists(dir.join("premake4.lua"))
}

fn dir_has_qmake_marker(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries.flatten().any(|entry| {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        name.ends_with(".pro") || name.ends_with(".qmake.stash") || name == ".qmake.cache"
    })
}

pub fn has_xmake_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_xmake_marker)
}

pub fn has_premake_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_premake_marker)
}

pub fn has_qmake_project_ancestor(start_dir: &Path, max_ascend: u32) -> bool {
    has_marker_ancestor(start_dir, max_ascend, dir_has_qmake_marker)
}

pub fn is_xmake_build_dir_name(name: &str) -> bool {
    name == ".build"
}

pub fn is_premake_build_dir_name(name: &str) -> bool {
    matches!(name, "bin-int" | "bin-int64")
}

pub fn is_qmake_shadow_build_dir_name(name: &str) -> bool {
    name.starts_with("build-") && !name.starts_with("bazel-")
}

pub fn is_msvc_config_dir_name(name: &str) -> bool {
    matches!(
        name,
        "Debug" | "Release" | "RelWithDebInfo" | "MinSizeRel"
    )
}

pub fn is_msvc_arch_dir_name(name: &str) -> bool {
    matches!(
        name,
        "x64" | "x86" | "Win32" | "ARM64" | "ARM" | "amd64" | "i386"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_root(prefix: &str) -> PathBuf {
        let base = std::env::current_dir()
            .expect("cwd")
            .join("..")
            .join(".tmp-rust-tests");
        create_dir_all(&base).expect("create base");
        let root = base.join(format!("deco-rust-{prefix}-{}", Uuid::new_v4()));
        create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn detects_package_project_with_lockfile() {
        let root = temp_root("pkg");
        write(root.join("package.json"), "{}").expect("write package");
        write(root.join("pnpm-lock.yaml"), "lockfileVersion: 9").expect("write lock");
        create_dir_all(root.join("src")).expect("create src");

        let detected = detect_project_root(&root.join("src"), 4, Some(&root));
        assert!(detected.is_some());
        assert_eq!(
            detected.expect("has project").project_root,
            root.to_string_lossy().to_string()
        );

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn has_xmake_project_ancestor_finds_build_dir() {
        let root = temp_root("xmake-ancestor");
        write(root.join("xmake.lua"), "set_project(\"demo\")\n").expect("write xmake");
        create_dir_all(root.join(".build")).expect("create .build");

        assert!(has_xmake_project_ancestor(&root.join(".build"), 6));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn has_premake_project_ancestor_finds_bin_int() {
        let root = temp_root("premake-ancestor");
        write(root.join("premake5.lua"), "workspace \"demo\"\n").expect("write premake");
        create_dir_all(root.join("bin-int")).expect("create bin-int");

        assert!(has_premake_project_ancestor(&root.join("bin-int"), 6));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn has_qmake_project_ancestor_finds_shadow_build() {
        let root = temp_root("qmake-ancestor");
        write(root.join("app.pro"), "TEMPLATE = app\n").expect("write pro");
        create_dir_all(root.join("build-Desktop-Debug")).expect("create shadow build");

        assert!(has_qmake_project_ancestor(&root.join("build-Desktop-Debug"), 6));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn has_bazel_project_ancestor_finds_module_bazel() {
        let root = temp_root("bazel-ancestor");
        write(root.join("MODULE.bazel"), "module(name = \"demo\")\n").expect("write module");
        create_dir_all(root.join("bazel-bin")).expect("create bazel-bin");

        assert!(has_bazel_project_ancestor(&root.join("bazel-bin"), 6));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn has_meson_project_ancestor_finds_meson_build() {
        let root = temp_root("meson-ancestor");
        write(root.join("meson.build"), "project('demo', 'c')\n").expect("write meson");
        create_dir_all(root.join("builddir")).expect("create builddir");

        assert!(has_meson_project_ancestor(&root.join("builddir"), 6));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn has_go_mod_ancestor_finds_parent_module() {
        let root = temp_root("go-mod-ancestor");
        write(root.join("go.mod"), "module example.com/app\n").expect("write go.mod");
        create_dir_all(root.join("cmd").join("app").join("bin")).expect("create bin");

        assert!(has_go_mod_ancestor(&root.join("cmd").join("app"), 6));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn returns_none_without_markers() {
        let root = temp_root("none");
        create_dir_all(root.join("folder")).expect("create folder");

        let detected = detect_project_root(&root.join("folder"), 4, Some(&root));
        assert!(detected.is_none());

        remove_dir_all(root).expect("cleanup");
    }
}
