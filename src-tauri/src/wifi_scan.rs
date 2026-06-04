use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};

static WIFI_CANCEL: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn cancel_wifi_scan() {
    WIFI_CANCEL.store(true, Ordering::SeqCst);
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WifiNetwork {
    pub ssid: String,
    pub bssid: String,
    pub rssi: i32,
    pub security: String,
    pub channel: u32,
    pub band: String,
    pub is_current: bool,
}

#[tauri::command]
pub async fn run_wifi_scan() -> Result<Vec<WifiNetwork>, String> {
    if cfg!(not(target_os = "macos")) {
        return Err("Wi-Fi scanning is only available on macOS".to_string());
    }

    if WIFI_CANCEL.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err("Wi-Fi scan already running".to_string());
    }

    let current_network_output = std::process::Command::new("networksetup")
        .args(["-getairportnetwork", "en0"])
        .output()
        .ok();
    let current_ssid = current_network_output
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).to_string();
            s.strip_prefix("Current Wi-Fi Network: ")
                .or_else(|| s.strip_prefix("Current Network: "))
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_default();

    let airport_output = std::process::Command::new("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport")
        .arg("-s")
        .output();

    let networks = match airport_output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            parse_airport_output(&stdout, &current_ssid)
        }
        _ => {
            let profiler_output = std::process::Command::new("/usr/sbin/system_profiler")
                .args(["SPAirPortDataType", "-xml"])
                .output();
            match profiler_output {
                Ok(o) if o.status.success() => {
                    let xml = String::from_utf8_lossy(&o.stdout);
                    parse_profiler_output(&xml, &current_ssid)
                }
                _ => Vec::new(),
            }
        }
    };

    WIFI_CANCEL.store(false, Ordering::SeqCst);
    Ok(networks)
}

fn parse_airport_output(output: &str, current_ssid: &str) -> Vec<WifiNetwork> {
    let mut networks = Vec::new();
    for line in output.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let ssid = trimmed.get(..32).unwrap_or("").trim().to_string();
        let rest = trimmed.get(32..).unwrap_or("").trim();
        let parts: Vec<&str> = rest.split_whitespace().collect();

        if parts.len() < 3 || ssid.is_empty() {
            continue;
        }

        let bssid = parts.get(0).unwrap_or(&"").to_string();
        let rssi: i32 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(-100);
        let channel: u32 = parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
        let band = if channel > 14 { "5 GHz".to_string() } else { "2.4 GHz".to_string() };
        let security = parts.get(3..).map(|s| s.join(" ")).unwrap_or_default();
        let is_current = ssid == current_ssid;

        networks.push(WifiNetwork {
            ssid,
            bssid,
            rssi,
            security,
            channel,
            band,
            is_current,
        });
    }
    networks.sort_by(|a, b| b.rssi.cmp(&a.rssi));
    networks
}

fn parse_profiler_output(_xml: &str, _current_ssid: &str) -> Vec<WifiNetwork> {
    Vec::new()
}