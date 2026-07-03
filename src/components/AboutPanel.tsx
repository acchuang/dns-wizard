import { open } from "@tauri-apps/plugin-shell";

const tools = [
  { icon: "🌐", name: "DNS Wizard", shortcut: "Cmd+1", desc: "Quick Fix benchmarks all providers and applies the fastest one in a single click. Prefer control? Choose a profile (Gamer, Privacy, Family, etc.) and pick from ranked results." },
  { icon: "⚡", name: "Speed Test", shortcut: "Cmd+2", desc: "Two-phase network quality assessment: latency + jitter + packet loss, then multi-stage downloads. Composite Quality Score from A+ to F. History with min/avg/max stats." },
  { icon: "📡", name: "Ping & Traceroute", shortcut: "Cmd+3", desc: "TCP ping to measure latency (5 probes, port 443). Traceroute maps each hop (up to 20, 2s timeout). Presets for Cloudflare, Google, Quad9. Export as CSV or JSON." },
  { icon: "🔍", name: "DNS Leak Test", shortcut: "Cmd+4", desc: "Detects whether your DNS queries go through the servers you configured. Apply a DNS profile first, then run the test to establish a baseline." },
  { icon: "♥", name: "Dashboard", shortcut: "Cmd+5", desc: "At-a-glance network health with circular grade indicator, sparkline history chart, and status cards with trend arrows for DNS, Speed, and Security." },
  { icon: "🛡", name: "Port Scanner", shortcut: "Cmd+6", desc: "Scan a host for open, closed, and filtered ports. Presets for common web, mail, SSH/RDP, and database ports. Max 500 ports per scan. Export results." },
  { icon: "ℹ️", name: "Network Info", shortcut: "Cmd+7", desc: "View all network details: public IP, ISP, location, interface, local IP, gateway, MAC address, DNS servers, and DHCP mode. Copy any value." },
];

function AboutPanel() {
  return (
    <div className="about-panel">
      <div className="about-header">
        <div className="about-logo">D</div>
        <h1 className="about-title">DNS Wizard</h1>
        <p className="about-version">Network utility suite for macOS · v1.3.2</p>
      </div>

      <div className="about-stats">
        <div className="about-stat">
          <div className="about-stat-value">7</div>
          <div className="about-stat-label">Tools</div>
        </div>
        <div className="about-stat">
          <div className="about-stat-value">22</div>
          <div className="about-stat-label">Commands</div>
        </div>
        <div className="about-stat">
          <div className="about-stat-value">0</div>
          <div className="about-stat-label">Telemetry</div>
        </div>
      </div>

      <button
        className="about-coffee-btn"
        onClick={() => open("https://buymeacoffee.com/acchuang")}
      >
        ☕ Support DNS Wizard
      </button>

      <div className="about-card-grid">
        {tools.map((tool) => (
          <div key={tool.name} className="about-card">
            <div className="about-card-header">
              <span className="about-card-icon">{tool.icon}</span>
              <span className="about-card-name">{tool.name}</span>
              <span className="about-card-shortcut">{tool.shortcut}</span>
            </div>
            <p className="about-card-desc">{tool.desc}</p>
          </div>
        ))}
      </div>

      <div className="about-card about-card-info">
        <div className="about-card-header">
          <span className="about-card-icon">⌨️</span>
          <span className="about-card-name">Shortcuts & Tips</span>
        </div>
        <p className="about-card-desc">
          <strong>Cmd+1–7</strong> switch tools · <strong>Cmd+8</strong> About · Toggle the <strong>eye icon</strong> in the sidebar to switch between detailed and simple views. Simple mode hides technical numbers and shows plain-English ratings.
        </p>
      </div>

      <p className="about-credit">
        Built with Tauri, React, and Rust. Network tools that respect your privacy.
      </p>
    </div>
  );
}

export default AboutPanel;
