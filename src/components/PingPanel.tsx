import { useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PingState, PingResult, HopResult } from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import EmptyState from "./EmptyState";
import ResultTable from "./ResultTable";
import ExportButton from "./ExportButton";
import Tooltip from "./Tooltip";

interface Props {
  state: PingState;
  setState: React.Dispatch<React.SetStateAction<PingState>>;
}

const presets = [
  { label: "Cloudflare", host: "1.1.1.1" },
  { label: "Google", host: "8.8.8.8" },
  { label: "Quad9", host: "9.9.9.9" },
];

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
    <div className="ping-panel">
      <h2>
        {state.mode === "ping" ? "Ping" : "Traceroute"}
      </h2>
      <div className="ping-tabs">
        <button className={`ping-tab ${state.mode === "ping" ? "active" : ""}`}
          onClick={() => setState((prev) => ({ ...prev, mode: "ping", results: [], error: null }))}>Ping</button>
        <button className={`ping-tab ${state.mode === "traceroute" ? "active" : ""}`}
          onClick={() => setState((prev) => ({ ...prev, mode: "traceroute", results: [], error: null }))}>Traceroute</button>
      </div>
      <div className="ping-input-row">
        <input
          className="ping-input"
          value={state.host}
          onChange={(e) => setState((prev) => ({ ...prev, host: e.target.value }))}
          placeholder="cloudflare.com"
          disabled={state.isRunning}
        />
        {!state.isRunning ? (
          <button className="btn-accent" onClick={runTest}>Run</button>
        ) : (
          <button className="btn-outline" onClick={cancel}>Cancel</button>
        )}
      </div>
      <div className="ping-presets">
        {presets.map((p) => (
          <button
            key={p.host}
            className={`ping-preset ${state.host === p.host && !state.isRunning ? 'active' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, host: p.host, results: [], error: null }))}
            disabled={state.isRunning}
          >
            {p.label}
          </button>
        ))}
      </div>

      {simpleMode && state.mode === "ping" && state.results.length > 0 && !state.isRunning && (
        <div style={{ padding: "12px 16px", backgroundColor: "var(--bg-card)", borderRadius: 8 }}>
          {successCount === 5 ? (
            <span style={{ color: "var(--success)", fontWeight: 600 }}>
              ✓ All 5 pings succeeded — {state.host} is reachable
            </span>
          ) : (
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>
              ✗ {5 - successCount}/5 pings failed — {state.host} may be unreachable
            </span>
          )}
        </div>
      )}

      {state.error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{state.error}</p>}
      {state.isRunning && state.mode === "traceroute" && rows.length === 0 && (
        <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: 0 }}>
          <Tooltip text="Traceroute sends packets with increasing time-to-live to map each hop between you and the destination.">
            Tracing route
          </Tooltip>... this may take up to 40 seconds.
        </p>
      )}
      {!state.isRunning && !state.error && rows.length === 0 && (
        <EmptyState
          icon="📡"
          title={state.mode === "ping" ? "Ping Test" : "Traceroute"}
          description={state.mode === "ping" ? "Enter a host and run ping to see results." : "Click Run to trace the route to a host."}
        />
      )}
      {rows.length > 0 && !simpleMode && (
        <ResultTable columns={state.mode === "ping" ? pingColumns : traceColumns} rows={rows} />
      )}

      {state.results.length > 0 && !state.isRunning && state.mode === "ping" && (
        <div className="ping-summary-tiles">
          <div className="ping-summary-tile">
            <div className="ping-summary-value" style={{ color: "var(--success)" }}>
              {(() => {
                const results = state.results as PingResult[];
                const successes = results.filter(r => r.success && r.latencyMs !== null);
                if (successes.length === 0) return "—";
                const avgMs = successes.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / successes.length;
                return `${avgMs.toFixed(1)}ms`;
              })()}
            </div>
            <div className="ping-summary-label">Avg</div>
          </div>
          <div className="ping-summary-tile">
            <div className="ping-summary-value">
              {(() => {
                const results = state.results as PingResult[];
                const successes = results.filter(r => r.success && r.latencyMs !== null);
                if (successes.length === 0) return "—";
                return `${Math.min(...successes.map(r => r.latencyMs ?? Infinity)).toFixed(1)}ms`;
              })()}
            </div>
            <div className="ping-summary-label">Min</div>
          </div>
          <div className="ping-summary-tile">
            <div className="ping-summary-value">
              {(() => {
                const results = state.results as PingResult[];
                const successes = results.filter(r => r.success && r.latencyMs !== null);
                if (successes.length === 0) return "—";
                return `${Math.max(...successes.map(r => r.latencyMs ?? 0)).toFixed(1)}ms`;
              })()}
            </div>
            <div className="ping-summary-label">Max</div>
          </div>
          <div className="ping-summary-tile">
            <div className="ping-summary-value" style={{ color: (() => {
              const results = state.results as PingResult[];
              const lossPct = results.length > 0 ? (results.filter(r => !r.success).length / results.length) * 100 : 0;
              return lossPct === 0 ? "var(--success)" : lossPct < 25 ? "var(--warning)" : "var(--danger)";
            })() }}>
              {(() => {
                const results = state.results as PingResult[];
                if (results.length === 0) return "—";
                return `${((results.filter(r => !r.success).length / results.length) * 100).toFixed(1)}%`;
              })()}
            </div>
            <div className="ping-summary-label">Loss</div>
          </div>
          <div className="ping-summary-tile">
            <div className="ping-summary-value">{state.results.length}</div>
            <div className="ping-summary-label">Pings</div>
          </div>
        </div>
      )}

      {exportData.length > 0 && <ExportButton data={exportData} filename={`dns-wizard-${state.mode}`} />}
    </div>
  );
}

export default PingPanel;
