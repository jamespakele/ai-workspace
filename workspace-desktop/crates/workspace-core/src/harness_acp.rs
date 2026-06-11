//! ACP harness (STORY-0010): the standardized path for agents that speak
//! the Agent Client Protocol. Legacy flag-based harnesses remain as the
//! fallback for agents without ACP support (hermes, ollama, pi, aider, amp)
//! or when the ACP launch fails on this machine.

use crate::acp::PermissionPolicy;
use crate::acp_sessions::{prompt_via_acp, AcpError, LaunchProfile};
use crate::config::AppConfig;
use crate::harness::ChatResponse;

/// Where a prompt for this agent should go.
#[derive(Debug, PartialEq, Eq)]
pub enum Route {
    Acp(LaunchProfile),
    Legacy,
}

/// Decide the route for an agent given the current config.
pub fn route(agent: &str, config: &AppConfig, model: Option<&str>) -> Route {
    if !config.acp_enabled {
        return Route::Legacy;
    }
    match profile_for(agent, config, model) {
        Some(profile) => Route::Acp(profile),
        None => Route::Legacy,
    }
}

/// Build the ACP launch profile for an agent: a config override wins, then
/// the built-in defaults. Returns None for agents with no ACP support.
///
/// Default launch commands are best-effort for current releases and are
/// expected to be overridden via `acp_launch_overrides` where a machine
/// differs (see story-0010 Dev Notes).
pub fn profile_for(agent: &str, config: &AppConfig, model: Option<&str>) -> Option<LaunchProfile> {
    if let Some(override_cmd) = config.acp_launch_overrides.get(agent) {
        let mut parts = override_cmd.split_whitespace().map(ToOwned::to_owned);
        let command = parts.next()?;
        return Some(LaunchProfile {
            command,
            args: parts.collect(),
            env: Vec::new(),
        });
    }

    let model = model.filter(|m| !m.is_empty());
    match agent {
        // Zed's Claude Agent SDK adapter (npm: @zed-industries/claude-agent-acp).
        "claude" => Some(LaunchProfile {
            command: "claude-agent-acp".to_string(),
            args: Vec::new(),
            env: model
                .map(|m| vec![("ANTHROPIC_MODEL".to_string(), m.to_string())])
                .unwrap_or_default(),
        }),
        "gemini" => Some(LaunchProfile {
            command: "gemini".to_string(),
            args: {
                let mut args = vec!["--experimental-acp".to_string()];
                if let Some(m) = model {
                    args.push("-m".to_string());
                    args.push(m.to_string());
                }
                args
            },
            env: Vec::new(),
        }),
        // Zed's Codex adapter.
        "codex" => Some(LaunchProfile {
            command: "codex-acp".to_string(),
            args: Vec::new(),
            env: Vec::new(),
        }),
        "goose" => Some(LaunchProfile {
            command: "goose".to_string(),
            args: vec!["acp".to_string()],
            env: Vec::new(),
        }),
        // antigravity (agy) ACP support unconfirmed post Gemini-CLI cutover;
        // enable via acp_launch_overrides once verified. Everything else has
        // no ACP support.
        _ => None,
    }
}

