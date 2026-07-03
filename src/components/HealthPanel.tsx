import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { NetworkInfo, SpeedHistoryEntry, LatencyResult } from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import { getHealthGradeClass } from "../utils/grades";
import SparklineChart from "./SparklineChart";

interface HealthStatus {
  dns: "good" | "warn" | "bad" | "unknown";
  speed: "good" | "warn" | "bad" | "unknown";
  security: "good" | "warn" | "bad" | "unknown";
  dnsDetail: string;
  speedDetail: string;
  securityDetail: string;
}

function computeOverallGrade(health: HealthStatus, history: SpeedHistoryEntry[]): string {
  let score = 0;
  let count = 0;
  const gradePoints: Record<string, number> = { good: 90, warn: 60, bad: 30, unknown: 50 };

  score += gradePoints[health.dns]; count++;
  score += gradePoints[health.speed]; count++;
  score += gradePoints[health.security]; count++;

  if (history.length > 0) {
    score += history.slice(0, 3).reduce((s, e) => s + e.qualityScore, 0) / Math.min(3, history.length);
    count++;
  }

  if (count === 0) return "—";
  const avg = score / count;
  if (avg >= 90) return "A+";
  if (avg >= 80) return "A";
  if (avg >= 65) return "B";
  if (avg >= 50) return "C";
  if (avg >= 35) return "D";
  return "F";
}

function computeTrend(history: SpeedHistoryEntry[]): "up" | "down" | "flat" | null {
  if (history.length < 2) return null;
  const recent = history[0].qualityScore;
  const prev = history[1].qualityScore;
  if (recent > prev + 5) return "up";
  if (recent < prev - 5) return "down";
  return "flat";
}

