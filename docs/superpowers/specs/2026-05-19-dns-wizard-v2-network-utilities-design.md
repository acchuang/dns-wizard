# DNS Wizard v2 — Network Utility Suite Design Spec

**Date:** 2026-05-19  
**Status:** Draft v2 (reviewed)

## Overview

Expand DNS Wizard from a 3-step DNS configuration tool into a 4-tool network utility suite, keeping the existing DNS wizard flow intact and adding Speed Test, Ping/Traceroute, and DNS Leak Test as separate panels accessible via a sidebar.

## Architecture

### Navigation

Replace the current single-wizard layout with a sidebar + content area:

```
┌──────────────────────────────────────┐
│  DNS Wizard                          │
├──────┬───────────────────────────────┤
│ 🌐   │                               │
│ DNS  │      Active panel content      │
│ ⚡   │                               │
│Speed │                               │
│ 📡   │                               │
│ Ping │                               │
│ 🔍   │                               │
│ Leak │                               │
│      │                               │
└──────┴───────────────────────────────┘
```

- Sidebar: 48px wide, icon-only (Lucide icons), dark bg `#0f172a`
- Active tab highlighted with `#7c3aed` accent
- Content area: remaining width, houses the active tool's UI
- Window stays 520×640px, non-resizable, dark theme only

### App State

```typescript
type ActiveTool = "dns" | "speed" | "ping" | "leak";

interface AppState {
  activeTool: ActiveTool;
  dns: WizardState;       // existing state, renamed ref only
  speed: SpeedTestState;
  ping: PingState;
  leak: LeakTestState;
}
```

## Type Definitions

All shared types live in `src/types.ts`. Rust structs use `#[serde(rename_all = "camelCase")]` to match.

```typescript
// --- DNS Wizard (existing, unchanged) ---
export interface DnsProvider { name: string; ip: string; latency: number | null; }
export interface ConfigResult { success: boolean; message: string; }
export type Profile = "Gamer" | "Privacy" | "Family" | "AdBlock" | "Balanced" | "ControlD" | "OpenDNS" | "Comodo";
export const UNREACHABLE_SENTINEL = 99999;

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
  latencyMs: number | null;  // null on failure
  success: boolean;
}
export interface HopResult {
  hop: number;
  host: string;
  latencyMs: number | null;  // null on timeout
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
  isLeaking: boolean | null;  // null = can't determine (no baseline)
}
export interface LeakTestState {
  status: "idle" | "running" | "done" | "error";
  result: LeakResult | null;
  error: string | null;
}

// --- Navigation ---
export type ActiveTool = "dns" | "speed" | "ping" | "leak";
```

## Tool 1: DNS Wizard (Existing)

No changes to the current 3-step flow. The existing `App.tsx` state is extracted into `DnsPanel.tsx` and renders when `activeTool === "dns"`.

### New DNS Profiles

Add 3 more profiles to `profiles.rs` and `Step1_ChooseProfile.tsx`:

| Profile ID | Label | Icon | Providers |
|------------|-------|------|-----------|
| `ControlD` | "Control D" | `filter` | 76.76.2.0, 76.76.10.0 |
| `OpenDNS` | "OpenDNS" | `lock` | 208.67.222.222, 208.67.220.220 |
| `Comodo` | "Comodo Secure" | `shieldCheck` | 8.26.56.26, 8.20.247.20 |

The `Profile` type gains: `"ControlD" | "OpenDNS" | "Comodo"`.  
The `ProfileDef.icon` union gains: `"filter" | "lock" | "shieldCheck"`.

Profile cards layout changes from a 2-column grid to a 3-column grid to accommodate 8 profiles.

## Tool 2: Speed Test

### Rust Backend

```rust
#[tauri::command]
async fn run_speed_test() -> Result<SpeedResult, String>
```

- Downloads 10MB from `https://speed.cloudflare.com/__down?bytes=10000000`
- **Fallback URL**: `https://proof.ovh.net/files/1Mb.dat` (smaller, for retry)
- Uses `reqwest` with a 30s timeout
- Measures bytes received / elapsed time → Mbps
- Returns `SpeedResult { download_mbps: f64, bytes_received: u64, elapsed_ms: u64 }`
- On Cloudflare failure, tries fallback URL before reporting error
- Clear error message: "Speed test server unreachable. Check your internet connection."

### Frontend State

