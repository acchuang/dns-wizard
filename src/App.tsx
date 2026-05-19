import { useState } from "react";
import { ActiveTool, SpeedTestState, PingState, LeakTestState } from "./types";
import Sidebar from "./components/Sidebar";
import DnsPanel from "./components/DnsPanel";
import SpeedPanel from "./components/SpeedPanel";
import PingPanel from "./components/PingPanel";
import LeakPanel from "./components/LeakPanel";

const initialSpeed: SpeedTestState = { status: "idle", result: null, error: null };
const initialPing: PingState = { host: "cloudflare.com", mode: "ping", isRunning: false, results: [], error: null };
const initialLeak: LeakTestState = { status: "idle", result: null, error: null };

function App() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("dns");
  const [speedState, setSpeedState] = useState<SpeedTestState>(initialSpeed);
  const [pingState, setPingState] = useState<PingState>(initialPing);
  const [leakState, setLeakState] = useState<LeakTestState>(initialLeak);
  const [appliedDns, setAppliedDns] = useState<string[]>([]);

  const handleDnsApplied = (primary: string | null, secondary: string | null) => {
    if (primary) {
      setAppliedDns([primary, secondary ?? ""].filter(Boolean));
    } else {
      setAppliedDns([]);
    }
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#1a1a2e" }}>
      <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
      <div className="app-content">
        {activeTool === "dns" && <DnsPanel onDnsApplied={handleDnsApplied} />}
        {activeTool === "speed" && <SpeedPanel state={speedState} setState={setSpeedState} />}
        {activeTool === "ping" && <PingPanel state={pingState} setState={setPingState} />}
        {activeTool === "leak" && <LeakPanel state={leakState} setState={setLeakState} configuredDns={appliedDns} />}
      </div>
    </div>
  );
}

export default App;