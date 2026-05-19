# Speed Test Enhancement Design

## Overview

Enhance the DNS Wizard Speed Test from a basic single-server download test to a multi-server, live-progress, visually rich experience with history tracking.

## Architecture

### Components Changed/Added

| Component | Type | Purpose |
|-----------|------|---------|
| `speed_test.rs` | Rust (modify) | Multi-server support, streaming chunks, Tauri event emission |
| `SpeedPanel.tsx` | React (modify) | Multi-server results display, history section, event listener |
| `SpeedGauge.tsx` | React (modify) | Auto-scaling, animated arc, color gradient, tick marks, pulsing |
| `types.ts` | TS (modify) | Add SpeedServer, SpeedProgressEvent, SpeedHistory types |

### Data Flow

```
[Start Test] → Rust: iterate servers sequentially
                ↓ (every 500ms)
              Tauri event: "speed-progress" { bytesReceived, elapsedMs, currentMbps, name }
                ↓ (per server complete)
              Tauri event: "speed-server-done" { name, downloadMbps, bytesReceived, elapsedMs }
                ↓ (all servers complete)
              Tauri command returns: SpeedTestResult { results: ServerResult[], averageMbps: f64 }
                ↓
              Frontend: update gauge, show per-server rows, save to localStorage
```

## Design Details

### 1. Live Progress (Tauri Events)

**Rust backend changes:**

- Switch from `response.bytes()` to streaming via `response.chunk()` in a loop
- Track bytes received and elapsed time
- Every 500ms, emit `"speed-progress"` event via `app_handle.emit()`:
  ```rust
  SpeedProgressEvent {
      bytes_received: u64,
      elapsed_ms: u64,
      current_mbps: f64,
      name: String,  // server name, matches ServerResult.name
  }
  ```
- When a server download completes, emit `"speed-server-done"` with the final `ServerResult` for that server
- The Tauri command signature changes to accept `app_handle: tauri::AppHandle` and return `SpeedTestResult`
- 500ms emission is implemented via `tokio::time::Instant` elapsed-time check: after each `chunk()` call, if `now - last_emit >= 500ms`, emit the event. This avoids timer overhead and ties emission to actual data progress.

**Frontend changes:**

- `SpeedPanel` listens to `"speed-progress"` and `"speed-server-done"` events using `listen()` from `@tauri-apps/api/event`
- On each `"speed-progress"` event, update the gauge's current speed display
- On each `"speed-server-done"`, add the result to a per-server results array
- On final completion, calculate average and save to history
- Event listeners are cleaned up via `UnlistenFn` on component unmount (`useEffect` return)

### 2. Better Gauge Visuals

**Auto-scaling maxMbps:**

- Gauge max dynamically adjusts based on result speed (boundaries are inclusive lower, exclusive upper unless the last bucket):
  - < 10 Mbps → max = 10
  - 10 ≤ x < 50 → max = 50
  - 50 ≤ x < 100 → max = 100
  - 100 ≤ x < 250 → max = 250
  - 250 ≤ x < 500 → max = 500
  - 500+ → max = 1000

**Animated arc fill:**

- When all servers complete, animate the gauge arc to show the **average Mbps** across all successful servers
- Animation starts from 0 and interpolates to `averageMbps` over 1 second using `requestAnimationFrame` with ease-out easing (`1 - (1 - t)^3`)
- During running state, the gauge shows live current speed (from `speed-progress` events) without animation

**Color gradient:**

- Speed-based color mapping (inclusive lower, exclusive upper):
  - < 10 Mbps → `#ef4444` (red/slow)
  - 10 ≤ x < 50 Mbps → `#eab308` (yellow/moderate)
  - 50 ≤ x < 250 Mbps → `#22c55e` (green/fast)
  - 250+ Mbps → `#06b6d4` (cyan/blazing)

**Tick marks:**

- Display 5 tick labels around the arc (0, 25%, 50%, 75%, 100% of maxMbps)
- Small tick lines at each mark using CSS positioned elements
- Labels positioned outside the arc ring

**Pulsing animation:**

- While running, the arc fill pulses with a subtle opacity animation (CSS `@keyframes pulse`)

### 3. Multi-Server Testing

**Server definitions (hardcoded in Rust):**

| Server | URL | Bytes |
|--------|-----|-------|
| Cloudflare | `https://speed.cloudflare.com/__down?bytes=25000000` | 25MB |
| Cloudflare Alt | `https://speed.cloudflare.com/__down?bytes=15000000` | 15MB |
| Speedtest | `http://speedtest.tele2.net/10MB.zip` | 10MB |

- Each server has: `name` (display string) and `url` (download endpoint)
- Servers run sequentially (not parallel) to avoid bandwidth contention
- If a server fails (connection timeout after 15s, DNS failure, TLS error, HTTP error status, or zero bytes received), skip it and try the next; if all fail, return error
- Per-server timeout: 15 seconds each
- Frontend shows a row for each server result as it completes
- If a server is skipped, show it in the results list with an error indicator

