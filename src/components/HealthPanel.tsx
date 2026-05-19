import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { NetworkInfo, SpeedHistoryEntry } from "../types";
import { useSimpleMode } from "./SimpleModeContext";

interface HealthStatus {
  dns: "good" | "warn" | "bad" | "unknown";
  speed: "good" | "warn" | "bad" | "unknown";
  security: "good" | "warn" | "bad" | "unknown";
  dnsLabel: string;
  speedLabel: string;
  securityLabel: string;
}

function getGradeClass(grade: string): "good" | "warn" | "bad" {
  if (grade === "A+" || grade === "A" || grade === "B") return "good";
  if (grade === "C" || grade === "D") return "warn";
  return "bad";
}

function StatusLight({ status, label, fixLabel, onFix }: { status: "good" | "warn" | "bad" | "unknown"; label: string; fixLabel?: string; onFix?: () => void }) {
  const colors = { good: "#22c55e", warn: "#eab308", bad: "#ef4444", unknown: "#64748b" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", backgroundColor: "#16213e", borderRadius: 10, width: "100%" }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: colors[status], flexShrink: 0, boxShadow: `0 0 8px ${colors[status]}40` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{label}</div>
      </div>
      {fixLabel && onFix && status !== "good" && (
        <button onClick={onFix} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #7c3aed", background: "transparent", color: "#7c3aed", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
          {fixLabel}
        </button>
      )}
    </div>
  );
}

function HealthPanel({ onNavigate }: { onNavigate: (tool: string) => void }) {
  const { simpleMode } = useSimpleMode();
  const [health, setHealth] = useState<HealthStatus>({
    dns: "unknown", speed: "unknown", security: "unknown",
    dnsLabel: "Checking...", speedLabel: "No data", securityLabel: "Not tested",
  });

  useEffect(() => {
    async function check() {
      let dnsStatus: HealthStatus["dns"] = "unknown";
      let dnsLabel = "Unknown";
      try {
        const info = await invoke<NetworkInfo>("get_current_dns");
        if (info.servers.length === 0) {
          dnsStatus = "bad";
          dnsLabel = simpleMode ? "Using slow ISP DNS" : `No custom DNS — using ISP default on ${info.service}`;
        } else {
          const known = ["1.1.1.1", "8.8.8.8", "9.9.9.9", "94.140.14.14", "76.76.2.0", "208.67.222.222", "8.26.56.26", "194.242.2.2", "45.45.46.46"];
          const hasKnown = info.servers.some((s: string) => known.includes(s));
          dnsStatus = hasKnown ? "good" : "warn";
          dnsLabel = hasKnown
            ? (simpleMode ? "Fast DNS active" : `Custom DNS active on ${info.service}: ${info.servers.join(", ")}`)
            : (simpleMode ? "Unknown DNS" : `Unknown DNS servers on ${info.service}: ${info.servers.join(", ")}`);
        }
      } catch {
        dnsStatus = "unknown";
        dnsLabel = "Could not detect";
      }

      let speedStatus: HealthStatus["speed"] = "unknown";
      let speedLabel = "No speed test run";
      try {
        const raw = localStorage.getItem("dnswizard-speed-history");
        if (raw) {
          const history: SpeedHistoryEntry[] = JSON.parse(raw).filter((e: SpeedHistoryEntry) => e.qualityScore !== undefined);
          if (history.length > 0) {
            const latest = history[0];
            const cls = getGradeClass(latest.qualityGrade);
            speedStatus = cls;
            speedLabel = simpleMode
              ? (cls === "good" ? "Connection is fast" : cls === "warn" ? "Connection is okay" : "Connection is slow")
              : `Last test: ${latest.qualityGrade} (${latest.qualityScore}/100) — ${latest.headlineMbps.toFixed(1)} Mbps`;
          }
        }
      } catch {}

      let secStatus: HealthStatus["security"] = "unknown";
      let secLabel = "Not tested";
      // We don't store leak results persistently, so we can only say "not tested"
      secLabel = simpleMode ? "Run a leak test to check" : "No leak test results yet — run a DNS leak test to verify security";

      setHealth({ dns: dnsStatus, speed: speedStatus, security: secStatus, dnsLabel, speedLabel, securityLabel: secLabel });
    }
    check();
  }, [simpleMode]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16, color: "#e2e8f0" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Network Health</h2>
      {simpleMode && (
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          Quick overview of your internet status. Fix any red items below.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <StatusLight status={health.dns} label={health.dnsLabel} fixLabel="Set DNS" onFix={() => onNavigate("dns")} />
        <StatusLight status={health.speed} label={health.speedLabel} fixLabel="Test Speed" onFix={() => onNavigate("speed")} />
        <StatusLight status={health.security} label={health.securityLabel} fixLabel="Test Leaks" onFix={() => onNavigate("leak")} />
      </div>
    </div>
  );
}

export default HealthPanel;