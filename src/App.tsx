import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WizardState, Profile, DnsProvider, ConfigResult } from "./types";
import ProgressDots from "./components/ProgressDots";
import Step1_ChooseProfile from "./components/Step1_ChooseProfile";
import Step2_Benchmark from "./components/Step2_Benchmark";
import Step3_Results from "./components/Step3_Results";

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

function App() {
  const [state, setState] = useState<WizardState>(initialState);

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
    try {
      const results = await invoke<DnsProvider[]>("run_benchmark", {
        profile: state.selectedProfile,
      });
      setBenchmarkResults(results);
    } catch (e) {
      setError(String(e));
    }
  }, [state.selectedProfile, setRunning, setError, setBenchmarkResults]);

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
    <>
      <ProgressDots step={state.step} applied={state.applied} />
      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            width: `${3 * 100}%`,
            transform: `translateX(-${(state.step - 1) * (100 / 3)}%)`,
            transition: "transform 0.3s ease",
          }}
        >
          <Step1_ChooseProfile
            onSelect={selectProfile}
            applied={state.applied}
            appliedProfile={state.appliedProfile}
          />
          <Step2_Benchmark
            profile={state.selectedProfile}
            isRunning={state.isRunning}
            error={state.error}
            onStart={runBenchmark}
          />
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
        </div>
      </div>
    </>
  );
}

export default App;