const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
};

const headingStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#e2e8f0",
  marginBottom: 8,
};

const bodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
  lineHeight: 1.6,
  margin: 0,
};

function AboutPanel() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 0, color: "#e2e8f0", overflowY: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 4 }}>DNS Wizard</h1>
      <p style={{ fontSize: 13, color: "#64748b", margin: 0, marginBottom: 20 }}>Network utility suite for macOS</p>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>DNS Wizard</h2>
        <p style={bodyStyle}>
          Choose a DNS profile (Gamer, Privacy, Family, etc.), benchmark the servers, and apply the fastest one.
          DNS changes require admin privileges. Click a profile to start, view benchmark results, then apply
          your preferred server. Use <strong>Restore Defaults</strong> to revert to DHCP.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Speed Test</h2>
        <p style={bodyStyle}>
          Comprehensive network quality assessment in two phases. <strong>Phase 1</strong> — 20 TCP pings to
          1.1.1.1:443 measuring latency, jitter, and packet loss. <strong>Phase 2</strong> — five sequential
          download stages (100 kB, 1 MB, 10 MB, 25 MB, 50 MB) from Cloudflare and third-party CDNs.
          A composite <strong>Network Quality Score</strong> (A+ through F) is calculated from weighted metrics.
          Past results are stored in history with min/avg/max stats.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Ping &amp; Traceroute</h2>
        <p style={bodyStyle}>
          <strong>Ping</strong> measures TCP connection latency to a host (5 probes, port 443). Private and loopback IPs are blocked for safety.
          <strong>Traceroute</strong> shows each network hop to a destination (up to 20 hops, 2-second timeout per hop).
          Built-in presets: Cloudflare (1.1.1.1), Google (8.8.8.8), Quad9 (9.9.9.9). Custom hostnames and IPs supported.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>DNS Leak Test</h2>
        <p style={bodyStyle}>
          Detects whether your DNS queries are being handled by the servers you configured.
          First apply a DNS profile in the DNS Wizard tab, then run the leak test here.
          If detected servers differ from your configured ones, a leak is reported.
          Without a profile applied, the test notes that no baseline is available.
        </p>
      </div>

      <div style={{ borderTop: "1px solid #334155", paddingTop: 16, marginTop: 8 }}>
        <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
          Built with Tauri, React, and Rust. Network tools that respect your privacy.
        </p>
      </div>
    </div>
  );
}

export default AboutPanel;