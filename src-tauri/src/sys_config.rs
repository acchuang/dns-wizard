use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConfigResult {
    pub success: bool,
    pub message: String,
}

pub fn detect_network_service() -> Result<String, String> {
    let route_output = std::process::Command::new("route")
        .args(["-n", "get", "default"])
        .output()
        .map_err(|e| format!("Failed to run route: {}", e))?;

    if !route_output.status.success() {
        return Err("Could not determine default route".to_string());
    }

    let route_stdout = String::from_utf8_lossy(&route_output.stdout);
    let interface = route_stdout
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("interface:") {
                Some(trimmed.strip_prefix("interface:").unwrap_or(trimmed).trim().to_string())
            } else {
                None
            }
        })
        .ok_or_else(|| "Could not find interface in route output".to_string())?;

    if interface.is_empty() {
        return Err("Empty interface from route output".to_string());
    }

    let list_output = std::process::Command::new("networksetup")
        .args(["-listallhardwareports"])
        .output()
        .map_err(|e| format!("Failed to run networksetup: {}", e))?;

    if !list_output.status.success() {
        return Err("networksetup command failed".to_string());
    }

    let list_stdout = String::from_utf8_lossy(&list_output.stdout);

    let mut current_port: Option<String> = None;
    let mut current_device: Option<String> = None;

    for line in list_stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Hardware Port:") {
            current_port = Some(trimmed.strip_prefix("Hardware Port:").unwrap_or(trimmed).trim().to_string());
            current_device = None;
        } else if trimmed.starts_with("Device:") {
            current_device = Some(trimmed.strip_prefix("Device:").unwrap_or(trimmed).trim().to_string());
        }

        if let (Some(port), Some(dev)) = (&current_port, &current_device) {
            if dev == &interface {
                return Ok(port.clone());
            }
        }
    }

    Err(format!("Could not find network service for interface {}", interface))
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