function useSpeedMetrics(): { latest: SpeedHistoryEntry | null; latency: LatencyResult | null; history: SpeedHistoryEntry[] } {
  const [metrics, setMetrics] = useState<{ latest: SpeedHistoryEntry | null; latency: LatencyResult | null; history: SpeedHistoryEntry[] }>({ latest: null, latency: null, history: [] });

  useEffect(() => {
    function compute() {
      try {
        const raw = localStorage.getItem("dnswizard-speed-history");
        if (!raw) return { latest: null, latency: null, history: [] as SpeedHistoryEntry[] };
        const history: SpeedHistoryEntry[] = JSON.parse(raw).filter(
          (e: SpeedHistoryEntry) => e.qualityScore !== undefined
        );
        if (history.length === 0) return { latest: null, latency: null, history };
        const latest = history[0];
        return { latest, latency: latest.latency, history };
      } catch {
        return { latest: null, latency: null, history: [] };
      }
    }
    setMetrics(compute());
    const handler = () => setMetrics(compute());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return metrics;
}

function latColor(ms: number): string {
  if (ms < 20) return "var(--success)";
  if (ms < 50) return "var(--warning)";
  return "var(--danger)";
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "var(--success)", "A": "var(--success)", "B": "var(--warning)",
  "C": "var(--warning)", "D": "var(--danger)", "F": "var(--danger)", "—": "var(--text-tertiary)",
};

function HealthPanel({ onNavigate }: { onNavigate: (tool: string) => void }) {
  const { simpleMode } = useSimpleMode();
  const simpleModeRef = useRef(simpleMode);
  simpleModeRef.current = simpleMode;
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthStatus>({
    dns: "unknown",
    speed: "unknown",
    security: "unknown",
    dnsDetail: "",
    speedDetail: "",
    securityDetail: "",
  });

  const checkHealth = useCallback(async () => {
    let dnsStatus: HealthStatus["dns"] = "unknown";
    let dnsDetail = "";
    try {
      const info = await invoke<NetworkInfo>("get_current_dns");
      if (info.servers.length === 0) {
        dnsStatus = "bad";
        dnsDetail = simpleModeRef.current
          ? "Using slow ISP DNS"
          : `No custom DNS — using ISP default on ${info.service}`;
      } else {
        const known = ["1.1.1.1", "8.8.8.8", "9.9.9.9", "94.140.14.14", "76.76.2.0", "208.67.222.222", "8.26.56.26", "194.242.2.2", "45.45.46.46"];
        const hasKnown = info.servers.some((s: string) => known.includes(s));
        dnsStatus = hasKnown ? "good" : "warn";
        dnsDetail = hasKnown
          ? simpleModeRef.current
            ? "Fast DNS active"
            : `Custom DNS active on ${info.service}: ${info.servers.join(", ")}`
          : simpleModeRef.current
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
          const cls = getHealthGradeClass(latest.qualityGrade);
          speedStatus = cls;
          speedDetail = simpleModeRef.current
            ? cls === "good" ? "Connection is fast" : cls === "warn" ? "Connection is okay" : "Connection is slow"
            : `Last test: ${latest.qualityGrade} (${latest.qualityScore}/100) — ${latest.headlineMbps.toFixed(1)} Mbps`;
        }
      }
    } catch {}

    let secStatus: HealthStatus["security"] = "unknown";
    let secDetail = simpleModeRef.current
      ? "Run a leak test to check"
      : "No leak test results yet — run a DNS leak test to verify security";
    try {
      const rawLeak = localStorage.getItem("dnswizard-leak-result");
      if (rawLeak) {
        const leak: { isLeaking: boolean | null; timestamp: number } = JSON.parse(rawLeak);
        const when = new Date(leak.timestamp).toLocaleDateString();
        if (leak.isLeaking === false) {
          secStatus = "good";
          secDetail = simpleModeRef.current ? "No DNS leaks" : `Last leak test (${when}): no leaks detected`;
        } else if (leak.isLeaking === true) {
          secStatus = "bad";
          secDetail = simpleModeRef.current ? "DNS leak detected" : `Last leak test (${when}): queries leaking outside configured DNS`;
        } else {
          secStatus = "warn";
          secDetail = simpleModeRef.current ? "No baseline — apply a DNS profile" : `Last leak test (${when}): no baseline — apply a DNS profile first`;
        }
      }
    } catch {}

    setHealth({ dns: dnsStatus, speed: speedStatus, security: secStatus, dnsDetail, speedDetail, securityDetail: secDetail });
  }, []);

  useEffect(() => {
    checkHealth().finally(() => setLoading(false));
  }, [checkHealth]);

  useEffect(() => {
    const handler = () => { checkHealth(); };
    window.addEventListener("speed-test-complete", handler);
    window.addEventListener("dns-applied", handler);
    window.addEventListener("leak-test-complete", handler);
    return () => {
      window.removeEventListener("speed-test-complete", handler);
      window.removeEventListener("dns-applied", handler);
      window.removeEventListener("leak-test-complete", handler);
    };
  }, [checkHealth]);

  const speedMetrics = useSpeedMetrics();
  const { history } = speedMetrics;
  const grade = computeOverallGrade(health, history);
  const trend = computeTrend(history);
  const gradeColor = GRADE_COLORS[grade] || "var(--text-tertiary)";

  const circumference = 2 * Math.PI * 48;
  const gradeProgress = grade === "—" ? 0 : { "A+": 1, "A": 0.85, "B": 0.65, "C": 0.5, "D": 0.35, "F": 0.15 }[grade] ?? 0;
  const dashOffset = circumference * (1 - gradeProgress);

  const cards = [
    { icon: "🔒", kind: "dns", label: "DNS", status: health.dns, detail: health.dnsDetail, fix: "Set DNS", nav: "dns",
      statusText: ({ good: "Secure", warn: "Check", bad: "Unsafe", unknown: "—" } as Record<string, string>)[health.dns] },
    { icon: "⚡", kind: "speed", label: "Speed", status: health.speed, detail: health.speedDetail, fix: "Test Speed", nav: "speed",
      statusText: ({ good: "Fast", warn: "Moderate", bad: "Slow", unknown: "—" } as Record<string, string>)[health.speed] },
    { icon: "🛡", kind: "security", label: "Security", status: health.security, detail: health.securityDetail, fix: "Test Leaks", nav: "leak",
      statusText: ({ good: "Protected", warn: "Check", bad: "Leaking", unknown: "—" } as Record<string, string>)[health.security] },
  ];

  if (loading) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-hero">
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Network Dashboard</h2>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, color: "var(--text-tertiary)", fontSize: 13 }}>
          Checking network...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-hero">
        <div className="dashboard-grade-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--bg-input)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="48" fill="none"
              stroke={gradeColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="dashboard-grade-text">
            <span className="dashboard-grade-letter" style={{ color: gradeColor }}>{grade}</span>
            <span className="dashboard-grade-label">Overall</span>
          </div>
        </div>
        <p className="dashboard-summary">
          {grade === "A+" || grade === "A" ? "Your network looks great" : grade === "B" ? "Minor issues detected" : grade === "—" ? "Run tests to see your grade" : "Issues need attention"}
        </p>
      </div>

      {history.length > 0 && (
        <div className="dashboard-history">
          <div className="dashboard-history-header">
            <h3 className="dashboard-history-title">Speed History</h3>
            <span className="dashboard-history-stats">
              {history.length} test{history.length !== 1 ? "s" : ""}
              {trend && (
                <span className={`dashboard-card-trend ${trend}`}>
                  {trend === "up" ? " ↑" : trend === "down" ? " ↓" : " →"}
                </span>
              )}
            </span>
          </div>
          <SparklineChart history={history} />
        </div>
      )}

      <div className="dashboard-cards">
        {cards.map((card) => (
          <div key={card.kind} className="dashboard-card">
            <div className="dashboard-card-header">
              <div className="dashboard-card-info">
                <div className={`dashboard-card-icon ${card.kind}`}>{card.icon}</div>
                <span className="dashboard-card-label">{card.label}</span>
              </div>
              {card.kind === "speed" && trend && (
                <span className={`dashboard-card-trend ${trend}`}>
                  {trend === "up" ? "↑ improving" : trend === "down" ? "↓ declining" : "→ stable"}
                </span>
              )}
            </div>
            <div className="dashboard-card-status">
              <div className={`dashboard-card-status-dot ${card.status}`} />
              <span className={`dashboard-card-status-text ${card.status}`}>{card.statusText}</span>
            </div>
            <div className="dashboard-card-detail">{card.detail}</div>
            {card.status !== "good" && (
              <button className="dashboard-card-fix" onClick={() => onNavigate(card.nav)}>{card.fix}</button>
            )}
          </div>
        ))}
      </div>

      <div className="dashboard-actions">
        <button className="btn-accent" onClick={() => onNavigate("dns")}>Quick Fix DNS</button>
        <button className="btn-outline" onClick={() => onNavigate("speed")}>Run Speed Test</button>
        <button className="btn-outline" onClick={() => onNavigate("leak")}>DNS Leak Test</button>
      </div>

      <div className="dashboard-metrics">
        <div className="dashboard-metric">
          <div className="dashboard-metric-value" style={{ color: speedMetrics.latency ? latColor(speedMetrics.latency.avgMs) : "var(--text-primary)" }}>
            {speedMetrics.latency ? `${speedMetrics.latency.avgMs.toFixed(0)}` : "—"}
          </div>
          <div className="dashboard-metric-label">Latency ms</div>
        </div>
        <div className="dashboard-metric">
          <div className="dashboard-metric-value" style={{ color: speedMetrics.latest ? "var(--accent)" : "var(--text-primary)" }}>
            {speedMetrics.latest ? `${speedMetrics.latest.headlineMbps.toFixed(1)}` : "—"}
          </div>
          <div className="dashboard-metric-label">Mbps</div>
        </div>
        <div className="dashboard-metric">
          <div className="dashboard-metric-value">
            {speedMetrics.latency ? `${speedMetrics.latency.jitterMs.toFixed(1)}` : "—"}
          </div>
          <div className="dashboard-metric-label">Jitter ms</div>
        </div>
        <div className="dashboard-metric">
          <div className="dashboard-metric-value">
            {speedMetrics.latency ? `${speedMetrics.latency.packetLoss.toFixed(1)}%` : "—"}
          </div>
          <div className="dashboard-metric-label">Loss</div>
        </div>
      </div>
    </div>
  );
}

export default HealthPanel;