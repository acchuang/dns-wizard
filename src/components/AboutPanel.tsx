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
          Measures your download speed by fetching data from Cloudflare's speed test endpoint (~25 MB).
          Click <strong>Start Test</strong> and wait for the gauge to display your speed in Mbps.
          If the primary server is unreachable, a fallback is used.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Ping &amp; Traceroute</h2>
        <p style={bodyStyle}>
          <strong>Ping</strong> measures TCP connection latency to a host (5 probes, port 80). Private and loopback IPs are blocked for safety.
          <strong>Traceroute</strong> shows each network hop to a destination (up to 20 hops, 2-second timeout per hop).
          Both support preset hosts (Cloudflare, Google, Quad9) or custom hostnames/IPs.
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