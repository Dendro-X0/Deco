use super::tool_migration::ToolId;

#[cfg(windows)]
fn is_process_running(image_name: &str) -> bool {
    use std::process::Command;
    let output = Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {image_name}"), "/NH"])
        .output();
    let Ok(output) = output else {
        return false;
    };
    let text = String::from_utf8_lossy(&output.stdout);
    if text.contains("INFO: No tasks are running") {
        return false;
    }
    text.to_ascii_lowercase().contains(&image_name.to_ascii_lowercase())
}

#[cfg(not(windows))]
fn is_process_running(_image_name: &str) -> bool {
    false
}

fn process_image_names(tool: ToolId) -> Vec<&'static str> {
    match tool {
        ToolId::Cursor | ToolId::CursorRoaming | ToolId::CursorLocal => {
            vec!["Cursor.exe"]
        }
        ToolId::Vscode => vec!["Code.exe"],
        ToolId::ClaudeCode => vec!["claude.exe"],
        ToolId::CodexCli => vec!["codex.exe"],
        ToolId::ClaudeDesktop => vec!["Claude.exe"],
        ToolId::DockerDesktop => vec![
            "Docker Desktop.exe",
            "com.docker.backend.exe",
            "com.docker.build.exe",
        ],
        ToolId::NpmCache | ToolId::PnpmStore => vec![],
    }
}

pub fn detect_running_processes(tool: ToolId) -> Vec<String> {
    process_image_names(tool)
        .into_iter()
        .filter(|name| is_process_running(name))
        .map(|s| s.to_string())
        .collect()
}

pub fn running_process_warning(tool: ToolId) -> Option<String> {
    let running = detect_running_processes(tool);
    if running.is_empty() {
        return None;
    }
    Some(format!(
        "Close these processes before Run migration: {} (check Task Manager and the tray icon).",
        running.join(", ")
    ))
}
