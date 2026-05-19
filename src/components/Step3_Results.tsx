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

const wrapperStyle: React.CSSProperties = {
  flex: "0 0 100%",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  overflowY: "auto",
};

const btnBase: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.2s",
};

const authBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "#7c3aed",
  color: "#fff",
};

const restoreBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
};

const flushBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "transparent",
  color: "#64748b",
  border: "1px solid #334155",
  fontSize: 13,
  padding: "8px 16px",
};

const startOverBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "transparent",
  color: "#64748b",
  fontSize: 13,
};

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

  return (
    <div style={wrapperStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
        {applied ? "DNS Active" : "Benchmark Results"}
      </h1>

      {allUnreachable && (
        <p style={{ fontSize: 14, color: "#ef4444", margin: 0, textAlign: "center" }}>
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
                  backgroundColor: selectedIp === r.ip ? "rgba(124, 58, 237, 0.15)" : "#16213e",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 14, color: "#e2e8f0" }}>{r.name}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: r.latency! < 20 ? "#22c55e" : r.latency! < 50 ? "#eab308" : "#ef4444" }}>
                  {r.latency}ms
                </span>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: "100%", maxWidth: 440, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={thStyle}>Provider</th>
                <th style={thStyle}>
                  <Tooltip text="How long it takes for the DNS server to respond. Lower is better.">
                    Latency
                  </Tooltip>
                </th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.ip}
                  style={{
                    borderBottom: "1px solid #1e293b",
                    backgroundColor:
                      selectedIp === r.ip ? "rgba(124, 58, 237, 0.15)" : "transparent",
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                  }}
                  onClick={() => onSelect(r.ip, secondaryFor(r.ip))}
                >
                  <td style={tdStyle}>{r.name}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                    {r.latency === null
                      ? "--"
                      : r.latency >= UNREACHABLE_SENTINEL
                      ? <span style={{ color: "#ef4444" }}>Unreachable</span>
                      : `${r.latency}ms`}
                  </td>
                  <td style={tdStyle}>
                    {selectedIp === r.ip && <span style={{ color: "#7c3aed" }}>Selected</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      <ExportButton data={exportData} filename="dns-benchmark" label="Export" />

      {error && (
        <p style={{ fontSize: 13, color: "#ef4444", margin: 0, textAlign: "center" }}>
          {error}
        </p>
      )}

      {!applied && selectedIp && !isApplying && (
        <button style={authBtn} onClick={onAuthorizeApply}>
          Apply DNS (requires admin)
        </button>
      )}
      {isApplying && (
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          Waiting for authorization...
        </p>
      )}

      {applied && !isApplying && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button style={restoreBtn} onClick={onAuthorizeRestore}>
            Restore Default DNS
          </button>
          <button style={flushBtn} onClick={onFlushCache} disabled={isFlushing}>
            {isFlushing ? "Flushing..." : "Flush DNS Cache"}
          </button>
        </div>
      )}

      <button style={startOverBtn} onClick={onStartOver}>
        Start Over
      </button>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
};

export default Step3_Results;