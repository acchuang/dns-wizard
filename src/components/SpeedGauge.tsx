import { SpeedResult } from "../types";

interface Props {
  result: SpeedResult | null;
  status: "idle" | "running" | "done" | "error";
}

const gaugeContainer: React.CSSProperties = {
  width: 200,
  height: 200,
  borderRadius: "50%",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const gaugeInner: React.CSSProperties = {
  width: 160,
  height: 160,
  borderRadius: "50%",
  backgroundColor: "#1a1a2e",
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

function SpeedGauge({ result, status }: Props) {
  const maxMbps = 100;
  const ratio = result ? Math.min(result.downloadMbps / maxMbps, 1) : 0;
  const degrees = ratio * 270;

  const background =
    status === "running"
      ? "conic-gradient(#334155 0deg, #334155 270deg, transparent 270deg)"
      : `conic-gradient(#7c3aed 0deg, #7c3aed ${degrees}deg, #334155 ${degrees}deg, #334155 270deg, transparent 270deg)`;

  return (
    <div style={{ ...gaugeContainer, background }}>
      <div style={gaugeInner}>
        {status === "running" && (
          <span style={{ fontSize: 14, color: "#94a3b8" }}>Testing...</span>
        )}
        {status === "done" && result && (
          <>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#e2e8f0" }}>
              {result.downloadMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 14, color: "#64748b" }}>Mbps</span>
          </>
        )}
        {status === "idle" && (
          <span style={{ fontSize: 14, color: "#64748b" }}>Mbps</span>
        )}
        {status === "error" && (
          <span style={{ fontSize: 14, color: "#ef4444" }}>Error</span>
        )}
      </div>
    </div>
  );
}

export default SpeedGauge;