import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WizardState, Profile, DnsProvider, ConfigResult, NetworkInfo, QuickFixResult } from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import ProgressDots from "./ProgressDots";
import Step1_ChooseProfile from "./Step1_ChooseProfile";
import Step2_Benchmark from "./Step2_Benchmark";
import Step3_Results from "./Step3_Results";
import Tooltip from "./Tooltip";

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
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [quickFix, setQuickFix] = useState<QuickFixResult | null>(null);
  const [quickFixRunning, setQuickFixRunning] = useState(false);
  const [quickFixApplying, setQuickFixApplying] = useState(false);
  const [quickFixApplied, setQuickFixApplied] = useState(false);
  const [quickFixError, setQuickFixError] = useState<string | null>(null);
  const benchmarkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { simpleMode } = useSimpleMode();

  const refreshNetworkInfo = useCallback(() => {
    invoke<NetworkInfo>("get_current_dns")
      .then(setNetworkInfo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshNetworkInfo();
    return () => {
      if (benchmarkTimeoutRef.current) {
        clearTimeout(benchmarkTimeoutRef.current);
      }
    };
  }, []);

  const handleFlushCache = useCallback(async () => {
    if (isFlushing) return;
    setIsFlushing(true);
    try {
      await invoke<ConfigResult>("flush_dns_cache");
      refreshNetworkInfo();
    } catch {} finally {
      setIsFlushing(false);
    }
  }, [isFlushing, refreshNetworkInfo]);

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
      const results = await invoke<DnsProvider[]>("run_benchmark", {
        profile: state.selectedProfile,
      });
      if (benchmarkTimeoutRef.current) {
        clearTimeout(benchmarkTimeoutRef.current);
        benchmarkTimeoutRef.current = null;
      }
      setBenchmarkResults(results);
    } catch (e) {
      if (benchmarkTimeoutRef.current) {
        clearTimeout(benchmarkTimeoutRef.current);
        benchmarkTimeoutRef.current = null;
      }
      setError(String(e));
    }
  }, [state.selectedProfile, setRunning, setError, setBenchmarkResults]);

  const handleQuickFix = useCallback(async () => {
    setQuickFixRunning(true);
    setQuickFixError(null);
    try {
      const result = await invoke<QuickFixResult>("fix_my_internet");
      setQuickFix(result);
    } catch (e) {
      setQuickFixError(String(e));
    } finally {
      setQuickFixRunning(false);
    }
  }, []);

  const handleQuickFixApply = useCallback(async () => {
    if (!quickFix || quickFixApplying) return;
    setQuickFixApplying(true);
    try {
      const result = await invoke<ConfigResult>("execute_admin_apply", {
        primary: quickFix.providerIp,
        secondary: "",
      });
      if (result.success) {
        setQuickFixApplied(true);
        onDnsApplied?.(quickFix.providerIp, null);
        refreshNetworkInfo();
      } else {
        setQuickFixError(result.message);
      }
    } catch (e) {
      setQuickFixError(String(e));
    } finally {
      setQuickFixApplying(false);
    }
  }, [quickFix, quickFixApplying]);

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
        refreshNetworkInfo();
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
        refreshNetworkInfo();
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
      <div style={{ marginBottom: 16, padding: 16, backgroundColor: "#16213e", borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#e2e8f0" }}>
          <Tooltip text="Benchmarks all DNS providers and applies the fastest one automatically — no need to pick a profile.">
            Quick Fix
          </Tooltip>
        </h3>
        {simpleMode ? (
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>One click to optimize your DNS for speed.</p>
        ) : (
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Benchmarks all providers and applies the fastest one.</p>
        )}
        <button
          onClick={handleQuickFix}
          disabled={quickFixRunning || quickFixApplying}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: quickFixRunning || quickFixApplying ? "not-allowed" : "pointer",
            backgroundColor: "#7c3aed",
            color: "#fff",
            opacity: quickFixRunning || quickFixApplying ? 0.6 : 1,
          }}
        >
          {quickFixRunning ? "Testing..." : "Fix My Internet"}
        </button>
        {quickFixError && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{quickFixError}</p>}
        {quickFix && !quickFixRunning && !quickFixError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            <p style={{ fontSize: 14, color: "#10b981", margin: 0, fontWeight: 600 }}>
              Fastest: {quickFix.providerName} ({quickFix.providerIp}) — {quickFix.latencyMs}ms
            </p>
            {!quickFixApplied && (
              <button
                onClick={handleQuickFixApply}
                disabled={quickFixApplying}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #334155", backgroundColor: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", width: "fit-content" }}
              >
                {quickFixApplying ? "Authorizing..." : `Apply ${quickFix.providerName}`}
              </button>
            )}
            {quickFixApplied && <p style={{ fontSize: 13, color: "#10b981", margin: 0 }}>DNS applied successfully!</p>}
          </div>
        )}
      </div>
      <ProgressDots step={state.step} applied={state.applied} />
      <div style={{ width: "100%", flex: 1, display: "flex", overflow: "hidden" }}>
        {state.step === 1 && (
          <Step1_ChooseProfile
            onSelect={selectProfile}
            applied={state.applied}
            appliedProfile={state.appliedProfile}
            networkInfo={networkInfo}
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
            isFlushing={isFlushing}
            onSelect={selectResult}
            onAuthorizeApply={authorizeApply}
            onAuthorizeRestore={authorizeRestore}
            onFlushCache={handleFlushCache}
            onStartOver={startOver}
          />
        )}
      </div>
    </div>
  );
}

export default DnsPanel;