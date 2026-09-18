//! Docker Desktop disk layout helpers (Windows) — plan-only guidance, no VHDX junction Run.

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DockerDiskBreakdown {
    pub docker_root: String,
    pub total_bytes: Option<u64>,
    pub vhdx_path: Option<String>,
    pub vhdx_bytes: Option<u64>,
    pub appdata_excluding_vhdx_bytes: Option<u64>,
}

pub fn docker_vhdx_candidates(docker_root: &Path) -> Vec<PathBuf> {
    vec![
        docker_root.join("wsl").join("data").join("ext4.vhdx"),
        docker_root.join("wsl").join("disk").join("ext4.vhdx"),
    ]
}

pub fn find_docker_vhdx(docker_root: &Path) -> Option<PathBuf> {
    docker_vhdx_candidates(docker_root)
        .into_iter()
        .find(|p| p.is_file())
}

pub fn file_size(path: &Path) -> Option<u64> {
    std::fs::metadata(path).ok().filter(|m| m.is_file()).map(|m| m.len())
}

pub fn analyze_docker_disk(docker_root: &Path, total_bytes: Option<u64>) -> DockerDiskBreakdown {
    let vhdx = find_docker_vhdx(docker_root);
    let vhdx_bytes = vhdx.as_ref().and_then(|p| file_size(p));
    let appdata_excluding_vhdx_bytes = match (total_bytes, vhdx_bytes) {
        (Some(total), Some(vhdx)) => Some(total.saturating_sub(vhdx)),
        (Some(total), None) => Some(total),
        _ => None,
    };
    DockerDiskBreakdown {
        docker_root: docker_root.to_string_lossy().to_string(),
        total_bytes,
        vhdx_path: vhdx.map(|p| p.to_string_lossy().to_string()),
        vhdx_bytes,
        appdata_excluding_vhdx_bytes,
    }
}

pub fn format_bytes_hint(bytes: u64) -> String {
    const GB: f64 = 1024.0 * 1024.0 * 1024.0;
    const MB: f64 = 1024.0 * 1024.0;
    if bytes as f64 >= GB {
        format!("{:.1} GB", bytes as f64 / GB)
    } else if bytes as f64 >= MB {
        format!("{:.0} MB", bytes as f64 / MB)
    } else {
        format!("{bytes} bytes")
    }
}

pub fn docker_breakdown_warnings(breakdown: &DockerDiskBreakdown) -> Vec<String> {
    let mut warnings = vec![
        "Docker Desktop is plan-only: Deco does not migrate ext4.vhdx via junction Run. \
         Use Docker Desktop disk settings (config wizard in Settings)."
            .to_string(),
    ];

    if let (Some(vhdx_bytes), Some(path)) = (breakdown.vhdx_bytes, breakdown.vhdx_path.as_deref()) {
        warnings.push(format!(
            "WSL disk image (ext4.vhdx): {} at {}",
            format_bytes_hint(vhdx_bytes),
            path
        ));
    }

    if let Some(meta_bytes) = breakdown.appdata_excluding_vhdx_bytes {
        warnings.push(format!(
            "Docker LocalAppData (excluding VHDX): {}",
            format_bytes_hint(meta_bytes)
        ));
    }

    if vhdx_is_dominant(breakdown) {
        warnings.push(
            "Most Docker disk usage is in ext4.vhdx. Junction-migrating only LocalAppData\\Docker \
             would not free meaningful space. Use Docker Desktop → Settings → Resources → Advanced → \
             Disk image location."
                .to_string(),
        );
    }

    warnings
}

fn vhdx_is_dominant(breakdown: &DockerDiskBreakdown) -> bool {
    let Some(vhdx) = breakdown.vhdx_bytes else {
        return false;
    };
    const MIN_VHDX: u64 = 500 * 1024 * 1024;
    if vhdx < MIN_VHDX {
        return false;
    }
    match breakdown.appdata_excluding_vhdx_bytes {
        Some(meta) => vhdx > meta,
        None => vhdx >= MIN_VHDX,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn docker_vhdx_candidates_include_known_paths() {
        let root = PathBuf::from(r"C:\Users\me\AppData\Local\Docker");
        let candidates = docker_vhdx_candidates(&root);
        assert!(candidates.iter().any(|p| p.ends_with("wsl\\data\\ext4.vhdx")));
        assert!(candidates.iter().any(|p| p.ends_with("wsl\\disk\\ext4.vhdx")));
    }

    #[test]
    fn analyze_subtracts_vhdx_from_total() {
        let base = std::env::temp_dir().join(format!("deco-docker-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("mkdir base");
        let docker_root = base.join("Docker");
        let vhdx_dir = docker_root.join("wsl").join("data");
        fs::create_dir_all(&vhdx_dir).expect("mkdir");
        let vhdx_path = vhdx_dir.join("ext4.vhdx");
        let mut f = fs::File::create(&vhdx_path).expect("create vhdx");
        f.write_all(&[0u8; 1024]).expect("write vhdx");

        let settings = docker_root.join("settings.json");
        fs::write(&settings, b"{\"small\":true}").expect("write settings");

        let breakdown = analyze_docker_disk(&docker_root, Some(2048));
        assert_eq!(breakdown.vhdx_bytes, Some(1024));
        assert_eq!(breakdown.appdata_excluding_vhdx_bytes, Some(1024));
        assert!(!vhdx_is_dominant(&breakdown));
        let warnings = docker_breakdown_warnings(&breakdown);
        assert!(warnings.iter().any(|w| w.contains("plan-only")));
        assert!(warnings.iter().any(|w| w.contains("ext4.vhdx")));
        let _ = fs::remove_dir_all(&base);
    }
}
