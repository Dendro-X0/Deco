//! Firefox Roaming profile layout checks before junction migration (Windows).

use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FirefoxLayoutCheck {
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

pub fn validate_firefox_profile_layout(source: &Path) -> FirefoxLayoutCheck {
    let mut warnings = vec![
        "Quit Firefox completely (Task Manager + tray) before Run migration.".to_string(),
    ];
    let mut errors = Vec::new();

    if !source.is_dir() {
        errors.push(format!(
            "Firefox profile root is not a directory: {}",
            source.display()
        ));
        return FirefoxLayoutCheck { warnings, errors };
    }

    let profiles_ini = source.join("profiles.ini");
    if !profiles_ini.is_file() {
        errors.push(format!(
            "Firefox profiles.ini not found at {}. Select the full %APPDATA%\\Mozilla\\Firefox folder, not a single profile subfolder.",
            profiles_ini.display()
        ));
        return FirefoxLayoutCheck { warnings, errors };
    }

    let profiles_dir = source.join("Profiles");
    if profiles_dir.is_dir() {
        let profile_count = std::fs::read_dir(&profiles_dir)
            .map(|entries| entries.filter_map(|e| e.ok()).filter(|e| e.path().is_dir()).count())
            .unwrap_or(0);
        if profile_count == 0 {
            warnings.push(
                "Profiles folder exists but contains no profile directories — verify this is your active Firefox data before Run."
                    .to_string(),
            );
        } else {
            warnings.push(format!(
                "Found {profile_count} profile folder(s) under Profiles/. Junction migration moves the entire Mozilla\\Firefox tree."
            ));
        }
    } else {
        warnings.push(
            "Profiles subdirectory not found. Portable or custom installs may use a different layout — open profiles.ini and confirm paths before Run."
                .to_string(),
        );
    }

    FirefoxLayoutCheck { warnings, errors }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn rejects_missing_profiles_ini() {
        let base = std::env::temp_dir().join(format!("deco-firefox-missing-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("mkdir");
        let check = validate_firefox_profile_layout(&base);
        assert!(!check.errors.is_empty());
        assert!(check.errors[0].contains("profiles.ini"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn accepts_profiles_ini_with_profiles_dir() {
        let base = std::env::temp_dir().join(format!("deco-firefox-ok-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(base.join("Profiles").join("abc.default")).expect("mkdir");
        fs::write(base.join("profiles.ini"), "[Install4F96D1932A9F858E]\nDefault=Profiles/abc.default\n").expect("write ini");
        let check = validate_firefox_profile_layout(&base);
        assert!(check.errors.is_empty());
        assert!(check.warnings.iter().any(|w| w.contains("profile folder")));
        let _ = fs::remove_dir_all(&base);
    }
}
