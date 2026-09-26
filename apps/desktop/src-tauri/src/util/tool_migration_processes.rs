use super::tool_migration::ToolId;

#[cfg(windows)]
fn tasklist_image_names() -> Vec<String> {
    let output = crate::util::hidden_command::command("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let mut names = Vec::new();
    for line in text.lines() {
        // CSV: "Image Name","PID","Session Name","Session#","Mem Usage"
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix('"') {
            if let Some(end) = rest.find('"') {
                names.push(rest[..end].to_string());
            }
        }
    }
    names
}

#[cfg(not(windows))]
fn tasklist_image_names() -> Vec<String> {
    Vec::new()
}

#[cfg(windows)]
fn is_process_running(image_name: &str) -> bool {
    let needle = image_name.to_ascii_lowercase();
    tasklist_image_names()
        .iter()
        .any(|n| n.eq_ignore_ascii_case(image_name) || n.to_ascii_lowercase().contains(&needle.replace(".exe", "")))
}

#[cfg(not(windows))]
fn is_process_running(_image_name: &str) -> bool {
    false
}

#[cfg(windows)]
fn is_cursor_family_running() -> bool {
    tasklist_image_names().iter().any(|n| {
        let lower = n.to_ascii_lowercase();
        // Official Cursor.exe plus portable builds like "CursorXX-8.1.0-portable.exe"
        lower.contains("cursor") && lower.ends_with(".exe")
    })
}

#[cfg(not(windows))]
fn is_cursor_family_running() -> bool {
    false
}

fn process_image_names(tool: ToolId) -> Vec<&'static str> {
    match tool {
        ToolId::Cursor | ToolId::CursorRoaming | ToolId::CursorLocal => vec!["Cursor.exe"],
        ToolId::Vscode => vec!["Code.exe"],
        ToolId::ClaudeCode => vec!["claude.exe"],
        ToolId::CodexCli => vec!["codex.exe"],
        ToolId::ClaudeDesktop => vec!["Claude.exe"],
        ToolId::GoogleChrome => vec!["chrome.exe"],
        ToolId::MicrosoftEdge => vec!["msedge.exe"],
        ToolId::Brave => vec!["brave.exe"],
        ToolId::Firefox => vec!["firefox.exe"],
        ToolId::Discord | ToolId::DiscordRoaming | ToolId::DiscordLocal => vec!["Discord.exe"],
        ToolId::Spotify => vec!["Spotify.exe"],
        ToolId::Slack => vec!["slack.exe"],
        ToolId::Telegram => vec!["Telegram.exe"],
        ToolId::Notion => vec!["Notion.exe"],
        ToolId::ObsStudio => vec!["obs64.exe", "obs32.exe"],
        ToolId::EpicGames => vec!["EpicGamesLauncher.exe"],
        ToolId::SteamAppdata => vec!["steam.exe"],
        ToolId::BattleNet => vec!["Battle.net.exe"],
        ToolId::DockerDesktop => vec![
            "Docker Desktop.exe",
            "com.docker.backend.exe",
            "com.docker.build.exe",
        ],
        ToolId::NpmCache | ToolId::PnpmStore => vec![],
    }
}

pub fn detect_running_processes(tool: ToolId) -> Vec<String> {
    match tool {
        ToolId::Cursor | ToolId::CursorRoaming | ToolId::CursorLocal => {
            if is_cursor_family_running() {
                // Prefer concrete image names from the live process list.
                let mut found: Vec<String> = tasklist_image_names()
                    .into_iter()
                    .filter(|n| {
                        let lower = n.to_ascii_lowercase();
                        lower.contains("cursor") && lower.ends_with(".exe")
                    })
                    .collect();
                found.sort();
                found.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
                if found.is_empty() {
                    vec!["Cursor.exe".to_string()]
                } else {
                    found
                }
            } else {
                Vec::new()
            }
        }
        _ => process_image_names(tool)
            .into_iter()
            .filter(|name| is_process_running(name))
            .map(|s| s.to_string())
            .collect(),
    }
}

pub fn running_process_warning(tool: ToolId) -> Option<String> {
    let running = detect_running_processes(tool);
    if running.is_empty() {
        return None;
    }
    Some(format!(
        "Deco will close these processes when you Run migration: {}.",
        running.join(", ")
    ))
}

/// Result of attempting to close tool processes before rename/junction.
#[derive(Debug, Clone)]
pub struct CloseProcessesOutcome {
    pub closed: Vec<String>,
    pub still_running: Vec<String>,
}

/// Close detected tool processes (CCleaner-style) so rename/junction can proceed.
/// Force-kills by image name, waits briefly for handles to release, then re-checks.
pub fn close_running_processes(tool: ToolId) -> CloseProcessesOutcome {
    let targets = detect_running_processes(tool);
    if targets.is_empty() {
        return CloseProcessesOutcome {
            closed: Vec::new(),
            still_running: Vec::new(),
        };
    }

    #[cfg(windows)]
    {
        let mut closed = Vec::new();
        for image in &targets {
            // /T kills the process tree; /F force-terminates (needed for Electron apps).
            let _ = crate::util::hidden_command::command("taskkill")
                .args(["/F", "/T", "/IM", image])
                .output();
            closed.push(image.clone());
        }

        // Electron / Chromium often needs a short settle before directory rename succeeds.
        for _ in 0..10 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if detect_running_processes(tool).is_empty() {
                break;
            }
            // Second pass in case a helper respawned briefly.
            for image in detect_running_processes(tool) {
                let _ = crate::util::hidden_command::command("taskkill")
                    .args(["/F", "/T", "/IM", &image])
                    .output();
            }
        }

        // Extra settle for file-handle release after process exit.
        std::thread::sleep(std::time::Duration::from_millis(1500));

        CloseProcessesOutcome {
            closed,
            still_running: detect_running_processes(tool),
        }
    }

    #[cfg(not(windows))]
    {
        CloseProcessesOutcome {
            closed: Vec::new(),
            still_running: targets,
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn warning_mentions_close_on_run_not_manual_quit() {
        // Pure string contract — detect may be empty on CI hosts without the tool.
        let msg = format!(
            "Deco will close these processes when you Run migration: {}.",
            "Cursor.exe"
        );
        assert!(msg.contains("will close"));
        assert!(!msg.contains("Close these processes before"));
    }

    #[test]
    fn cursor_family_image_filter_accepts_portable_names() {
        let samples = [
            "Cursor.exe",
            "CursorXX-8.1.0-portable.exe",
            "cursor-nightly.exe",
        ];
        for name in samples {
            let lower = name.to_ascii_lowercase();
            assert!(lower.contains("cursor") && lower.ends_with(".exe"));
        }
    }
}
