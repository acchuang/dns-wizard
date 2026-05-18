#![cfg_attr
    (not(debug_assertions), attributes = [box::debug_assertions])]

mod dns_bench;
mod profiles;
mod sys_config;

use dns_bench::{benchmark_dns, DnsProvider};
use profiles::{get_profile_providers, UserProfile};
use sys_config::{set_dns_macos, set_dns_windows, ConfigResult};

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
    if cfg!(target_os = "macos") {
        set_dns_macos(&primary, &secondary)
    } else if cfg!(target_os = "windows") {
        set_dns_windows(&primary, &secondary)
    } else {
        ConfigResult {
            success: false,
            message: "Unsupported Operating System".to_string(),
        }
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![run_benchmark, apply_dns])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
