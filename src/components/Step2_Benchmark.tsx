import { useEffect, useRef } from "react";
import { Profile } from "../types";

interface Props {
  profile: Profile | null;
  isRunning: boolean;
  error: string | null;
  onStart: () => void;
}

const wrapperStyle: React.CSSProperties = {
  flex: "0 0 33.333%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  paddingTop: 20,
};

const spinnerStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  border: "4px solid #334155",
  borderTop: "4px solid #7c3aed",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const retryBtn: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 8,
  border: "1px solid #334155",
  backgroundColor: "transparent",
  color: "#94a3b8",
  fontSize: 13,
  cursor: "pointer",
};

function Step2_Benchmark({ profile, isRunning, error, onStart }: Props) {
  const hasStarted = useRef(false);

  useEffect(() => {
    hasStarted.current = false;
  }, [profile]);

  useEffect(() => {
    if (!isRunning && !hasStarted.current) {
      hasStarted.current = true;
      onStart();
    }
  }, [profile, isRunning, onStart]);

  return (
    <div style={wrapperStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Benchmarking</h1>
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, textAlign: "center" }}>
        Testing DNS servers for the {profile} profile...
      </p>
      {isRunning && <div style={spinnerStyle} />}
      {isRunning && (
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          This may take a few seconds
        </p>
      )}
      {error && !isRunning && (
        <>
          <p style={{ fontSize: 13, color: "#ef4444", margin: 0, textAlign: "center" }}>
            {error}
          </p>
          <button style={retryBtn} onClick={() => { hasStarted.current = false; onStart(); }}>
            Retry
          </button>
        </>
      )}
    </div>
  );
}

export default Step2_Benchmark;