**Frontend display:**

- Below the gauge, show a compact results table:
  ```
  Cloudflare     ████████████  85.3 Mbps
  Cloudflare Alt ██████████    72.8 Mbps
  DigitalOcean   ███████       52.1 Mbps
  ─────────────────────────────────────
  Average                       70.1 Mbps
  ```
- Each row appears as `"speed-server-done"` events arrive
- Failed servers show an error indicator instead of a speed (e.g., "Cloudflare Alt ⚠ Failed: timeout" in red)
- Mini bar chart per row: width relative to the fastest server in that run (fastest = 100% bar width)

### 4. History/Stats

**Storage:**

- Key: `"dnswizard-speed-history"` in `localStorage`
- Schema: `SpeedHistoryEntry[]` (max 20 entries, newest first)
- Each entry:
  ```typescript
  {
    timestamp: string;       // ISO 8601
    servers: {
      name: string;
      downloadMbps: number;
      bytesReceived: number;
      elapsedMs: number;
    }[];
    averageMbps: number;
  }
  ```
- On each test completion, prepend to array and trim to 20

**Frontend display:**

- Collapsible "History" section below results
- Shows last 5 runs in a compact list:
  ```
  May 19, 2026 3:45 PM  Avg 70.1 Mbps
  May 18, 2026 9:12 PM  Avg 65.3 Mbps
  May 17, 2026 1:30 PM  Avg 42.7 Mbps
  ```
- Stats summary: `Min: 42.7 | Avg: 59.4 | Max: 70.1` — computed from the `averageMbps` of each history entry
- "Clear History" button

## Types

```typescript
// types.ts additions
interface SpeedServer {
  name: string;
  url: string;
}

interface SpeedProgressEvent {
  bytesReceived: number;
  elapsedMs: number;
  currentMbps: number;
  name: string;  // matches ServerResult.name
}

interface ServerResult {
  name: string;
  downloadMbps: number;
  bytesReceived: number;
  elapsedMs: number;
  error: string | null;   // null if successful, error message if failed
}

interface SpeedTestResult {
  results: ServerResult[];
  averageMbps: number;
}

interface SpeedHistoryEntry {
  timestamp: string;
  servers: ServerResult[];
  averageMbps: number;
}
```

```rust
// speed_test.rs additions
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServerResult {
    pub name: String,
    pub download_mbps: f64,
    pub bytes_received: u64,
    pub elapsed_ms: u64,
    pub error: Option<String>,  // None if successful, error message if failed
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedProgressEvent {
    pub bytes_received: u64,
    pub elapsed_ms: u64,
    pub current_mbps: f64,
    pub name: String,  // server name, matches ServerResult.name
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestResult {
    pub results: Vec<ServerResult>,
    pub average_mbps: f64,
}
```

## Command Changes

- `run_speed_test` → returns `Result<SpeedTestResult, String>` (was single `SpeedResult`), containing `results: Vec<ServerResult>` and `average_mbps: f64`
- Accepts `app_handle: tauri::AppHandle` for event emission
- Button is disabled while test is running; no concurrent test can start

### Cancellation

- A "Cancel" button appears while a test is running, replacing "Start Test"
- Tauri command checks an `AtomicBool` cancel flag between server iterations and between chunks
- On cancel: immediately return partial results collected so far (may be empty)
- Frontend shows a "Cancelled" status if results array is empty, or "Partial" if some servers completed

## Error Handling

- If a single server fails (per-server total elapsed timeout of 15s — covers connection, DNS, TLS, download stalls — or HTTP error status, or zero bytes received), skip it and continue to the next
- If all servers fail, return an `Err(String)` with a message like "All speed test servers failed"
- Per-server timeout: 15 seconds
- Frontend shows which servers succeeded and which were skipped (with error indicator)
- The "Start Test" button is disabled while a test is running to prevent concurrent tests
- On component unmount, all event listeners are cleaned up via `UnlistenFn`

## Rust Server Configuration

```rust
struct SpeedServer {
    name: &'static str,
    url: &'static str,
}

const SERVERS: &[SpeedServer] = &[
    SpeedServer { name: "Cloudflare", url: "https://speed.cloudflare.com/__down?bytes=25000000" },
    SpeedServer { name: "Cloudflare Alt", url: "https://speed.cloudflare.com/__down?bytes=15000000" },
    SpeedServer { name: "Speedtest", url: "http://speedtest.tele2.net/10MB.zip" },
];
```

## SpeedGauge Props

```typescript
interface SpeedGaugeProps {
  result: SpeedTestResult | null;       // final result for animation target
  currentMbps: number;                   // live speed during test
  status: "idle" | "running" | "done" | "error";
  serverName: string | null;             // current server being tested (shown during running)
}
```