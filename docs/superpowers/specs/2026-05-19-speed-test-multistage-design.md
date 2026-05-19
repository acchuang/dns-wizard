# Speed Test Enhancement — Multi-Stage Download + Latency/Jitter/Loss + Quality Score

## Overview

Enhance the speed test from a 3-server download test to a comprehensive network quality assessment:
1. **Multi-stage download**: 5 sequential stages (100kB, 1MB, 10MB, 25MB, 100MB) all from Cloudflare
2. **Latency/jitter/packet loss**: 20 TCP pings to 1.1.1.1:443
3. **Network quality score**: Composite A+–F grade from weighted metrics

## Architecture

### Components Changed/Added

| Component | Type | Purpose |
|-----------|------|---------|
| `speed_test.rs` | Rust (modify) | Replace 3-server model with 5-stage download, add quality score computation |
| `latency_test.rs` | Rust (new) | 20 TCP pings to 1.1.1.1:443, compute latency/jitter/loss |
| `lib.rs` | Rust (modify) | Add run_latency_test command, update run_speed_test |
| `types.ts` | TS (modify) | Add StageResult, LatencyResult, update SpeedTestResult/SpeedTestState |
| `SpeedPanel.tsx` | React (modify) | Show latency metrics row, quality score, 5-stage results |
| `SpeedGauge.tsx` | React (modify) | Handle latency phase display |

### Data Flow

```
[Start Test]
  → Phase 1: run_latency_test (20 TCP pings to 1.1.1.1:443)
    → latency-progress events per ping
    → latency-done event with LatencyResult
  → Phase 2: 5 download stages sequentially (100kB → 1MB → 10MB → 25MB → 100MB)
    → speed-progress events every 500ms (with stageName)
    → speed-stage-done events per stage
  → Compute quality score from latency + 25MB headline download speed
  → Combined SpeedTestResult returned with latency + stages + qualityScore + qualityGrade
  → Frontend: update gauge, show quality badge, stage rows, latency metrics, save to history
```

## Design Details

### 1. Multi-Stage Download Test

**Stages (all Cloudflare `__down?bytes=N`):**

| Stage | Name | Bytes |
|-------|------|-------|
| 1 | 100 kB | 100,000 |
| 2 | 1 MB | 1,000,000 |
| 3 | 10 MB | 10,000,000 |
| 4 | 25 MB | 25,000,000 |
| 5 | 100 MB | 100,000,000 |

**Rust changes:**
- Replace `ServerResult` with `StageResult` struct: `name`, `downloadMbps`, `bytesReceived`, `elapsedMs`, `error`
- Replace `SpeedServer` / `SERVERS` with `DownloadStage` / `STAGES`
- Run stages sequentially — no bandwidth contention
- Progress events (reuse `speed-progress`): add `stageName` field (rename existing `name` field for clarity)
- New event `speed-stage-done` emitted when each stage completes (replaces `speed-server-done`)
- The 25MB stage is the "headline" speed used for gauge and quality score
- Per-stage timeouts: 5s for 100kB/1MB, 15s for 10MB/25MB, 30s for 100MB

**Frontend changes:**
- SpeedPanel shows 5 stage result rows (replacing the 3 server rows)
- Each row: stage name, speed bar, Mbps value
- Gauge animates to 25MB stage speed on completion
- History entries store per-stage results

### 2. Latency / Jitter / Packet Loss

**New `latency_test.rs` module:**
- 20 TCP connect pings to `1.1.1.1:443`, 200ms apart between pings
- Cancel support via `AtomicBool` (same pattern as speed_test)
- Running guard via `AtomicBool` (same pattern)
- Per-ping: emit `latency-progress` event with `{ seq, latencyMs, success }`
- On completion: compute and emit `latency-done` event with `LatencyResult`

**LatencyResult struct:**
```rust
pub struct LatencyResult {
    pub min_ms: f64,
    pub avg_ms: f64,
    pub max_ms: f64,
    pub jitter_ms: f64,
    pub packet_loss: f64,  // 0.0 to 100.0
    pub ping_count: u32,
    pub success_count: u32,
}
```

**Jitter calculation:**
- Collect consecutive successful latencies: `[l1, l2, l3, ...]`
- Deltas: `[|l2-l1|, |l3-l2|, ...]`
- Jitter = mean of deltas
- If fewer than 2 successful pings, jitter = 0

**Packet loss calculation:**
- `packet_loss = (1 - success_count / ping_count) * 100.0`

**Frontend display:**
- Compact latency metrics row shown above download stages:
  ```
  Latency  12.3 ms    Jitter  2.1 ms    Packet Loss  0%
  ```
