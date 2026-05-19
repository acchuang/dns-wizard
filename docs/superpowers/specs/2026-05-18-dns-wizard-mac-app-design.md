# DNS Wizard Mac App — Design Spec
**Date:** 2026-05-18

## Overview

Package the DNS Wizard Tauri project as a distributable Mac `.dmg` app using Tauri 2 + Vite + React + TypeScript. The app guides users through a 3-step wizard: select a DNS profile, benchmark available servers, and apply the fastest result.

## Architecture

```
dns-wizard/
├── src/                          # React + TypeScript frontend (Vite)
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Wizard state machine (step management)
│   ├── components/
│   │   ├── Step1_ChooseProfile.tsx
│   │   ├── Step2_Benchmark.tsx
│   │   ├── Step3_Results.tsx
│   │   ├── ProgressDots.tsx
│   │   └── ProfileCard.tsx
│   └── styles/
│       └── index.css
├── src-tauri/                    # Rust backend (Tauri 2)
│   ├── Cargo.toml                # tauri 2.x, tauri-build, tauri-plugin-shell
│   ├── tauri.conf.json           # DMG config, window size, identifier
│   ├── build.rs
│   ├── icons/                    # App icon PNG/icns
│   └── src/
│       ├── main.rs               # Tauri entry, command registration
│       ├── dns_bench.rs          # Async DNS benchmarking
│       ├── profiles.rs           # Profile → DNS provider mapping
│       └── sys_config.rs         # networksetup apply/restore
├── index.html                    # Vite HTML entry
├── package.json                  # @tauri-apps/api, @tauri-apps/cli, react, vite, etc.
├── vite.config.ts
└── tsconfig.json
```

The existing nested `src-tauri/dns-wizard/src-tauri/` structure is flattened. Rust source files ported with Tauri 1→2 API changes only.

## Data Flow

```
Step1 (Choose Profile)          Step2 (Benchmark)            Step3 (Results)
     │                                │                            │
     │  user picks profile             │  invoke run_benchmark      │  show sorted results
     │  (Gamer/Privacy/etc.)          │  (Rust → DNS ping test)    │  user picks best server
     │                                │                            │
     ▼                                ▼                            ▼
  App state:                      App state:                   App state:
  { step: 1,                     { step: 2,                   { step: 3,
    selectedProfile }              isRunning: true,             benchmarkResults: [...],
                                    selectedProfile }            applied: false }
                                                                      │
                                                               invoke apply_dns
                                                               (Rust → networksetup)
                                                                      │
                                                               App state:
                                                               { step: 3,
                                                                 applied: true }
```

State lives in `App.tsx` — no routing, just a `step` number (1/2/3). Tauri `invoke()` bridges to Rust commands.

## Types

```rust
// dns_bench.rs
#[derive(Serialize, Deserialize, Clone)]
pub struct DnsProvider {
    pub name: String,       // Display name, e.g. "Cloudflare"
    pub ip: String,         // Primary IP, e.g. "1.1.1.1"
    pub latency: Option<u128>, // None = not yet benchmarked; Some(ms) = tested (Some(u128::MAX) = unreachable)
}

// sys_config.rs
#[derive(Serialize, Deserialize)]
pub struct ConfigResult {
    pub success: bool,
    pub message: String,
}
```

Frontend state type (TypeScript):
```typescript
type WizardState = {
  step: 1 | 2 | 3;
  selectedProfile: string | null;
  benchmarkResults: DnsProvider[];
  isRunning: boolean;
  error: string | null;
  applied: boolean;
};
```

## Tauri Commands

| Command | Signature | Description |
|---------|-----------|-------------|
| `run_benchmark(profile: String)` | `Result<Vec<DnsProvider>, String>` | Resolves `google.com` via each DNS server to measure real-world resolution latency (5s timeout per server) |
| `apply_dns(primary: String, secondary: String)` | `ConfigResult` | Applies DNS via `networksetup` |
| `restore_dns()` | `ConfigResult` | Restores DHCP/automatic DNS |

`get_current_dns` is removed — not needed for the 3-step wizard UX.

## Error Handling

| Scenario | UX Behavior |
|----------|------------|
| `networksetup` fails (no permissions) — apply or restore | Show inline error: "Admin privileges required to update DNS settings." An **"Authorize"** button triggers `osascript` with administrator privileges (see Admin Privilege Escalation below). |
| DNS server unreachable during benchmark | Latency set to `u128::MAX`, displayed as "Unreachable" with red indicator in results table |
| All servers unreachable | Error banner: "No DNS servers responded. Check your internet connection and try again." |
| User closes app mid-benchmark | Rust task is bound to the Tauri window; window close drops the app entirely, killing the benchmark. On reopen, step resets to 1 — no zombie tasks. |
| "Start Over" from Step 3 | Resets state to Step 1 with `applied` preserved (reflects system reality if DNS was already applied). Does **not** restore DNS — users may want to keep new DNS while trying other profiles. The UI shows "DNS active" indicator in Step 1 if `applied` is true. |
| Restore when user had custom DNS before | Calls `networksetup -setdnsservers <service> empty` to blank the list back to DHCP — the app does not preserve prior custom DNS settings |
| Apply fails partway (primary set, secondary fails) | `networksetup` is atomic — both servers are set in one call; partial failure not possible |

