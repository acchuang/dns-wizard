import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  SpeedTestState, SpeedProgressEvent, StageResult, SpeedHistoryEntry,
  SpeedTestResult, LatencyResult, LatencyProgressEvent,
} from "../types";
import SpeedGauge from "./SpeedGauge";

interface Props {
  state: SpeedTestState;
  setState: React.Dispatch<React.SetStateAction<SpeedTestState>>;
}

const HISTORY_KEY = "dnswizard-speed-history";

function loadHistory(): SpeedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: SpeedHistoryEntry) => e.qualityScore !== undefined);
  } catch {
    return [];
  }
}

function saveHistory(entry: SpeedHistoryEntry) {
  const history = loadHistory();
  history.unshift(entry);
  if (history.length > 20) history.length = 20;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const btnBase: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

function getBarColor(mbps: number): string {
  if (mbps >= 250) return "#06b6d4";
  if (mbps >= 50) return "#22c55e";
  if (mbps >= 10) return "#eab308";
  return "#ef4444";
}

function getGradeColor(grade: string): string {
  if (grade === "A+" || grade === "A") return "#22c55e";
  if (grade === "B") return "#eab308";
  return "#ef4444";
}

function getLatencyColor(ms: number): string {
  if (ms < 30) return "#22c55e";
  if (ms < 60) return "#eab308";
  return "#ef4444";
}

function getJitterColor(ms: number): string {
  if (ms < 5) return "#22c55e";
  if (ms < 10) return "#eab308";
  return "#ef4444";
}

function getLossColor(pct: number): string {
  if (pct === 0) return "#22c55e";
  if (pct < 2) return "#eab308";
  return "#ef4444";
}

function SpeedPanel({ state, setState }: Props) {
  const runTest = async () => {
    setState({
      status: "running", result: null, error: null, currentMbps: 0,
      currentStage: null, stageResults: [], latencyResult: null,
      testPhase: "latency", pingProgress: 0,
    });

    let unlistenLatencyProgress: UnlistenFn | null = null;
    let unlistenLatencyDone: UnlistenFn | null = null;
    let unlistenSpeedProgress: UnlistenFn | null = null;
    let unlistenStageDone: UnlistenFn | null = null;

    try {
      unlistenLatencyProgress = await listen<LatencyProgressEvent>("latency-progress", () => {
        setState((prev) => ({
          ...prev,
          pingProgress: prev.pingProgress + 1,
        }));
      });

      unlistenLatencyDone = await listen<LatencyResult>("latency-done", (e) => {
        setState((prev) => ({
          ...prev,
          latencyResult: e.payload,
          testPhase: "download" as const,
          pingProgress: 20,
        }));
      });

      unlistenSpeedProgress = await listen<SpeedProgressEvent>("speed-progress", (e) => {
        setState((prev) => ({
          ...prev,
          currentMbps: e.payload.currentMbps,
          currentStage: e.payload.stageName,
        }));
      });

      unlistenStageDone = await listen<StageResult>("speed-stage-done", (e) => {
        setState((prev) => ({
          ...prev,
          stageResults: [...prev.stageResults, e.payload],
        }));
      });

      const testResult = await invoke<SpeedTestResult>("run_speed_test");

      if (!testResult.cancelled) {
        saveHistory({
          timestamp: new Date().toISOString(),
          latency: testResult.latency,
          stages: testResult.stages,
          headlineMbps: testResult.headlineMbps,
          qualityScore: testResult.qualityScore,
          qualityGrade: testResult.qualityGrade,
        });
      }

      if (testResult.cancelled && testResult.stages.some((s: StageResult) => !s.error)) {
        setState((prev) => ({
          ...prev,
          status: "cancelled" as const,
          result: testResult,
          currentMbps: testResult.headlineMbps,
          currentStage: null,
          testPhase: "idle" as const,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "done" as const,
          result: testResult,
          currentMbps: testResult.headlineMbps,
          currentStage: null,
          testPhase: "idle" as const,
        }));
      }
    } catch (e) {
      if (String(e).includes("cancelled")) {
        setState((prev) => ({
          ...prev,
          status: "cancelled" as const,
          currentStage: null,
          testPhase: "idle" as const,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "error" as const,
          error: String(e),
          currentStage: null,
          testPhase: "idle" as const,
        }));
      }
    } finally {
      unlistenLatencyProgress?.();
      unlistenLatencyDone?.();
      unlistenSpeedProgress?.();
      unlistenStageDone?.();
    }
  };

  const cancelTest = () => {
    invoke("cancel_speed_test");
  };

  const history = loadHistory();
  const maxSpeed = state.stageResults
    .filter((r) => !r.error)
    .reduce((max, r) => Math.max(max, r.downloadMbps), 0);

  const statsData = history.length > 0
    ? {
        min: Math.min(...history.map((h) => h.qualityScore)),
        max: Math.max(...history.map((h) => h.qualityScore)),
        avg: history.reduce((s, h) => s + h.qualityScore, 0) / history.length,
      }
    : null;

  const showLatencyRow = state.latencyResult !== null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", gap: 16, overflowY: "auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
        Speed Test
      </h2>

      <SpeedGauge
        result={state.result}
        currentMbps={state.currentMbps}
        status={state.status}
        testPhase={state.testPhase}
        stageName={state.currentStage}
      />

      {state.result && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: getGradeColor(state.result.qualityGrade) }}>
            {state.result.qualityGrade}
          </span>
          <span style={{ fontSize: 14, color: "#94a3b8" }}>
            Network Quality ({state.result.qualityScore}/100)
          </span>
        </div>
      )}

      {showLatencyRow && state.latencyResult && (
        <div style={{ width: "100%", maxWidth: 360, display: "flex", justifyContent: "space-between", fontSize: 12, padding: "8px 12px", backgroundColor: "#1e293b", borderRadius: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>Latency</span>
            <span style={{ color: state.latencyResult.successCount === 0 ? "#64748b" : getLatencyColor(state.latencyResult.avgMs), fontWeight: 600 }}>
              {state.latencyResult.successCount === 0 ? "--" : `${state.latencyResult.avgMs.toFixed(1)} ms`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>Jitter</span>
            <span style={{ color: state.latencyResult.successCount < 2 ? "#64748b" : getJitterColor(state.latencyResult.jitterMs), fontWeight: 600 }}>
              {state.latencyResult.successCount < 2 ? "--" : `${state.latencyResult.jitterMs.toFixed(1)} ms`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>Packet Loss</span>
            <span style={{ color: getLossColor(state.latencyResult.packetLoss), fontWeight: 600 }}>
              {state.latencyResult.packetLoss.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {state.stageResults.length > 0 && (
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 6 }}>
          {state.stageResults.map((sr, i) => {
            const barWidth = sr.error ? 0 : maxSpeed > 0 ? (sr.downloadMbps / maxSpeed) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 60, color: sr.error ? "#ef4444" : "#94a3b8", flexShrink: 0 }}>
                  {sr.name}
                </span>
                {sr.error ? (
                  <span style={{ color: "#ef4444", fontSize: 12 }}>
                    Failed: {sr.error.length > 25 ? sr.error.slice(0, 25) + "..." : sr.error}
                  </span>
                ) : (
                  <>
                    <div style={{ flex: 1, height: 8, backgroundColor: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${barWidth}%`, height: "100%", backgroundColor: getBarColor(sr.downloadMbps), borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                    <span style={{ width: 90, textAlign: "right" as const, color: "#e2e8f0", fontWeight: 600, flexShrink: 0 }}>
                      {sr.downloadMbps.toFixed(1)} Mbps
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.error && (
        <p style={{ color: "#ef4444", fontSize: 13, margin: 0, textAlign: "center" }}>
          {state.error}
        </p>
      )}

      <button
        style={{
          ...btnBase,
          backgroundColor: "#7c3aed",
          color: "#fff",
          cursor: "pointer",
        }}
        disabled={false}
        onClick={state.status === "running" ? cancelTest : runTest}
      >
        {state.status === "running" ? "Cancel" : state.status === "done" ? "Test Again" : "Start Test"}
      </button>

      {history.length > 0 && (
        <HistorySection history={history} stats={statsData} />
      )}
    </div>
  );
}

function HistorySection({ history, stats }: { history: SpeedHistoryEntry[]; stats: { min: number; max: number; avg: number } | null }) {
  const [open, setOpen] = useState(true);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    window.location.reload();
  };

  return (
    <div style={{ width: "100%", maxWidth: 360, marginTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", padding: "4px 0", width: "100%", textAlign: "left" as const, display: "flex", justifyContent: "space-between" }}
      >
        <span>History</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {history.slice(0, 5).map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
              <span>{formatTimestamp(h.timestamp)}</span>
              <span style={{ color: "#94a3b8" }}>{h.qualityGrade} ({h.qualityScore}) {h.headlineMbps.toFixed(1)} Mbps</span>
            </div>
          ))}
          {stats && (
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: 4, marginTop: 4, fontSize: 11, color: "#475569", display: "flex", justifyContent: "space-between" }}>
              <span>Min: {stats.min}</span>
              <span>Avg: {stats.avg.toFixed(0)}</span>
              <span>Max: {stats.max}</span>
            </div>
          )}
          <button
            onClick={clearHistory}
            style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: "4px 0", textAlign: "left" as const, marginTop: 2 }}
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

export default SpeedPanel;