- Appears as soon as `latency-done` event arrives (before download stages finish)
- Source: reads from `SpeedTestState.latencyResult` (set by `latency-done` event, preserved through completion). Since `latency-done` is always emitted (even on total failure), `latencyResult` is always populated after latency phase. If it's still null (test was cancelled during latency, which returns `Err`), the latency row is hidden entirely.
- Color coded: latency <30ms green, 30-60ms yellow, >60ms red; jitter <5ms green, 5-10ms yellow, >10ms red; loss 0% green, 0-2% yellow, >2% red
- On total latency failure: show "Latency  -- ms  Jitter  -- ms  Packet Loss  100%" in red

### 3. Network Quality Score

**Scoring formula:**

`qualityScore = downloadScore * downloadWeight + latencyScore * latencyWeight + jitterScore * jitterWeight + lossScore * lossWeight`

Default weights: `downloadWeight=0.4, latencyWeight=0.3, jitterWeight=0.2, lossWeight=0.1`

When latency test fails completely (`latency: None`): weights are normalized. All available weights sum to 0.4 (download only), so each is divided by 0.4 to produce `downloadWeight=1.0, latencyWeight=0, jitterWeight=0, lossWeight=0`.
When `successCount < 2`: jitter sub-score is set to 0 regardless of calculated jitter value.

**Sub-scale mappings (piecewise linear interpolation):**

**Download (based on 25MB stage Mbps):**
| Mbps | Score |
|------|-------|
| 0 | 0 |
| 10 | 40 |
| 50 | 70 |
| 100 | 85 |
| 250 | 95 |
| 500+ | 100 |

Interpolation between anchors. E.g., 30 Mbps = 40 + (30-10)/(50-10) * (70-40) = 40 + 0.5*30 = 55.

**Latency (based on avgMs):**
| ms | Score |
|----|-------|
| 0 | 100 |
| 10 | 90 |
| 30 | 70 |
| 60 | 50 |
| 100 | 30 |
| 200+ | 0 |

**Jitter (based on jitterMs):**
| ms | Score |
|----|-------|
| 0 | 100 |
| 2 | 90 |
| 5 | 70 |
| 10 | 50 |
| 20 | 30 |
| 50+ | 0 |

**Packet loss (based on packetLoss %):**
| % | Score |
|---|-------|
| 0 | 100 |
| 2 | 80 |
| 5 | 50 |
| 10+ | 0 |

**Score → Grade:**
| Score Range | Grade |
|-------------|-------|
| 90–100 | A+ |
| 80–89 | A |
| 70–79 | B |
| 60–69 | C |
| 50–59 | D |
| <50 | F |

**Rust:** Computed in `speed_test.rs` after all tests complete. Included in `SpeedTestResult` as `quality_score: u32` (0-100, rounded) and `quality_grade: String`.

**Piecewise linear interpolation function:**
```rust
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
```

**Frontend display:**
- Prominent badge below gauge, above results:
  ```
  Network Quality: A+  (92/100)
  ```
- Color coded:
  - A+/A → `#22c55e` (green)
  - B → `#eab308` (yellow)
  - C/D/F → `#ef4444` (red)

### 4. Combined Test Flow

**Phase 1: Latency Test**
- Frontend shows "Testing latency..." in gauge center
- No gauge arc animation during this phase
- `latency-progress` events arrive, frontend can show ping count progress
- `latency-done` event arrives with final LatencyResult
- Frontend immediately shows latency metrics row

**Phase 2: Download Stages**
- Frontend shows live current speed in gauge (pulsing arc)
- Gauge displays current stage name below speed
- `speed-stage-done` events add result rows progressively
- `speed-progress` events update gauge in real time

**Completion:**
- Rust computes quality score from latency result + 25MB headline speed
- Returns `SpeedTestResult` with everything
- Frontend animates gauge to headline speed
- Shows quality badge + latency row + 5 stage rows
- Saves to history

### 5. Gauge Behavior

- Latency phase: gauge shows idle background arc, center text "Testing latency..."
- Download phase: gauge shows live speed + pulsing arc, stage name below speed
- On completion: gauge animates (ease-out, 1s) to 25MB headline speed
- Auto-scaling, color gradient, tick marks: same as current behavior, using headline speed

## Types

```typescript
// types.ts additions/changes
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
  headlineMbps: number;       // 25MB stage speed
  qualityScore: number;        // 0-100
  qualityGrade: string;        // "A+", "A", "B", etc.
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
  pingProgress: number;          // number of pings completed so far (0-20)
}
```

```rust
// Rust structs

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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LatencyProgressEvent {
    pub seq: u32,
    pub latency_ms: Option<f64>,
    pub success: bool,
}
```