### Network Service Detection

The app auto-detects the active network service at startup instead of hardcoding "Wi-Fi":

```bash
networksetup -listallnetworkservices | head -n 1
```

This returns the first active service (e.g., "Wi-Fi", "Ethernet", "iPhone USB"). If the command returns empty or fails, the app shows an error: "No active network service detected. Connect to a network and restart the app." Apply/Restore buttons are disabled until a service is detected. The Rust `sys_config` module stores this detected service name at startup and uses it for all subsequent `networksetup` calls.

**Network change mid-session:** If the user switches network interfaces (e.g., Wi-Fi → Ethernet) while the app is open, the stored service name becomes stale. This edge case is accepted as out of scope for v1. The user can restart the app to re-detect.

### Admin Privilege Escalation

When `networksetup` returns a non-zero exit code, the Rust backend returns `ConfigResult { success: false }`. The frontend shows an error message with an **"Authorize"** button. This button triggers an `osascript` command via Tauri's shell plugin using the detected network service:

```bash
osascript -e 'do shell script "networksetup -setdnsservers <detected_service> <primary> <secondary>" with administrator privileges'
```

This displays the standard macOS admin password dialog. On success, the frontend re-invokes `apply_dns` via the Rust backend (which will now succeed since the DNS change was already applied by `osascript`) to keep state tracking consistent. On user cancel, the error remains displayed.

## Backend Changes (Tauri 1.5 → 2.x)

- `Cargo.toml`: `tauri = "2"`, add `tauri-plugin-shell = "2"`
- `main.rs`: Command signatures updated for Tauri 2 `tauri::command` return types
- Replace `tauri::generate_context!()` with `tauri::Builder::default().plugin(tauri_plugin_shell::init())`
- No logic changes to benchmark, profile, or sys_config modules. The existing `profiles.rs` already contains the DNS provider→IP mappings for all 5 profiles (confirmed in current source).

## Frontend Components

| Component | Responsibility |
|-----------|---------------|
| `ProgressDots` | 3-dot indicator highlighting current step |
| `ProfileCard` | Single profile option (icon, name, description), clickable |
| `Step1_ChooseProfile` | Grid of 5 profile cards: Gamer, Privacy, Parent/Family, AdBlock, Balanced |
| `Step2_Benchmark` | Animated progress bar, latency results appearing sequentially |
| `Step3_Results` | Ranked table of providers, "Apply" button, "Restore", "Start Over" link |
| `App` | Step state machine, invoke bridge, CSS opacity/translateX crossfade transitions between steps |

## Style

- **Colors:** Dark theme as default — deep charcoal background (`#1a1a2e`), accent purple (`#7c3aed`), green success indicators (`#10b981`), red errors (`#ef4444`). Cards use slightly lighter surface (`#16213e`).
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`). Profile names: 18px semibold. Latency values: monospace tabular-nums. Body: 14px regular.
- **Layout:** Window fixed at 520×640px, non-resizable. Centered content with 24px horizontal padding. Step transitions are CSS `opacity` + `translateX` crossfades (no framer-motion dependency needed for 3 simple transitions).
- **Dark mode only** — no light mode toggle; the app is designed for a sleek dark aesthetic.

## Dependencies

**Frontend:** `react`, `react-dom`, `typescript`, `vite`, `@tauri-apps/api`, `@tauri-apps/cli`, `lucide-react`
**Backend:** `tauri` 2.x, `tauri-build` 2.x, `tauri-plugin-shell` 2.x, `serde`, `serde_json`, `tokio`, `trust-dns-resolver`

## Bundling (DMG)

`tauri.conf.json` snippet:
```json
{
  "bundle": {
    "targets": ["dmg"],
    "icon": ["icons/icon.icns"],
    "macOS": { "minimumSystemVersion": "11.0" }
  }
}
```

Build command: `npm run tauri build -- --target aarch64-apple-darwin` (Apple Silicon) or `--target x86_64-apple-darwin` (Intel). For universal binary use `--target universal-apple-darwin` which produces a single .dmg supporting both architectures.
Output: `src-tauri/target/release/bundle/dmg/DNS Wizard_x.x.x_aarch64.dmg`

## macOS-Specific Considerations

- **Network Service Detection:** At startup, `sys_config` runs `networksetup -listallnetworkservices | head -n 1` to detect the active service (e.g., "Wi-Fi", "Ethernet") instead of hardcoding.
- **Admin Privileges:** `networksetup` requires admin permissions; handled via `osascript` with `administrator privileges` when initial apply fails (see Error Handling section).
- App identifier: `com.dnswizard.app`
- Minimum macOS version: 11.0 (Big Sur)

## Testing Strategy

- **Rust unit tests:** `cargo test` — benchmark module has pure logic testable with mocked resolvers. Sys_config tests verify service detection parsing.
- **Frontend:** Manual verification of 3-step wizard flow. Key paths: profile selection → benchmark → apply success; apply failure → authorize → retry → success; restore → confirm DHCP; start over resets state.
- **Integration:** End-to-end DMG build and install on a Mac to verify `networksetup` changes actually apply and persist.
