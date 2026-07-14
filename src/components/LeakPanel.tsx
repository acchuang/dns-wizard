import { invoke } from "@tauri-apps/api/core";
import { LeakTestState, LeakResult } from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import { useMountedRef, runGuarded } from "../hooks/useTestRunner";
import { normalizedIncludes } from "../utils/ip";
import EmptyState from "./EmptyState";
import PaneHeader from "./PaneHeader";

interface Props {
  state: LeakTestState;
  setState: React.Dispatch<React.SetStateAction<LeakTestState>>;
  configuredDns: string[];
}

function LeakPanel({ state, setState, configuredDns }: Props) {
  const { simpleMode } = useSimpleMode();
  const mountedRef = useMountedRef();

  const runTest = async () => {
    setState({ status: "running", result: null, error: null });
    await runGuarded<LeakResult>(mountedRef, {
      run: () => invoke<LeakResult>("run_dns_leak_test", { configuredServers: configuredDns }),
      onSuccess: (result) => {
        setState({ status: "done", result, error: null });
        try {
          localStorage.setItem("dnswizard-leak-result", JSON.stringify({ isLeaking: result.isLeaking, timestamp: Date.now() }));
        } catch {}
      },
      onError: (message) => setState({ status: "error", result: null, error: message }),
    });
  };

  const { result } = state;

  const leakCount = result
    ? result.detectedServers.filter(s => !normalizedIncludes(result.configuredServers, s)).length
    : 0;

  const simpleLabel = result?.isLeaking === true ? "DNS leak detected"
    : result?.isLeaking === false ? "No leaks detected"
    : result?.isLeaking === null ? "No baseline set"
    : "";

  const detailedLabel = result?.isLeaking === true
    ? "DNS leak detected — queries are not going through your configured servers"
    : result?.isLeaking === false
    ? "No leak detected — all queries go through your configured DNS"
    : result?.isLeaking === null
    ? "No baseline — apply a DNS profile first to compare"
    : "";

  return (
    <div className="leak-panel">
      <PaneHeader tool="leak" title="DNS Leak Test" />

      {state.status === "idle" && !result && configuredDns.length > 0 && (
        <EmptyState icon="🔒" title="DNS Leak Test" description="Test whether your DNS queries are going through your configured servers" />
      )}

      {configuredDns.length === 0 && state.status !== "running" && (
        <p style={{ fontSize: 13, color: "var(--warning)", margin: 0 }}>
          Apply a DNS profile first to detect leaks.
        </p>
      )}

      <button
        className="btn-accent"
        style={{ opacity: state.status === "running" || configuredDns.length === 0 ? 0.5 : 1, cursor: state.status === "running" || configuredDns.length === 0 ? "not-allowed" : "pointer" }}
        disabled={state.status === "running" || configuredDns.length === 0}
        onClick={runTest}>
        {state.status === "running" ? "Testing..." : "Run Leak Test"}
      </button>

      {state.error && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{state.error}</p>
      )}

      {result && (
        <div className={`leak-banner ${result.isLeaking === true ? 'danger' : result.isLeaking === false ? 'success' : 'warning'}`}>
          <div className={`leak-banner-icon ${result.isLeaking === true ? 'danger' : result.isLeaking === false ? 'success' : 'warning'}`}>
            {result.isLeaking === true ? '⚠️' : result.isLeaking === false ? '✅' : '—'}
          </div>
          <div>
            <div className={`leak-banner-title ${result.isLeaking === true ? 'danger' : 'success'}`}>
              {simpleMode ? simpleLabel : detailedLabel}
            </div>
            <div className="leak-banner-desc">
              {result.isLeaking === true ? "Your DNS queries may be exposed to unintended servers." : result.isLeaking === false ? "All queries are routed through your configured DNS server." : "Apply a DNS profile and run the test to establish a baseline."}
            </div>
          </div>
        </div>
      )}

      {result && !simpleMode && (
        <div className="leak-content">
          <div className="leak-server-list">
            <p className="leak-server-header">DETECTED SERVERS</p>
            {result.detectedServers.map((ip) => {
              const isConfigured = normalizedIncludes(result.configuredServers, ip);
              return (
                <div key={ip} className={`leak-server-card ${isConfigured ? '' : 'leaked'}`}>
                  <div className={`leak-server-icon ${isConfigured ? 'configured' : 'leaked'}`}>
                    {isConfigured ? 'CF' : '??'}
                  </div>
                  <div className="leak-server-info">
                    <div className="leak-server-ip">{ip}</div>
                    <div className="leak-server-provider">
                      {isConfigured ? 'Configured' : 'Unknown Provider'}
                    </div>
                  </div>
                  <span className={`leak-server-badge ${isConfigured ? 'configured' : 'leaked'}`}>
                    {isConfigured ? '✓ Configured' : '⚠ Leaked'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="leak-side-panel">
            <div className="leak-stat-tile">
              <div className="leak-stat-value">{result.detectedServers.length}</div>
              <div className="leak-stat-label">Servers</div>
            </div>
            <div className="leak-stat-tile">
              <div className="leak-stat-value" style={{ color: (leakCount > 0 ? "var(--danger)" : "var(--success)") }}>
                {leakCount}
              </div>
              <div className="leak-stat-label">Leaks</div>
            </div>
          </div>
        </div>
      )}

      {result && simpleMode && (
        <>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 4px 0" }}>Your DNS Servers</h3>
              {result.configuredServers.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>None configured (using DHCP)</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {result.configuredServers.map((s) => <li key={s} style={{ fontSize: 13, color: "var(--text-primary)" }}>{s}</li>)}
                </ul>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 4px 0" }}>Detected Servers</h3>
              {result.detectedServers.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>None detected</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {result.detectedServers.map((s) => <li key={s} style={{ fontSize: 13, color: "var(--text-primary)" }}>{s}</li>)}
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
