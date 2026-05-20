import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { NetworkInfo, SpeedHistoryEntry, LatencyResult } from "../types";
import { useSimpleMode } from "./SimpleModeContext";

interface HealthStatus {
  dns: "good" | "warn" | "bad" | "unknown";
  speed: "good" | "warn" | "bad" | "unknown";
  security: "good" | "warn" | "bad" | "unknown";
  dnsDetail: string;
  speedDetail: string;
  securityDetail: string;
}

function getGradeClass(grade: string): "good" | "warn" | "bad" {
  if (grade === "A+" || grade === "A" || grade === "B") return "good";
  if (grade === "C" || grade === "D") return "warn";
  return "bad";
}

const DNS_LABELS: Record<string, string> = {
  good: "Secure",
  warn: "Check",
  bad: "Unsafe",
  unknown: "—",
};

const SPEED_LABELS: Record<string, string> = {
  good: "Fast",
  warn: "Check",
  bad: "Slow",
  unknown: "—",
};

const SECURITY_LABELS: Record<string, string> = {
  good: "Protected",
  warn: "Check",
  bad: "Leaking",
  unknown: "—",
};

interface CardProps {
  icon: string;
  iconKind: string;
  label: string;
  status: "good" | "warn" | "bad" | "unknown";
  statusText: string;
  detail: string;
  fixLabel?: string;
  onFix?: () => void;
}

function HealthCard({ icon, iconKind, label, status, statusText, detail, fixLabel, onFix }: CardProps) {
  return (
    <div className="health-card">
      <div className="health-card-header">
        <div className={`health-card-icon ${iconKind}`}>{icon}</div>
        <span className="health-card-label">{label}</span>
      </div>
      <div className="health-status-line">
        <div className={`health-status-dot ${status}`} />
        <span className={`health-status-text ${status}`}>{statusText}</span>
      </div>
      {detail && <div className="health-card-detail">{detail}</div>}
      {fixLabel && onFix && status !== "good" && (
        <button className="health-card-fix" onClick={onFix}>{fixLabel}</button>
      )}
    </div>
  );
}

function useSpeedMetrics(): { latest: SpeedHistoryEntry | null; latency: LatencyResult | null } {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem("dnswizard-speed-history");
      if (!raw) return { latest: null, latency: null };
      const history: SpeedHistoryEntry[] = JSON.parse(raw).filter(
        (e: SpeedHistoryEntry) => e.qualityScore !== undefined
      );
      if (history.length === 0) return { latest: null, latency: null };
      const latest = history[0];
      return { latest, latency: latest.latency };
    } catch {
      return { latest: null, latency: null };
    }
  }, []);
}

function latColor(ms: number): string {
  if (ms < 20) return "var(--success)";
  if (ms < 50) return "var(--warning)";
  return "var(--danger)";
}

