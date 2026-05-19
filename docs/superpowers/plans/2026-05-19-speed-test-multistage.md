# Speed Test Multi-Stage + Latency/Jitter/Loss + Quality Score Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the speed test with 5-stage sequential downloads (100kB–100MB), latency/jitter/packet-loss testing via 20 TCP pings, and a composite A+–F network quality score.

**Architecture:** Two-phase test: Phase 1 runs latency test (new latency_test.rs module) with 20 TCP pings to 1.1.1.1:443, Phase 2 runs 5 download stages from Cloudflare. Backend computes quality score from weighted metrics. Frontend listens to 4 Tauri events and displays latency metrics row, quality badge, and stage results.

**Tech Stack:** Tauri v2, React, TypeScript, Rust, reqwest (stream), tokio (TCP connect, timeout), @tauri-apps/api/event

**Spec:** `docs/superpowers/specs/2026-05-19-speed-test-multistage-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/src/latency_test.rs` | Create | Latency test module: 20 TCP pings, LatencyResult, events, cancel |
| `src-tauri/src/speed_test.rs` | Modify | Replace 3-server with 5-stage download, quality score, combine with latency |
| `src-tauri/src/lib.rs` | Modify | Add latency_test module, run_latency_test command |
| `src/types.ts` | Modify | Replace ServerResult/SpeedTestResult/etc with StageResult/LatencyResult/QualityScore types |
| `src/components/SpeedGauge.tsx` | Modify | Handle latency phase, testPhase + stageName props |
| `src/components/SpeedPanel.tsx` | Modify | 4 event listeners, latency metrics row, quality badge, 5 stage rows |
| `src/App.tsx` | Modify | Update initialSpeed state |

---

## Chunk 1: Rust — Latency Test Module

### Task 1: Create latency_test.rs

**Files:**
- Create: `src-tauri/src/latency_test.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create latency_test.rs**

```rust
use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Emitter;

static LATENCY_CANCEL: AtomicBool = AtomicBool::new(false);
static LATENCY_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn cancel_latency_test() {
    LATENCY_CANCEL.store(true, Ordering::SeqCst);
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
```

- [ ] **Step 2: Add latency_test module to lib.rs**

At the top of `src-tauri/src/lib.rs`, add after `mod dns_leak;`:

```rust
mod latency_test;
```

Add the new command after the `cancel_speed_test` command (line 149):

```rust
#[tauri::command]
async fn run_latency_test(app: tauri::AppHandle<tauri::Wry>) -> Result<latency_test::LatencyResult, String> {
    latency_test::run_latency_test(app).await
}
```

Update the `cancel_speed_test` command to also cancel latency:

```rust
#[tauri::command]
fn cancel_speed_test() {
    speed_test::cancel_speed_test();
    latency_test::cancel_latency_test();
}
```

Add `run_latency_test` to the `generate_handler![]` list.

- [ ] **Step 3: Build to verify**

Run: `cd /Users/acchuang/Project/dns-wizard && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`

Expected: Compiles with no errors

---

## Chunk 2: Rust — Speed Test Overhaul

### Task 2: Rewrite speed_test.rs for 5-stage download + quality score

**Files:**
- Modify: `src-tauri/src/speed_test.rs`

- [ ] **Step 1: Replace entire contents of speed_test.rs**

```rust
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
    bytes: u64,
    timeout_secs: u64,
}

const STAGES: &[DownloadStage] = &[
    DownloadStage { name: "100 kB", bytes: 100_000, timeout_secs: 5 },
    DownloadStage { name: "1 MB", bytes: 1_000_000, timeout_secs: 5 },
    DownloadStage { name: "10 MB", bytes: 10_000_000, timeout_secs: 15 },
    DownloadStage { name: "25 MB", bytes: 25_000_000, timeout_secs: 15 },
    DownloadStage { name: "100 MB", bytes: 100_000_000, timeout_secs: 30 },
];

