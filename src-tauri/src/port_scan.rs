use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Emitter;

static PORT_CANCEL: AtomicBool = AtomicBool::new(false);
static PORT_RUNNING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn cancel_port_scan() {
    PORT_CANCEL.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn reset_port_scan() {
    PORT_RUNNING.store(false, Ordering::SeqCst);
    PORT_CANCEL.store(false, Ordering::SeqCst);
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PortResult {
    pub port: u16,
    pub status: String,
    pub service: String,
    pub latency_ms: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PortProgressEvent {
    pub port: u16,
    pub status: String,
    pub progress: f64,
}

const WELL_KNOWN_PORTS: &[(u16, &str)] = &[
    (21, "FTP"), (22, "SSH"), (23, "Telnet"), (25, "SMTP"),
    (53, "DNS"), (80, "HTTP"), (110, "POP3"), (143, "IMAP"),
    (443, "HTTPS"), (465, "SMTPS"), (587, "SMTP"), (993, "IMAPS"),
    (995, "POP3S"), (3306, "MySQL"), (5432, "PostgreSQL"),
    (5900, "VNC"), (6379, "Redis"), (8080, "HTTP-Alt"), (8443, "HTTPS-Alt"),
    (27017, "MongoDB"),
];

fn service_name(port: u16) -> String {
    WELL_KNOWN_PORTS.iter()
        .find(|(p, _)| *p == port)
        .map(|(_, name)| name.to_string())
        .unwrap_or_default()
}

fn parse_port_range(input: &str) -> Result<Vec<u16>, String> {
    let mut ports = Vec::new();
    for part in input.split(',') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.contains('-') {
            let bounds: Vec<&str> = trimmed.split('-').collect();
            if bounds.len() != 2 {
                return Err(format!("Invalid port range: {}", trimmed));
            }
            let start: u16 = bounds[0].parse().map_err(|_| format!("Invalid port: {}", bounds[0]))?;
            let end: u16 = bounds[1].parse().map_err(|_| format!("Invalid port: {}", bounds[1]))?;
            if start > end {
                return Err(format!("Invalid port range: {}-{}", start, end));
            }
            for p in start..=end {
                if ports.len() >= 500 {
                    return Err("Maximum 500 ports per scan".to_string());
                }
                ports.push(p);
            }
        } else {
            let p: u16 = trimmed.parse().map_err(|_| format!("Invalid port: {}", trimmed))?;
            ports.push(p);
        }
    }
    ports.sort();
    ports.dedup();
    if ports.len() > 500 {
        return Err("Maximum 500 ports per scan".to_string());
    }
    Ok(ports)
}

#[tauri::command]
pub async fn run_port_scan(app: tauri::AppHandle, host: String, port_range: String) -> Result<Vec<PortResult>, String> {
    let validated_host = crate::validate::validate_host(&host)?;
    let ports = parse_port_range(&port_range)?;
    let total = ports.len();

    if PORT_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err("Port scan already running".to_string());
    }
    PORT_CANCEL.store(false, Ordering::SeqCst);

    let mut results = Vec::new();

    for (i, port) in ports.iter().enumerate() {
        if PORT_CANCEL.load(Ordering::SeqCst) {
            break;
        }

        let start = std::time::Instant::now();
        let connect_addr = format!("{}:{}", validated_host, port);
        let result = tokio::time::timeout(
            Duration::from_secs(2),
            tokio::net::TcpStream::connect(&connect_addr),
        ).await;

        let (status, latency_ms) = match result {
            Ok(Ok(_)) => {
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                ("open".to_string(), Some((elapsed * 100.0).round() / 100.0))
            }
            Ok(Err(_)) => ("closed".to_string(), None),
            Err(_) => ("filtered".to_string(), None),
        };

        let service = service_name(*port);
        results.push(PortResult {
            port: *port,
            status: status.clone(),
            service,
            latency_ms,
        });

        if i % 5 == 0 || i == total - 1 {
            let _ = app.emit("port-progress", &PortProgressEvent {
                port: *port,
                status,
                progress: (i as f64 + 1.0) / total as f64 * 100.0,
            });
        }
    }

    PORT_RUNNING.store(false, Ordering::SeqCst);
    Ok(results)
}