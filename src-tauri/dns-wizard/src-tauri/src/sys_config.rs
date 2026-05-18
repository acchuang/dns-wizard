use std::process::Command;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct ConfigResult {
    pub success: bool,
    pub message: String,
}

pub fn set_dns_macos(primary: &str, secondary: &str) -> ConfigResult {
    // On macOS, we typically use 'networksetup'
    // Note: This usually requires sudo/admin privileges
    let service = "Wi-Fi"; 
    
    let status = Command::new("networksetup")
        .args(["-setdnsservers", service, primary, secondary])
        .status();

    match status {
        Ok(s) if s.success() => ConfigResult {
            success: true,
            message: format!("DNS successfully updated to {} and {}", primary, secondary),
        },
        _ => ConfigResult {
            success: false,
            message: "Failed to update DNS. Please run the app as administrator.".to_string(),
        },
    }
}

pub fn set_dns_windows(primary: &str, secondary: &str) -> ConfigResult {
    // On Windows, we use netsh
    let cmd = format!(
        "netsh interface ip set dns name=\"Wi-Fi\" static {} primary", 
        primary
    );
    
    let status = Command::new("cmd")
        .args(["/C", &cmd])
        .status();

    match status {
        Ok(s) if s.success() => ConfigResult {
            success: true,
            message: format!("DNS successfully updated to {}", primary),
        },
        _ => ConfigResult {
            success: false,
            message: "Failed to update DNS. Please run the app as administrator.".to_string(),
        },
    }
}
