use super::types::{RiskLevel, SafetyClass};

#[derive(Debug, Clone)]
pub struct PathPolicy {
    extra_protected: Vec<String>,
    allow_patterns: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PathMatch {
    pub risk: RiskLevel,
    pub safety_class: SafetyClass,
    pub reason_codes: Vec<String>,
}

const SYSTEM_PATTERNS: &[&str] = &[
    "/windows/",
    "/system32/",
    "/program files/",
    "/program files (x86)/",
    "/appdata/",
    "/$recycle.bin/",
    "/system volume information/",
    "/config.msi/",
];

const APP_RUNTIME_PATTERNS: &[(&str, &str)] = &[
    ("/resources/app/", "ELECTRON_RUNTIME_PATH"),
    ("/resources/app.asar/", "ELECTRON_RUNTIME_PATH"),
    ("/.vscode/", "IDE_RUNTIME_PATH"),
    ("/.vscode-insiders/", "IDE_RUNTIME_PATH"),
    ("/.cursor/", "IDE_RUNTIME_PATH"),
    ("/cursor/", "IDE_RUNTIME_PATH"),
];

fn normalize_path(value: &str) -> String {
    let mut normalized = value.replace('\\', "/").to_lowercase();
    if !normalized.ends_with('/') {
        normalized.push('/');
    }
    normalized
}

fn normalize_pattern(value: &str) -> String {
    let mut normalized = value.replace('\\', "/").to_lowercase();
    if !normalized.starts_with('/') {
        normalized.insert(0, '/');
    }
    if !normalized.ends_with('/') {
        normalized.push('/');
    }
    normalized
}

impl PathPolicy {
    pub fn new(extra_protected: Vec<String>, allow_patterns: Vec<String>) -> Self {
        Self {
            extra_protected: extra_protected
                .iter()
                .map(|item| normalize_pattern(item))
                .collect(),
            allow_patterns: allow_patterns
                .iter()
                .map(|item| normalize_pattern(item))
                .collect(),
        }
    }

    pub fn should_prune(&self, abs_path: &str) -> bool {
        self.find_match(abs_path)
            .map(|m| m.risk == RiskLevel::Blocked)
            .unwrap_or(false)
    }

    pub fn find_match(&self, abs_path: &str) -> Option<PathMatch> {
        let normalized = normalize_path(abs_path);

        for pattern in SYSTEM_PATTERNS {
            if normalized.contains(pattern) {
                return Some(PathMatch {
                    risk: RiskLevel::Blocked,
                    safety_class: SafetyClass::System,
                    reason_codes: vec!["PROTECTED_SYSTEM_PATH".to_string()],
                });
            }
        }

        for (pattern, reason) in APP_RUNTIME_PATTERNS {
            if normalized.contains(pattern) {
                let mut reasons = vec![reason.to_string()];
                let downgraded = self.is_allowlisted(&normalized);
                if downgraded {
                    reasons.push("ALLOWLIST_DOWNGRADE".to_string());
                }
                return Some(PathMatch {
                    risk: if downgraded {
                        RiskLevel::Review
                    } else {
                        RiskLevel::Blocked
                    },
                    safety_class: SafetyClass::AppRuntime,
                    reason_codes: reasons,
                });
            }
        }

        for pattern in &self.extra_protected {
            if normalized.contains(pattern) {
                let mut reasons = vec!["CUSTOM_PROTECTED_PATH".to_string()];
                let downgraded = self.is_allowlisted(&normalized);
                if downgraded {
                    reasons.push("ALLOWLIST_DOWNGRADE".to_string());
                }
                return Some(PathMatch {
                    risk: if downgraded {
                        RiskLevel::Review
                    } else {
                        RiskLevel::Blocked
                    },
                    safety_class: SafetyClass::AppRuntime,
                    reason_codes: reasons,
                });
            }
        }

        None
    }

    fn is_allowlisted(&self, normalized_path: &str) -> bool {
        self.allow_patterns
            .iter()
            .any(|pattern| normalized_path.contains(pattern))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_system_paths() {
        let policy = PathPolicy::new(vec![], vec![]);
        let m = policy
            .find_match("C:\\Program Files\\Cursor\\resources\\app\\node_modules")
            .expect("expected match");
        assert_eq!(m.risk, RiskLevel::Blocked);
        assert_eq!(m.safety_class, SafetyClass::System);
        assert!(m
            .reason_codes
            .contains(&"PROTECTED_SYSTEM_PATH".to_string()));
    }

    #[test]
    fn blocks_electron_runtime_paths() {
        let policy = PathPolicy::new(vec![], vec![]);
        let m = policy
            .find_match("E:\\Apps\\Cursor\\resources\\app\\node_modules")
            .expect("expected match");
        assert_eq!(m.risk, RiskLevel::Blocked);
        assert_eq!(m.safety_class, SafetyClass::AppRuntime);
        assert!(m
            .reason_codes
            .contains(&"ELECTRON_RUNTIME_PATH".to_string()));
    }

    #[test]
    fn downgrades_custom_pattern_when_allowlisted() {
        let policy = PathPolicy::new(
            vec!["/custom/runtime/".to_string()],
            vec!["/custom/runtime/dev/".to_string()],
        );
        let m = policy
            .find_match("E:/custom/runtime/dev/node_modules")
            .expect("expected match");
        assert_eq!(m.risk, RiskLevel::Review);
        assert!(m.reason_codes.contains(&"ALLOWLIST_DOWNGRADE".to_string()));
    }
}
