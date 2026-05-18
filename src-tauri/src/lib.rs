mod dns_bench;
mod profiles;
mod sys_config;

use dns_bench::{benchmark_dns, DnsProvider};
use profiles::{get_profile_providers, UserProfile};
use sys_config::{detect_network_service, set_dns_macos, restore_dns_macos, ConfigResult};

#[tauri::command]
async fn run_benchmark(profile: String) -> Result<Vec<DnsProvider>, String> {
    let profile_enum = match profile.as_str() {
        "Gamer" => UserProfile::Gamer,
        "Parent" => UserProfile::Parent,
        "Privacy" => UserProfile::Privacy,
        "AdBlock" => UserProfile::AdBlock,
        _ => UserProfile::Balanced,
    };

    let providers = get_profile_providers(profile_enum);
    let results = benchmark_dns(providers).await;
    Ok(results)
}

#[tauri::command]
fn apply_dns(primary: String, secondary: String) -> ConfigResult {
    let service = match detect_network_service() {
        Ok(s) => s,
        Err(e) => return ConfigResult {
            success: false,
            message: e,
        },
    };
    set_dns_macos(&service, &primary, &secondary)
}

#[tauri::command]
fn restore_dns() -> ConfigResult {
    let service = match detect_network_service() {
        Ok(s) => s,
        Err(e) => return ConfigResult {
            success: false,
            message: e,
        },
    };
    restore_dns_macos(&service)
}

#[tauri::command]
async fn execute_admin_apply(
    app: tauri::AppHandle<tauri::Wry>,
    primary: String,
    secondary: String,
) -> Result<ConfigResult, String> {
    use tauri_plugin_shell::ShellExt;

    let service = detect_network_service().map_err(|e| e)?;
    let script = format!(
        "do shell script \"networksetup -setdnsservers {} {} {}\" with administrator privileges",
        service, primary, secondary
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
            message: format!("DNS updated to {} and {}", primary, secondary),
        })
    } else {
        Ok(ConfigResult {
            success: false,
            message: "Authorization cancelled or failed.".to_string(),
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
        service
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
            message: "DNS restored to automatic (DHCP)".to_string(),
        })
    } else {
        Ok(ConfigResult {
            success: false,
            message: "Authorization cancelled or failed.".to_string(),
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_benchmark,
            apply_dns,
            restore_dns,
            execute_admin_apply,
            execute_admin_restore
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
