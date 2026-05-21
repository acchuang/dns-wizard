# 🧙‍♂️ DNS Wizard
**Make your internet feel like new.**

DNS Wizard is a high-performance, noob-friendly system utility that analyzes your local network and optimizes your DNS settings with a single click. Built for users who want the benefits of low-latency DNS without having to navigate scary system network panels.

## ✨ Features

- **🚀 Speed-Dating Engine**: Performs real-time benchmarks against the world's fastest DNS providers (Cloudflare, Google, Quad9, etc.) to find the absolute fastest server *for your specific location*.
- **🎯 Outcome-Based Profiles**: Choose a "Recipe" instead of an IP address:
  - 🎮 **Gamer**: Optimized for the lowest possible latency.
  - 🛡️ **Privacy**: Routes traffic through privacy-respecting providers.
  - 👨‍👩‍👧 **Family**: Automatic filtering of adult content and malicious sites.
  - 🚫 **Ad-Free**: Integrates DNS-level ad-blocking to clean up your web experience.
  - ⚖️ **Balanced**: A stable, high-speed default.
- **🛠️ One-Click Application**: Native integration with macOS (`networksetup`) to apply settings instantly with admin authorization.
- **🔄 Safety Net**: A built-in "Restore" function to instantly put your network back to automatic (DHCP) settings.
- **🎨 Modern Wizard UX**: A sleek, 3-step guided experience designed for non-technical users.

## 🚀 Tech Stack

- **Backend**: Rust 🦀 (utilizing `tokio` for async and `trust-dns-resolver` for precise timing).
- **Frontend**: React + TypeScript + Framer Motion + Lucide-React.
- **Core Framework**: [Tauri](https://tauri.app/) (Provides the security and speed of Rust with the flexibility of a web frontend, resulting in a tiny binary size).

## 🛠️ Installation & Setup

### Prerequisites
- **Rust**: Install via [rustup](https://rustup.rs/)
- **Node.js**: Latest LTS version.
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

### Running in Development Mode
\`\`\`bash
# Install dependencies
npm install

# Start the development environment
npm run tauri dev
\`\`\`

### Building for Production
\`\`\`bash
npm run tauri build
\`\`\`

## ⚠️ Important Usage Notes
Modifying network settings requires elevated permissions. To use the **Apply** and **Restore** features, the application must be run with **sudo/root** privileges on **macOS**.

> **Note**: DNS Wizard is currently macOS-only. Windows support is not yet available.

## 📜 License
MIT License - Feel free to use and contribute!
