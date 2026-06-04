mod dns_bench;
mod ping;
mod profiles;
mod speed_test;
mod sys_config;
mod dns_leak;
mod latency_test;
mod validate;
mod ip_norm;

use dns_bench::{benchmark_dns, DnsProvider};
use ping::{PingResult, HopResult};
use profiles::{get_profile_providers, get_all_providers, UserProfile};
use sys_config::{detect_network_service, ConfigResult, NetworkInfo};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QuickFixResult {
    pub provider_name: String,
    pub provider_ip: String,
    pub latency_ms: u128,
    pub profile: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublicIpInfo {
    pub ip: String,
    pub isp: String,
    pub city: String,
    pub country: String,
}

#[tauri::command]
async fn run_benchmark(profile: String) -> Result<Vec<DnsProvider>, String> {
    let profile_enum = match profile.as_str() {
        "Gamer" => UserProfile::Gamer,
        "Family" => UserProfile::Family,
        "Privacy" => UserProfile::Privacy,
        "AdBlock" => UserProfile::AdBlock,
        "ControlD" => UserProfile::ControlD,
        "OpenDNS" => UserProfile::OpenDNS,
        "Comodo" => UserProfile::Comodo,
        _ => UserProfile::Balanced,
    };

    let providers = get_profile_providers(profile_enum);
    let results = benchmark_dns(providers).await;
    Ok(results)
}

#[tauri::command]
async fn fix_my_internet() -> Result<QuickFixResult, String> {
    let providers = get_all_providers();
    let results = benchmark_dns(providers).await;
    let best = results.iter()
        .filter(|r| r.latency.is_some() && r.latency.unwrap() < 99999)
        .min_by_key(|r| r.latency.unwrap());
    match best {
        Some(provider) => Ok(QuickFixResult {
            provider_name: provider.name.clone(),
            provider_ip: provider.ip.clone(),
            latency_ms: provider.latency.unwrap(),
            profile: String::new(),
        }),
        None => Err("No DNS servers responded. Check your internet connection.".to_string()),
    }
}

#[tauri::command]
async fn execute_admin_apply(
    app: tauri::AppHandle<tauri::Wry>,
    primary: String,
    secondary: String,
) -> Result<ConfigResult, String> {
    use tauri_plugin_shell::ShellExt;

    let service = detect_network_service().map_err(|e| e)?;

    let dns_args = if secondary.is_empty() {
        format!("-setdnsservers {} {}", shell_escape(&service), shell_escape(&primary))
    } else {
        format!(
            "-setdnsservers {} {} {}",
            shell_escape(&service),
            shell_escape(&primary),
            shell_escape(&secondary)
        )
    };

    let script = format!(
        "do shell script \"networksetup {}\" with administrator privileges",
        dns_args
    );

    let output = app
        .shell()
        .command("osascript")
        .args(["-e", &script])
        .output()
        .await
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if output.status.success() {
        let msg = if secondary.is_empty() {
            format!("DNS updated to {} (service: {})", primary, service)
        } else {
            format!("DNS updated to {} (primary) and {} (secondary) on {}", primary, secondary, service)
        };
        Ok(ConfigResult {
            success: true,
            message: msg,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(ConfigResult {
            success: false,
            message: if stderr.contains("User canceled") || stderr.contains("-128") {
                "Authorization cancelled.".to_string()
            } else {
                format!("Failed to apply DNS on '{}': {}", service, stderr.trim())
            },
        })
    }
}

#[tauri::command]
async fn execute_admin_restore(
    app: tauri::AppHandle<tauri::Wry>,
) -> Result<ConfigResult, String> {
    use tauri_plugin_shell::ShellExt;

    let service = detect_network_service().map_err(|e| e)?;
    let script = format!(
        "do shell script \"networksetup -setdnsservers {} empty\" with administrator privileges",
        shell_escape(&service)
    );

    let output = app
        .shell()
        .command("osascript")
        .args(["-e", &script])
        .output()
        .await
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if output.status.success() {
        Ok(ConfigResult {
            success: true,
            message: format!("DNS restored to automatic (DHCP) on {}", service),
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(ConfigResult {
            success: false,
            message: if stderr.contains("User canceled") || stderr.contains("-128") {
                "Authorization cancelled.".to_string()
            } else {
                format!("Failed to restore DNS on '{}': {}", service, stderr.trim())
            },
        })
    }
}

fn shell_escape(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

#[tauri::command]
async fn run_speed_test(app: tauri::AppHandle<tauri::Wry>) -> Result<speed_test::SpeedTestResult, String> {
    speed_test::run_speed_test(app).await
}

#[tauri::command]
fn cancel_speed_test() {
    speed_test::cancel_speed_test();
    latency_test::cancel_latency_test();
}

#[tauri::command]
async fn run_latency_test(app: tauri::AppHandle<tauri::Wry>) -> Result<latency_test::LatencyResult, String> {
    latency_test::run_latency_test(app).await
}

#[tauri::command]
async fn run_ping(host: String, count: u32) -> Result<Vec<PingResult>, String> {
    let host = validate::validate_host(&host)?;
    let count = validate::clamp_count(count, 1, 20);
    ping::run_ping(host, count).await
}

#[tauri::command(rename_all = "camelCase")]
async fn run_traceroute(host: String, max_hops: u32) -> Result<Vec<HopResult>, String> {
    let host = validate::validate_host(&host)?;
    let max_hops = validate::clamp_count(max_hops, 1, 30);
    tokio::task::spawn_blocking(move || ping::run_traceroute_sync(host, max_hops))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
fn cancel_ping() {
    ping::cancel_ping();
}

#[tauri::command]
fn cancel_traceroute() {
    ping::cancel_traceroute();
}

#[tauri::command]
async fn get_current_dns() -> Result<NetworkInfo, String> {
    sys_config::get_current_dns()
}

#[tauri::command]
async fn flush_dns_cache(app: tauri::AppHandle<tauri::Wry>) -> Result<ConfigResult, String> {
    use tauri_plugin_shell::ShellExt;
    let script = "do shell script \"dscacheutil -flushcache && killall -HUP mDNSResponder\" with administrator privileges".to_string();
    let output = app
        .shell()
        .command("osascript")
        .args(["-e", &script])
        .output()
        .await
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;
    if output.status.success() {
        Ok(ConfigResult {
            success: true,
            message: "DNS cache flushed successfully".to_string(),
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(ConfigResult {
            success: false,
            message: if stderr.contains("User canceled") || stderr.contains("-128") {
                "Authorization cancelled.".to_string()
            } else {
                format!("Failed to flush DNS cache: {}", stderr.trim())
            },
        })
    }
}

#[tauri::command(rename_all = "camelCase")]
async fn run_dns_leak_test(configured_servers: Vec<String>) -> Result<dns_leak::DnsLeakResult, String> {
    dns_leak::run_dns_leak_test(configured_servers).await
}

#[tauri::command]
async fn get_public_ip() -> Result<PublicIpInfo, String> {
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
    let (isp_name, city, country) = match response {
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

    Ok(PublicIpInfo {
        ip,
        isp: isp_name,
        city,
        country,
    })
}

#[tauri::command]
async fn save_file(path: String, content: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    let path_buf = std::path::PathBuf::from(&path);
    let file_name = path_buf.file_name().ok_or_else(|| "Path has no file name".to_string())?;
    if file_name.to_str().map_or(true, |n| n.starts_with('.')) {
        return Err("Cannot write hidden or dot files".to_string());
    }
    let allowed_extensions = ["csv", "json", "txt"];
    let ext = path_buf.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if !allowed_extensions.contains(&ext) {
        return Err(format!("File extension .{} not allowed. Use .csv, .json, or .txt", ext));
    }
    if let Some(parent) = path_buf.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

use speed_test::reset_speed_test;
use latency_test::reset_latency_test;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            run_benchmark,
            fix_my_internet,
            execute_admin_apply,
            execute_admin_restore,
            run_speed_test,
            cancel_speed_test,
            reset_speed_test,
            run_latency_test,
            reset_latency_test,
            run_ping,
            run_traceroute,
            cancel_ping,
            cancel_traceroute,
            run_dns_leak_test,
            get_current_dns,
            flush_dns_cache,
            get_public_ip,
            save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}