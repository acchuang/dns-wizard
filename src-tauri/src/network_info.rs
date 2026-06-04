use serde::{Serialize, Deserialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfoResult {
    pub public_ip: String,
    pub isp: String,
    pub city: String,
    pub country: String,
    pub interface_name: String,
    pub connection_type: String,
    pub mac_address: String,
    pub local_ip: String,
    pub gateway: String,
    pub dns_servers: Vec<String>,
    pub dhcp_mode: String,
}

async fn fetch_public_ip() -> Result<(String, String, String, String), String> {
    let client = reqwest::Client::builder()
        .user_agent("DNSWizard/1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let ip = client.get("https://api.ipify.org")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch IP: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read IP response: {}", e))?
        .trim()
        .to_string();

    let response = client.get("https://ipinfo.io/")
        .query(&[("token", "demo")])
        .send()
        .await;

    let (isp, city, country) = match response {
        Ok(resp) => {
            let body = resp.text().await.unwrap_or_default();
            let v: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
            (
                v["org"].as_str().unwrap_or("Unknown").to_string(),
                v["city"].as_str().unwrap_or("").to_string(),
                v["country"].as_str().unwrap_or("").to_string(),
            )
        }
        Err(_) => ("Unknown".to_string(), String::new(), String::new()),
    };

    Ok((ip, isp, city, country))
}

#[tauri::command]
pub async fn run_network_info() -> Result<NetworkInfoResult, String> {
    let (public_ip, isp, city, country) = fetch_public_ip().await.unwrap_or_default();

    let interface_name = get_output("networksetup", &["-listallhardwareports"])
        .and_then(|output| {
            let mut device = "en0".to_string();
            let mut found_wifi = false;
            for line in output.lines() {
                if line.contains("Wi-Fi") || line.contains("AirPort") {
                    found_wifi = true;
                }
                if found_wifi && line.starts_with("Device:") {
                    device = line.split(':').nth(1).unwrap_or(" en0").trim().to_string();
                    break;
                }
            }
            Some(device)
        })
        .unwrap_or_else(|| "en0".to_string());

    let iface = if interface_name.is_empty() { "en0".to_string() } else { interface_name };

    let local_ip = get_output("ipconfig", &["getifaddr", &iface]).unwrap_or_default();
    let gateway = get_output("route", &["-n", "get", "default"])
        .and_then(|out| {
            for line in out.lines() {
                if line.contains("gateway") {
                    return line.split(':').nth(1).map(|s| s.trim().to_string());
                }
            }
            None
        })
        .unwrap_or_default();

    let mac_address = get_output("networksetup", &["-getmacaddress", &iface])
        .map(|s| {
            let trimmed = s.trim();
            trimmed.split(' ').next().unwrap_or("").trim().to_string()
        })
        .unwrap_or_default();

    let dns_output = get_output("networksetup", &["-getdnsservers", &iface]).unwrap_or_default();
    let dns_servers: Vec<String> = dns_output
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && !l.contains("aren't any DNS servers"))
        .collect();

    let dhcp_mode = get_output("networksetup", &["-getinfo", &iface])
        .map(|out| {
            if out.contains(" manual") || out.contains("Manual") {
                "Manual"
            } else if out.contains(" dhcp") || out.contains("DHCP") {
                "DHCP"
            } else {
                "Unknown"
            }.to_string()
        })
        .unwrap_or_else(|| "Unknown".to_string());

    let connection_type = if iface.starts_with("en") { "Wi-Fi/Ethernet" } else { "Unknown" };

    Ok(NetworkInfoResult {
        public_ip,
        isp,
        city,
        country,
        interface_name: iface,
        connection_type: connection_type.to_string(),
        mac_address,
        local_ip,
        gateway,
        dns_servers,
        dhcp_mode,
    })
}

fn get_output(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd).args(args).output().ok().and_then(|o| {
        if o.status.success() {
            Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
        } else {
            None
        }
    })
}