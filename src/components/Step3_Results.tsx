import { useMemo } from "react";
import { DnsProvider, UNREACHABLE_SENTINEL } from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import ExportButton from "./ExportButton";
import Tooltip from "./Tooltip";

interface Props {
  results: DnsProvider[];
  selectedIp: string | null;
  error: string | null;
  applied: boolean;
  isApplying: boolean;
  isFlushing: boolean;
  onSelect: (ip: string, secondaryIp: string) => void;
  onAuthorizeApply: () => void;
  onAuthorizeRestore: () => void;
  onFlushCache: () => void;
  onStartOver: () => void;
}

function Step3_Results({
  results,
  selectedIp,
  error,
  applied,
  isApplying,
  isFlushing,
  onSelect,
  onAuthorizeApply,
  onAuthorizeRestore,
  onFlushCache,
  onStartOver,
}: Props) {
  const { simpleMode } = useSimpleMode();

  const reachable = useMemo(
    () => results.filter((r) => r.latency !== null && r.latency < UNREACHABLE_SENTINEL),
    [results]
  );

  const allUnreachable = results.length > 0 && reachable.length === 0;

  const fastestIp = reachable.length > 0 ? reachable[0].ip : null;

  const secondaryFor = (ip: string) => {
    const others = reachable
      .filter((r) => r.ip !== ip)
      .sort((a, b) => (a.latency ?? UNREACHABLE_SENTINEL) - (b.latency ?? UNREACHABLE_SENTINEL));
    return others.length > 0 ? others[0].ip : "";
  };

  const exportData = useMemo(() => {
    return results.map((r) => ({
      Provider: r.name,
      IP: r.ip,
      LatencyMs: r.latency !== null && r.latency < UNREACHABLE_SENTINEL ? r.latency : "Unreachable",
    }));
  }, [results]);

  const rowClass = (ip: string) => {
    const classes = ["dns-result-row"];
    if (selectedIp === ip) classes.push("selected");
    if (fastestIp === ip) classes.push("fastest");
    return classes.join(" ");
  };

  return (
    <div className="dns-results-wrapper">
      <h1 className="dns-step-title">
        {applied ? "DNS Active" : "Benchmark Results"}
      </h1>

      {allUnreachable && (
        <p style={{ fontSize: 14, color: "var(--danger)", margin: 0, textAlign: "center" }}>
          No DNS servers responded. Check your internet connection and try again.
        </p>
      )}

      {results.length > 0 && !allUnreachable && (
        simpleMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 440 }}>
            {reachable.slice(0, 5).map((r) => (
              <div
                key={r.ip}
                onClick={() => onSelect(r.ip, secondaryFor(r.ip))}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 16px",
                  backgroundColor: selectedIp === r.ip ? "var(--bg-selected)" : "var(--bg-card)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{r.name}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: r.latency! < 20 ? "var(--success)" : r.latency! < 50 ? "var(--warning)" : "var(--danger)" }}>
                  {r.latency}ms
                </span>
              </div>
            ))}
          </div>
        ) : (
          <table className="dns-results-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>
                  <Tooltip text="How long it takes for the DNS server to respond. Lower is better.">
                    Latency
                  </Tooltip>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.ip}
                  className={rowClass(r.ip)}
                  onClick={() => onSelect(r.ip, secondaryFor(r.ip))}
                >
                  <td>{r.name}</td>
                  <td style={{ fontFamily: "monospace" }}>
                    {r.latency === null
                      ? "--"
                      : r.latency >= UNREACHABLE_SENTINEL
                      ? <span style={{ color: "var(--danger)" }}>Unreachable</span>
                      : `${r.latency}ms`}
                  </td>
                  <td>
                    {selectedIp === r.ip && <span style={{ color: "var(--accent)" }}>Selected</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      <ExportButton data={exportData} filename="dns-benchmark" label="Export" />

      {error && (
        <p style={{ fontSize: 13, color: "var(--danger)", margin: 0, textAlign: "center" }}>
          {error}
        </p>
      )}

      {!applied && selectedIp && !isApplying && (
        <button className="btn-accent" onClick={onAuthorizeApply}>
          Apply DNS (requires admin)
        </button>
      )}
      {isApplying && (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          Waiting for authorization...
        </p>
      )}

      {applied && !isApplying && (
        <div className="dns-result-buttons">
          <button className="btn-outline" onClick={onAuthorizeRestore}>
            Restore Default DNS
          </button>
          <button className="btn-outline" onClick={onFlushCache} disabled={isFlushing}
            style={{ opacity: isFlushing ? 0.5 : 1 }}>
            {isFlushing ? "Flushing..." : "Flush DNS Cache"}
          </button>
        </div>
      )}

      <button className="dns-btn-text" onClick={onStartOver}>Start Over</button>
    </div>
  );
}

export default Step3_Results;
