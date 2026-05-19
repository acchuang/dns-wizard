# DNS Wizard Mac App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the DNS Wizard project to Tauri 2, build the React+TypeScript frontend, and produce a distributable Mac .dmg app.

**Architecture:** Tauri 2 Rust backend (3 Tauri commands: benchmark, apply, restore) with a Vite+React+TypeScript frontend implementing a 3-step wizard (choose profile → benchmark → apply results). CSS-only dark theme transitions.

**Tech Stack:** Tauri 2.x, Vite, React 18, TypeScript 5, lucide-react, Rust (serde, tokio, hickory-resolver)

**Spec:** `docs/superpowers/specs/2026-05-18-dns-wizard-mac-app-design.md`

---

## Chunk 1: Project Scaffold & Directory Cleanup

### Task 1.1: Clean up old structure and scaffold Tauri 2 + Vite + React + TS

**Files:**
- Delete: `node_modules/`, `package-lock.json`, `src-tauri/dns-wizard/` (old nested Rust src)
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/vite-env.d.ts`
- Modify: `package.json`
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/` directory
- Create: `src/main.tsx`, `src/styles/index.css`

- [ ] **Step 1: Remove old dependencies and nested Rust source**

```bash
rm -rf node_modules package-lock.json src-tauri/dns-wizard
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: `node_modules` and `src-tauri/dns-wizard` removed.

- [ ] **Step 2: Rewrite package.json with correct dependencies**

Write to `package.json`:
```json
{
  "name": "dns-wizard",
  "version": "1.0.0",
  "description": "DNS Wizard — optimize your DNS with one click",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tauri-apps/api": "^2.0.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "typescript": "~5.6.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 3: Create index.html**

Write to `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DNS Wizard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create vite.config.ts**

Write to `vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
```

- [ ] **Step 5: Create tsconfig.json**

Write to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create src/vite-env.d.ts**

Write to `src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 7: Install npm dependencies**

```bash
npm install
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: `node_modules` created, no errors.

- [ ] **Step 8: Create src-tauri/Cargo.toml**

Write to `src-tauri/Cargo.toml`:
```toml
[package]
name = "dns-wizard"
version = "1.0.0"
edition = "2021"

[lib]
name = "dns_wizard_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
hickory-resolver = "0.24"
```

- [ ] **Step 9: Create src-tauri/build.rs**

Write to `src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 10: Create src-tauri/tauri.conf.json**

Write to `src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "DNS Wizard",
  "version": "1.0.0",
  "identifier": "com.dnswizard.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "DNS Wizard",
        "width": 520,
        "height": 640,
        "resizable": false,
        "decorations": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "dmg",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "11.0"
    }
  }
}
```

- [ ] **Step 11: Create src-tauri/src/lib.rs (stub)**

Write to `src-tauri/src/lib.rs`:
```rust
mod dns_bench;
mod profiles;
mod sys_config;
```

- [ ] **Step 12: Create src-tauri/src/main.rs (stub)**

Write to `src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dns_wizard_lib::run()
}
```

- [ ] **Step 13: Create src/main.tsx (stub)**

Write to `src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 14: Create src/App.tsx stub (for tsc verification)**

Write to `src/App.tsx`:
```tsx
function App() {
  return <div>DNS Wizard</div>;
}

export default App;
```

- [ ] **Step 15: Create src/styles/index.css (stub)**

Write to `src/styles/index.css`:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background-color: #1a1a2e;
  color: #e2e8f0;
  font-size: 14px;
  overflow: hidden;
  user-select: none;
}

#root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px 24px;
}
```

- [ ] **Step 16: Create placeholder icon files**

```bash
mkdir -p src-tauri/icons && touch src-tauri/icons/32x32.png src-tauri/icons/128x128.png src-tauri/icons/128x128@2x.png src-tauri/icons/icon.icns src-tauri/icons/icon.ico
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: `src-tauri/icons/` directory with empty placeholder files created. Real icons can be replaced later; placeholders allow the Tauri build to proceed.

- [ ] **Step 17: Verify scaffolding compiles**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: No TypeScript errors.

- [ ] **Step 18: Commit**

```bash
git add -A && git commit -m "scaffold: Tauri 2 + Vite + React + TypeScript project setup"
```

Run: in `/Users/acchuang/Project/dns-wizard`

---

## Chunk 2: Rust Backend Migration

### Task 2.1: Port and enhance DNS benchmark module

**Files:**
- Create: `src-tauri/src/dns_bench.rs`
- Delete: source is from `src-tauri/dns-wizard/src-tauri/src/dns_bench.rs` (already deleted)

- [ ] **Step 1: Write the benchmark module**

Write to `src-tauri/src/dns_bench.rs`:
```rust
use std::time::{Duration, Instant};
use hickory_resolver::config::{NameServerConfig, Protocol, ResolverConfig, ResolverOpts};
use hickory_resolver::TokioAsyncResolver;
use serde::{Serialize, Deserialize};
use tokio::time::timeout;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DnsProvider {
    pub name: String,
    pub ip: String,
    pub latency: Option<u128>,
}

const BENCHMARK_TIMEOUT_SECS: u64 = 5;

pub async fn benchmark_dns(providers: Vec<DnsProvider>) -> Vec<DnsProvider> {
    let mut results = providers;

    for provider in results.iter_mut() {
        let ip: std::net::IpAddr = match provider.ip.parse() {
            Ok(addr) => addr,
            Err(_) => {
                provider.latency = Some(u128::MAX);
                continue;
            }
        };

        let ns = NameServerConfig {
            socket_addr: std::net::SocketAddr::new(ip, 53),
            protocol: Protocol::Udp,
            tls_dns_name: None,
            trust_negative_responses: false,
            bind_addr: None,
        };

        let config = ResolverConfig::from_parts(None, vec![], vec![ns]);
        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_millis(2000);

        let resolver = match TokioAsyncResolver::tokio(config, opts) {
            Ok(r) => r,
            Err(_) => {
                provider.latency = Some(u128::MAX);
                continue;
            }
        };

        let start = Instant::now();
        let result = timeout(
            Duration::from_secs(BENCHMARK_TIMEOUT_SECS),
            resolver.lookup_ip("google.com"),
        )
        .await;

        match result {
            Ok(Ok(_)) => {
                provider.latency = Some(start.elapsed().as_millis());
            }
            _ => {
                provider.latency = Some(u128::MAX);
            }
        }
    }

    results.sort_by(|a, b| {
        a.latency
            .unwrap_or(u128::MAX)
            .cmp(&b.latency.unwrap_or(u128::MAX))
    });
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dns_provider_serialization() {
        let provider = DnsProvider {
            name: "Cloudflare".to_string(),
            ip: "1.1.1.1".to_string(),
            latency: Some(12),
        };
        let json = serde_json::to_string(&provider).unwrap();
        assert!(json.contains("Cloudflare"));
        assert!(json.contains("1.1.1.1"));
    }

    #[test]
    fn test_dns_provider_none_latency() {
        let provider = DnsProvider {
            name: "Test".to_string(),
            ip: "8.8.8.8".to_string(),
            latency: None,
        };
        let json = serde_json::to_string(&provider).unwrap();
        assert!(json.contains("\"latency\":null"));
    }
}
```

- [ ] **Step 2: Run Rust tests**

```bash
cargo test
```

Run: in `/Users/acchuang/Project/dns-wizard/src-tauri`
Expected: Both serialization tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: port dns_bench to Tauri 2 with hickory-resolver and timeout"
```

### Task 2.2: Port profiles module

**Files:**
- Create: `src-tauri/src/profiles.rs`

- [ ] **Step 1: Write the profiles module**

Write to `src-tauri/src/profiles.rs`:
```rust
use serde::{Serialize, Deserialize};
use crate::dns_bench::DnsProvider;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum UserProfile {
    Gamer,
    Parent,
    Privacy,
    AdBlock,
    Balanced,
}

pub fn get_profile_providers(profile: UserProfile) -> Vec<DnsProvider> {
    match profile {
        UserProfile::Gamer => vec![
            DnsProvider { name: "Cloudflare".to_string(), ip: "1.1.1.1".to_string(), latency: None },
            DnsProvider { name: "Google".to_string(), ip: "8.8.8.8".to_string(), latency: None },
        ],
        UserProfile::Parent => vec![
            DnsProvider { name: "Cloudflare Family".to_string(), ip: "1.1.1.3".to_string(), latency: None },
            DnsProvider { name: "CleanBrowsing".to_string(), ip: "185.228.168.168".to_string(), latency: None },
        ],
        UserProfile::Privacy => vec![
            DnsProvider { name: "Quad9".to_string(), ip: "9.9.9.9".to_string(), latency: None },
            DnsProvider { name: "Mullvad DNS".to_string(), ip: "194.242.2.2".to_string(), latency: None },
        ],
        UserProfile::AdBlock => vec![
            DnsProvider { name: "AdGuard DNS".to_string(), ip: "94.100.104.4".to_string(), latency: None },
            DnsProvider { name: "NextDNS".to_string(), ip: "45.45.46.46".to_string(), latency: None },
        ],
        UserProfile::Balanced => vec![
            DnsProvider { name: "Cloudflare".to_string(), ip: "1.1.1.1".to_string(), latency: None },
            DnsProvider { name: "Google".to_string(), ip: "8.8.8.8".to_string(), latency: None },
            DnsProvider { name: "Quad9".to_string(), ip: "9.9.9.9".to_string(), latency: None },
        ],
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cargo build
```

Run: in `/Users/acchuang/Project/dns-wizard/src-tauri`
Expected: Successful compilation ("unused" warnings acceptable at this intermediate state).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: port profiles module"
```

### Task 2.3: Port and enhance sys_config (network detection + apply/restore)

**Files:**
- Create: `src-tauri/src/sys_config.rs`

- [ ] **Step 1: Write sys_config with network detection**

Write to `src-tauri/src/sys_config.rs`:
```rust
use std::process::Command;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConfigResult {
    pub success: bool,
    pub message: String,
}

pub fn detect_network_service() -> Result<String, String> {
    let output = Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output()
        .map_err(|e| format!("Failed to run networksetup: {}", e))?;

    if !output.status.success() {
        return Err("networksetup command failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let service = stdout
        .lines()
        .next()
        .ok_or_else(|| "No network services found".to_string())?
        .trim()
        .to_string();

    if service.is_empty() {
        return Err("No network services found".to_string());
    }

    Ok(service)
}

pub fn set_dns_macos(service: &str, primary: &str, secondary: &str) -> ConfigResult {
    let args = if secondary.is_empty() {
        vec!["-setdnsservers", service, primary]
    } else {
        vec!["-setdnsservers", service, primary, secondary]
    };

    let status = Command::new("networksetup")
        .args(&args)
        .status();

    match status {
        Ok(s) if s.success() => ConfigResult {
            success: true,
            message: format!("DNS updated to {} and {}", primary, secondary),
        },
        _ => ConfigResult {
            success: false,
            message: "Admin privileges required to update DNS settings.".to_string(),
        },
    }
}

pub fn restore_dns_macos(service: &str) -> ConfigResult {
    let status = Command::new("networksetup")
        .args(["-setdnsservers", service, "empty"])
        .status();

    match status {
        Ok(s) if s.success() => ConfigResult {
            success: true,
            message: "DNS restored to automatic (DHCP)".to_string(),
        },
        _ => ConfigResult {
            success: false,
            message: "Admin privileges required to restore DNS settings.".to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_result_success() {
        let result = ConfigResult {
            success: true,
            message: "ok".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":true"));
    }

    #[test]
    fn test_config_result_failure() {
        let result = ConfigResult {
            success: false,
            message: "error occurred".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":false"));
        assert!(json.contains("error occurred"));
    }
}
```

- [ ] **Step 2: Run Rust tests**

```bash
cargo test
```

Run: in `/Users/acchuang/Project/dns-wizard/src-tauri`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: port sys_config with network detection and restore"
```

### Task 2.4: Wire up Tauri commands in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write lib.rs with Tauri commands**

Write to `src-tauri/src/lib.rs`:
```rust
mod dns_bench;
mod profiles;
mod sys_config;

use dns_bench::{benchmark_dns, DnsProvider};
use profiles::{get_profile_providers, UserProfile};
use sys_config::{detect_network_service, set_dns_macos, restore_dns_macos, ConfigResult};

#[tauri::command]
async fn run_benchmark(profile: String) -> Result<Vec<DnsProvider>, String> {
    let profile_enum = match profile.as_str() {
        "Gamer" => UserProfile::Gamer,
        "Parent" => UserProfile::Parent,
        "Privacy" => UserProfile::Privacy,
        "AdBlock" => UserProfile::AdBlock,
        _ => UserProfile::Balanced,
    };

    let providers = get_profile_providers(profile_enum);
    let results = benchmark_dns(providers).await;
    Ok(results)
}

#[tauri::command]
fn apply_dns(primary: String, secondary: String) -> ConfigResult {
    let service = match detect_network_service() {
        Ok(s) => s,
        Err(e) => return ConfigResult {
            success: false,
            message: e,
        },
    };
    set_dns_macos(&service, &primary, &secondary)
}

#[tauri::command]
fn restore_dns() -> ConfigResult {
    let service = match detect_network_service() {
        Ok(s) => s,
        Err(e) => return ConfigResult {
            success: false,
            message: e,
        },
    };
    restore_dns_macos(&service)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_benchmark, apply_dns, restore_dns])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Verify Rust compilation**

```bash
cargo build
```

Run: in `/Users/acchuang/Project/dns-wizard/src-tauri`
Expected: Successful compilation. Ignore unused warnings on `dns_bench`/`profiles`/`sys_config` — they're used via `lib.rs`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: wire up Tauri 2 commands — benchmark, apply_dns, restore_dns"
```

---