/// Send a prompt over ACP. Errors keep the Unavailable/Failed split so the
/// dispatcher can fall back to the legacy harness only when the agent never
/// came up.
pub fn send(
    agent: &str,
    profile: &LaunchProfile,
    config: &AppConfig,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, AcpError> {
    let policy = if config.acp_auto_approve {
        PermissionPolicy::AllowAll
    } else {
        PermissionPolicy::RejectAll
    };

    let cwd = cwd
        .filter(|dir| !dir.is_empty())
        .or_else(|| {
            std::env::current_dir()
                .ok()
                .map(|dir| dir.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| "/".to_string());

    let session_id = session_id.filter(|sid| !sid.is_empty());

    let (sid, outcome) = prompt_via_acp(profile, policy, session_id.as_deref(), &cwd, &text)?;

    Ok(ChatResponse {
        session_id: sid,
        response: outcome.text,
        agent: agent.to_string(),
    })
}

/// Resolve an ACP attempt against the legacy fallback: only an Unavailable
/// error (agent never reachable over ACP) falls through; prompt-level
/// failures surface so they aren't silently retried against a different
/// harness with different semantics.
pub fn resolve_acp_result(
    acp: Result<ChatResponse, AcpError>,
    legacy: impl FnOnce() -> Result<ChatResponse, String>,
) -> Result<ChatResponse, String> {
    match acp {
        Ok(response) => Ok(response),
        Err(AcpError::Unavailable(_)) => legacy(),
        Err(AcpError::Failed(message)) => Err(message),
    }
}

// ── Tests ────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> AppConfig {
        AppConfig::default()
    }

    #[test]
    fn default_profiles_cover_acp_capable_agents() {
        let cfg = config();
        assert_eq!(
            profile_for("claude", &cfg, None).unwrap().command,
            "claude-agent-acp"
        );

        let gemini = profile_for("gemini", &cfg, Some("gemini-3-pro")).unwrap();
        assert_eq!(gemini.command, "gemini");
        assert!(gemini.args.contains(&"--experimental-acp".to_string()));
        assert!(gemini.args.contains(&"gemini-3-pro".to_string()));

        assert_eq!(profile_for("codex", &cfg, None).unwrap().command, "codex-acp");
        assert_eq!(
            profile_for("goose", &cfg, None).unwrap().args,
            vec!["acp".to_string()]
        );
    }

    #[test]
    fn claude_model_travels_via_env() {
        let profile = profile_for("claude", &config(), Some("claude-fable-5")).unwrap();
        assert!(profile
            .env
            .contains(&("ANTHROPIC_MODEL".to_string(), "claude-fable-5".to_string())));
    }

    #[test]
    fn agents_without_acp_support_get_no_profile() {
        let cfg = config();
        for agent in ["hermes", "ollama", "pi", "aider", "amp", "antigravity"] {
            assert!(profile_for(agent, &cfg, None).is_none(), "{agent}");
        }
    }

    #[test]
    fn override_wins_and_works_for_any_agent() {
        let mut cfg = config();
        cfg.acp_launch_overrides
            .insert("antigravity".to_string(), "agy --acp --foo".to_string());
        cfg.acp_launch_overrides
            .insert("claude".to_string(), "my-claude-acp --fast".to_string());

        let agy = profile_for("antigravity", &cfg, None).unwrap();
        assert_eq!(agy.command, "agy");
        assert_eq!(agy.args, vec!["--acp".to_string(), "--foo".to_string()]);

        let claude = profile_for("claude", &cfg, None).unwrap();
        assert_eq!(claude.command, "my-claude-acp");
    }

    #[test]
    fn routing_honors_the_acp_enabled_flag() {
        let mut cfg = config();
        assert!(matches!(route("claude", &cfg, None), Route::Acp(_)));
        assert_eq!(route("hermes", &cfg, None), Route::Legacy);

        cfg.acp_enabled = false;
        assert_eq!(route("claude", &cfg, None), Route::Legacy);
    }

    #[test]
    fn unavailable_falls_back_to_legacy_but_failed_surfaces() {
        let legacy_response = || {
            Ok(ChatResponse {
                session_id: "legacy".to_string(),
                response: "from legacy".to_string(),
                agent: "claude".to_string(),
            })
        };

        let fallen_back = resolve_acp_result(
            Err(AcpError::Unavailable("no binary".to_string())),
            legacy_response,
        )
        .unwrap();
        assert_eq!(fallen_back.response, "from legacy");

        let surfaced = resolve_acp_result(
            Err(AcpError::Failed("agent error on session/prompt: boom".to_string())),
            legacy_response,
        )
        .unwrap_err();
        assert!(surfaced.contains("boom"));

        let untouched = resolve_acp_result(
            Ok(ChatResponse {
                session_id: "acp".to_string(),
                response: "from acp".to_string(),
                agent: "claude".to_string(),
            }),
            || panic!("legacy must not run on ACP success"),
        )
        .unwrap();
        assert_eq!(untouched.response, "from acp");
    }

    #[test]
    fn send_round_trips_through_the_fixture_agent() {
        let fixture = format!(
            "{}/tests/fixtures/fake-acp-agent.sh",
            env!("CARGO_MANIFEST_DIR")
        );
        let mut cfg = config();
        cfg.acp_launch_overrides
            .insert("claude".to_string(), format!("sh {fixture}"));

        let profile = profile_for("claude", &cfg, None).unwrap();
        let response = send("claude", &profile, &cfg, "hi".to_string(), None, None)
            .expect("ACP send");

        assert_eq!(response.agent, "claude");
        assert_eq!(response.session_id, "fixture-session");
        assert_eq!(response.response, "hello from fixture");
    }
}
