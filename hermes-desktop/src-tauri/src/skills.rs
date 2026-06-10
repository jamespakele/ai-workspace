use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Component, Path};

use zip::ZipArchive;

#[derive(serde::Serialize, Clone)]
pub struct SkillImportResult {
    pub name: String,
    pub trigger_phrases: Vec<String>,
}

#[tauri::command]
pub fn list_skills() -> Result<Vec<SkillImportResult>, String> {
    let home = dirs::home_dir().ok_or_else(|| "Cannot find home directory".to_string())?;
    let skills_dir = home.join(".hermes").join("skills");
    if !skills_dir.is_dir() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&skills_dir).map_err(|error| error.to_string())?;
    let mut skills = Vec::new();

    for entry in entries.filter_map(|entry| entry.ok()) {
        let skill_md = entry.path().join("SKILL.md");
        let Ok(content) = fs::read_to_string(&skill_md) else {
            continue;
        };

        if let Ok((name, trigger_phrases)) = parse_frontmatter(&content) {
            skills.push(SkillImportResult {
                name,
                trigger_phrases,
            });
        }
    }

    skills.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(skills)
}

#[tauri::command]
pub fn import_skill(path: String) -> Result<SkillImportResult, String> {
    let skill_md = read_skill_md(&path)?;
    let (name, trigger_phrases) = parse_frontmatter(&skill_md)?;

    let home = dirs::home_dir().ok_or_else(|| "Cannot find home directory".to_string())?;
    let skill_dir = home.join(".hermes").join("skills").join(&name);
    fs::create_dir_all(&skill_dir).map_err(|error| error.to_string())?;

    let file = File::open(&path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;

        if entry.name().contains("__MACOSX") {
            continue;
        }

        let entry_path = Path::new(entry.name());
        if entry_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        }) {
            return Err(format!("Zip-slip rejected: {}", entry.name()));
        }

        let destination = skill_dir.join(entry_path);

        if entry.is_dir() {
            fs::create_dir_all(&destination).map_err(|error| error.to_string())?;
            continue;
        }

        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let mut output = File::create(&destination).map_err(|error| error.to_string())?;
        io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }

    Ok(SkillImportResult {
        name,
        trigger_phrases,
    })
}

fn read_skill_md(path: &str) -> Result<String, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let entry_name = entry.name().to_ascii_lowercase();

        if entry_name == "skill.md" || entry_name.ends_with("/skill.md") {
            let mut content = String::new();
            entry
                .read_to_string(&mut content)
                .map_err(|error| error.to_string())?;
            return Ok(content);
        }
    }

    Err("No SKILL.md found in zip".to_string())
}

fn parse_frontmatter(content: &str) -> Result<(String, Vec<String>), String> {
    let mut lines = content.lines();

    for line in lines.by_ref() {
        if line.trim() == "---" {
            break;
        }
    }

    let mut frontmatter_lines = Vec::new();
    let mut found_closing = false;

    for line in lines {
        if line.trim() == "---" {
            found_closing = true;
            break;
        }

        frontmatter_lines.push(line);
    }

    if frontmatter_lines.is_empty() && !content.lines().any(|line| line.trim() == "---") {
        return Err("No frontmatter found in SKILL.md".to_string());
    }

    if !found_closing {
        return Err("Frontmatter not closed in SKILL.md".to_string());
    }

    let mut name = None;
    let mut trigger_phrases = Vec::new();
    let mut collecting_triggers = false;

    for line in frontmatter_lines {
        let trimmed = line.trim();

        if let Some(value) = trimmed.strip_prefix("name:") {
            let parsed = trim_yaml_scalar(value);
            if !parsed.is_empty() {
                name = Some(parsed.to_string());
            }
            collecting_triggers = false;
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("trigger_phrases:") {
            trigger_phrases = parse_inline_list(value);
            collecting_triggers = trigger_phrases.is_empty();
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("triggers:") {
            trigger_phrases = parse_inline_list(value);
            collecting_triggers = trigger_phrases.is_empty();
            continue;
        }

        if collecting_triggers {
            if let Some(item) = trimmed.strip_prefix("- ") {
                let parsed = trim_yaml_scalar(item);
                if !parsed.is_empty() {
                    trigger_phrases.push(parsed.to_string());
                }
                continue;
            }

            if !trimmed.is_empty() && !trimmed.starts_with('#') {
                collecting_triggers = false;
            }
        }
    }

    let name = name.ok_or_else(|| "'name:' field not found in SKILL.md frontmatter".to_string())?;

    Ok((name, trigger_phrases))
}

fn parse_inline_list(value: &str) -> Vec<String> {
    let trimmed = value.trim();

    if !trimmed.starts_with('[') || !trimmed.ends_with(']') {
        return Vec::new();
    }

    trimmed[1..trimmed.len() - 1]
        .split(',')
        .map(trim_yaml_scalar)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn trim_yaml_scalar(value: &str) -> &str {
    value.trim().trim_matches('"').trim_matches('\'')
}
