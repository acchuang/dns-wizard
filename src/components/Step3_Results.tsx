import { useMemo } from "react";
import { DnsProvider, UNREACHABLE_SENTINEL } from "../types";

interface Props {
  results: DnsProvider[];
  selectedIp: string | null;
  error: string | null;
  applied: boolean;
  onSelect: (ip: string, secondaryIp: string) => void;
  onApply: () => void;
  onRestore: () => void;
  onStartOver: () => void;
  onAuthorizeApply: () => void;
  onAuthorizeRestore: () => void;
}

const wrapperStyle: React.CSSProperties = {
  flex: "0 0 100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  paddingTop: 20,
  overflowY: "auto",
  maxHeight: "calc(100vh - 120px)",
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

const applyBtn: React.CSSProperties = {
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

const startOverBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "transparent",
  color: "#64748b",
  fontSize: 13,
};

const authBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "#ef4444",
  color: "#fff",
};

function Step3_Results({
  results,
  selectedIp,
  error,
  applied,
  onSelect,
  onApply,
  onRestore,
  onStartOver,
  onAuthorizeApply,
  onAuthorizeRestore,
}: Props) {
  const reachable = useMemo(
    () => results.filter((r) => r.latency !== null && r.latency < UNREACHABLE_SENTINEL),
    [results]
  );

  const allUnreachable = results.length > 0 && reachable.length === 0;

  const secondaryFor = (ip: string) => {
    const others = reachable.filter((r) => r.ip !== ip);
    return others.length > 0 ? others[0].ip : "";
  };

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
        <table style={{ width: "100%", maxWidth: 440, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              <th style={thStyle}>Provider</th>
              <th style={thStyle}>Latency</th>
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
      )}

      {error && (
        <p style={{ fontSize: 13, color: "#ef4444", margin: 0, textAlign: "center" }}>
          {error}
        </p>
      )}

      {error && error.includes("Admin privileges") && (
        <div style={{ display: "flex", gap: 8 }}>
          {!applied && error.includes("update") && (
            <button style={authBtn} onClick={onAuthorizeApply}>
              Authorize Apply
            </button>
          )}
          {applied && error.includes("restore") && (
            <button style={authBtn} onClick={onAuthorizeRestore}>
              Authorize Restore
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {!applied && (
          <button
            style={{
              ...applyBtn,
              opacity: selectedIp ? 1 : 0.4,
              cursor: selectedIp ? "pointer" : "not-allowed",
            }}
            disabled={!selectedIp}
            onClick={onApply}
          >
            Apply DNS
          </button>
        )}
        {applied && (
          <button style={restoreBtn} onClick={onRestore}>
            Restore Default DNS
          </button>
        )}
      </div>

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
