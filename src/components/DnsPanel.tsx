import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WizardState, Profile, DnsProvider, ConfigResult } from "../types";
import ProgressDots from "./ProgressDots";
import Step1_ChooseProfile from "./Step1_ChooseProfile";
import Step2_Benchmark from "./Step2_Benchmark";
import Step3_Results from "./Step3_Results";

const initialState: WizardState = {
  step: 1,
  selectedProfile: null,
  appliedProfile: null,
  benchmarkResults: [],
  isRunning: false,
  error: null,
  applied: false,
  selectedIp: null,
  selectedSecondaryIp: null,
  isApplying: false,
};

interface Props {
  onDnsApplied?: (primary: string | null, secondary: string | null) => void;
}

function DnsPanel({ onDnsApplied }: Props) {
  const [state, setState] = useState<WizardState>(initialState);
  const benchmarkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectProfile = useCallback((profile: Profile) => {
    setState((prev) => ({ ...prev, selectedProfile: profile, step: 2 }));
  }, []);

  const setRunning = useCallback((running: boolean) => {
    setState((prev) => ({ ...prev, isRunning: running }));
  }, []);

  const setBenchmarkResults = useCallback((results: DnsProvider[]) => {
    setState((prev) => ({
      ...prev,
      benchmarkResults: results,
      isRunning: false,
      step: 3,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, isRunning: false }));
  }, []);

  const runBenchmark = useCallback(async () => {
    if (!state.selectedProfile) return;
    setRunning(true);
    setError(null);

    if (benchmarkTimeoutRef.current) {
      clearTimeout(benchmarkTimeoutRef.current);
    }
    benchmarkTimeoutRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.isRunning) {
          return { ...prev, error: "Benchmark timed out. Please try again.", isRunning: false };
        }
        return prev;
      });
    }, 30000);

    try {
      console.log("[DNS Wizard] Starting benchmark for profile:", state.selectedProfile);
      const results = await invoke<DnsProvider[]>("run_benchmark", {
        profile: state.selectedProfile,
      });
      console.log("[DNS Wizard] Benchmark results:", results);
      if (benchmarkTimeoutRef.current) {
        clearTimeout(benchmarkTimeoutRef.current);
        benchmarkTimeoutRef.current = null;
      }
      setBenchmarkResults(results);
    } catch (e) {
      console.error("[DNS Wizard] Benchmark error:", e);
      if (benchmarkTimeoutRef.current) {
        clearTimeout(benchmarkTimeoutRef.current);
        benchmarkTimeoutRef.current = null;
      }
      setError(String(e));
    }
  }, [state.selectedProfile, setRunning, setError, setBenchmarkResults]);

  useEffect(() => {
    return () => {
      if (benchmarkTimeoutRef.current) {
        clearTimeout(benchmarkTimeoutRef.current);
      }
    };
  }, []);

  const selectResult = useCallback(
    (ip: string, secondaryIp: string) => {
      setState((prev) => ({ ...prev, selectedIp: ip, selectedSecondaryIp: secondaryIp }));
    },
    []
  );

  const authorizeApply = useCallback(async () => {
    if (!state.selectedIp || state.isApplying) return;
    setState((prev) => ({ ...prev, isApplying: true, error: null }));
    try {
      const result = await invoke<ConfigResult>("execute_admin_apply", {
        primary: state.selectedIp,
        secondary: state.selectedSecondaryIp ?? "",
      });
      if (result.success) {
        setState((prev) => ({
          ...prev,
          applied: true,
          appliedProfile: prev.selectedProfile,
          isApplying: false,
        }));
        onDnsApplied?.(state.selectedIp, state.selectedSecondaryIp);
      } else {
        setState((prev) => ({ ...prev, error: result.message, isApplying: false }));
      }
    } catch (e) {
      setState((prev) => ({ ...prev, error: String(e), isApplying: false }));
    }
  }, [state.selectedIp, state.selectedSecondaryIp, state.selectedProfile, state.isApplying]);

  const authorizeRestore = useCallback(async () => {
    if (state.isApplying) return;
    setState((prev) => ({ ...prev, isApplying: true, error: null }));
    try {
      const result = await invoke<ConfigResult>("execute_admin_restore");
      if (result.success) {
        setState((prev) => ({ ...prev, applied: false, isApplying: false }));
        onDnsApplied?.(null, null);
      } else {
        setState((prev) => ({ ...prev, error: result.message, isApplying: false }));
      }
    } catch (e) {
      setState((prev) => ({ ...prev, error: String(e), isApplying: false }));
    }
  }, [state.isApplying]);

  const startOver = useCallback(() => {
    setState((prev) => ({
      ...initialState,
      applied: prev.applied,
      appliedProfile: prev.appliedProfile,
    }));
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, overflow: "hidden" }}>
      <ProgressDots step={state.step} applied={state.applied} />
      <div style={{ width: "100%", flex: 1, display: "flex", overflow: "hidden" }}>
        {state.step === 1 && (
          <Step1_ChooseProfile
            onSelect={selectProfile}
            applied={state.applied}
            appliedProfile={state.appliedProfile}
          />
        )}
        {state.step === 2 && (
          <Step2_Benchmark
            profile={state.selectedProfile}
            isRunning={state.isRunning}
            error={state.error}
            onStart={runBenchmark}
          />
        )}
        {state.step === 3 && (
          <Step3_Results
            results={state.benchmarkResults}
            selectedIp={state.selectedIp}
            error={state.error}
            applied={state.applied}
            isApplying={state.isApplying}
            onSelect={selectResult}
            onAuthorizeApply={authorizeApply}
            onAuthorizeRestore={authorizeRestore}
            onStartOver={startOver}
          />
        )}
      </div>
    </div>
  );
}

export default DnsPanel;