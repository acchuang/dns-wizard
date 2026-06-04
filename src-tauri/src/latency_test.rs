use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Emitter;

static LATENCY_CANCEL: AtomicBool = AtomicBool::new(false);
static LATENCY_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn cancel_latency_test() {
    LATENCY_CANCEL.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn reset_latency_test() {
    LATENCY_RUNNING.store(false, Ordering::SeqCst);
    LATENCY_CANCEL.store(false, Ordering::SeqCst);
}

fn is_cancelled() -> bool {
    LATENCY_CANCEL.load(Ordering::SeqCst)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LatencyResult {
    pub min_ms: f64,
    pub avg_ms: f64,
    pub max_ms: f64,
    pub jitter_ms: f64,
    pub packet_loss: f64,
    pub ping_count: u32,
    pub success_count: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LatencyProgressEvent {
    pub seq: u32,
    pub latency_ms: Option<f64>,
    pub success: bool,
}

const TARGET_HOST: &str = "1.1.1.1";
const TARGET_PORT: u16 = 443;
const PING_COUNT: u32 = 20;
const PING_TIMEOUT: Duration = Duration::from_secs(5);
const PING_INTERVAL: Duration = Duration::from_millis(200);

pub async fn run_latency_test(app_handle: tauri::AppHandle) -> Result<LatencyResult, String> {
    if LATENCY_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err("Latency test already running".to_string());
    }

    LATENCY_CANCEL.store(false, Ordering::SeqCst);

    let addr = format!("{}:{}", TARGET_HOST, TARGET_PORT);
    let mut latencies: Vec<f64> = Vec::new();
    let mut success_count: u32 = 0;

    for i in 0..PING_COUNT {
        if is_cancelled() {
            break;
        }

        let start = std::time::Instant::now();
        let result = tokio::time::timeout(
            PING_TIMEOUT,
            tokio::net::TcpStream::connect(&addr),
        ).await;

        let (latency_ms, success) = match result {
            Ok(Ok(_)) => {
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                latencies.push(elapsed);
                success_count += 1;
                (Some((elapsed * 100.0).round() / 100.0), true)
            }
            _ => (None, false),
        };

        let event = LatencyProgressEvent {
            seq: i + 1,
            latency_ms,
            success,
        };
        let _ = app_handle.emit("latency-progress", &event);

        if is_cancelled() {
            break;
        }

        if i < PING_COUNT - 1 {
            tokio::time::sleep(PING_INTERVAL).await;
        }
    }

    let was_cancelled = is_cancelled();
    LATENCY_RUNNING.store(false, Ordering::SeqCst);

    if was_cancelled {
        return Err("Latency test cancelled".to_string());
    }

    let min_ms = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_ms = latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let avg_ms = if latencies.is_empty() { 0.0 } else { latencies.iter().sum::<f64>() / latencies.len() as f64 };

    let jitter_ms = if latencies.len() < 2 {
        0.0
    } else {
        let deltas: Vec<f64> = latencies.windows(2).map(|w| (w[1] - w[0]).abs()).collect();
        deltas.iter().sum::<f64>() / deltas.len() as f64
    };

    let packet_loss = (1.0 - success_count as f64 / PING_COUNT as f64) * 100.0;

    Ok(LatencyResult {
        min_ms: (min_ms * 100.0).round() / 100.0,
        avg_ms: (avg_ms * 100.0).round() / 100.0,
        max_ms: (max_ms * 100.0).round() / 100.0,
        jitter_ms: (jitter_ms * 100.0).round() / 100.0,
        packet_loss: (packet_loss * 10.0).round() / 10.0,
        ping_count: PING_COUNT,
        success_count,
    })
}