const CF_BASE_URL: &str = "https://speed.cloudflare.com/__down?bytes=";
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(500);
const HEADLINE_STAGE_INDEX: usize = 3;

pub async fn run_speed_test(app_handle: tauri::AppHandle) -> Result<SpeedTestResult, String> {
    if SPEED_RUNNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err("Speed test already running".to_string());
    }

    SPEED_CANCEL.store(false, Ordering::SeqCst);

    // Phase 1: Latency test
    let latency_result = match latency_test::run_latency_test(app_handle.clone()).await {
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

    // Phase 2: Download stages
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .read_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut stages: Vec<StageResult> = Vec::new();
    let mut headline_mbps: f64 = 0.0;
    let mut largest_completed_bytes: u64 = 0;

    for (i, stage) in STAGES.iter().enumerate() {
        if is_cancelled() {
            break;
        }

        let url = format!("{}{}", CF_BASE_URL, stage.bytes);
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

    // Headline: prefer 25MB stage, fallback to largest completed
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
            // jitter unmeasurable (<2 pings): normalize weights without jitter
            (lat, 0.0, loss, 0.4 / 0.8, 0.3 / 0.8, 0.0, 0.1 / 0.8)
        }
        _ => {
            // No latency data: download is 100% weight
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
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/acchuang/Project/dns-wizard && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`

Expected: Compiles with no errors

---

## Chunk 3: TypeScript Types

### Task 3: Update types.ts and App.tsx

**Files:**
- Modify: `src/types.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace Speed Test section in types.ts**

Replace lines 33–73 (from `// --- Speed Test ---` through the closing `}` of `SpeedTestState`) with:

```typescript
// --- Speed Test ---
export interface StageResult {
  name: string;
  downloadMbps: number;
  bytesReceived: number;
  elapsedMs: number;
  error: string | null;
}

export interface LatencyResult {
  minMs: number;
  avgMs: number;
  maxMs: number;
  jitterMs: number;
  packetLoss: number;
  pingCount: number;
  successCount: number;
}

export interface LatencyProgressEvent {
  seq: number;
  latencyMs: number | null;
  success: boolean;
}

export interface SpeedTestResult {
  latency: LatencyResult | null;
  stages: StageResult[];
  headlineMbps: number;
  qualityScore: number;
  qualityGrade: string;
  cancelled: boolean;
}

export interface SpeedProgressEvent {
  bytesReceived: number;
  elapsedMs: number;
  currentMbps: number;
  stageName: string;
}

export interface SpeedHistoryEntry {
  timestamp: string;
  latency: LatencyResult | null;
  stages: StageResult[];
  headlineMbps: number;
  qualityScore: number;
  qualityGrade: string;
}

export interface SpeedTestState {
  status: "idle" | "running" | "done" | "error" | "cancelled";
  result: SpeedTestResult | null;
  error: string | null;
  currentMbps: number;
  currentStage: string | null;
  stageResults: StageResult[];
  latencyResult: LatencyResult | null;
  testPhase: "idle" | "latency" | "download";
  pingProgress: number;
}
```

- [ ] **Step 2: Update App.tsx initial state**

In `src/App.tsx`, replace the `initialSpeed` constant:

Old:
```typescript
const initialSpeed: SpeedTestState = { status: "idle", result: null, error: null, currentMbps: 0, currentServer: null, serverResults: [] };
```

New:
```typescript
const initialSpeed: SpeedTestState = { status: "idle", result: null, error: null, currentMbps: 0, currentStage: null, stageResults: [], latencyResult: null, testPhase: "idle", pingProgress: 0 };
```

- [ ] **Step 3: Verify TypeScript compiles (expect errors in SpeedPanel/SpeedGauge)**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit 2>&1 | head -10`

Expected: Errors in SpeedGauge/SpeedPanel (expected — fixing next)

---

## Chunk 4: SpeedGauge Updates

### Task 4: Update SpeedGauge for latency phase and new props

**Files:**
- Modify: `src/components/SpeedGauge.tsx`

- [ ] **Step 1: Update SpeedGauge.tsx props and latency phase behavior**

Replace entire contents of `src/components/SpeedGauge.tsx` with:

```typescript
import { useEffect, useRef, useState } from "react";
import { SpeedTestResult } from "../types";

interface Props {
  result: SpeedTestResult | null;
  currentMbps: number;
  status: "idle" | "running" | "done" | "error" | "cancelled";
  testPhase: "idle" | "latency" | "download";
  stageName: string | null;
}

const SIZE = 220;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const ARC_START = 135;
const ARC_END = 405;
const ARC_SPAN = ARC_END - ARC_START;

function getGaugeMax(mbps: number): number {
  if (mbps >= 500) return 1000;
  if (mbps >= 250) return 500;
  if (mbps >= 100) return 250;
  if (mbps >= 50) return 100;
  if (mbps >= 10) return 50;
  return 10;
}

function getArcColor(mbps: number): string {
  if (mbps >= 250) return "#06b6d4";
  if (mbps >= 50) return "#22c55e";
  if (mbps >= 10) return "#eab308";
  return "#ef4444";
}

function arcPath(value: number, max: number): string {
  const ratio = Math.min(value / max, 1);
  const angle = ARC_START + ratio * ARC_SPAN;
  const startRad = (ARC_START * Math.PI) / 180;
  const endRad = (angle * Math.PI) / 180;
  const x1 = CENTER + RADIUS * Math.cos(startRad);
  const y1 = CENTER + RADIUS * Math.sin(startRad);
  const x2 = CENTER + RADIUS * Math.cos(endRad);
  const y2 = CENTER + RADIUS * Math.sin(endRad);
  const largeArc = angle - ARC_START > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function fullBgArc(max: number): string {
  return arcPath(max, max);
}

function SpeedGauge({ result, currentMbps, status, testPhase, stageName }: Props) {
  const [animatedMbps, setAnimatedMbps] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const targetRef = useRef<number>(0);

  const showDownloadArc = status === "running" && testPhase === "download";
  const showDoneArc = status === "done" && result !== null;
  const displayMbps = showDownloadArc ? currentMbps : animatedMbps;
  const gaugeMax = getGaugeMax(showDoneArc && result ? result.headlineMbps : displayMbps);
  const arcColor = getArcColor(displayMbps);

  useEffect(() => {
    if (status !== "done" || !result) {
      setAnimatedMbps(0);
      return;
    }

    targetRef.current = result.headlineMbps;
    startRef.current = 0;
    const duration = 1000;

    const animate = (ts: number) => {
      if (startRef.current === 0) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedMbps(targetRef.current * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, result]);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const angle = ARC_START + frac * ARC_SPAN;
    const rad = (angle * Math.PI) / 180;
    const innerR = RADIUS - STROKE / 2 - 4;
    const outerR = RADIUS - STROKE / 2 - 14;
    const x1 = CENTER + innerR * Math.cos(rad);
    const y1 = CENTER + innerR * Math.sin(rad);
    const x2 = CENTER + outerR * Math.cos(rad);
    const y2 = CENTER + outerR * Math.sin(rad);
    const labelR = RADIUS - STROKE / 2 - 24;
    const lx = CENTER + labelR * Math.cos(rad);
    const ly = CENTER + labelR * Math.sin(rad);
    const labelVal = Math.round(frac * gaugeMax);
    return { x1, y1, x2, y2, lx, ly, label: String(labelVal) };
  });

  const pulseStyle: React.CSSProperties = showDownloadArc
    ? { animation: "pulse 1.5s ease-in-out infinite" }
    : {};

  const showArc = displayMbps > 0 || showDownloadArc;

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <path d={fullBgArc(gaugeMax)} fill="none" stroke="#1e293b" strokeWidth={STROKE} strokeLinecap="round" />
        {showArc && (
          <path
            d={arcPath(displayMbps, gaugeMax)}
            fill="none"
            stroke={arcColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            style={pulseStyle}
          />
        )}
        {ticks.map((t, i) => (
          <g key={i} className="speed-gauge-tick">
            <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
            <text x={t.lx} y={t.ly} textAnchor="middle" dominantBaseline="middle">{t.label}</text>
          </g>
        ))}
      </svg>
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {status === "running" && testPhase === "latency" && (
          <span style={{ fontSize: 14, color: "#94a3b8" }}>Testing latency...</span>
        )}
        {status === "running" && testPhase === "download" && (
          <>
            <span style={{ fontSize: 28, fontWeight: 700, color: arcColor }}>
              {currentMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: "#64748b" }}>Mbps</span>
            {stageName && (
              <span style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{stageName}</span>
            )}
          </>
        )}
        {status === "done" && result && (
          <>
            <span style={{ fontSize: 32, fontWeight: 700, color: arcColor }}>
              {animatedMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: "#64748b" }}>Mbps</span>
          </>
        )}
        {status === "idle" && (
          <span style={{ fontSize: 14, color: "#64748b" }}>Mbps</span>
        )}
        {status === "error" && (
          <span style={{ fontSize: 14, color: "#ef4444" }}>Error</span>
        )}
        {status === "cancelled" && (
          <span style={{ fontSize: 14, color: "#eab308" }}>Cancelled</span>
        )}
      </div>
    </div>
  );
}

export default SpeedGauge;
```

- [ ] **Step 2: Verify no TypeScript errors in gauge**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit 2>&1 | grep -i gauge`

Expected: No gauge errors

---

## Chunk 5: SpeedPanel Overhaul

### Task 5: Rewrite SpeedPanel with all new features

**Files:**
- Modify: `src/components/SpeedPanel.tsx`

- [ ] **Step 1: Replace entire contents of SpeedPanel.tsx**

```typescript
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  SpeedTestState, SpeedProgressEvent, StageResult, SpeedHistoryEntry,
  SpeedTestResult, LatencyResult, LatencyProgressEvent,
} from "../types";
import SpeedGauge from "./SpeedGauge";

interface Props {
  state: SpeedTestState;
  setState: React.Dispatch<React.SetStateAction<SpeedTestState>>;
}

const HISTORY_KEY = "dnswizard-speed-history";

function loadHistory(): SpeedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: SpeedHistoryEntry) => e.qualityScore !== undefined);
  } catch {
    return [];
  }
}

function saveHistory(entry: SpeedHistoryEntry) {
  const history = loadHistory();
  history.unshift(entry);
  if (history.length > 20) history.length = 20;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const btnBase: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

function getBarColor(mbps: number): string {
  if (mbps >= 250) return "#06b6d4";
  if (mbps >= 50) return "#22c55e";
  if (mbps >= 10) return "#eab308";
  return "#ef4444";
}

function getGradeColor(grade: string): string {
  if (grade === "A+" || grade === "A") return "#22c55e";
  if (grade === "B") return "#eab308";
  return "#ef4444";
}

function getLatencyColor(ms: number): string {
  if (ms < 30) return "#22c55e";
  if (ms < 60) return "#eab308";
  return "#ef4444";
}

function getJitterColor(ms: number): string {
  if (ms < 5) return "#22c55e";
  if (ms < 10) return "#eab308";
  return "#ef4444";
}

function getLossColor(pct: number): string {
  if (pct === 0) return "#22c55e";
  if (pct < 2) return "#eab308";
  return "#ef4444";
}

function SpeedPanel({ state, setState }: Props) {
  const runTest = async () => {
    setState({
      status: "running", result: null, error: null, currentMbps: 0,
      currentStage: null, stageResults: [], latencyResult: null,
      testPhase: "latency", pingProgress: 0,
    });

    let unlistenLatencyProgress: UnlistenFn | null = null;
    let unlistenLatencyDone: UnlistenFn | null = null;
    let unlistenSpeedProgress: UnlistenFn | null = null;
    let unlistenStageDone: UnlistenFn | null = null;

    try {
      unlistenLatencyProgress = await listen<LatencyProgressEvent>("latency-progress", () => {
        setState((prev) => ({
          ...prev,
          pingProgress: prev.pingProgress + 1,
        }));
      });

      unlistenLatencyDone = await listen<LatencyResult>("latency-done", (e) => {
        setState((prev) => ({
          ...prev,
          latencyResult: e.payload,
          testPhase: "download" as const,
          pingProgress: 20,
        }));
      });

      unlistenSpeedProgress = await listen<SpeedProgressEvent>("speed-progress", (e) => {
        setState((prev) => ({
          ...prev,
          currentMbps: e.payload.currentMbps,
          currentStage: e.payload.stageName,
        }));
      });

      unlistenStageDone = await listen<StageResult>("speed-stage-done", (e) => {
        setState((prev) => ({
          ...prev,
          stageResults: [...prev.stageResults, e.payload],
        }));
      });

      const testResult = await invoke<SpeedTestResult>("run_speed_test");

      if (!testResult.cancelled) {
        saveHistory({
          timestamp: new Date().toISOString(),
          latency: testResult.latency,
          stages: testResult.stages,
          headlineMbps: testResult.headlineMbps,
          qualityScore: testResult.qualityScore,
          qualityGrade: testResult.qualityGrade,
        });
      }

      if (testResult.cancelled && testResult.stages.some((s: StageResult) => !s.error)) {
        setState((prev) => ({
          ...prev,
          status: "cancelled" as const,
          result: testResult,
          currentMbps: testResult.headlineMbps,
          currentStage: null,
          testPhase: "idle" as const,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "done" as const,
          result: testResult,
          currentMbps: testResult.headlineMbps,
          currentStage: null,
          testPhase: "idle" as const,
        }));
      }
    } catch (e) {
      if (String(e).includes("cancelled")) {
        setState((prev) => ({
          ...prev,
          status: "cancelled" as const,
          currentStage: null,
          testPhase: "idle" as const,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "error" as const,
          error: String(e),
          currentStage: null,
          testPhase: "idle" as const,
        }));
      }
    } finally {
      unlistenLatencyProgress?.();
      unlistenLatencyDone?.();
      unlistenSpeedProgress?.();
      unlistenStageDone?.();
    }
  };

  const cancelTest = () => {
    invoke("cancel_speed_test");
  };

  const history = loadHistory();
  const maxSpeed = state.stageResults
    .filter((r) => !r.error)
    .reduce((max, r) => Math.max(max, r.downloadMbps), 0);

  const statsData = history.length > 0
    ? {
        min: Math.min(...history.map((h) => h.qualityScore)),
        max: Math.max(...history.map((h) => h.qualityScore)),
        avg: history.reduce((s, h) => s + h.qualityScore, 0) / history.length,
      }
    : null;

  const showLatencyRow = state.latencyResult !== null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", gap: 16, overflowY: "auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
        Speed Test
      </h2>

      <SpeedGauge
        result={state.result}
        currentMbps={state.currentMbps}
        status={state.status}
        testPhase={state.testPhase}
        stageName={state.currentStage}
      />

      {state.result && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: getGradeColor(state.result.qualityGrade) }}>
            {state.result.qualityGrade}
          </span>
          <span style={{ fontSize: 14, color: "#94a3b8" }}>
            Network Quality ({state.result.qualityScore}/100)
          </span>
        </div>
      )}

      {showLatencyRow && state.latencyResult && (
        <div style={{ width: "100%", maxWidth: 360, display: "flex", justifyContent: "space-between", fontSize: 12, padding: "8px 12px", backgroundColor: "#1e293b", borderRadius: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>Latency</span>
            <span style={{ color: state.latencyResult.successCount === 0 ? "#64748b" : getLatencyColor(state.latencyResult.avgMs), fontWeight: 600 }}>
              {state.latencyResult.successCount === 0 ? "--" : `${state.latencyResult.avgMs.toFixed(1)} ms`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>Jitter</span>
            <span style={{ color: state.latencyResult.successCount < 2 ? "#64748b" : getJitterColor(state.latencyResult.jitterMs), fontWeight: 600 }}>
              {state.latencyResult.successCount < 2 ? "--" : `${state.latencyResult.jitterMs.toFixed(1)} ms`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>Packet Loss</span>
            <span style={{ color: getLossColor(state.latencyResult.packetLoss), fontWeight: 600 }}>
              {state.latencyResult.packetLoss.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {state.stageResults.length > 0 && (
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 6 }}>
          {state.stageResults.map((sr, i) => {
            const barWidth = sr.error ? 0 : maxSpeed > 0 ? (sr.downloadMbps / maxSpeed) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 60, color: sr.error ? "#ef4444" : "#94a3b8", flexShrink: 0 }}>
                  {sr.name}
                </span>
                {sr.error ? (
                  <span style={{ color: "#ef4444", fontSize: 12 }}>
                    Failed: {sr.error.length > 25 ? sr.error.slice(0, 25) + "..." : sr.error}
                  </span>
                ) : (
                  <>
                    <div style={{ flex: 1, height: 8, backgroundColor: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${barWidth}%`, height: "100%", backgroundColor: getBarColor(sr.downloadMbps), borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                    <span style={{ width: 90, textAlign: "right" as const, color: "#e2e8f0", fontWeight: 600, flexShrink: 0 }}>
                      {sr.downloadMbps.toFixed(1)} Mbps
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.error && (
        <p style={{ color: "#ef4444", fontSize: 13, margin: 0, textAlign: "center" }}>
          {state.error}
        </p>
      )}

      <button
        style={{
          ...btnBase,
          backgroundColor: "#7c3aed",
          color: "#fff",
          cursor: "pointer",
        }}
        disabled={false}
        onClick={state.status === "running" ? cancelTest : runTest}
      >
        {state.status === "running" ? "Cancel" : state.status === "done" ? "Test Again" : "Start Test"}
      </button>

      {history.length > 0 && (
        <HistorySection history={history} stats={statsData} />
      )}
    </div>
  );
}

