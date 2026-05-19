# Speed Test Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the speed test with live progress, multi-server testing, rich gauge visuals (auto-scaling, animated arc, color gradient, tick marks, pulsing), and history/stats.

**Architecture:** Rust backend streams download chunks and emits Tauri events every 500ms with live speed. Three servers tested sequentially. Frontend listens to events, animates gauge, shows per-server results, and stores history in localStorage.

**Tech Stack:** Tauri v2, React, TypeScript, Rust, reqwest (streaming), @tauri-apps/api/event

**Spec:** `docs/superpowers/specs/2026-05-19-speed-test-enhancement-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Add ServerResult, SpeedProgressEvent, SpeedTestResult, SpeedHistoryEntry, update SpeedTestState |
| `src-tauri/src/speed_test.rs` | Modify | Multi-server, streaming, Tauri events, cancel, ServerResult/SpeedTestResult/SpeedProgressEvent structs |
| `src-tauri/src/lib.rs` | Modify | Update run_speed_test command sig, add cancel_speed_test command |
| `src/components/SpeedGauge.tsx` | Modify | Auto-scaling, animated arc, color gradient, tick marks, pulsing, new props |
| `src/components/SpeedPanel.tsx` | Modify | Event listeners, per-server results, cancel button, history section |
| `src/styles/index.css` | Modify | Add pulse keyframes, gauge tick styles |

---

## Chunk 1: Rust Backend

### Task 1: Update speed_test.rs types and server config

**Files:**
- Modify: `src-tauri/src/speed_test.rs`

- [ ] **Step 1: Add new structs and server config**

Replace entire contents of `src-tauri/src/speed_test.rs` with:

```rust
use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::Emitter;

static SPEED_CANCEL: AtomicBool = AtomicBool::new(false);

