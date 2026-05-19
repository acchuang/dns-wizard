import { invoke } from "@tauri-apps/api/core";
import { LeakTestState, LeakResult } from "../types";

interface Props {
  state: LeakTestState;
  setState: React.Dispatch<React.SetStateAction<LeakTestState>>;
  configuredDns: string[];
}

const btnStyle: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#7c3aed",
  color: "#fff",
};

function LeakPanel({ state, setState, configuredDns }: Props) {
  const runTest = async () => {
    setState({ status: "running", result: null, error: null });
    try {
      const result = await invoke<LeakResult>("run_dns_leak_test", {
        configuredServers: configuredDns,
      });
      setState({ status: "done", result, error: null });
    } catch (e) {
      setState({ status: "error", result: null, error: String(e) });
    }
  };

  const { result } = state;

  const statusColor = result?.isLeaking === true ? "#ef4444"
    : result?.isLeaking === false ? "#10b981"
    : "#eab308";

  const statusText = result?.isLeaking === true
    ? "DNS leak detected — queries are not going through your configured servers"
    : result?.isLeaking === false
    ? "No leak detected — all queries go through your configured DNS"
    : result?.isLeaking === null
    ? "No baseline — apply a DNS profile first to compare"
    : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16, color: "#e2e8f0" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>DNS Leak Test</h2>

      {configuredDns.length === 0 && state.status !== "running" && (
        <p style={{ fontSize: 13, color: "#eab308", margin: 0 }}>Apply a DNS profile first to detect leaks.</p>
      )}

      <button
        style={{ ...btnStyle, opacity: state.status === "running" || configuredDns.length === 0 ? 0.5 : 1, cursor: state.status === "running" || configuredDns.length === 0 ? "not-allowed" : "pointer" }}
        disabled={state.status === "running" || configuredDns.length === 0}
        onClick={runTest}
      >
        {state.status === "running" ? "Testing..." : "Start Leak Test"}
      </button>

      {state.error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{state.error}</p>}

      {result && (
        <>
          <p style={{ fontSize: 16, fontWeight: 600, color: statusColor, margin: 0 }}>{statusText}</p>

          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>Your DNS Servers</h3>
              {result.configuredServers.length === 0 ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>None configured (using DHCP)</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {result.configuredServers.map((s) => <li key={s} style={{ fontSize: 13 }}>{s}</li>)}
                </ul>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>Detected Servers</h3>
              {result.detectedServers.length === 0 ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>None detected</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {result.detectedServers.map((s) => <li key={s} style={{ fontSize: 13 }}>{s}</li>)}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeakPanel;