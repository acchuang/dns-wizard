use serde::{Serialize, Deserialize};
use std::time::Instant;
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
static PING_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn cancel_ping() {
    PING_CANCEL.store(true, Ordering::SeqCst);
}

pub async fn run_ping(host: String, count: u32) -> Result<Vec<PingResult>, String> {
    if PING_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err("Ping already running".to_string());
    }
    PING_CANCEL.store(false, Ordering::SeqCst);
    let mut results = Vec::new();

    for i in 0..count {
        if PING_CANCEL.load(Ordering::SeqCst) {
            break;
        }

        let start = Instant::now();
        let addr = format!("{}:443", host);

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

    PING_RUNNING.store(false, Ordering::SeqCst);
    Ok(results)
}

static TRACE_CANCEL: AtomicBool = AtomicBool::new(false);
static TRACE_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn cancel_traceroute() {
    TRACE_CANCEL.store(true, Ordering::SeqCst);
}

pub fn run_traceroute_sync(host: String, max_hops: u32) -> Result<Vec<HopResult>, String> {
    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader, Read};

    if TRACE_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err("Traceroute already running".to_string());
    }
    TRACE_CANCEL.store(false, Ordering::SeqCst);

    let traceroute_path = if std::path::Path::new("/usr/sbin/traceroute").exists() {
        "/usr/sbin/traceroute"
    } else {
        "traceroute"
    };

    let mut child = match Command::new(traceroute_path)
        .args(["-m", &max_hops.to_string(), "-w", "2", &host])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            TRACE_RUNNING.store(false, Ordering::SeqCst);
            return Err(format!("Failed to run traceroute: {}", e));
        }
    };

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            TRACE_RUNNING.store(false, Ordering::SeqCst);
            return Err("Failed to capture stdout".to_string());
        }
    };
    let mut stderr_pipe = child.stderr.take();
    let reader = BufReader::new(stdout);
    let mut results = Vec::new();

    for line in reader.lines() {
        if TRACE_CANCEL.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            break;
        }

        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let hop_num = match parts[0].parse::<u32>() {
            Ok(num) => num,
            Err(_) => continue,
        };

        if parts.len() < 2 {
            continue;
        }

        if parts[1] == "*" {
            results.push(HopResult {
                hop: hop_num,
                host: "*".to_string(),
                latency_ms: None,
                success: false,
            });
            continue;
        }

        let host_name = if parts.len() > 2 && parts[2].starts_with('(') {
            let ip = parts[2].trim_start_matches('(').trim_end_matches(')');
            ip.to_string()
        } else {
            parts[1].to_string()
        };

        let mut latency: Option<f64> = None;
        for i in 1..parts.len().saturating_sub(1) {
            if parts[i + 1] == "ms" {
                if let Ok(val) = parts[i].parse::<f64>() {
                    latency = Some(val);
                    break;
                }
            }
        }

        results.push(HopResult {
            hop: hop_num,
            host: host_name,
            latency_ms: latency,
            success: latency.is_some(),
        });
    }

    TRACE_RUNNING.store(false, Ordering::SeqCst);

    if TRACE_CANCEL.load(Ordering::SeqCst) {
        let _ = child.kill();
        let _ = child.wait();
        return Ok(results);
    }

    let status = child.wait();
    if let Ok(status) = status {
        if !status.success() && results.is_empty() {
            let mut stderr_buf = String::new();
            if let Some(mut err) = stderr_pipe.take() {
                let _ = err.read_to_string(&mut stderr_buf);
            }
            return Err(format!("traceroute failed: {}", stderr_buf.trim()));
        }
    }

    Ok(results)
}