function HistorySection({ history, stats }: { history: SpeedHistoryEntry[]; stats: { min: number; max: number; avg: number } | null }) {
  const [open, setOpen] = useState(true);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    window.location.reload();
  };

  return (
    <div style={{ width: "100%", maxWidth: 360, marginTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", padding: "4px 0", width: "100%", textAlign: "left" as const, display: "flex", justifyContent: "space-between" }}
      >
        <span>History</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {history.slice(0, 5).map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
              <span>{formatTimestamp(h.timestamp)}</span>
              <span style={{ color: "#94a3b8" }}>{h.qualityGrade} ({h.qualityScore}) {h.headlineMbps.toFixed(1)} Mbps</span>
            </div>
          ))}
          {stats && (
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: 4, marginTop: 4, fontSize: 11, color: "#475569", display: "flex", justifyContent: "space-between" }}>
              <span>Min: {stats.min}</span>
              <span>Avg: {stats.avg.toFixed(0)}</span>
              <span>Max: {stats.max}</span>
            </div>
          )}
          <button
            onClick={clearHistory}
            style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: "4px 0", textAlign: "left" as const, marginTop: 2 }}
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

export default SpeedPanel;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit 2>&1`

Expected: No errors

---

## Chunk 6: Build Verification

### Task 6: Full build and smoke test

**Files:** (none new)

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`

Expected: Clean

- [ ] **Step 2: Run Rust build**

Run: `cd /Users/acchuang/Project/dns-wizard && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`

Expected: Compiles successfully

- [ ] **Step 3: Run full Tauri build**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tauri build 2>&1 | tail -5`

Expected: DMG builds successfully