function HealthPanel({ onNavigate }: { onNavigate: (tool: string) => void }) {
  const { simpleMode } = useSimpleMode();
  const [health, setHealth] = useState<HealthStatus>({
    dns: "unknown",
    speed: "unknown",
    security: "unknown",
    dnsDetail: "",
    speedDetail: "",
    securityDetail: "",
  });

  useEffect(() => {
    async function check() {
      let dnsStatus: HealthStatus["dns"] = "unknown";
      let dnsDetail = "";
      try {
        const info = await invoke<NetworkInfo>("get_current_dns");
        if (info.servers.length === 0) {
          dnsStatus = "bad";
          dnsDetail = simpleMode
            ? "Using slow ISP DNS"
            : `No custom DNS — using ISP default on ${info.service}`;
        } else {
          const known = ["1.1.1.1", "8.8.8.8", "9.9.9.9", "94.140.14.14", "76.76.2.0", "208.67.222.222", "8.26.56.26", "194.242.2.2", "45.45.46.46"];
          const hasKnown = info.servers.some((s: string) => known.includes(s));
          dnsStatus = hasKnown ? "good" : "warn";
          dnsDetail = hasKnown
            ? simpleMode
              ? "Fast DNS active"
              : `Custom DNS active on ${info.service}: ${info.servers.join(", ")}`
            : simpleMode
              ? "Unknown DNS"
              : `Unknown DNS servers on ${info.service}: ${info.servers.join(", ")}`;
        }
      } catch {
        dnsStatus = "unknown";
        dnsDetail = "Could not detect";
      }

      let speedStatus: HealthStatus["speed"] = "unknown";
      let speedDetail = "No speed test run";
      try {
        const raw = localStorage.getItem("dnswizard-speed-history");
        if (raw) {
          const history: SpeedHistoryEntry[] = JSON.parse(raw).filter(
            (e: SpeedHistoryEntry) => e.qualityScore !== undefined
          );
          if (history.length > 0) {
            const latest = history[0];
            const cls = getGradeClass(latest.qualityGrade);
            speedStatus = cls;
            speedDetail = simpleMode
              ? cls === "good"
                ? "Connection is fast"
                : cls === "warn"
                  ? "Connection is okay"
                  : "Connection is slow"
              : `Last test: ${latest.qualityGrade} (${latest.qualityScore}/100) — ${latest.headlineMbps.toFixed(1)} Mbps`;
            
          }
        }
      } catch {}

      let secStatus: HealthStatus["security"] = "unknown";
      let secDetail = simpleMode
        ? "Run a leak test to check"
        : "No leak test results yet — run a DNS leak test to verify security";

      setHealth({
        dns: dnsStatus,
        speed: speedStatus,
        security: secStatus,
        dnsDetail,
        speedDetail,
        securityDetail: secDetail,
      });
    }
    check();
  }, [simpleMode]);

  const speedMetrics = useSpeedMetrics();

  return (
    <div className="health-panel">
      <div className="health-header">
        <h2 className="health-title">Network Health</h2>
        <span className="health-subtitle">DNS Wizard</span>
      </div>

      <div className="health-cards">
        <HealthCard
          icon="🔒"
          iconKind="dns"
          label="DNS"
          status={health.dns}
          statusText={DNS_LABELS[health.dns]}
          detail={health.dnsDetail}
          fixLabel="Set DNS"
          onFix={() => onNavigate("dns")}
        />
        <HealthCard
          icon="⚡"
          iconKind="speed"
          label="Speed"
          status={health.speed}
          statusText={SPEED_LABELS[health.speed]}
          detail={health.speedDetail}
          fixLabel="Test Speed"
          onFix={() => onNavigate("speed")}
        />
        <HealthCard
          icon="🛡"
          iconKind="security"
          label="Security"
          status={health.security}
          statusText={SECURITY_LABELS[health.security]}
          detail={health.securityDetail}
          fixLabel="Test Leaks"
          onFix={() => onNavigate("leak")}
        />
      </div>

      <div className="health-actions">
        <button className="btn-accent" onClick={() => onNavigate("dns")}>Quick Fix DNS</button>
        <button className="btn-outline" onClick={() => onNavigate("speed")}>Run Speed Test</button>
        <button className="btn-outline" onClick={() => onNavigate("leak")}>DNS Leak Test</button>
      </div>

      <div className="health-metric-tiles">
        <div className="health-metric-tile">
          <div
            className="health-metric-value"
            style={{
              color: speedMetrics.latency
                ? latColor(speedMetrics.latency.avgMs)
                : "var(--text-primary)",
            }}
          >
            {speedMetrics.latency ? `${speedMetrics.latency.avgMs.toFixed(0)} ms` : "—"}
          </div>
          <div className="health-metric-label">Latency</div>
        </div>
        <div className="health-metric-tile">
          <div className="health-metric-value" style={{ color: speedMetrics.latest ? "var(--accent)" : "var(--text-primary)" }}>
            {speedMetrics.latest ? `${speedMetrics.latest.headlineMbps.toFixed(1)} Mbps` : "—"}
          </div>
          <div className="health-metric-label">Download</div>
        </div>
        <div className="health-metric-tile">
          <div className="health-metric-value">
            {speedMetrics.latency ? `${speedMetrics.latency.jitterMs.toFixed(1)} ms` : "—"}
          </div>
          <div className="health-metric-label">Jitter</div>
        </div>
        <div className="health-metric-tile">
          <div className="health-metric-value">
            {speedMetrics.latency ? `${speedMetrics.latency.packetLoss.toFixed(1)}%` : "—"}
          </div>
          <div className="health-metric-label">Loss</div>
        </div>
      </div>
    </div>
  );
}

export default HealthPanel;
