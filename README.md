# 🧙‍♂️ DNS Wizard
**Make your internet feel like new.**

DNS Wizard is a noob-friendly, 7-tool network utility suite for macOS. It optimizes your DNS with one click and bundles the network diagnostics you'd otherwise need a terminal for — speed testing, ping/traceroute, leak detection, port scanning — behind a clean, guided UI.

📦 **[Download the latest release](https://github.com/acchuang/dns-wizard/releases)** (Apple Silicon `.dmg`)

## ✨ Tools

- **🌐 DNS Wizard** (⌘1): **Quick Fix** benchmarks the world's fastest DNS providers (Cloudflare, Google, Quad9, etc.) against *your* connection and applies the winner in one click. Want more control? Choose an outcome-based profile instead:
  - 🎮 **Gamer** — lowest possible latency
  - 🛡️ **Privacy** — privacy-respecting providers
  - 👨‍👩‍👧 **Family** — filters adult content and malicious sites
  - 🚫 **Ad-Free** — DNS-level ad blocking
  - ⚖️ **Balanced** — a stable, high-speed default
  - …plus Control D, OpenDNS, and Comodo Secure
- **⚡ Speed Test** (⌘2): Two-phase network quality assessment — latency, jitter, and packet loss, then multi-stage downloads. Composite Quality Score from A+ to F, with history.
- **📡 Ping & Traceroute** (⌘3): TCP ping and hop-by-hop traceroute with provider presets. Export as CSV or JSON.
- **🔍 DNS Leak Test** (⌘4): Verifies your queries actually go through the DNS servers you configured.
- **♥ Dashboard** (⌘5): At-a-glance network health — overall grade ring, speed history sparkline, and status cards for DNS, Speed, and Security.
- **🛡 Port Scanner** (⌘6): Scan a host for open, closed, and filtered ports with presets for common services.
- **ℹ️ Network Info** (⌘7): Public IP, ISP, location, interface, gateway, MAC, DNS servers, and DHCP mode — copy any value.

## 🎨 UX niceties

- **🪟 Frosted-glass UI**: translucent settings-style window over a soft mesh-gradient backdrop, with a labeled sidebar grouped into sections and a color-coded icon for every tool.
- **🔄 Safety Net**: One-click restore to automatic (DHCP) DNS.
- **👁 Simple mode**: Hides technical numbers and shows plain-English ratings.
- **🌗 Light/dark/auto themes**, keyboard shortcuts (⌘1–8), and zero telemetry.

## 🚀 Tech Stack

- **Backend**: Rust 🦀 (`tokio` for async, `hickory-resolver` for precise DNS timing).
- **Frontend**: React + TypeScript + Lucide-React.
- **Core Framework**: [Tauri](https://tauri.app/) — Rust's security and speed with a web frontend, in a tiny binary.

## 🛠️ Installation & Setup

### Prerequisites
- **Rust**: Install via [rustup](https://rustup.rs/)
- **Node.js**: Latest LTS version.
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

### Running in Development Mode
```bash
# Install dependencies
npm install

# Start the development environment
npm run tauri dev
```

### Building for Production
```bash
npm run tauri build
```

## ⚠️ Important Usage Notes

Applying DNS settings, restoring DHCP, and flushing the DNS cache modify system network settings, so macOS shows a native **administrator password prompt** for those actions. You do **not** need to run the app as root — everything else works without elevated permissions.

> **Note**: DNS Wizard is currently macOS-only. Windows support is not yet available.

## 📜 License
MIT License - Feel free to use and contribute!
