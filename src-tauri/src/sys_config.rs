use std::process::Command;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConfigResult {
    pub success: bool,
    pub message: String,
}

pub fn detect_network_service() -> Result<String, String> {
    let output = Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output()
        .map_err(|e| format!("Failed to run networksetup: {}", e))?;

    if !output.status.success() {
        return Err("networksetup command failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let service = stdout
        .lines()
        .next()
        .ok_or_else(|| "No network services found".to_string())?
        .trim()
        .to_string();

    if service.is_empty() {
        return Err("No network services found".to_string());
    }

    Ok(service)
}

pub fn set_dns_macos(service: &str, primary: &str, secondary: &str) -> ConfigResult {
    let args = if secondary.is_empty() {
        vec!["-setdnsservers", service, primary]
    } else {
        vec!["-setdnsservers", service, primary, secondary]
    };

    let status = Command::new("networksetup")
        .args(&args)
        .status();

    match status {
        Ok(s) if s.success() => ConfigResult {
            success: true,
            message: format!("DNS updated to {} and {}", primary, secondary),
        },
        _ => ConfigResult {
            success: false,
            message: "Admin privileges required to update DNS settings.".to_string(),
        },
    }
}

pub fn restore_dns_macos(service: &str) -> ConfigResult {
    let status = Command::new("networksetup")
        .args(["-setdnsservers", service, "empty"])
        .status();

    match status {
        Ok(s) if s.success() => ConfigResult {
            success: true,
            message: "DNS restored to automatic (DHCP)".to_string(),
        },
        _ => ConfigResult {
            success: false,
            message: "Admin privileges required to restore DNS settings.".to_string(),
        },
    }
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
