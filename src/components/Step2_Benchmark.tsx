import { useEffect, useRef } from "react";
import { Profile } from "../types";
import Tooltip from "./Tooltip";

interface Props {
  profile: Profile | null;
  isRunning: boolean;
  error: string | null;
  onStart: () => void;
}

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
    <div className="dns-step-wrapper">
      <h1 className="dns-step-title">
        <Tooltip text="Benchmarking sends DNS queries to each provider and measures how long they take to respond.">
          Benchmarking
        </Tooltip>
      </h1>
      <p className="dns-step-desc">Testing DNS servers for the {profile} profile...</p>
      {isRunning && <div className="dns-benchmark-spinner" />}
      {isRunning && (
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          This may take a few seconds
        </p>
      )}
      {error && !isRunning && (
        <>
          <p style={{ fontSize: 13, color: "var(--danger)", margin: 0, textAlign: "center" }}>
            {error}
          </p>
          <button className="btn-outline" onClick={() => { hasStarted.current = false; onStart(); }}>
            Retry
          </button>
        </>
      )}
    </div>
  );
}

export default Step2_Benchmark;
