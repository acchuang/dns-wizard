import { useState, useEffect } from "react";
import { ActiveTool, SpeedTestState, PingState, LeakTestState } from "./types";
import { SimpleModeProvider } from "./components/SimpleModeContext";
import OnboardingModal, { hasCompletedOnboarding } from "./components/OnboardingModal";
import Sidebar from "./components/Sidebar";
import DnsPanel from "./components/DnsPanel";
import SpeedPanel from "./components/SpeedPanel";
import PingPanel from "./components/PingPanel";
import LeakPanel from "./components/LeakPanel";
import HealthPanel from "./components/HealthPanel";
import AboutPanel from "./components/AboutPanel";

const initialSpeed: SpeedTestState = { status: "idle", result: null, error: null, currentMbps: 0, currentStage: null, stageResults: [], latencyResult: null, testPhase: "idle", pingProgress: 0 };
const initialPing: PingState = { host: "cloudflare.com", mode: "ping", isRunning: false, results: [], error: null };
const initialLeak: LeakTestState = { status: "idle", result: null, error: null };

const toolKeys: ActiveTool[] = ["dns", "speed", "ping", "leak", "health", "about"];

function AppInner() {
  const [showOnboarding, setShowOnboarding] = useState(!hasCompletedOnboarding());
  const [activeTool, setActiveTool] = useState<ActiveTool>(hasCompletedOnboarding() ? "health" : "dns");
  const [speedState, setSpeedState] = useState<SpeedTestState>(initialSpeed);
  const [pingState, setPingState] = useState<PingState>(initialPing);
  const [leakState, setLeakState] = useState<LeakTestState>(initialLeak);
  const [appliedDns, setAppliedDns] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const idx = e.key.charCodeAt(0) - "1".charCodeAt(0);
        if (idx >= 0 && idx < toolKeys.length) {
          e.preventDefault();
          setActiveTool(toolKeys[idx]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDnsApplied = (primary: string | null, secondary: string | null) => {
    if (primary) {
      setAppliedDns([primary, secondary ?? ""].filter(Boolean));
    } else {
      setAppliedDns([]);
    }
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#1a1a2e" }}>
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
      <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
      <div className="app-content">
        {activeTool === "dns" && <DnsPanel onDnsApplied={handleDnsApplied} />}
        {activeTool === "speed" && <SpeedPanel state={speedState} setState={setSpeedState} />}
        {activeTool === "ping" && <PingPanel state={pingState} setState={setPingState} />}
        {activeTool === "leak" && <LeakPanel state={leakState} setState={setLeakState} configuredDns={appliedDns} />}
        {activeTool === "health" && <HealthPanel onNavigate={(t) => setActiveTool(t as ActiveTool)} />}
        {activeTool === "about" && <AboutPanel />}
      </div>
    </div>
  );
}

function App() {
  return (
    <SimpleModeProvider>
      <AppInner />
    </SimpleModeProvider>
  );
}

export default App;