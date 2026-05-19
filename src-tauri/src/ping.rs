use serde::{Serialize, Deserialize};
use std::time::Instant;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PingResult {
    pub seq: u32,
    pub latency_ms: Option<f64>,
    pub success: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HopResult {
    pub hop: u32,
    pub host: String,
    pub latency_ms: Option<f64>,
    pub success: bool,
}

static PING_CANCEL: AtomicBool = AtomicBool::new(false);

pub fn cancel_ping() {
    PING_CANCEL.store(true, Ordering::SeqCst);
}

pub async fn run_ping(host: String, count: u32) -> Result<Vec<PingResult>, String> {
    PING_CANCEL.store(false, Ordering::SeqCst);
    let mut results = Vec::new();

    for i in 0..count {
        if PING_CANCEL.load(Ordering::SeqCst) {
            break;
        }

        let start = Instant::now();
        let addr = format!("{}:80", host);

        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            tokio::net::TcpStream::connect(&addr),
        ).await {
            Ok(_) => {
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                results.push(PingResult {
                    seq: i + 1,
                    latency_ms: Some((elapsed * 100.0).round() / 100.0),
                    success: true,
                });
            }
            Err(_) => {
                results.push(PingResult {
                    seq: i + 1,
                    latency_ms: None,
                    success: false,
                });
            }
        }

        if i < count - 1 {
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
    }

    Ok(results)
}

static TRACE_CANCEL: AtomicBool = AtomicBool::new(false);

pub fn cancel_traceroute() {
    TRACE_CANCEL.store(true, Ordering::SeqCst);
}

pub fn run_traceroute_sync(host: String, max_hops: u32) -> Result<Vec<HopResult>, String> {
    TRACE_CANCEL.store(false, Ordering::SeqCst);

    let output = Command::new("traceroute")
        .args(["-m", &max_hops.to_string(), "-w", "2", &host])
        .output()
        .map_err(|e| format!("Failed to run traceroute: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("traceroute failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines().skip(1) {
        if TRACE_CANCEL.load(Ordering::SeqCst) {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let hop_num = match trimmed.split_whitespace().next() {
            Some(n) => match n.parse::<u32>() {
                Ok(num) => num,
                Err(_) => continue,
            },
            None => continue,
        };

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        let host_name = if parts.len() > 1 { parts[1].to_string() } else { "?".to_string() };

        let latency = parts.iter()
            .find(|p| p.ends_with("ms"))
            .and_then(|p| p.trim_end_matches("ms").parse::<f64>().ok());

        results.push(HopResult {
            hop: hop_num,
            host: host_name,
            latency_ms: latency,
            success: latency.is_some(),
        });
    }

    Ok(results)
}