```typescript
interface SpeedTestState {
  status: "idle" | "running" | "done" | "error";
  result: SpeedResult | null;
  error: string | null;
}
```

### UI

- Idle state: "Start Test" button, speed gauge at 0
- Running state: button disabled with "Testing..." text, gauge animating with `animation: spin 1s linear infinite` spinner overlay
- Done state: large Mbps number centered, gauge filled via `conic-gradient`, "Test Again" button
- Error state: red error text, "Retry" button

### Speed Gauge (`SpeedGauge.tsx`)

Circular gauge using CSS `conic-gradient`:
- Background track: `#334155`
- Filled arc: `#7c3aed`
- Maximum scale: 100 Mbps (anything above fills the full circle)
- Center: large Mbps number, smaller "Mbps" label below

### New Dependency

- `reqwest` with `rustls-tls` feature added to `Cargo.toml`

## Tool 3: Ping / Traceroute

### Rust Backend

```rust
#[tauri::command]
async fn run_ping(host: String, count: u32) -> Result<Vec<PingResult>, String>

#[tauri::command]
async fn run_traceroute(host: String, max_hops: u32) -> Result<Vec<HopResult>, String>
```

**Input validation (security):**
- `host`: must match `^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$` (valid hostname/IP format)
- Reject loopback (127.x.x.x), link-local (169.254.x.x), and private ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x) — these are internal IPs that should not be scanned
- `count`: clamped to 1–20 (max 20 pings)
- `max_hops`: clamped to 1–30
- Returns error string on validation failure

**Ping implementation:**
- TCP connect to `host:80` (no raw sockets, no root needed)
- Measures time to establish TCP connection
- Runs `count` pings sequentially
- Each ping has a 5s timeout
- Returns `{ seq: u32, latency_ms: Option<f64>, success: bool }`

**Traceroute implementation:**
- Shells out to macOS `traceroute` binary via `std::process::Command`
- Parses standard traceroute output (each line: `hop_number  hostname  (ip)  latency_ms`)
- Falls back to showing raw output if parsing fails
- Max 30 hops, 30s overall timeout
- Using system `traceroute` because TCP-based traceroute cannot retrieve hop IPs without raw ICMP sockets (which require root)

Rust structs:
```rust
#[derive(Serialize)]
struct PingResult { seq: u32, latency_ms: Option<f64>, success: bool }

#[derive(Serialize)]
struct HopResult { hop: u32, host: String, latency_ms: Option<f64>, success: bool }
```

### Frontend State

```typescript
interface PingState {
  host: string;
  mode: "ping" | "traceroute";
  isRunning: boolean;
  results: PingResult[] | HopResult[];
  error: string | null;
}
```

### UI

- Text input for host (defaults to "cloudflare.com")
- Preset quick-select chips: Cloudflare (1.1.1.1), Google (8.8.8.8), Quad9 (9.9.9.9)
- Tab toggle: "Ping" | "Traceroute" (defaults to Ping)
- "Run" button → disabled + "Cancel" button while running
- Results table: seq/hop, latency, status (✓/✗)
- Error text for validation failures

### Dependencies

- `regex` crate for host validation

## Tool 4: DNS Leak Test

### Rust Backend

```rust
#[tauri::command]
async fn run_dns_leak_test(configured_servers: Vec<String>) -> Result<DnsLeakResult, String>
```

**How it works:**
1. Resolves `whoami.ds.akahelp.net` using the system resolver → returns the IP of the recursive resolver that handled the query
2. Resolves multiple test domains via system resolver to detect which nameserver IPs respond:
   - `whoami.ds.akahelp.net` (primary)
   - `resolver.dnscrypt.info` (secondary check)
