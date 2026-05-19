mod dns_bench;
mod ping;
mod profiles;
mod speed_test;
mod sys_config;
mod dns_leak;
mod validate;

use dns_bench::{benchmark_dns, DnsProvider};
use ping::{PingResult, HopResult};
use profiles::{get_profile_providers, UserProfile};
use sys_config::{detect_network_service, ConfigResult};

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
    let mut escaped = String::new();
    for c in s.chars() {
        match c {
            '\\' | '"' | '$' | '`' => {
                escaped.push('\\');
                escaped.push(c);
            }
            _ => escaped.push(c),
        }
    }
    escaped
}

#[tauri::command]
async fn run_speed_test() -> Result<speed_test::SpeedResult, String> {
    speed_test::run_speed_test().await
}

#[tauri::command]
async fn run_ping(host: String, count: u32) -> Result<Vec<PingResult>, String> {
    let host = validate::validate_host(&host)?;
    let count = validate::clamp_count(count, 1, 20);
    ping::run_ping(host, count).await
}

#[tauri::command]
fn run_traceroute(host: String, max_hops: u32) -> Result<Vec<HopResult>, String> {
    let host = validate::validate_host(&host)?;
    let max_hops = validate::clamp_count(max_hops, 1, 30);
    ping::run_traceroute_sync(host, max_hops)
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
async fn run_dns_leak_test(configured_servers: Vec<String>) -> Result<dns_leak::DnsLeakResult, String> {
    dns_leak::run_dns_leak_test(configured_servers).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_benchmark,
            execute_admin_apply,
            execute_admin_restore,
            run_speed_test,
            run_ping,
            run_traceroute,
            cancel_ping,
            cancel_traceroute,
            run_dns_leak_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
