use serde::Serialize;
use std::process::Command;

#[derive(Clone, Serialize)]
pub struct ChatResponse {
    pub session_id: String,
    pub response: String,
}

/// Send a prompt to Hermes via CLI and return the response.
///
/// Uses `hermes chat -q "<text>" -Q` (quiet/programmatic mode).
/// If `session_id` is provided, resumes that session with `--resume`.
/// If `cwd` is provided, Hermes runs in that project directory.
#[tauri::command]
pub fn send_prompt(
    hermes_bin: String,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = if hermes_bin.trim().is_empty() {
        "hermes".to_string()
    } else {
        hermes_bin
    };

    if text.trim().is_empty() {
        return Err("Prompt text is empty".to_string());
    }

    let mut cmd = Command::new(&bin);
    cmd.args(["chat", "-q", &text, "-Q"]);

    if let Some(sid) = &session_id {
        if !sid.is_empty() {
            cmd.args(["--resume", sid]);
        }
    }

    // Run Hermes in the project directory so it sees the right files.
    if let Some(dir) = &cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|error| {
        format!("Failed to run hermes: {error}")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Sometimes useful info is in stdout even on failure.
        let detail = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(format!("hermes exited with {}: {}", output.status, detail));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_quiet_output(&stdout)
}

/// Parse the `-Q` (quiet mode) output format:
///
/// ```text
/// session_id: 20260610_042242_958bce
/// Hey there! What can I help you with?
/// ```
fn parse_quiet_output(raw: &str) -> Result<ChatResponse, String> {
    let mut session_id = String::new();
    let mut response_lines: Vec<&str> = Vec::new();
    let mut found_session = false;

    for line in raw.lines() {
        if !found_session {
            if let Some(id) = line.strip_prefix("session_id: ") {
                session_id = id.trim().to_string();
                found_session = true;
                continue;
            }
            // Skip blank lines before session_id.
            if line.trim().is_empty() {
                continue;
            }
        } else {
            response_lines.push(line);
        }
    }

    if session_id.is_empty() {
        // If we can't find a session_id line, treat all output as the response
        // and generate a placeholder ID. This handles edge cases like
        // --continue mode where output format may differ.
        return Ok(ChatResponse {
            session_id: String::new(),
            response: clean_output(raw),
        });
    }

    let response = clean_output(&response_lines.join("\n"));

    Ok(ChatResponse {
        session_id,
        response,
    })
}

/// Strip CLI noise from the response text:
/// - ANSI escape codes (colors, cursor movement)
/// - Leading/trailing whitespace
/// - Redundant blank lines
fn clean_output(raw: &str) -> String {
    let stripped = strip_ansi(raw);

    // Collapse 3+ consecutive blank lines into 2.
    let mut result = String::with_capacity(stripped.len());
    let mut blank_count = 0;

    for line in stripped.lines() {
        if line.trim().is_empty() {
            blank_count += 1;
            if blank_count <= 2 {
                result.push('\n');
            }
        } else {
            blank_count = 0;
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(line);
        }
    }

    result.trim().to_string()
}

/// Remove ANSI escape sequences (CSI, OSC, etc.) from text.
fn strip_ansi(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            // ESC sequence — consume until the terminator.
            match chars.peek() {
                Some('[') => {
                    // CSI sequence: ESC [ ... <letter>
                    chars.next();
                    while let Some(&next) = chars.peek() {
                        chars.next();
                        if next.is_ascii_alphabetic() || next == '~' {
                            break;
                        }
                    }
                }
                Some(']') => {
                    // OSC sequence: ESC ] ... ST (ESC \ or BEL)
                    chars.next();
                    while let Some(&next) = chars.peek() {
                        if next == '\x07' {
                            chars.next();
                            break;
                        }
                        if next == '\x1b' {
                            chars.next();
                            if chars.peek() == Some(&'\\') {
                                chars.next();
                            }
                            break;
                        }
                        chars.next();
                    }
                }
                _ => {
                    // Other ESC sequences (2-char): skip next char.
                    chars.next();
                }
            }
        } else {
            result.push(ch);
        }
    }

    result
}
