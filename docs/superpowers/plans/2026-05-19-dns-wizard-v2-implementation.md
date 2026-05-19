# DNS Wizard v2 — Network Utilities Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand DNS Wizard from a single-purpose DNS tool into a 4-tool network utility suite with Speed Test, Ping/Traceroute, and DNS Leak Test.

**Architecture:** Sidebar navigation switches between 4 panel components. Each tool has its own Rust backend module with Tauri commands and its own React panel component. Existing DNS wizard code is extracted into `DnsPanel.tsx` without logic changes.

**Tech Stack:** Tauri 2, React 18, TypeScript, Rust, hickory-resolver, reqwest (speed test), regex (validation), system traceroute binary

---

## Chunk 1: Sidebar Navigation + App Restructuring

### Task 1: Add new types to types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new type definitions**

Add the following types after the existing `WizardState` interface:

```typescript
// --- Navigation ---
export type ActiveTool = "dns" | "speed" | "ping" | "leak";

// --- Speed Test ---
export interface SpeedResult {
  downloadMbps: number;
  bytesReceived: number;
  elapsedMs: number;
}

export interface SpeedTestState {
  status: "idle" | "running" | "done" | "error";
  result: SpeedResult | null;
  error: string | null;
}

// --- Ping / Traceroute ---
export interface PingResult {
  seq: number;
  latencyMs: number | null;
  success: boolean;
}

export interface HopResult {
  hop: number;
  host: string;
  latencyMs: number | null;
  success: boolean;
}

export interface PingState {
  host: string;
  mode: "ping" | "traceroute";
  isRunning: boolean;
  results: PingResult[] | HopResult[];
  error: string | null;
}

// --- DNS Leak Test ---
export interface LeakResult {
  configuredServers: string[];
  detectedServers: string[];
  isLeaking: boolean | null;
}

export interface LeakTestState {
  status: "idle" | "running" | "done" | "error";
  result: LeakResult | null;
  error: string | null;
}

// --- Expanded profiles ---
export type Profile =
  | "Gamer"
  | "Privacy"
  | "Family"
  | "AdBlock"
  | "Balanced"
  | "ControlD"
  | "OpenDNS"
  | "Comodo";

export interface ProfileDef {
  id: Profile;
  label: string;
  description: string;
  icon: "zap" | "shield" | "users" | "ban" | "scale" | "filter" | "lock" | "shieldCheck";
}
```

Remove the old `Profile`, `ProfileDef`, and `ADMIN_ERROR_MESSAGE` types. Keep `DnsProvider`, `ConfigResult`, `WizardState`, and `UNREACHABLE_SENTINEL` as-is.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`
Expected: No errors (the new types are self-contained; old components will break until we update them in later tasks, but tsc won't check JSX imports for unused types)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add types for speed test, ping, leak test, and expanded profiles"
```

### Task 2: Create Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar.tsx**

```tsx
import { Globe, Zap, Radio, SearchCheck } from "lucide-react";
import { ActiveTool } from "../types";

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
}

const tools: { id: ActiveTool; icon: typeof Globe; label: string }[] = [
  { id: "dns", icon: Globe, label: "DNS" },
  { id: "speed", icon: Zap, label: "Speed" },
  { id: "ping", icon: Radio, label: "Ping" },
  { id: "leak", icon: SearchCheck, label: "Leak" },
];

const sidebarStyle: React.CSSProperties = {
  width: 48,
  minHeight: "100%",
  backgroundColor: "#0f172a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 16,
  gap: 4,
};

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: 8,
  border: "none",
  backgroundColor: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "#64748b",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 0.2s",
});

function Sidebar({ activeTool, onToolChange }: Props) {
  return (
    <div style={sidebarStyle}>
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            style={btnStyle(activeTool === tool.id)}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
}

export default Sidebar;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Sidebar navigation component"
```

### Task 3: Extract DNS wizard into DnsPanel.tsx

