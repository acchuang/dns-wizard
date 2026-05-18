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

  const applyDns = useCallback(async () => {
    if (!state.selectedIp) return;
    setError(null);
    try {
      const result = await invoke<ConfigResult>("apply_dns", {
        primary: state.selectedIp,
        secondary: state.selectedSecondaryIp ?? "",
      });
      if (result.success) {
        setState((prev) => ({
          ...prev,
          applied: true,
          appliedProfile: prev.selectedProfile,
        }));
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [state.selectedIp, state.selectedSecondaryIp, state.selectedProfile]);

  const restoreDns = useCallback(async () => {
    setError(null);
    try {
      const result = await invoke<ConfigResult>("restore_dns");
      if (result.success) {
        setState((prev) => ({ ...prev, applied: false }));
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const startOver = useCallback(() => {
    setState((prev) => ({
      ...initialState,
      applied: prev.applied,
      appliedProfile: prev.appliedProfile,
    }));
  }, []);

  const authorizeApply = useCallback(async () => {
    if (!state.selectedIp) return;
    setError(null);
    try {
      await invoke("execute_admin_apply", {
        primary: state.selectedIp,
        secondary: state.selectedSecondaryIp ?? "",
      });
      setState((prev) => ({
        ...prev,
        applied: true,
        error: null,
        appliedProfile: prev.selectedProfile,
      }));
    } catch (e) {
      setError(String(e));
    }
  }, [state.selectedIp, state.selectedSecondaryIp, state.selectedProfile]);

  const authorizeRestore = useCallback(async () => {
    setError(null);
    try {
      await invoke("execute_admin_restore");
      setState((prev) => ({ ...prev, applied: false, error: null }));
    } catch (e) {
      setError(String(e));
    }
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
            onSelect={selectResult}
            onApply={applyDns}
            onRestore={restoreDns}
            onStartOver={startOver}
            onAuthorizeApply={authorizeApply}
            onAuthorizeRestore={authorizeRestore}
          />
        </div>
      </div>
    </>
  );
}

export default App;
