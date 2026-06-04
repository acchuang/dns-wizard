import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { NetworkInfoResult } from "../types";
import EmptyState from "./EmptyState";

function NetworkInfoPanel() {
  const [info, setInfo] = useState<NetworkInfoResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadInfo();
    return () => { mountedRef.current = false; };
  }, []);

  const loadInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<NetworkInfoResult>("run_network_info");
      if (mountedRef.current) {
        setInfo(result);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(String(e));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const CopyBtn = ({ value, label }: { value: string; label: string }) => (
    <button className="network-copy-btn" onClick={() => copyToClipboard(value, label)}>
      {copied === label ? "✓" : "⧉"}
    </button>
  );

  if (loading) {
    return (
      <div className="network-panel">
        <h2>Network Info</h2>
        <div className="network-loading">Loading network details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="network-panel">
        <h2>Network Info</h2>
        <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>
        <button className="btn-outline" onClick={loadInfo}>Retry</button>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="network-panel">
        <h2>Network Info</h2>
        <EmptyState icon="ℹ️" title="Network Info" description="Click to load your network details" />
        <button className="btn-accent" onClick={loadInfo}>Load Info</button>
      </div>
    );
  }

  return (
    <div className="network-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Network Info</h2>
        <button className="btn-outline" onClick={loadInfo} style={{ fontSize: 11, padding: "4px 12px" }}>Refresh</button>
      </div>

      <div className="network-section">
        <h3 className="network-section-title">External</h3>
        <div className="network-row">
          <span className="network-row-label">Public IP</span>
          <span className="network-row-value">{info.publicIp || "—"} <CopyBtn value={info.publicIp} label="publicIp" /></span>
        </div>
        <div className="network-row">
          <span className="network-row-label">ISP</span>
          <span className="network-row-value">{info.isp || "—"}</span>
        </div>
        <div className="network-row">
          <span className="network-row-label">Location</span>
          <span className="network-row-value">{[info.city, info.country].filter(Boolean).join(", ") || "—"}</span>
        </div>
      </div>

      <div className="network-section">
        <h3 className="network-section-title">Interface</h3>
        <div className="network-row">
          <span className="network-row-label">Interface</span>
          <span className="network-row-value">{info.interfaceName}</span>
        </div>
        <div className="network-row">
          <span className="network-row-label">Connection</span>
          <span className="network-row-value">{info.connectionType}</span>
        </div>
        <div className="network-row">
          <span className="network-row-label">MAC Address</span>
          <span className="network-row-value">{info.macAddress || "—"} <CopyBtn value={info.macAddress} label="mac" /></span>
        </div>
        <div className="network-row">
          <span className="network-row-label">Local IP</span>
          <span className="network-row-value">{info.localIp || "—"} <CopyBtn value={info.localIp} label="localIp" /></span>
        </div>
        <div className="network-row">
          <span className="network-row-label">Gateway</span>
          <span className="network-row-value">{info.gateway || "—"} <CopyBtn value={info.gateway} label="gateway" /></span>
        </div>
      </div>

      <div className="network-section">
        <h3 className="network-section-title">DNS</h3>
        <div className="network-dns-list">
          {info.dnsServers.length > 0 ? info.dnsServers.map((server, i) => (
            <div key={i} className="network-dns-entry">
              <span className="network-dns-server">{server}</span>
              <CopyBtn value={server} label={`dns-${i}`} />
            </div>
          )) : (
            <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>No DNS servers configured</span>
          )}
        </div>
        <div className="network-row">
          <span className="network-row-label">DHCP Mode</span>
          <span className="network-row-value">{info.dhcpMode}</span>
        </div>
      </div>
    </div>
  );
}

export default NetworkInfoPanel;