**Files:**
- Create: `src/components/DnsPanel.tsx` (copy from current `App.tsx`)
- Modify: `src/App.tsx` (replace with tool switcher)

- [ ] **Step 1: Create DnsPanel.tsx**

Copy the entire current `App.tsx` into `src/components/DnsPanel.tsx`. Rename the function from `App` to `DnsPanel` and export it. The file should contain all the current DNS wizard state (`WizardState`, `initialState`, all callbacks, all JSX). No changes to the logic — just a rename.

- [ ] **Step 2: Rewrite App.tsx as tool switcher**

Replace `src/App.tsx` with:

```tsx
import { useState } from "react";
import { ActiveTool, SpeedTestState, PingState, LeakTestState } from "./types";
import Sidebar from "./components/Sidebar";
import DnsPanel from "./components/DnsPanel";
import SpeedPanel from "./components/SpeedPanel";
import PingPanel from "./components/PingPanel";
import LeakPanel from "./components/LeakPanel";

const initialSpeed: SpeedTestState = { status: "idle", result: null, error: null };
const initialPing: PingState = { host: "cloudflare.com", mode: "ping", isRunning: false, results: [], error: null };
const initialLeak: LeakTestState = { status: "idle", result: null, error: null };

function App() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("dns");
  const [speedState, setSpeedState] = useState<SpeedTestState>(initialSpeed);
  const [pingState, setPingState] = useState<PingState>(initialPing);
  const [leakState, setLeakState] = useState<LeakTestState>(initialLeak);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#1a1a2e" }}>
      <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {activeTool === "dns" && <DnsPanel />}
        {activeTool === "speed" && <SpeedPanel state={speedState} setState={setSpeedState} />}
        {activeTool === "ping" && <PingPanel state={pingState} setState={setPingState} />}
        {activeTool === "leak" && <LeakPanel state={leakState} setState={setLeakState} />}
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Remove `#root` padding from index.css**

In `src/styles/index.css`, change the `#root` padding from `padding: 40px 24px 24px` to `padding: 0`. The sidebar handles its own layout now.

- [ ] **Step 4: Verify app compiles and renders DNS panel**

Note: SpeedPanel, PingPanel, LeakPanel don't exist yet. Create stubs:

Create `src/components/SpeedPanel.tsx`:
```tsx
const SpeedPanel = () => <div style={{ padding: 24, color: "#e2e8f0" }}>Speed Test — coming soon</div>;
export default SpeedPanel;
```

Create `src/components/PingPanel.tsx`:
```tsx
const PingPanel = () => <div style={{ padding: 24, color: "#e2e8f0" }}>Ping — coming soon</div>;
export default PingPanel;
```

Create `src/components/LeakPanel.tsx`:
```tsx
const LeakPanel = () => <div style={{ padding: 24, color: "#e2e8f0" }}>DNS Leak Test — coming soon</div>;
export default LeakPanel;
```

- [ ] **Step 5: Build and verify**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`
Expected: No type errors

Run: `cd /Users/acchuang/Project/dns-wizard && npm run build`
Expected: Vite build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/DnsPanel.tsx src/components/Sidebar.tsx src/components/SpeedPanel.tsx src/components/PingPanel.tsx src/components/LeakPanel.tsx src/styles/index.css
git commit -m "feat: add sidebar navigation, extract DnsPanel, add stub panels"
```

### Task 4: Add 3 new DNS profiles to Rust backend

**Files:**
- Modify: `src-tauri/src/profiles.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add new profile variants to profiles.rs**

Add three new enum variants and their provider mappings:

```rust
// In the UserProfile enum, add:
ControlD,
OpenDNS,
Comodo,

