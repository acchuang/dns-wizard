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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_benchmark, apply_dns, restore_dns])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