3. Compares detected server IPs against `configured_servers` (passed from frontend)
4. If `configured_servers` is empty (user hasn't applied a profile / is on DHCP), `is_leaking` is `null` — can't determine without a baseline

Returns:
```rust
struct DnsLeakResult {
    configured_servers: Vec<String>,
    detected_servers: Vec<String>,
    is_leaking: Option<bool>,  // None = can't determine
}
```

### Frontend State

```typescript
interface LeakTestState {
  status: "idle" | "running" | "done" | "error";
  result: LeakResult | null;
  error: string | null;
}
```

The frontend passes the currently applied DNS servers (from `dns.selectedIp` and `dns.selectedSecondaryIp`) to the backend. If no DNS has been applied, passes empty array → `isLeaking` will be `null`.

### UI

- Idle: "Start Leak Test" button, note about configuring DNS first if none applied
- Running: spinner
- Done with `isLeaking === false`: ✅ Green "No leak detected"
- Done with `isLeaking === true`: ❌ Red "DNS leak detected" with detected vs. configured servers table
- Done with `isLeaking === null`: ⚠️ Yellow "No baseline — apply a DNS profile first"
- Error: red error text, "Retry" button
- Always shows: "Your DNS servers" list and "Detected servers" list side by side

## Cancellation

All long-running operations support cancellation:
- **Speed test**: 30s auto-timeout (no explicit cancel needed; operation completes or times out)
- **Ping**: Cancel button sets an `AtomicBool` flag checked between each ping iteration
- **Traceroute**: Cancel button kills the `traceroute` child process via `child.kill()`
- **DNS leak test**: 15s auto-timeout per resolution attempt

Implementation: Each command takes an `app: AppHandle` parameter. Cancel signals use `tauri::async_runtime::spawn` + `tokio::sync::watch` channel. Frontend calls `cancel_ping` command which sends a signal through the watch channel.

Simplified approach for v2: Add `cancel_<tool>` commands that set a shared `AtomicBool`. The running command checks this flag between iterations and returns early if set.

## Shared Components

### Sidebar (`Sidebar.tsx`)
- 4 icon buttons using Lucide: `Globe`, `Zap`, `Radio`, `SearchCheck`
- Active state: `#7c3aed` bg, white icon
- Inactive: transparent bg, `#64748b` icon
- Hover: `#334155` bg

### Result Table (`ResultTable.tsx`)
- Reusable dark-theme table component
- Props: `columns: {key: string, label: string}[]`, `rows: Record<string, ReactNode>[]`
- Used by Ping, Traceroute, and DNS Leak Test

## Updated Project Structure

```
src/
  App.tsx                  # Root: ActiveTool state + sidebar + panel switch
  types.ts                 # All shared types (updated)
  components/
    Sidebar.tsx            # Tool navigation sidebar
    # DNS (existing, unchanged)
    ProgressDots.tsx
    ProfileCard.tsx
    DnsPanel.tsx            # Extracted from App.tsx
    Step1_ChooseProfile.tsx
    Step2_Benchmark.tsx
    Step3_Results.tsx
    # Speed Test (new)
    SpeedPanel.tsx
    SpeedGauge.tsx
    # Ping (new)
    PingPanel.tsx
    ResultTable.tsx
    # DNS Leak Test (new)
    LeakPanel.tsx
src-tauri/src/
  lib.rs                    # Register all commands + cancel commands
  dns_bench.rs              # Existing, unchanged
  profiles.rs               # Updated: 3 new profiles
  sys_config.rs              # Existing, unchanged
  speed_test.rs              # New: download speed measurement
  ping.rs                    # New: TCP ping + shell-out traceroute
  dns_leak.rs                # New: DNS leak detection
  validate.rs                # New: shared input validation (host, IP ranges)
```

## Updated Cargo.toml Dependencies

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
hickory-resolver = "0.24"
reqwest = { version = "0.12", features = ["rustls-tls"] }
regex = "1"
```

Note: `socket2` removed — traceroute uses shell-out to system `traceroute` instead.

## Error Handling

All tools follow the same pattern:
- Rust returns `Result<T, String>` with human-readable error messages
- Frontend catches errors and displays them inline (no alerts)
- "Retry" button appears on error states
- Running state disables start buttons and shows cancel option
- Null/Option types used consistently: `latencyMs: number | null` for failed measurements, `isLeaking: boolean | null` for indeterminate states

## Testing Strategy

- **Unit tests**: Each Rust module gets `#[cfg(test)]` for serialization, validation, and pure logic
- **Integration**: Manual testing of each tool panel  
- **Speed test edge cases**: Network timeout, partial download, zero-byte response, Cloudflare endpoint down (fallback triggers)
- **Ping edge cases**: Unreachable host, timeout per ping, DNS resolution failure, private IP rejection
- **Traceroute edge cases**: Unreachable final hop, intermediate timeouts, partial output parsing
- **Leak test edge cases**: No configured DNS (DHCP) → `isLeaking: null`, all servers unreachable, akahelp.net down
- **Validation edge cases**: Empty host, host with special characters, loopback IPs, private IPs