// In get_profile_providers, add:
UserProfile::ControlD => vec![
    DnsProvider { name: "Control D".to_string(), ip: "76.76.2.0".to_string(), latency: None },
    DnSProvider { name: "Control D Alt".to_string(), ip: "76.76.10.0".to_string(), latency: None },
],
UserProfile::OpenDNS => vec![
    DnsProvider { name: "OpenDNS".to_string(), ip: "208.67.222.222".to_string(), latency: None },
    DnsProvider { name: "OpenDNS Family".to_string(), ip: "208.67.220.220".to_string(), latency: None },
],
UserProfile::Comodo => vec![
    DnsProvider { name: "Comodo Secure".to_string(), ip: "8.26.56.26".to_string(), latency: None },
    DnsProvider { name: "Comodo Secure Alt".to_string(), ip: "8.20.247.20".to_string(), latency: None },
],
```

- [ ] **Step 2: Add new profile names to lib.rs match**

In `src-tauri/src/lib.rs`, add to the `run_benchmark` match:

```rust
"ControlD" => UserProfile::ControlD,
"OpenDNS" => UserProfile::OpenDNS,
"Comodo" => UserProfile::Comodo,
```

- [ ] **Step 3: Add new profile cards to Step1_ChooseProfile.tsx**

Add these entries to the `profiles` array:

```tsx
{ id: "ControlD", label: "Control D", description: "Filtering & customization", icon: "filter" },
{ id: "OpenDNS", label: "OpenDNS", description: "Security & parental controls", icon: "lock" },
{ id: "Comodo", label: "Comodo Secure", description: "Malware & phishing protection", icon: "shieldCheck" },
```

Update the grid style in `Step1_ChooseProfile.tsx` to use `gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))"` instead of `flexWrap: wrap` to accommodate 8 cards neatly.

Import `Filter`, `Lock`, and `ShieldCheck` from `lucide-react` in `ProfileCard.tsx` and add them to the `iconMap`.

- [ ] **Step 4: Run Rust tests**

Run: `cd /Users/acchuang/Project/dns-wizard/src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/profiles.rs src-tauri/src/lib.rs src/components/Step1_ChooseProfile.tsx src/components/ProfileCard.tsx
git commit -m "feat: add ControlD, OpenDNS, Comodo DNS profiles"
```

---

## Chunk 2: Speed Test

### Task 5: Add reqwest dependency and create speed_test.rs

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/speed_test.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add reqwest to Cargo.toml**

Add to `[dependencies]`:

```toml
reqwest = { version = "0.12", features = ["rustls-tls"] }
```

- [ ] **Step 2: Create speed_test.rs**

```rust
use serde::{Serialize, Deserialize};
use std::time::Instant;

#[derive(Serialize, Deserialize, Debug, Clone)]
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
```

- [ ] **Step 3: Register command in lib.rs**

Add `mod speed_test;` and register `speed_test::run_speed_test` as `run_speed_test` in the invoke handler:

```rust
mod speed_test;
// ... 
.invoke_handler(tauri::generate_handler![
    run_benchmark,
    execute_admin_apply,
    execute_admin_restore,
    run_speed_test,
])
```

- [ ] **Step 4: Verify Rust compiles**

Run: `cd /Users/acchuang/Project/dns-wizard/src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/speed_test.rs src-tauri/src/lib.rs
git commit -m "feat: add speed test Rust backend with Cloudflare + fallback URLs"
```

### Task 6: Create SpeedPanel and SpeedGauge components

**Files:**
- Replace: `src/components/SpeedPanel.tsx` (stub → full)
- Create: `src/components/SpeedGauge.tsx`

- [ ] **Step 1: Create SpeedGauge.tsx**

