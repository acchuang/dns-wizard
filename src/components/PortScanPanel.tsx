import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { PortScanState, PortResult, PortProgressEvent } from "../types";
import { useToast } from "./ToastProvider";
import EmptyState from "./EmptyState";
import ExportButton from "./ExportButton";

const PRESETS: { label: string; range: string }[] = [
  { label: "Common Web", range: "80,443,8080,8443" },
  { label: "Mail", range: "25,110,143,465,587,993,995" },
  { label: "SSH/RDP", range: "22,3389,5900" },
  { label: "Databases", range: "3306,5432,6379,27017" },
  { label: "Full Scan", range: "1-1024" },
];

const initialState: PortScanState = {
  host: "",
  portRange: "80,443",
  isRunning: false,
  results: [],
  progress: 0,
  total: 0,
  error: null,
};

function PortScanPanel() {
  const [state, setState] = useState<PortScanState>(initialState);
  const { addToast } = useToast();
  const mountedRef = useRef(true);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; unlistenRef.current?.(); };
  }, []);

  const runScan = async () => {
    if (state.isRunning) return;
    setState((prev) => ({ ...prev, isRunning: true, results: [], progress: 0, error: null }));

    const unlisten = await listen<PortProgressEvent>("port-progress", (e) => {
      if (!mountedRef.current) return;
      setState((prev) => ({ ...prev, progress: e.payload.progress }));
    });
    unlistenRef.current = unlisten;

    try {
      const results = await invoke<PortResult[]>("run_port_scan", {
        host: state.host,
        portRange: state.portRange,
      });
      if (mountedRef.current) {
        const openCount = results.filter((r) => r.status === "open").length;
        setState((prev) => ({ ...prev, isRunning: false, results, total: results.length }));
        addToast(openCount > 0 ? "info" : "info", `Found ${openCount} open port${openCount !== 1 ? "s" : ""}`);
      }
    } catch (e) {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isRunning: false, error: String(e) }));
      }
    } finally {
      unlisten();
    }
  };

  const cancelScan = async () => {
    await invoke("cancel_port_scan");
  };

  const openPorts = state.results.filter((r) => r.status === "open");
  const filteredPorts = state.results.filter((r) => r.status === "filtered");

  const exportData = state.results.map((r) => ({
    Port: r.port,
    Status: r.status,
    Service: r.service || "—",
    LatencyMs: r.latencyMs != null ? r.latencyMs.toFixed(1) : "—",
  }));

  return (
    <div className="port-panel">
      <h2>Port Scanner</h2>

      <div className="port-input-row">
        <input
          className="port-input"
          placeholder="Host (e.g. cloudflare.com)"
          value={state.host}
          onChange={(e) => setState((prev) => ({ ...prev, host: e.target.value }))}
          disabled={state.isRunning}
        />
        <input
          className="port-range-input"
          placeholder="Port range (e.g. 80,443 or 1-1024)"
          value={state.portRange}
          onChange={(e) => setState((prev) => ({ ...prev, portRange: e.target.value }))}
          disabled={state.isRunning}
        />
        <button
          className="btn-accent"
          onClick={state.isRunning ? cancelScan : runScan}
          disabled={!state.host.trim() && !state.isRunning}
        >
          {state.isRunning ? "Cancel" : "Scan"}
        </button>
      </div>

      <div className="port-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.range}
            className={`port-preset${state.portRange === preset.range ? " active" : ""}`}
            onClick={() => setState((prev) => ({ ...prev, portRange: preset.range }))}
            disabled={state.isRunning}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {state.isRunning && (
        <div className="port-progress-bar">
          <div className="port-progress-fill" style={{ width: `${state.progress}%` }} />
        </div>
      )}

      {state.error && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{state.error}</p>
      )}

      {state.results.length > 0 && (
        <>
          <div className="port-summary-tiles">
            <div className="port-summary-tile">
              <div className="port-summary-value" style={{ color: "var(--success)" }}>{openPorts.length}</div>
              <div className="port-summary-label">Open</div>
            </div>
            <div className="port-summary-tile">
              <div className="port-summary-value" style={{ color: "var(--warning)" }}>{filteredPorts.length}</div>
              <div className="port-summary-label">Filtered</div>
            </div>
            <div className="port-summary-tile">
              <div className="port-summary-value">{state.results.length - openPorts.length - filteredPorts.length}</div>
              <div className="port-summary-label">Closed</div>
            </div>
            <div className="port-summary-tile">
              <div className="port-summary-value">{state.results.length}</div>
              <div className="port-summary-label">Total</div>
            </div>
          </div>

          <table className="port-results-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>Status</th>
                <th>Service</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {state.results
                .filter((r) => r.status === "open" || r.status === "filtered")
                .map((r) => (
                  <tr key={r.port}>
                    <td>{r.port}</td>
                    <td className={`port-status-${r.status}`}>{r.status}</td>
                    <td>{r.service || "—"}</td>
                    <td>{r.latencyMs != null ? `${r.latencyMs.toFixed(1)}ms` : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {exportData.length > 0 && <ExportButton data={exportData} filename="port-scan" />}
        </>
      )}

      {!state.isRunning && state.results.length === 0 && !state.error && (
        <EmptyState icon="🔍" title="Scan Ports" description="Enter a host and port range to discover open services" />
      )}
    </div>
  );
}

export default PortScanPanel;