## Command Changes

- `run_speed_test(app_handle)` — now orchestrates Phase 1 (latency) + Phase 2 (download) + score computation
- Remove old `run_speed_test` multi-server logic, replace with staged download
- New command `run_latency_test(app_handle)` — standalone latency test (can also be called independently)
- New command `cancel_speed_test` — cancels the entire test immediately (both latency and download phases). If cancelled during latency, the test ends with no results (returns `Err("Speed test cancelled")`). If cancelled during download, partial download results are returned with `cancelled: true`.

## Error Handling

- If latency test fails completely: set `latency: None` in result, Phase 2 (download) still executes. The `latency-done` event is still emitted with `LatencyResult` where all latency values are 0, `successCount: 0`, `packetLoss: 100.0` — this signals failure to the frontend while still providing a valid event for phase transition. Quality score weights are normalized to sum to 1.0 using only available components: download becomes 100% weight (0.4 / 0.4), since latency/jitter/loss are from the same ping data and all fail together. Additionally, when `successCount < 2`, the jitter sub-score is set to 0 (not 100) to avoid rewarding unmeasurable jitter.
- If a download stage fails: include `StageResult` with `error: Some(...)` and `downloadMbps: 0.0`
- If the 25MB headline stage fails: use the speed from the **largest successfully completed stage** as headline (not the highest Mbps value — small stages can show inflated speeds). E.g., if 25MB fails but 10MB completed, use 10MB speed.
- If all stages fail: return `Err("All download stages failed")`
- Cancel during latency: returns `Err("Speed test cancelled")` — no partial results
- Cancel during download: returns partial results with `cancelled: true`
- Cancel check granularity: checked between pings (after each latency-progress emit), between stages (before starting next stage), and between chunks inside `test_single_stage` (same as current chunk-level check). Cancel is responsive within ~500ms.
- Per-stage timeouts: 5s (100kB, 1MB), 15s (10MB, 25MB), 30s (100MB). Implemented via `tokio::time::timeout()` wrapper around each stage's download, with a base client using `connect_timeout(5s)` + `read_timeout(30s)`.
- Mid-download disconnect (connection reset): treated as stage failure → `StageResult` with `error: Some("Download error: ...")`. Partial bytes are NOT used for speed calculation.
- Individual TCP ping timeout: 5 seconds per ping (via `tokio::time::timeout()`)
- "200ms apart" means 200ms sleep after each ping completes (not from start to start)
- Any TCP connect error (timeout, refused, unreachable, etc.) emits `latency-progress` with `success: false` and `latencyMs: null` — partial latency results remain useful
- `quality_score` uses `f64::round()` (round-half-to-even / banker's rounding) then cast to `u32`
- History backward compatibility: old localStorage entries are loaded on read but lack the new `stages`/`headlineMbps`/`qualityScore` fields. The `loadHistory()` function validates each entry has a `qualityScore` field; entries without it are filtered out. New saves prepend to the array, so old entries persist until they age out of the 20-entry window. No data is lost on save — old entries just won't render in the new UI.
- Cancelled tests with partial results are NOT saved to history (only fully completed tests are saved).
- `testPhase` resets to `"idle"` on error, cancelled, and done status.

## Stages Configuration

Base URL: `https://speed.cloudflare.com/__down?bytes=`

| Stage | Name | `bytes` param | Timeout |
|-------|------|---------------|---------|
| 1 | 100 kB | 100000 | 5s |
| 2 | 1 MB | 1000000 | 5s |
| 3 | 10 MB | 10000000 | 15s |
| 4 | 25 MB | 25000000 | 15s |
| 5 | 100 MB | 100000000 | 30s |

Full URL example: `https://speed.cloudflare.com/__down?bytes=25000000`

## SpeedGauge Props

```typescript
interface SpeedGaugeProps {
  result: SpeedTestResult | null;
  currentMbps: number;
  status: "idle" | "running" | "done" | "error" | "cancelled";
  testPhase: "idle" | "latency" | "download";
  stageName: string | null;     // replaces serverName
}
```

During latency phase: gauge shows idle background arc, center text "Testing latency..." in `#94a3b8`.
During download phase: shows live speed, pulsing arc, stage name below speed.
On completion: animates to headline speed.

## Frontend Event Listeners

SpeedPanel must listen to 4 events (all cleaned up on unmount):
1. `latency-progress` → `LatencyProgressEvent` — update ping count display
2. `latency-done` → `LatencyResult` — set latencyResult, switch phase to "download"
3. `speed-progress` → `SpeedProgressEvent` — update gauge live speed
4. `speed-stage-done` → `StageResult` — add stage result row