```tsx
import { SpeedResult } from "../types";

interface Props {
  result: SpeedResult | null;
  status: "idle" | "running" | "done" | "error";
}

const gaugeContainer: React.CSSProperties = {
  width: 200,
  height: 200,
  borderRadius: "50%",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const gaugeInner: React.CSSProperties = {
  width: 160,
  height: 160,
  borderRadius: "50%",
  backgroundColor: "#1a1a2e",
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

function SpeedGauge({ result, status }: Props) {
  const maxMbps = 100;
  const ratio = result ? Math.min(result.downloadMbps / maxMbps, 1) : 0;
  const degrees = ratio * 270;

  const background = status === "running"
    ? "conic-gradient(#334155 0deg, #334155 270deg, transparent 270deg)"
    : `conic-gradient(#7c3aed 0deg, #7c3aed ${degrees}deg, #334155 ${degrees}deg, #334155 270deg, transparent 270deg)`;

  return (
    <div style={{ ...gaugeContainer, background }}>
      <div style={gaugeInner}>
        {status === "running" && (
          <span style={{ fontSize: 14, color: "#94a3b8" }}>Testing...</span>
        )}
        {status === "done" && result && (
          <>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#e2e8f0" }}>
              {result.downloadMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 14, color: "#64748b" }}>Mbps</span>
          </>
        )}
        {status === "idle" && (
          <span style={{ fontSize: 14, color: "#64748b" }}>Mbps</span>
        )}
      </div>
    </div>
  );
}

export default SpeedGauge;
```

- [ ] **Step 2: Replace SpeedPanel.tsx**

```tsx
import { invoke } from "@tauri-apps/api/core";
import { SpeedTestState, SpeedResult } from "../types";
import SpeedGauge from "./SpeedGauge";

interface Props {
  state: SpeedTestState;
  setState: React.Dispatch<React.SetStateAction<SpeedTestState>>;
}

const btnBase: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

