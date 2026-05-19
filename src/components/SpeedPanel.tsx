import { invoke } from "@tauri-apps/api/core";
import { SpeedTestState, SpeedResult } from "../types";
import SpeedGauge from "./SpeedGauge";

interface Props {
  state: SpeedTestState;
  setState: React.Dispatch<React.SetStateAction<SpeedTestState>>;
}

const btnBase: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

function SpeedPanel({ state, setState }: Props) {
  const runTest = async () => {
    setState({ status: "running", result: null, error: null });
    try {
      const result = await invoke<SpeedResult>("run_speed_test");
      setState({ status: "done", result, error: null });
    } catch (e) {
      setState({ status: "error", result: null, error: String(e) });
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
        Speed Test
      </h2>
      <SpeedGauge result={state.result} status={state.status} />
      {state.status === "done" && state.result && (
        <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
          <div>{state.result.bytesReceived.toLocaleString()} bytes received</div>
          <div>{state.result.elapsedMs} ms elapsed</div>
        </div>
      )}
      {state.error && (
        <p style={{ color: "#ef4444", fontSize: 13, margin: 0, textAlign: "center" }}>
          {state.error}
        </p>
      )}
      <button
        style={{
          ...btnBase,
          backgroundColor: state.status === "running" ? "#334155" : "#7c3aed",
          color: state.status === "running" ? "#64748b" : "#fff",
          cursor: state.status === "running" ? "not-allowed" : "pointer",
        }}
        disabled={state.status === "running"}
        onClick={runTest}
      >
        {state.status === "running"
          ? "Testing..."
          : state.status === "done"
            ? "Test Again"
            : "Start Test"}
      </button>
    </div>
  );
}

export default SpeedPanel;