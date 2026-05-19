import { useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PingState, PingResult, HopResult } from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import ResultTable from "./ResultTable";
import ExportButton from "./ExportButton";
import Tooltip from "./Tooltip";

interface Props {
  state: PingState;
  setState: React.Dispatch<React.SetStateAction<PingState>>;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #334155",
  backgroundColor: "#16213e",
  color: "#e2e8f0",
  fontSize: 14,
  width: 200,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#7c3aed",
  color: "#fff",
};

const cancelBtnStyle: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
};

const presets = [
  { label: "Cloudflare", host: "1.1.1.1" },
  { label: "Google", host: "8.8.8.8" },
  { label: "Quad9", host: "9.9.9.9" },
];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px",
  borderRadius: 6,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "#64748b",
});

function PingPanel({ state, setState }: Props) {
  const cancelledRef = useRef(false);
  const { simpleMode } = useSimpleMode();

  const runTest = async () => {
    cancelledRef.current = false;
    setState((prev) => ({ ...prev, isRunning: true, results: [], error: null }));
    try {
      if (state.mode === "ping") {
        const results = await invoke<PingResult[]>("run_ping", { host: state.host, count: 5 });
        if (!cancelledRef.current) {
          setState((prev) => ({ ...prev, isRunning: false, results }));
        }
      } else {
        const results = await invoke<HopResult[]>("run_traceroute", { host: state.host, maxHops: 20 });
        if (!cancelledRef.current) {
          setState((prev) => ({ ...prev, isRunning: false, results }));
        }
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setState((prev) => ({ ...prev, isRunning: false, error: String(e) }));
      }
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    if (state.mode === "ping") {
      invoke("cancel_ping");
    } else {
      invoke("cancel_traceroute");
    }
    setState((prev) => ({ ...prev, isRunning: false }));
  };

  const pingColumns = [
    { key: "seq", label: "#" },
    { key: "latency", label: "Latency" },
    { key: "status", label: "Status" },
  ];

  const traceColumns = [
    { key: "hop", label: "Hop" },
    { key: "host", label: "Host" },
    { key: "latency", label: "Latency" },
  ];

  const rows = state.results.map((r: PingResult | HopResult) => {
    if ("seq" in r) {
      return {
        seq: r.seq,
        latency: r.latencyMs !== null ? `${r.latencyMs}ms` : "—",
        status: r.success ? "✓" : "✗",
      };
    }
    const h = r as HopResult;
    return { hop: h.hop, host: h.host, latency: h.latencyMs !== null ? `${h.latencyMs}ms` : "—" };
  });

  const exportData = state.mode === "ping" 
    ? (state.results as PingResult[]).map((p) => ({ Seq: p.seq, LatencyMs: p.latencyMs !== null ? String(p.latencyMs) : "timeout", Success: p.success ? "yes" : "no" }))
    : (state.results as HopResult[]).map((h) => ({ Hop: h.hop, Host: h.host, LatencyMs: h.latencyMs !== null ? String(h.latencyMs) : "timeout", Success: h.success ? "yes" : "no" }));

  const successCount = state.results.filter((r: PingResult | HopResult) => "seq" in r && r.success).length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16, color: "#e2e8f0" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
        {state.mode === "ping" ? "Ping" : "Traceroute"}
      </h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={tabStyle(state.mode === "ping")} onClick={() => setState((prev) => ({ ...prev, mode: "ping", results: [], error: null }))}>Ping</button>
        <button style={tabStyle(state.mode === "traceroute")} onClick={() => setState((prev) => ({ ...prev, mode: "traceroute", results: [], error: null }))}>Traceroute</button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          style={inputStyle}
          value={state.host}
          onChange={(e) => setState((prev) => ({ ...prev, host: e.target.value }))}
          placeholder="cloudflare.com"
          disabled={state.isRunning}
        />
        {!state.isRunning ? (
          <button style={btnStyle} onClick={runTest}>Run</button>
        ) : (
          <button style={cancelBtnStyle} onClick={cancel}>Cancel</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {presets.map((p) => (
          <button
            key={p.host}
            style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #334155", background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            onClick={() => setState((prev) => ({ ...prev, host: p.host, results: [], error: null }))}
            disabled={state.isRunning}
          >
            {p.label}
          </button>
        ))}
      </div>

      {simpleMode && state.mode === "ping" && state.results.length > 0 && !state.isRunning && (
        <div style={{ padding: "12px 16px", backgroundColor: "#16213e", borderRadius: 8 }}>
          {successCount === 5 ? (
            <span style={{ color: "#22c55e", fontWeight: 600 }}>
              ✓ All 5 pings succeeded — {state.host} is reachable
            </span>
          ) : (
            <span style={{ color: "#ef4444", fontWeight: 600 }}>
              ✗ {5 - successCount}/5 pings failed — {state.host} may be unreachable
            </span>
          )}
        </div>
      )}

      {state.error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{state.error}</p>}
      {state.isRunning && state.mode === "traceroute" && rows.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
          <Tooltip text="Traceroute sends packets with increasing time-to-live to map each hop between you and the destination.">
            Tracing route
          </Tooltip>... this may take up to 40 seconds.
        </p>
      )}
      {!state.isRunning && !state.error && rows.length === 0 && (
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
          {state.mode === "ping" ? "Click Run to ping a host" : "Click Run to trace the route to a host"}
        </p>
      )}
      {rows.length > 0 && !simpleMode && (
        <ResultTable columns={state.mode === "ping" ? pingColumns : traceColumns} rows={rows} />
      )}

      {exportData.length > 0 && <ExportButton data={exportData} filename={`dns-wizard-${state.mode}`} />}
    </div>
  );
}

export default PingPanel;