function SpeedPanel({ state, setState }: Props) {
  const runTest = async () => {
    setState({ status: "running", result: null, error: null });
    try {
      const result = await invoke<SpeedResult>("run_speed_test");
      setState({ status: "done", result, error: null });
    } catch (e) {
      setState({ status: "error", result: null, error: String(e) });
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Speed Test</h2>
      <SpeedGauge result={state.result} status={state.status} />
      {state.status === "done" && state.result && (
        <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
          <div>{state.result.bytesReceived.toLocaleString()} bytes received</div>
          <div>{state.result.elapsedMs} ms elapsed</div>
        </div>
      )}
      {state.error && (
        <p style={{ color: "#ef4444", fontSize: 13, margin: 0, textAlign: "center" }}>{state.error}</p>
      )}
      <button
        style={{
          ...btnBase,
          backgroundColor: state.status === "running" ? "#334155" : "#7c3aed",
          color: state.status === "running" ? "#64748b" : "#fff",
          cursor: state.status === "running" ? "not-allowed" : "pointer",
        }}
        disabled={state.status === "running"}
        onClick={runTest}
      >
        {state.status === "running" ? "Testing..." : state.status === "done" ? "Test Again" : "Start Test"}
      </button>
    </div>
  );
}

export default SpeedPanel;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/SpeedPanel.tsx src/components/SpeedGauge.tsx
git commit -m "feat: add SpeedPanel and SpeedGauge UI components"
```

---

## Chunk 3: Ping / Traceroute

### Task 7: Add regex dependency and create validate.rs

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/validate.rs`

- [ ] **Step 1: Add regex to Cargo.toml**

Add to `[dependencies]`:

```toml
regex = "1"
```

- [ ] **Step 2: Create validate.rs**

```rust
use regex::Regex;
use std::net::IpAddr;

const HOST_REGEX: &str = r"^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$";

pub fn validate_host(host: &str) -> Result<String, String> {
    let trimmed = host.trim();
    if trimmed.is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    if trimmed.len() > 253 {
        return Err("Host name too long".to_string());
    }
    let re = Regex::new(HOST_REGEX).map_err(|e| format!("Regex error: {}", e))?;
    if !re.is_match(trimmed) {
        return Err("Invalid host format".to_string());
    }
    if let Ok(ip) = trimmed.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err(format!("Cannot ping private/internal IP: {}", ip));
        }
    }
    Ok(trimmed.to_string())
}

fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            octets[0] == 127
            || octets[0] == 10
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] == 192 && octets[1] == 168)
            || (octets[0] == 169 && octets[1] == 254)
        }
        IpAddr::V6(_) => false,
    }
}

pub fn clamp_count(count: u32, min: u32, max: u32) -> u32 {
    count.max(min).min(max)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_host() {
        assert!(validate_host("cloudflare.com").is_ok());
        assert!(validate_host("1.1.1.1").is_ok());
        assert!(validate_host("8.8.8.8").is_ok());
    }

    #[test]
    fn test_invalid_host() {
        assert!(validate_host("").is_err());
        assert!(validate_host("host with spaces").is_err());
        assert!(validate_host("127.0.0.1").is_err());
        assert!(validate_host("10.0.0.1").is_err());
        assert!(validate_host("192.168.1.1").is_err());
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/acchuang/Project/dns-wizard/src-tauri && cargo test validate`
Expected: 2 tests pass

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/validate.rs
git commit -m "feat: add host validation module with private IP rejection"
```

### Task 8: Create ping.rs

**Files:**
- Create: `src-tauri/src/ping.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create ping.rs**

```rust
use serde::{Serialize, Deserialize};
use std::time::Instant;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PingResult {
    pub seq: u32,
    pub latency_ms: Option<f64>,
    pub success: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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

        match tokio::net::TcpStream::timeout(
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
```

- [ ] **Step 2: Register commands in lib.rs**

Add `mod ping;` and `mod validate;` at the top. Add commands:

```rust
mod validate;
mod ping;

use ping::{PingResult, HopResult};

#[tauri::command]
async fn run_ping(host: String, count: u32) -> Result<Vec<PingResult>, String> {
    let host = validate::validate_host(&host)?;
    let count = validate::clamp_count(count, 1, 20);
    ping::run_ping(host, count).await
}

#[tauri::command]
fn run_traceroute(host: String, max_hops: u32) -> Result<Vec<HopResult>, String> {
    let host = validate::validate_host(&host)?;
    let max_hops = validate::clamp_count(max_hops, 1, 30);
    ping::run_traceroute_sync(host, max_hops)
}

#[tauri::command]
fn cancel_ping() {
    ping::cancel_ping();
}

#[tauri::command]
fn cancel_traceroute() {
    ping::cancel_traceroute();
}
```

Add all 4 to the `invoke_handler`.

- [ ] **Step 3: Verify Rust compiles**

Run: `cd /Users/acchuang/Project/dns-wizard/src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ping.rs src-tauri/src/validate.rs src-tauri/src/lib.rs
git commit -m "feat: add ping and traceroute Rust backend with host validation"
```

### Task 9: Create PingPanel component

**Files:**
- Replace: `src/components/PingPanel.tsx` (stub → full)
- Create: `src/components/ResultTable.tsx`

- [ ] **Step 1: Create ResultTable.tsx**

```tsx
interface Column {
  key: string;
  label: string;
  width?: string;
}

interface Props {
  columns: Column[];
  rows: Record<string, React.ReactNode>[];
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  borderBottom: "1px solid #334155",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 14,
  borderBottom: "1px solid #1e293b",
};

function ResultTable({ columns, rows }: Props) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>{columns.map((col) => <th key={col.key} style={thStyle}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => <td key={col.key} style={tdStyle}>{row[col.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ResultTable;
```

- [ ] **Step 2: Replace PingPanel.tsx**

```tsx
import { invoke } from "@tauri-apps/api/core";
import { PingState, PingResult, HopResult } from "../types";
import ResultTable from "./ResultTable";

interface Props {
  state: PingState;
  setState: React.Dispatch<React.SetStateAction<PingState>>;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  backgroundColor: "#16213e",
  color: "#e2e8f0",
  fontSize: 14,
  width: 200,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#7c3aed",
  color: "#fff",
};

const cancelBtnStyle: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
};

const presets = [
  { label: "Cloudflare", host: "1.1.1.1" },
  { label: "Google", host: "8.8.8.8" },
  { label: "Quad9", host: "9.9.9.9" },
];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px",
  borderRadius: 6,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "#64748b",
});

function PingPanel({ state, setState }: Props) {
  const runTest = async () => {
    setState((prev) => ({ ...prev, isRunning: true, results: [], error: null }));
    try {
      if (state.mode === "ping") {
        const results = await invoke<PingResult[]>("run_ping", { host: state.host, count: 5 });
        setState((prev) => ({ ...prev, isRunning: false, results }));
      } else {
        const results = await invoke<HopResult[]>("run_traceroute", { host: state.host, maxHops: 20 });
        setState((prev) => ({ ...prev, isRunning: false, results }));
      }
    } catch (e) {
      setState((prev) => ({ ...prev, isRunning: false, error: String(e) }));
    }
  };

  const cancel = () => {
    if (state.mode === "ping") {
      invoke("cancel_ping");
    } else {
      invoke("cancel_traceroute");
    }
    setState((prev) => ({ ...prev, isRunning: false }));
  };

  const pingColumns = [
    { key: "seq", label: "#" },
    { key: "latency", label: "Latency" },
    { key: "status", label: "Status" },
  ];

  const traceColumns = [
    { key: "hop", label: "Hop" },
    { key: "host", label: "Host" },
    { key: "latency", label: "Latency" },
  ];

  const rows = state.results.map((r: PingResult | HopResult) => {
    if ("seq" in r) {
      return {
        seq: r.seq,
        latency: r.latencyMs !== null ? `${r.latencyMs}ms` : "—",
        status: r.success ? "✓" : "✗",
      };
    }
    const h = r as HopResult;
    return { hop: h.hop, host: h.host, latency: h.latencyMs !== null ? `${h.latencyMs}ms` : "—" };
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16, color: "#e2e8f0" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
        {state.mode === "ping" ? "Ping" : "Traceroute"}
      </h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={tabStyle(state.mode === "ping")} onClick={() => setState((prev) => ({ ...prev, mode: "ping", results: [], error: null }))}>Ping</button>
        <button style={tabStyle(state.mode === "traceroute")} onClick={() => setState((prev) => ({ ...prev, mode: "traceroute", results: [], error: null }))}>Traceroute</button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          style={inputStyle}
          value={state.host}
          onChange={(e) => setState((prev) => ({ ...prev, host: e.target.value }))}
          placeholder="cloudflare.com"
          disabled={state.isRunning}
        />
        {!state.isRunning ? (
          <button style={btnStyle} onClick={runTest}>Run</button>
        ) : (
          <button style={cancelBtnStyle} onClick={cancel}>Cancel</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {presets.map((p) => (
          <button
            key={p.host}
            style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #334155", background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            onClick={() => setState((prev) => ({ ...prev, host: p.host, results: [], error: null }))}
            disabled={state.isRunning}
          >
            {p.label}
          </button>
        ))}
      </div>
      {state.error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{state.error}</p>}
      {rows.length > 0 && (
        <ResultTable columns={state.mode === "ping" ? pingColumns : traceColumns} rows={rows} />
      )}
    </div>
  );
}

export default PingPanel;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/PingPanel.tsx src/components/ResultTable.tsx
git commit -m "feat: add PingPanel and ResultTable UI components"
```

---

## Chunk 4: DNS Leak Test + Final Wiring

### Task 10: Create dns_leak.rs

**Files:**
- Create: `src-tauri/src/dns_leak.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create dns_leak.rs**

```rust
use hickory_resolver::TokioAsyncResolver;
use hickory_resolver::config::{ResolverConfig, ResolverOpts};
use serde::{Serialize, Deserialize};
use std::net::IpAddr;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DnsLeakResult {
    pub configured_servers: Vec<String>,
    pub detected_servers: Vec<String>,
    pub is_leaking: Option<bool>,
}

pub async fn run_dns_leak_test(configured_servers: Vec<String>) -> Result<DnsLeakResult, String> {
    let config = ResolverConfig::default();
    let opts = ResolverOpts::default();

    let resolver = TokioAsyncResolver::tokio(config, opts);

    let mut detected: Vec<String> = Vec::new();

    // Primary: whoami.ds.akahelp.net returns the IP of the resolving server
    match resolver.lookup_ip("whoami.ds.akahelp.net").await {
        Ok(response) => {
            for ip in response.iter() {
                detected.push(ip.to_string());
            }
        }
        Err(_) => {}
    }

    // Secondary: resolver.dnscrypt.info
    match resolver.lookup_ip("resolver.dnscrypt.info").await {
        Ok(response) => {
            for ip in response.iter() {
                if !detected.contains(&ip.to_string()) {
                    detected.push(ip.to_string());
                }
            }
        }
        Err(_) => {}
    }

    // Deduplicate
    detected.sort();
    detected.dedup();

    let is_leaking = if configured_servers.is_empty() {
        None // Can't determine without a baseline
    } else {
        let configured_set: std::collections::HashSet<String> = configured_servers.iter().cloned().collect();
        let detected_set: std::collections::HashSet<String> = detected.iter().cloned().collect();

        // Leaking if ANY detected server is not in the configured set
        let has_leak = detected_set.iter().any(|d| !configured_set.contains(d));
        let has_match = detected_set.iter().any(|d| configured_set.contains(d));

        Some(if has_leak && has_match { false } else if has_leak { true } else { false })
    };

    Ok(DnsLeakResult {
        configured_servers,
        detected_servers: detected,
        is_leaking,
    })
}
```

- [ ] **Step 2: Register command in lib.rs**

Add `mod dns_leak;` and register:

```rust
mod dns_leak;

#[tauri::command]
async fn run_dns_leak_test(configured_servers: Vec<String>) -> Result<dns_leak::DnsLeakResult, String> {
    dns_leak::run_dns_leak_test(configured_servers).await
}
```

Add `run_dns_leak_test` to the invoke handler.

- [ ] **Step 3: Verify Rust compiles**

Run: `cd /Users/acchuang/Project/dns-wizard/src-tauri && cargo check`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/dns_leak.rs src-tauri/src/lib.rs
git commit -m "feat: add DNS leak test Rust backend"
```

### Task 11: Create LeakPanel component

**Files:**
- Replace: `src/components/LeakPanel.tsx` (stub → full)

- [ ] **Step 1: Replace LeakPanel.tsx**

```tsx
import { invoke } from "@tauri-apps/api/core";
import { LeakTestState, LeakResult } from "../types";
import ResultTable from "./ResultTable";

interface Props {
  state: LeakTestState;
  setState: React.Dispatch<React.SetStateAction<LeakTestState>>;
  configuredDns: string[];
}

const btnStyle: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#7c3aed",
  color: "#fff",
};

function LeakPanel({ state, setState, configuredDns }: Props) {
  const runTest = async () => {
    setState({ status: "running", result: null, error: null });
    try {
      const result = await invoke<LeakResult>("run_dns_leak_test", {
        configuredServers: configuredDns,
      });
      setState({ status: "done", result, error: null });
    } catch (e) {
      setState({ status: "error", result: null, error: String(e) });
    }
  };

  const { result } = state;

  const statusColor = result?.isLeaking === true ? "#ef4444"
    : result?.isLeaking === false ? "#10b981"
    : "#eab308";

  const statusText = result?.isLeaking === true
    ? "DNS leak detected — queries are not going through your configured servers"
    : result?.isLeaking === false
    ? "No leak detected — all queries go through your configured DNS"
    : result?.isLeaking === null
    ? "No baseline — apply a DNS profile first to compare"
    : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16, color: "#e2e8f0" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>DNS Leak Test</h2>

      <button
        style={{ ...btnStyle, opacity: state.status === "running" ? 0.5 : 1 }}
        disabled={state.status === "running"}
        onClick={runTest}
      >
        {state.status === "running" ? "Testing..." : "Start Leak Test"}
      </button>

      {state.error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{state.error}</p>}

      {result && (
        <>
          <p style={{ fontSize: 16, fontWeight: 600, color: statusColor, margin: 0 }}>{statusText}</p>

          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>Your DNS Servers</h3>
              {result.configuredServers.length === 0 ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>None configured (using DHCP)</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {result.configuredServers.map((s) => <li key={s} style={{ fontSize: 13 }}>{s}</li>)}
                </ul>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>Detected Servers</h3>
              {result.detectedServers.length === 0 ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>None detected</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {result.detectedServers.map((s) => <li key={s} style={{ fontSize: 13 }}>{s}</li>)}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeakPanel;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/LeakPanel.tsx
git commit -m "feat: add LeakPanel UI component"
```

### Task 12: Wire up all panels in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx to pass DNS state to LeakPanel**

The LeakPanel needs the currently configured DNS servers. Update App.tsx to pass the DNS wizard's selected IPs:

```tsx
// In the leak panel section:
{activeTool === "leak" && (
  <LeakPanel
    state={leakState}
    setState={setLeakState}
    configuredDns={
      dnsState.applied && dnsState.selectedIp
        ? [dnsState.selectedIp, dnsState.selectedSecondaryIp ?? ""].filter(Boolean)
        : []
    }
  />
)}
```

This requires `dnsState` to be accessible. Since DnsPanel manages its own state internally, we need to either:
a) Lift the dns state up to App (complex refactor)
b) Pass a callback from App to DnsPanel that reports applied DNS servers

