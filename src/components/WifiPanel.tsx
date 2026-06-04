import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WifiScanState, WifiNetwork } from "../types";
import { useToast } from "./ToastProvider";
import EmptyState from "./EmptyState";
import ExportButton from "./ExportButton";

const initialState: WifiScanState = {
  isRunning: false,
  networks: [],
  error: null,
};

function signalIcon(rssi: number): string {
  if (rssi >= -50) return "📶";
  if (rssi >= -60) return "📶";
  if (rssi >= -70) return "📱";
  return "📉";
}

function rssiClass(rssi: number): string {
  if (rssi >= -50) return "rssi-excellent";
  if (rssi >= -60) return "rssi-good";
  if (rssi >= -70) return "rssi-fair";
  return "rssi-weak";
}

function WifiPanel() {
  const [state, setState] = useState<WifiScanState>(initialState);
  const { addToast } = useToast();
  const mountedRef = useRef(true);

  const runScan = async () => {
    if (state.isRunning) return;
    setState((prev) => ({ ...prev, isRunning: true, networks: [], error: null }));

    try {
      const networks = await invoke<WifiNetwork[]>("run_wifi_scan");
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isRunning: false, networks }));
        addToast("info", `Found ${networks.length} network${networks.length !== 1 ? "s" : ""}`);
      }
    } catch (e) {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isRunning: false, error: String(e) }));
      }
    }
  };

  const exportData = state.networks.map((n) => ({
    SSID: n.ssid,
    BSSID: n.bssid,
    RSSI: n.rssi,
    Channel: n.channel,
    Band: n.band,
    Security: n.security,
    Current: n.isCurrent ? "Yes" : "No",
  }));

  return (
    <div className="wifi-panel">
      <h2>Wi-Fi Scanner</h2>

      <button className="btn-accent wifi-scan-btn" onClick={runScan} disabled={state.isRunning}>
        {state.isRunning ? "Scanning..." : "Scan Networks"}
      </button>

      {state.error && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{state.error}</p>
      )}

      {state.networks.length > 0 && (
        <>
          <div className="wifi-summary-tiles">
            <div className="wifi-summary-tile">
              <div className="wifi-summary-value">{state.networks.length}</div>
              <div className="wifi-summary-label">Networks</div>
            </div>
            <div className="wifi-summary-tile">
              <div className="wifi-summary-value" style={{ color: "var(--success)" }}>
                {state.networks.filter((n) => n.rssi >= -50).length}
              </div>
              <div className="wifi-summary-label">Strong</div>
            </div>
            <div className="wifi-summary-tile">
              <div className="wifi-summary-value" style={{ color: "var(--accent)" }}>
                {state.networks.filter((n) => n.isCurrent).length || "—"}
              </div>
              <div className="wifi-summary-label">Current</div>
            </div>
          </div>

          <div className="wifi-network-list">
            {state.networks.map((network, i) => (
              <div key={i} className={`wifi-network-row${network.isCurrent ? " current" : ""}`}>
                <span className="wifi-signal">{signalIcon(network.rssi)}</span>
                <div className="wifi-info">
                  <span className="wifi-ssid">
                    {network.ssid || "(Hidden)"}
                    {network.isCurrent && " ✓"}
                  </span>
                  <span className="wifi-detail">{network.bssid} · {network.band} · Ch {network.channel}</span>
                </div>
                <span className="wifi-security">{network.security || "Open"}</span>
                <span className={`wifi-rssi ${rssiClass(network.rssi)}`}>{network.rssi} dBm</span>
              </div>
            ))}
          </div>

          {exportData.length > 0 && <ExportButton data={exportData} filename="wifi-scan" />}
        </>
      )}

      {!state.isRunning && state.networks.length === 0 && !state.error && (
        <EmptyState icon="📡" title="Scan Wi-Fi" description="Discover nearby Wi-Fi networks and their signal strength" />
      )}
    </div>
  );
}

export default WifiPanel;