use serde::{Serialize, Deserialize};
use std::time::Instant;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedResult {
    pub download_mbps: f64,
    pub bytes_received: u64,
    pub elapsed_ms: u64,
}

const SPEED_TEST_URL: &str = "https://speed.cloudflare.com/__down?bytes=10000000";
const SPEED_TEST_FALLBACK_URL: &str = "https://proof.ovh.net/files/1Mb.dat";
const TIMEOUT_SECS: u64 = 30;

pub async fn run_speed_test() -> Result<SpeedResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let start = Instant::now();
    let response = client.get(SPEED_TEST_URL).send().await;

    let response = match response {
        Ok(r) => r,
        Err(_) => {
            let fallback = client.get(SPEED_TEST_FALLBACK_URL).send().await;
            fallback.map_err(|e| format!("Speed test servers unreachable: {}", e))?
        }
    };

    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to download test data: {}", e))?;
    let elapsed = start.elapsed();

    let mbps = (bytes.len() as f64 * 8.0) / (elapsed.as_secs_f64() * 1_000_000.0);

    Ok(SpeedResult {
        download_mbps: (mbps * 100.0).round() / 100.0,
        bytes_received: bytes.len() as u64,
        elapsed_ms: elapsed.as_millis() as u64,
    })
}