**Option b** is simpler. Add an `onDnsApplied` callback prop to DnsPanel:

In `DnsPanel.tsx`, add:
```tsx
interface Props {
  onDnsApplied?: (primary: string | null, secondary: string | null) => void;
}
```

Call it when DNS is applied in the `authorizeApply` callback. In App.tsx, store the applied DNS IPs in state:

```tsx
const [appliedDns, setAppliedDns] = useState<string[]>([]);
```

And pass `configuredDns={appliedDns}` to LeakPanel.

- [ ] **Step 2: Verify full build**

Run: `cd /Users/acchuang/Project/dns-wizard && npm run tauri build 2>&1 | tail -10`
Expected: Build succeeds, DMG produced

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/DnsPanel.tsx src/components/LeakPanel.tsx
git commit -m "feat: wire up all panels and pass DNS state to leak test"
```

### Task 13: Final integration test and build

- [ ] **Step 1: Run Rust tests**

Run: `cd /Users/acchuang/Project/dns-wizard/src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript check**

Run: `cd /Users/acchuang/Project/dns-wizard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build DMG**

Run: `cd /Users/acchuang/Project/dns-wizard && npm run tauri build`
Expected: DMG produced at `src-tauri/target/release/bundle/dmg/DNS Wizard_1.0.0_aarch64.dmg`

- [ ] **Step 4: Manually test in dev mode**

Run: `cd /Users/acchuang/Project/dns-wizard && npm run tauri dev`
Test:
1. DNS tab: select profile, benchmark, verify results show
2. Speed tab: click Start Test, verify download speed shows
3. Ping tab: enter host, click Run, verify ping results
4. Traceroute: switch mode, click Run, verify hops show
5. Leak tab: click Start (without DNS applied → shows "No baseline"), apply DNS first, then test
6. Sidebar: verify switching between all 4 tabs works

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: DNS Wizard v2 — network utility suite complete"
```