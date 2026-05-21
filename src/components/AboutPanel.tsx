import { open } from "@tauri-apps/plugin-shell";

function AboutPanel() {
  return (
    <div className="about-panel">
      <div className="about-header">
        <div className="about-logo">D</div>
        <h1 className="about-title">DNS Wizard</h1>
        <p className="about-version">6-tool network utility suite for macOS · v1.2.1</p>
      </div>

      <div className="about-stats">
        <div className="about-stat">
          <div className="about-stat-value">6</div>
          <div className="about-stat-label">Tools</div>
        </div>
        <div className="about-stat">
          <div className="about-stat-value">14</div>
          <div className="about-stat-label">Commands</div>
        </div>
        <div className="about-stat">
          <div className="about-stat-value">0</div>
          <div className="about-stat-label">Telemetry</div>
        </div>
      </div>

      <div className="about-footer">
        <button
          className="about-coffee-btn"
          onClick={() => open("https://buymeacoffee.com/acchuang")}
        >
          ☕ Support DNS Wizard
        </button>
      </div>

      <div className="about-section">
        <h2>DNS Wizard</h2>
        <p>
          Choose a DNS profile (Gamer, Privacy, Family, etc.), benchmark the servers, and apply the fastest one.
          DNS changes require admin privileges. Click a profile to start, view benchmark results, then apply
          your preferred server. Use <strong>Restore Defaults</strong> to revert to DHCP.
          Or use <strong>Quick Fix</strong> to automatically find and apply the fastest DNS server in one click.
        </p>
      </div>

      <div className="about-section">
        <h2>Speed Test</h2>
        <p>
          Comprehensive network quality assessment in two phases. <strong>Phase 1</strong> — 20 TCP pings to
          1.1.1.1:443 measuring latency, jitter, and packet loss. <strong>Phase 2</strong> — five sequential
          download stages (100 kB, 1 MB, 10 MB, 25 MB, 50 MB) from Cloudflare.
          A composite <strong>Network Quality Score</strong> (A+ through F) is calculated from weighted metrics.
          Past results are stored in history with min/avg/max stats.
          Export results as CSV or JSON.
        </p>
      </div>

      <div className="about-section">
        <h2>Ping &amp; Traceroute</h2>
        <p>
          <strong>Ping</strong> measures TCP connection latency to a host (5 probes, port 443). Private and loopback IPs are blocked for safety.
          <strong>Traceroute</strong> shows each network hop to a destination (up to 20 hops, 2-second timeout per hop).
          Built-in presets: Cloudflare (1.1.1.1), Google (8.8.8.8), Quad9 (9.9.9.9). IPv6 addresses supported.
          Export results as CSV or JSON.
        </p>
      </div>

      <div className="about-section">
        <h2>DNS Leak Test</h2>
        <p>
          Detects whether your DNS queries are being handled by the servers you configured.
          First apply a DNS profile in the DNS Wizard tab, then run the leak test here.
          If detected servers differ from your configured ones, a leak is reported.
          Without a profile applied, the test notes that no baseline is available.
        </p>
      </div>

      <div className="about-section">
        <h2>Network Health</h2>
        <p>
          At-a-glance overview of your internet status. Shows traffic-light indicators for <strong>DNS</strong> (are you using a fast, custom DNS?),
          <strong>Speed</strong> (quality score from your last speed test), and <strong>Security</strong> (DNS leak test results).
          Each indicator has a "Fix" button to jump to the relevant tool.
        </p>
      </div>

      <div className="about-section">
        <h2>Keyboard Shortcuts</h2>
        <p>
          <strong>Cmd+1</strong> DNS · <strong>Cmd+2</strong> Speed · <strong>Cmd+3</strong> Ping · <strong>Cmd+4</strong> Leak · <strong>Cmd+5</strong> Health · <strong>Cmd+6</strong> About
        </p>
      </div>

      <div className="about-section">
        <h2>Simple Mode</h2>
        <p>
          Toggle the <strong>eye icon</strong> in the sidebar to switch between detailed and simple views.
          Simple mode hides technical numbers and shows plain-English ratings instead.
        </p>
      </div>

      <p className="about-credit" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
        Built with Tauri, React, and Rust. Network tools that respect your privacy.
      </p>
    </div>
  );
}

export default AboutPanel;
