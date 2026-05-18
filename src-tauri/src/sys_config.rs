use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConfigResult {
    pub success: bool,
    pub message: String,
}

pub fn detect_network_service() -> Result<String, String> {
    let output = std::process::Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output()
        .map_err(|e| format!("Failed to run networksetup: {}", e))?;

    if !output.status.success() {
        return Err("networksetup command failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let service = stdout
        .lines()
        .skip(1)
        .find(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && !trimmed.starts_with('*')
        })
        .ok_or_else(|| "No enabled network services found".to_string())?
        .trim()
        .to_string();

    Ok(service)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_result_success() {
        let result = ConfigResult {
            success: true,
            message: "ok".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":true"));
    }

    #[test]
    fn test_config_result_failure() {
        let result = ConfigResult {
            success: false,
            message: "error occurred".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":false"));
        assert!(json.contains("error occurred"));
    }
}