pub fn cancel_speed_test() {
    SPEED_CANCEL.store(true, Ordering::SeqCst);
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServerResult {
    pub name: String,
    pub download_mbps: f64,
    pub bytes_received: u64,
    pub elapsed_ms: u64,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestResult {
    pub results: Vec<ServerResult>,
    pub average_mbps: f64,
    pub cancelled: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedProgressEvent {
    pub bytes_received: u64,
    pub elapsed_ms: u64,
    pub current_mbps: f64,
    pub name: String,
}

struct SpeedServer {
    name: &'static str,
    url: &'static str,
}

const SERVERS: &[SpeedServer] = &[
    SpeedServer { name: "Cloudflare", url: "https://speed.cloudflare.com/__down?bytes=25000000" },
    SpeedServer { name: "Cloudflare Alt", url: "https://speed.cloudflare.com/__down?bytes=15000000" },
    SpeedServer { name: "Speedtest", url: "http://speedtest.tele2.net/10MB.zip" },
];

const PER_SERVER_TIMEOUT_SECS: u64 = 15;
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(500);

fn is_cancelled() -> bool {
    SPEED_CANCEL.load(Ordering::SeqCst)
}

pub async fn run_speed_test(app_handle: tauri::AppHandle) -> Result<SpeedTestResult, String> {
    SPEED_CANCEL.store(false, Ordering::SeqCst);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(PER_SERVER_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut results: Vec<ServerResult> = Vec::new();

    for server in SERVERS.iter() {
        if is_cancelled() {
            break;
        }

        let server_result = test_single_server(&client, &app_handle, server.name, server.url).await;
        match server_result {
            Ok(r) => {
                let _ = app_handle.emit("speed-server-done", &r);
                results.push(r);
            }
            Err(e) => {
                let failed = ServerResult {
                    name: server.name.to_string(),
                    download_mbps: 0.0,
                    bytes_received: 0,
                    elapsed_ms: 0,
                    error: Some(e.clone()),
                };
                let _ = app_handle.emit("speed-server-done", &failed);
                results.push(failed);
            }
        }
    }

    let was_cancelled = is_cancelled();

    if was_cancelled && results.is_empty() {
        return Err("Speed test cancelled".to_string());
    }

    let successful: Vec<&ServerResult> = results.iter().filter(|r| r.error.is_none()).collect();

    if successful.is_empty() && !is_cancelled() {
        return Err("All speed test servers failed".to_string());
    }

    let average_mbps = if successful.is_empty() {
        0.0
    } else {
        let total: f64 = successful.iter().map(|r| r.download_mbps).sum();
        (total / successful.len() as f64 * 100.0).round() / 100.0
    };

    Ok(SpeedTestResult {
        results,
        average_mbps,
        cancelled: was_cancelled,
    })
}

async fn test_single_server(
    client: &reqwest::Client,
    app_handle: &tauri::AppHandle,
    server_name: &str,
    url: &str,
) -> Result<ServerResult, String> {
    let start = Instant::now();
    let mut last_emit = Instant::now();

    let response = client.get(url).send().await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let mut total_bytes: u64 = 0;
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;

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
                name: server_name.to_string(),
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

    Ok(ServerResult {
        name: server_name.to_string(),
        download_mbps: (mbps * 100.0).round() / 100.0,
        bytes_received: total_bytes,
        elapsed_ms: elapsed.as_millis() as u64,
        error: None,
    })
}
```

- [ ] **Step 2: Add futures-util dependency and enable reqwest stream feature**

In `src-tauri/Cargo.toml`:

1. Add `futures-util = "0.3"` on a new line after `regex = "1"`
2. Change the reqwest line from `reqwest = { version = "0.12", features = ["rustls-tls"] }` to `reqwest = { version = "0.12", features = ["rustls-tls", "stream"] }`

- [ ] **Step 3: Update lib.rs commands**

In `src-tauri/src/lib.rs`:

Replace the `run_speed_test` command (line 141-144):

```rust
#[tauri::command]
async fn run_speed_test() -> Result<speed_test::SpeedResult, String> {
    speed_test::run_speed_test().await
}
```

With:

```rust
#[tauri::command]
async fn run_speed_test(app: tauri::AppHandle<tauri::Wry>) -> Result<speed_test::SpeedTestResult, String> {
    speed_test::run_speed_test(app).await
}

#[tauri::command]
fn cancel_speed_test() {
    speed_test::cancel_speed_test();
}
```

Add `cancel_speed_test` to the invoke handler. Update the `generate_handler![]` in `src-tauri/src/lib.rs` to:

```rust
.invoke_handler(tauri::generate_handler![
    run_benchmark,
    execute_admin_apply,
    execute_admin_restore,
    run_speed_test,
    cancel_speed_test,
    run_ping,
    run_traceroute,
    cancel_ping,
    cancel_traceroute,
    run_dns_leak_test,
])
```

- [ ] **Step 4: Build to verify**

Run: `cd /Users/acchuang/Project/dns-wizard && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20`

Expected: Compiles with no errors

---

## Chunk 2: TypeScript Types

### Task 2: Update types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Replace SpeedResult section and add new types**

Replace lines 33-44 (the Speed Test section and SpeedTestState):

```typescript
// --- Speed Test ---
export interface SpeedServer {
  name: string;
  url: string;
}

export interface ServerResult {
  name: string;
  downloadMbps: number;
  bytesReceived: number;
  elapsedMs: number;
  error: string | null;
}

export interface SpeedTestResult {
  results: ServerResult[];
  averageMbps: number;
  cancelled: boolean;
}

export interface SpeedProgressEvent {
  bytesReceived: number;
  elapsedMs: number;
  currentMbps: number;
  name: string;
}

export interface SpeedHistoryEntry {
  timestamp: string;
  servers: ServerResult[];
  averageMbps: number;
}

export interface SpeedTestState {
  status: "idle" | "running" | "done" | "error" | "cancelled";
  result: SpeedTestResult | null;
  error: string | null;
  currentMbps: number;
  currentServer: string | null;
  serverResults: ServerResult[];
}
```

- [ ] **Step 2: Update App.tsx initial state**

In `src/App.tsx`, replace line 10:

```typescript
const initialSpeed: SpeedTestState = { status: "idle", result: null, error: null };
```

With:

```typescript
const initialSpeed: SpeedTestState = { status: "idle", result: null, error: null, currentMbps: 0, currentServer: null, serverResults: [] };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit 2>&1 | head -20`

Expected: Type errors in SpeedPanel.tsx/SpeedGauge.tsx (expected — we'll fix those next)

---

## Chunk 3: SpeedGauge Visuals

### Task 3: Rewrite SpeedGauge with enhanced visuals

**Files:**
- Modify: `src/components/SpeedGauge.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Add pulse keyframes to CSS**

In `src/styles/index.css`, after the `@keyframes spin` block (line 43), add:

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.speed-gauge-tick line {
  stroke: #475569;
  stroke-width: 1.5;
}

.speed-gauge-tick text {
  fill: #64748b;
  font-size: 11px;
}
```

- [ ] **Step 2: Rewrite SpeedGauge.tsx**

Replace entire contents of `src/components/SpeedGauge.tsx` with:

```typescript
import { useEffect, useRef, useState } from "react";
import { SpeedTestResult } from "../types";

interface Props {
  result: SpeedTestResult | null;
  currentMbps: number;
  status: "idle" | "running" | "done" | "error" | "cancelled";
  serverName: string | null;
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

function SpeedGauge({ result, currentMbps, status, serverName }: Props) {
  const [animatedMbps, setAnimatedMbps] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const targetRef = useRef<number>(0);

  const displayMbps = status === "running" ? currentMbps : animatedMbps;
  const gaugeMax = getGaugeMax(status === "done" && result ? result.averageMbps : displayMbps);
  const arcColor = getArcColor(displayMbps);

  useEffect(() => {
    if (status !== "done" || !result) {
      setAnimatedMbps(0);
      return;
    }

    targetRef.current = result.averageMbps;
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

  const pulseStyle: React.CSSProperties = status === "running"
    ? { animation: "pulse 1.5s ease-in-out infinite" }
    : {};

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <path d={fullBgArc(gaugeMax)} fill="none" stroke="#1e293b" strokeWidth={STROKE} strokeLinecap="round" />
        {(displayMbps > 0 || status === "running") && (
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
        {status === "running" && (
          <>
            <span style={{ fontSize: 28, fontWeight: 700, color: arcColor }}>
              {currentMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: "#64748b" }}>Mbps</span>
            {serverName && (
              <span style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{serverName}</span>
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

- [ ] **Step 3: Verify no TypeScript errors in gauge**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit 2>&1 | grep -i gauge`

Expected: No errors (SpeedPanel may still error)

---

## Chunk 4: SpeedPanel Integration

### Task 4: Rewrite SpeedPanel with events, multi-server results, cancel, and history

**Files:**
- Modify: `src/components/SpeedPanel.tsx`

- [ ] **Step 1: Rewrite SpeedPanel.tsx — core flow, event listeners, cancel**

Replace entire contents of `src/components/SpeedPanel.tsx` with:

```typescript
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { SpeedTestState, SpeedProgressEvent, ServerResult, SpeedHistoryEntry, SpeedTestResult } from "../types";
import SpeedGauge from "./SpeedGauge";

interface Props {
  state: SpeedTestState;
  setState: React.Dispatch<React.SetStateAction<SpeedTestState>>;
}

const HISTORY_KEY = "dnswizard-speed-history";

function loadHistory(): SpeedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
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

function SpeedPanel({ state, setState }: Props) {
  const runTest = async () => {
    setState({ status: "running", result: null, error: null, currentMbps: 0, currentServer: null, serverResults: [] });

    let unlistenProgress: UnlistenFn | null = null;
    let unlistenServerDone: UnlistenFn | null = null;

    try {
      unlistenProgress = await listen<SpeedProgressEvent>("speed-progress", (e) => {
        setState((prev) => ({
          ...prev,
          currentMbps: e.payload.currentMbps,
          currentServer: e.payload.name,
        }));
      });

      unlistenServerDone = await listen<ServerResult>("speed-server-done", (e) => {
        setState((prev) => ({
          ...prev,
          serverResults: [...prev.serverResults, e.payload],
        }));
      });

      const testResult = await invoke<SpeedTestResult>("run_speed_test");

      saveHistory({
        timestamp: new Date().toISOString(),
        servers: testResult.results,
        averageMbps: testResult.averageMbps,
      });

      if (testResult.cancelled && testResult.results.some((r: ServerResult) => !r.error)) {
        setState((prev) => ({
          ...prev,
          status: "cancelled" as const,
          result: testResult,
          currentMbps: testResult.averageMbps,
          currentServer: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "done" as const,
          result: testResult,
          currentMbps: testResult.averageMbps,
          currentServer: null,
        }));
      }
    } catch (e) {
      if (String(e).includes("cancelled")) {
        setState((prev) => ({
          ...prev,
          status: "cancelled" as const,
          currentServer: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "error" as const,
          error: String(e),
          currentServer: null,
        }));
      }
    } finally {
      unlistenProgress?.();
      unlistenServerDone?.();
    }
  };

  const cancelTest = () => {
    invoke("cancel_speed_test");
  };

  const history = loadHistory();
  const maxSpeed = state.serverResults
    .filter((r) => !r.error)
    .reduce((max, r) => Math.max(max, r.downloadMbps), 0);

  const statsData = history.length > 0
    ? {
        min: Math.min(...history.map((h) => h.averageMbps)),
        max: Math.max(...history.map((h) => h.averageMbps)),
        avg: history.reduce((s, h) => s + h.averageMbps, 0) / history.length,
      }
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", gap: 16, overflowY: "auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
        Speed Test
      </h2>

      <SpeedGauge
        result={state.result}
        currentMbps={state.currentMbps}
        status={state.status}
        serverName={state.currentServer}
      />

      {state.serverResults.length > 0 && (
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 6 }}>
          {state.serverResults.map((sr, i) => {
            const barWidth = sr.error ? 0 : maxSpeed > 0 ? (sr.downloadMbps / maxSpeed) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 100, color: sr.error ? "#ef4444" : "#94a3b8", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {sr.name}
                </span>
                {sr.error ? (
                  <span style={{ color: "#ef4444", fontSize: 12 }}>
                    Failed: {sr.error.length > 30 ? sr.error.slice(0, 30) + "..." : sr.error}
                  </span>
                ) : (
                  <>
                    <div style={{ flex: 1, height: 8, backgroundColor: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${barWidth}%`, height: "100%", backgroundColor: getBarColor(sr.downloadMbps), borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                    <span style={{ width: 80, textAlign: "right" as const, color: "#e2e8f0", fontWeight: 600, flexShrink: 0 }}>
                      {sr.downloadMbps.toFixed(1)} Mbps
                    </span>
                  </>
                )}
              </div>
            );
          })}
          {state.result && (
            <div style={{ borderTop: "1px solid #334155", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#94a3b8" }}>Average</span>
              <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{state.result.averageMbps.toFixed(1)} Mbps</span>
            </div>
          )}
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
              <span style={{ color: "#94a3b8" }}>Avg {h.averageMbps.toFixed(1)} Mbps</span>
            </div>
          ))}
          {stats && (
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: 4, marginTop: 4, fontSize: 11, color: "#475569", display: "flex", justifyContent: "space-between" }}>
              <span>Min: {stats.min.toFixed(1)}</span>
              <span>Avg: {stats.avg.toFixed(1)}</span>
              <span>Max: {stats.max.toFixed(1)}</span>
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

## Chunk 5: Integration & Build Verification

### Task 5: Full build and smoke test

**Files:** (none new)

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`

Expected: Clean

- [ ] **Step 2: Run Rust build**

Run: `cd /Users/acchuang/Project/dns-wizard && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`

Expected: Compiles successfully

- [ ] **Step 3: Run Vite build**

Run: `cd /Users/acchuang/Project/dns-wizard && npx vite build 2>&1 | tail -10`

Expected: Build succeeds

- [ ] **Step 4: Run full Tauri build**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tauri build 2>&1 | tail -20`

Expected: DMG builds successfully

- [ ] **Step 5: Commit all changes**

```bash
cd /Users/acchuang/Project/dns-wizard && git add -A && git commit -m "feat: enhanced speed test — live progress, multi-server, rich gauge, history"
```