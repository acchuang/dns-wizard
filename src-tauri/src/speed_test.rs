use crate::latency_test::LatencyResult;
use futures_util::StreamExt;
use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::Emitter;

static SPEED_CANCEL: AtomicBool = AtomicBool::new(false);
static SPEED_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn cancel_speed_test() {
    SPEED_CANCEL.store(true, Ordering::SeqCst);
}

fn is_cancelled() -> bool {
    SPEED_CANCEL.load(Ordering::SeqCst)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StageResult {
    pub name: String,
    pub download_mbps: f64,
    pub bytes_received: u64,
    pub elapsed_ms: u64,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestResult {
    pub latency: Option<LatencyResult>,
    pub stages: Vec<StageResult>,
    pub headline_mbps: f64,
    pub quality_score: u32,
    pub quality_grade: String,
    pub cancelled: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedProgressEvent {
    pub bytes_received: u64,
    pub elapsed_ms: u64,
    pub current_mbps: f64,
    pub stage_name: String,
}

struct DownloadStage {
    name: &'static str,
    url: &'static str,
    timeout_secs: u64,
}

const STAGES: &[DownloadStage] = &[
    DownloadStage { name: "100 kB", url: "https://speed.cloudflare.com/__down?bytes=100000", timeout_secs: 5 },
    DownloadStage { name: "1 MB", url: "https://speed.cloudflare.com/__down?bytes=1000000", timeout_secs: 5 },
    DownloadStage { name: "10 MB", url: "https://speed.cloudflare.com/__down?bytes=10000000", timeout_secs: 15 },
    DownloadStage { name: "25 MB", url: "https://speed.cloudflare.com/__down?bytes=25000000", timeout_secs: 15 },
    DownloadStage { name: "50 MB", url: "https://speed.cloudflare.com/__down?bytes=50000000", timeout_secs: 30 },
];

const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(500);
const HEADLINE_STAGE_INDEX: usize = 3;

pub async fn run_speed_test(app_handle: tauri::AppHandle) -> Result<SpeedTestResult, String> {
    if SPEED_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err("Speed test already running".to_string());
    }

    SPEED_CANCEL.store(false, Ordering::SeqCst);

    let latency_result = match crate::latency_test::run_latency_test(app_handle.clone()).await {
        Ok(r) => {
            let _ = app_handle.emit("latency-done", &r);
            if is_cancelled() {
                SPEED_RUNNING.store(false, Ordering::SeqCst);
                return Err("Speed test cancelled".to_string());
            }
            Some(r)
        }
        Err(_) => {
            if is_cancelled() {
                SPEED_RUNNING.store(false, Ordering::SeqCst);
                return Err("Speed test cancelled".to_string());
            }
            let failed = LatencyResult {
                min_ms: 0.0,
                avg_ms: 0.0,
                max_ms: 0.0,
                jitter_ms: 0.0,
                packet_loss: 100.0,
                ping_count: 20,
                success_count: 0,
            };
            let _ = app_handle.emit("latency-done", &failed);
            None
        }
    };

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .read_timeout(Duration::from_secs(30))
        .user_agent("DNSWizard/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut stages: Vec<StageResult> = Vec::new();
    let mut headline_mbps: f64 = 0.0;
    let mut largest_completed_bytes: u64 = 0;

    for (i, stage) in STAGES.iter().enumerate() {
        if is_cancelled() {
            break;
        }

        let url = stage.url;
        let stage_result = tokio::time::timeout(
            Duration::from_secs(stage.timeout_secs),
            test_single_stage(&client, &app_handle, stage.name, &url),
        ).await;

        let result = match stage_result {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => StageResult {
                name: stage.name.to_string(),
                download_mbps: 0.0,
                bytes_received: 0,
                elapsed_ms: 0,
                error: Some(e),
            },
            Err(_) => StageResult {
                name: stage.name.to_string(),
                download_mbps: 0.0,
                bytes_received: 0,
                elapsed_ms: 0,
                error: Some("Stage timeout".to_string()),
            },
        };

        let _ = app_handle.emit("speed-stage-done", &result);

        if result.error.is_none() {
            if i == HEADLINE_STAGE_INDEX {
                headline_mbps = result.download_mbps;
            }
            if result.bytes_received > largest_completed_bytes {
                largest_completed_bytes = result.bytes_received;
                if i != HEADLINE_STAGE_INDEX {
                    headline_mbps = result.download_mbps;
                }
            }
        }

        stages.push(result);
    }

    let was_cancelled = is_cancelled();
    SPEED_RUNNING.store(false, Ordering::SeqCst);

    if was_cancelled && stages.iter().all(|s| s.error.is_some()) {
        return Err("Speed test cancelled".to_string());
    }

    let successful: Vec<&StageResult> = stages.iter().filter(|s| s.error.is_none()).collect();
    if successful.is_empty() && !was_cancelled {
        return Err("All download stages failed".to_string());
    }

    if let Some(headline_stage) = stages.get(HEADLINE_STAGE_INDEX) {
        if headline_stage.error.is_none() {
            headline_mbps = headline_stage.download_mbps;
        }
    }

    let (quality_score, quality_grade) = compute_quality_score(headline_mbps, &latency_result);

    Ok(SpeedTestResult {
        latency: latency_result,
        stages,
        headline_mbps: (headline_mbps * 100.0).round() / 100.0,
        quality_score,
        quality_grade,
        cancelled: was_cancelled,
    })
}

async fn test_single_stage(
    client: &reqwest::Client,
    app_handle: &tauri::AppHandle,
    stage_name: &str,
    url: &str,
) -> Result<StageResult, String> {
    let start = Instant::now();
    let mut last_emit = Instant::now();

    let response = client.get(url).send().await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let mut total_bytes: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        if is_cancelled() {
            return Err("Cancelled".to_string());
        }

        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        total_bytes += chunk.len() as u64;

        let now = Instant::now();
        if now - last_emit >= PROGRESS_EMIT_INTERVAL {
            let elapsed = now - start;
            let current_mbps = if elapsed.as_secs_f64() > 0.0 {
                (total_bytes as f64 * 8.0) / (elapsed.as_secs_f64() * 1_000_000.0)
            } else {
                0.0
            };

            let event = SpeedProgressEvent {
                bytes_received: total_bytes,
                elapsed_ms: elapsed.as_millis() as u64,
                current_mbps,
                stage_name: stage_name.to_string(),
            };
            let _ = app_handle.emit("speed-progress", &event);
            last_emit = now;
        }
    }

    if total_bytes == 0 {
        return Err("No data received".to_string());
    }

    let elapsed = start.elapsed();
    let mbps = if elapsed.as_secs_f64() > 0.0 {
        (total_bytes as f64 * 8.0) / (elapsed.as_secs_f64() * 1_000_000.0)
    } else {
        0.0
    };

    Ok(StageResult {
        name: stage_name.to_string(),
        download_mbps: (mbps * 100.0).round() / 100.0,
        bytes_received: total_bytes,
        elapsed_ms: elapsed.as_millis() as u64,
        error: None,
    })
}

fn interpolate(value: f64, anchors: &[(f64, f64)]) -> f64 {
    if value <= anchors[0].0 { return anchors[0].1; }
    if value >= anchors.last().unwrap().0 { return anchors.last().unwrap().1; }
    for i in 0..anchors.len() - 1 {
        if value >= anchors[i].0 && value <= anchors[i + 1].0 {
            let t = (value - anchors[i].0) / (anchors[i + 1].0 - anchors[i].0);
            return anchors[i].1 + t * (anchors[i + 1].1 - anchors[i].1);
        }
    }
    0.0
}

fn compute_quality_score(headline_mbps: f64, latency: &Option<LatencyResult>) -> (u32, String) {
    let download_anchors: &[(f64, f64)] = &[
        (0.0, 0.0), (10.0, 40.0), (50.0, 70.0), (100.0, 85.0), (250.0, 95.0), (500.0, 100.0),
    ];
    let latency_anchors: &[(f64, f64)] = &[
        (0.0, 100.0), (10.0, 90.0), (30.0, 70.0), (60.0, 50.0), (100.0, 30.0), (200.0, 0.0),
    ];
    let jitter_anchors: &[(f64, f64)] = &[
        (0.0, 100.0), (2.0, 90.0), (5.0, 70.0), (10.0, 50.0), (20.0, 30.0), (50.0, 0.0),
    ];
    let loss_anchors: &[(f64, f64)] = &[
        (0.0, 100.0), (2.0, 80.0), (5.0, 50.0), (10.0, 0.0),
    ];

    let download_score = interpolate(headline_mbps, download_anchors);

    let (lat, jit, loss, download_weight, latency_weight, jitter_weight, loss_weight) = match latency {
        Some(l) if l.success_count >= 2 => {
            let lat = interpolate(l.avg_ms, latency_anchors);
            let jit = interpolate(l.jitter_ms, jitter_anchors);
            let loss = interpolate(l.packet_loss, loss_anchors);
            (lat, jit, loss, 0.4, 0.3, 0.2, 0.1)
        }
        Some(l) if l.success_count > 0 => {
            let lat = interpolate(l.avg_ms, latency_anchors);
            let loss = interpolate(l.packet_loss, loss_anchors);
            (lat, 0.0, loss, 0.4 / 0.8, 0.3 / 0.8, 0.0, 0.1 / 0.8)
        }
        _ => {
            (0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0)
        }
    };

    let total_weight = download_weight + latency_weight + jitter_weight + loss_weight;
    let score = if total_weight > 0.0 {
        (download_score * download_weight + lat * latency_weight + jit * jitter_weight + loss * loss_weight) / total_weight
    } else {
        0.0
    };

    let score_int = score.round() as u32;
    let grade = match score_int {
        90..=100 => "A+",
        80..=89 => "A",
        70..=79 => "B",
        60..=69 => "C",
        50..=59 => "D",
        _ => "F",
    }.to_string();

    (score_int.min(100), grade)
}