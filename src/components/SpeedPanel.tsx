import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  SpeedTestState, SpeedProgressEvent, StageResult, SpeedHistoryEntry,
  SpeedTestResult, LatencyResult, LatencyProgressEvent,
} from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import SpeedGauge from "./SpeedGauge";
import ExportButton from "./ExportButton";


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

function getGradeClass(grade: string): string {
  if (grade === "A+") return "excellent";
  if (grade === "A") return "great";
  if (grade === "B") return "good";
  if (grade === "C") return "fair";
  if (grade === "D") return "poor";
  if (grade === "F") return "bad";
  return "empty";
}

function getGradeLabel(grade: string): string {
  if (grade === "A+") return "Excellent";
  if (grade === "A") return "Very Good";
  if (grade === "B") return "Good";
  if (grade === "C") return "Fair";
  if (grade === "D") return "Poor";
  return "Very Poor";
}

function SpeedPanel({ state, setState }: Props) {
  const { simpleMode } = useSimpleMode();

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

  const exportData = state.result ? [{
    HeadlineSpeed: `${state.result.headlineMbps.toFixed(1)} Mbps`,
    QualityGrade: state.result.qualityGrade,
    QualityScore: state.result.qualityScore,
    ...(state.result.latency ? {
      AvgLatencyMs: state.result.latency.avgMs.toFixed(1),
      JitterMs: state.result.latency.jitterMs.toFixed(1),
      PacketLossPct: state.result.latency.packetLoss.toFixed(1),
    } : {}),
    ...Object.fromEntries(state.result.stages.map((s, i) => [`Stage${i + 1}_${s.name}`, `${s.downloadMbps.toFixed(1)} Mbps`])),
  }] : [];

  const statsData = history.length > 0
    ? {
        min: Math.min(...history.map((h) => h.qualityScore)),
        max: Math.max(...history.map((h) => h.qualityScore)),
        avg: history.reduce((s, h) => s + h.qualityScore, 0) / history.length,
      }
    : null;

  return (
    <div className="speed-panel">
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
        Speed Test
      </h2>

      <SpeedGauge
        result={state.result}
        currentMbps={state.currentMbps}
        status={state.status}
        testPhase={state.testPhase}
        stageName={state.currentStage}
      />

      {state.status === "error" && (
        <div className="speed-grade-badge">
          <div className="speed-grade-tile bad">&#9888;&#65039;</div>
          <div>
            <div className="speed-grade-label">Connection failed</div>
            <div className="speed-grade-detail" style={{ color: "var(--danger)" }}>
              Check your network and try again.
            </div>
          </div>
        </div>
      )}

      {state.status !== "error" && state.result && (
        simpleMode ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: "var(--" + (state.result.qualityGrade === "A+" || state.result.qualityGrade === "A" ? "success" : state.result.qualityGrade === "B" ? "warning" : "danger") + ")" }}>
              {state.result.qualityGrade}
            </span>
            <span style={{ fontSize: 16, color: "var(--text-primary)", fontWeight: 600 }}>
              {getGradeLabel(state.result.qualityGrade)}
            </span>
            <span style={{ fontSize: 24, color: "var(--text-secondary)" }}>
              {state.result.headlineMbps.toFixed(1)} Mbps
            </span>
          </div>
        ) : (
          <div className="speed-grade-badge">
            <div className={`speed-grade-tile ${getGradeClass(state.result.qualityGrade)}`}>
              {state.result.qualityGrade}
            </div>
            <div>
              <div className="speed-grade-label">Network Quality Score</div>
              <div className="speed-grade-detail" style={{ color: "var(--success)" }}>
                {getGradeLabel(state.result.qualityGrade)}
              </div>
            </div>
          </div>
        )
      )}

      {state.status === "idle" && (
        <div className="speed-grade-badge">
          <div className="speed-grade-tile empty">&mdash;</div>
          <div>
            <div className="speed-grade-label">Network Quality Score</div>
            <div className="speed-grade-detail" style={{ color: "var(--text-tertiary)" }}>
              Run a speed test to see your grade
            </div>
          </div>
        </div>
      )}

      {state.status === "running" && state.testPhase === "latency" && (
        <div className="speed-grade-badge">
          <div className="speed-grade-tile empty">&mdash;</div>
          <div>
            <div className="speed-grade-label">Network Quality Score</div>
            <div className="speed-grade-detail" style={{ color: "var(--text-tertiary)" }}>
              Testing latency...
            </div>
          </div>
        </div>
      )}

      {state.status === "running" && state.testPhase === "download" && (
        <div className="speed-grade-badge">
          <div className="speed-grade-tile empty">&mdash;</div>
          <div>
            <div className="speed-grade-label">Network Quality Score</div>
            <div className="speed-grade-detail" style={{ color: "var(--text-tertiary)" }}>
              Testing download...
            </div>
          </div>
        </div>
      )}

      {state.latencyResult && (
        <div className="speed-metric-tiles">
          <div className="speed-metric-tile">
            <div className="speed-metric-value" style={{ color: state.latencyResult.successCount === 0 ? "var(--text-tertiary)" : "var(--success)" }}>
              {state.latencyResult.successCount === 0 ? "\u2014" : `${state.latencyResult.avgMs.toFixed(1)}ms`}
            </div>
            <div className="speed-metric-label">Latency</div>
          </div>
          <div className="speed-metric-tile">
            <div className="speed-metric-value" style={{ color: "var(--accent)" }}>
              {state.latencyResult.successCount < 2 ? "\u2014" : `${state.latencyResult.jitterMs.toFixed(1)}ms`}
            </div>
            <div className="speed-metric-label">Jitter</div>
          </div>
          <div className="speed-metric-tile">
            <div className="speed-metric-value" style={{ color: state.latencyResult.packetLoss === 0 ? "var(--success)" : state.latencyResult.packetLoss < 2 ? "var(--warning)" : "var(--danger)" }}>
              {state.latencyResult.packetLoss.toFixed(1)}%
            </div>
            <div className="speed-metric-label">Loss</div>
          </div>
          <div className="speed-metric-tile">
            <div className="speed-metric-value" style={{ color: "var(--text-primary)" }}>
              {state.result ? `${state.result.headlineMbps.toFixed(1)}Mbps` : "\u2014"}
            </div>
            <div className="speed-metric-label">Download</div>
          </div>
        </div>
      )}

      {state.stageResults.length > 0 && !simpleMode && (
        <div className="speed-stage-bars">
          {state.stageResults.map((sr, i) => {
            const barWidth = sr.error ? 0 : maxSpeed > 0 ? (sr.downloadMbps / maxSpeed) * 100 : 0;
            return (
              <div key={i} className="speed-stage-bar-row">
                <span className="stage-name">{sr.name}</span>
                {sr.error ? (
                  <span style={{ color: "var(--danger)", fontSize: 10 }}>Failed</span>
                ) : (
                  <>
                    <div className="speed-stage-bar-track">
                      <div className="speed-stage-bar-fill" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="stage-value">{sr.downloadMbps.toFixed(1)} Mbps</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.error && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: 0, textAlign: "center" }}>
          {state.error}
        </p>
      )}

      <button
        className="btn-accent"
        disabled={false}
        onClick={state.status === "running" ? cancelTest : runTest}
      >
        {state.status === "running" ? "Cancel" : state.status === "error" ? "Retry" : state.status === "done" ? "Test Again" : "Start Test"}
      </button>

      {exportData.length > 0 && <ExportButton data={exportData} filename="speed-test" />}

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

  const historyExportData = history.map((h) => ({
    Timestamp: h.timestamp,
    Grade: h.qualityGrade,
    Score: h.qualityScore,
    SpeedMbps: h.headlineMbps.toFixed(1),
    ...(h.latency ? {
      AvgLatencyMs: h.latency.avgMs.toFixed(1),
      JitterMs: h.latency.jitterMs.toFixed(1),
      PacketLossPct: h.latency.packetLoss.toFixed(1),
    } : {}),
  }));

  return (
    <div className="speed-history-toggle">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => setOpen(!open)}
          className="speed-history-clear"
          style={{ display: "flex", justifyContent: "space-between", flex: 1, fontSize: 13 }}
        >
          <span>History</span>
          <span>{open ? "\u25B2" : "\u25BC"}</span>
        </button>
        <ExportButton data={historyExportData} filename="speed-history" label="Export History" />
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {history.slice(0, 5).map((h, i) => (
            <div key={i} className="speed-history-row">
              <span>{formatTimestamp(h.timestamp)}</span>
              <span style={{ color: "var(--text-secondary)" }}>{h.qualityGrade} ({h.qualityScore}) {h.headlineMbps.toFixed(1)} Mbps</span>
            </div>
          ))}
          {stats && (
            <div style={{ borderTop: "1px solid var(--bg-input)", paddingTop: 4, marginTop: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-tertiary)" }}>Min: {stats.min}</span>
              <span style={{ color: "var(--text-tertiary)" }}>Avg: {stats.avg.toFixed(0)}</span>
              <span style={{ color: "var(--text-tertiary)" }}>Max: {stats.max}</span>
            </div>
          )}
          <button
            onClick={clearHistory}
            className="speed-history-clear"
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

export default SpeedPanel;
