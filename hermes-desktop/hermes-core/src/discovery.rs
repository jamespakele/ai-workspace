//! Discovery of Hermes installs and running gateways: parsing for `which -a`
//! and `docker ps` output, and the usual filesystem install locations.

use std::path::{Path, PathBuf};

/// Default port the Hermes TUI gateway listens on.
pub const DEFAULT_GATEWAY_PORT: u16 = 8765;

/// Filesystem locations where a `hermes` binary is conventionally installed.
pub fn candidate_binary_paths(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".local/bin/hermes"),
        home.join(".cargo/bin/hermes"),
        home.join("bin/hermes"),
        PathBuf::from("/usr/local/bin/hermes"),
        PathBuf::from("/usr/bin/hermes"),
        PathBuf::from("/opt/hermes/bin/hermes"),
    ]
}

/// Parse `which -a hermes` output into a deduplicated path list.
pub fn parse_which_output(output: &str) -> Vec<String> {
    let mut paths = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.starts_with('/') {
            continue;
        }

        if !paths.iter().any(|existing| existing == trimmed) {
            paths.push(trimmed.to_string());
        }
    }

    paths
}

/// Merge binary paths, keeping first occurrence order.
pub fn dedupe_paths(paths: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for path in paths {
        if !out.iter().any(|existing| *existing == path) {
            out.push(path);
        }
    }
    out
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct DockerGateway {
    pub container_id: String,
    pub name: String,
    pub image: String,
    pub host_port: u16,
}

/// Parse `docker ps --format '{{json .}}'` output (one JSON object per line)
/// into Hermes-looking containers with a published gateway port. A container
/// qualifies when its name or image mentions "hermes". The published port
/// mapping to the default gateway port wins; otherwise the first published
/// TCP port is used. Containers without published ports are skipped.
pub fn parse_docker_ps(output: &str) -> Vec<DockerGateway> {
    let mut gateways = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) else {
            continue;
        };

        let name = value["Names"].as_str().unwrap_or_default().to_string();
        let image = value["Image"].as_str().unwrap_or_default().to_string();

        let haystack = format!("{name} {image}").to_lowercase();
        if !haystack.contains("hermes") {
            continue;
        }

        let ports = value["Ports"].as_str().unwrap_or_default();
        let Some(host_port) = pick_host_port(ports) else {
            continue;
        };

        let container_id = value["ID"].as_str().unwrap_or_default().to_string();
        if gateways
            .iter()
            .any(|existing: &DockerGateway| existing.container_id == container_id)
        {
            continue;
        }

        gateways.push(DockerGateway {
            container_id,
            name,
            image,
            host_port,
        });
    }

    gateways
}

/// Pick the host port from a docker `Ports` string such as
/// `0.0.0.0:8765->8765/tcp, [::]:8765->8765/tcp`.
fn pick_host_port(ports: &str) -> Option<u16> {
    let mut first_tcp: Option<u16> = None;

    for segment in ports.split(',') {
        let segment = segment.trim();
        let Some((host_side, container_side)) = segment.split_once("->") else {
            continue; // unpublished, e.g. "8765/tcp"
        };

        if !container_side.ends_with("/tcp") {
            continue;
        }

        let host_port: u16 = match host_side.rsplit(':').next().and_then(|p| p.parse().ok()) {
            Some(port) => port,
            None => continue,
        };

        let container_port: Option<u16> = container_side
            .trim_end_matches("/tcp")
            .parse()
            .ok();

        if container_port == Some(DEFAULT_GATEWAY_PORT) {
            return Some(host_port);
        }

        first_tcp.get_or_insert(host_port);
    }

    first_tcp
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidate_paths_cover_usual_locations() {
        let paths = candidate_binary_paths(Path::new("/home/u"));
        let rendered: Vec<String> = paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect();

        assert!(rendered.contains(&"/home/u/.local/bin/hermes".to_string()));
        assert!(rendered.contains(&"/home/u/.cargo/bin/hermes".to_string()));
        assert!(rendered.contains(&"/usr/local/bin/hermes".to_string()));
        assert!(rendered.contains(&"/opt/hermes/bin/hermes".to_string()));
    }

    #[test]
    fn which_output_parses_and_dedupes() {
        let output = "/usr/local/bin/hermes\n/home/u/.local/bin/hermes\n/usr/local/bin/hermes\n";
        assert_eq!(
            parse_which_output(output),
            vec![
                "/usr/local/bin/hermes".to_string(),
                "/home/u/.local/bin/hermes".to_string(),
            ],
        );
    }

    #[test]
    fn which_output_ignores_noise() {
        assert!(parse_which_output("hermes not found\n\n").is_empty());
    }

    #[test]
    fn dedupe_keeps_first_occurrence_order() {
        let deduped = dedupe_paths(vec![
            "/a/hermes".to_string(),
            "/b/hermes".to_string(),
            "/a/hermes".to_string(),
        ]);
        assert_eq!(deduped, vec!["/a/hermes", "/b/hermes"]);
    }

    #[test]
    fn docker_ps_finds_hermes_containers_with_default_port() {
        let output = concat!(
            r#"{"ID":"abc123","Names":"hermes-agent","Image":"nous/hermes:latest","Ports":"0.0.0.0:8765->8765/tcp, [::]:8765->8765/tcp"}"#,
            "\n",
            r#"{"ID":"zzz","Names":"postgres","Image":"postgres:16","Ports":"0.0.0.0:5432->5432/tcp"}"#,
        );

        let gateways = parse_docker_ps(output);
        assert_eq!(gateways.len(), 1);
        assert_eq!(gateways[0].name, "hermes-agent");
        assert_eq!(gateways[0].host_port, 8765);
    }

    #[test]
    fn docker_ps_matches_on_image_and_remapped_port() {
        let output = r#"{"ID":"def","Names":"testbox","Image":"hermes-test:dev","Ports":"0.0.0.0:32768->8765/tcp"}"#;

        let gateways = parse_docker_ps(output);
        assert_eq!(gateways.len(), 1);
        assert_eq!(gateways[0].host_port, 32768);
    }

    #[test]
    fn docker_ps_prefers_gateway_port_over_other_mappings() {
        let output = r#"{"ID":"ghi","Names":"hermes-multi","Image":"hermes:dev","Ports":"0.0.0.0:9000->9000/tcp, 0.0.0.0:8800->8765/tcp"}"#;

        let gateways = parse_docker_ps(output);
        assert_eq!(gateways[0].host_port, 8800);
    }

    #[test]
    fn docker_ps_falls_back_to_first_published_tcp_port() {
        let output = r#"{"ID":"jkl","Names":"hermes-alt","Image":"hermes:dev","Ports":"0.0.0.0:9100->9100/tcp"}"#;

        let gateways = parse_docker_ps(output);
        assert_eq!(gateways[0].host_port, 9100);
    }

    #[test]
    fn docker_ps_skips_unpublished_and_malformed_lines() {
        let output = concat!(
            r#"{"ID":"mno","Names":"hermes-internal","Image":"hermes:dev","Ports":"8765/tcp"}"#,
            "\n",
            "not-json at all\n",
        );

        assert!(parse_docker_ps(output).is_empty());
    }

    #[test]
    fn docker_ps_dedupes_by_container_id() {
        let line = r#"{"ID":"abc","Names":"hermes-a","Image":"hermes:dev","Ports":"0.0.0.0:8765->8765/tcp"}"#;
        let output = format!("{line}\n{line}\n");

        assert_eq!(parse_docker_ps(&output).len(), 1);
    }
}
