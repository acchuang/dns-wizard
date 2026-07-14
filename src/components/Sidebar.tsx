import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Eye, EyeOff, Info } from "lucide-react";
import { ActiveTool, PublicIpInfo } from "../types";
import { toolMeta } from "../toolMeta";
import { useSimpleMode } from "./SimpleModeContext";
import { useTheme } from "./ThemeContext";

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
}

const sections: { label: string; ids: ActiveTool[] }[] = [
  { label: "Overview", ids: ["health"] },
  { label: "Tools", ids: ["dns", "speed", "ping", "leak", "ports"] },
  { label: "Network", ids: ["info"] },
];

function ToolRow({ id, active, onSelect }: { id: ActiveTool; active: boolean; onSelect: () => void }) {
  const meta = toolMeta[id];
  const Icon = meta.icon;
  return (
    <button
      className={`sidebar-btn ${active ? "active" : ""}`}
      onClick={onSelect}
      title={`${meta.label} (⌘${meta.shortcut})`}
      aria-label={meta.label}
      aria-pressed={active}
    >
      <span className="sidebar-icon-tile" style={{ background: meta.tint }}>
        <Icon size={15} />
      </span>
      <span className="sidebar-btn-label">{meta.label}</span>
    </button>
  );
}

function Sidebar({ activeTool, onToolChange }: Props) {
  const { simpleMode, toggleSimpleMode } = useSimpleMode();
  const { theme, setTheme } = useTheme();
  const [ipInfo, setIpInfo] = useState<PublicIpInfo | null>(null);

  useEffect(() => {
    const fetchIp = () => {
      invoke<PublicIpInfo>("get_public_ip")
        .then(setIpInfo)
        .catch(() => {});
    };
    fetchIp();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchIp();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">D</div>
        <span>DNS Wizard</span>
      </div>
      {sections.map((section) => (
        <div key={section.label}>
          <div className="sidebar-section-label">{section.label}</div>
          {section.ids.map((id) => (
            <ToolRow key={id} id={id} active={activeTool === id} onSelect={() => onToolChange(id)} />
          ))}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      {ipInfo && (
        <div className="sidebar-ip" title={`IP: ${ipInfo.ip}\nISP: ${ipInfo.isp}\n${ipInfo.city}, ${ipInfo.country}`}>
          <div className="sidebar-ip-label">MY IP</div>
          <div className="sidebar-ip-value">{ipInfo.ip}</div>
        </div>
      )}
      <button
        className="sidebar-btn"
        onClick={toggleSimpleMode}
        title={simpleMode ? "Show technical details" : "Hide technical details"}
        aria-label={simpleMode ? "Switch to detailed mode" : "Switch to simple mode"}
      >
        <span
          className="sidebar-icon-tile"
          style={{ background: simpleMode ? "linear-gradient(135deg, #60a5fa, #3b82f6)" : "linear-gradient(135deg, #94a3b8, #64748b)" }}
        >
          {simpleMode ? <EyeOff size={15} /> : <Eye size={15} />}
        </span>
        <span className="sidebar-btn-label">Simple Mode</span>
      </button>
      <button
        className={`sidebar-btn ${activeTool === "about" ? "active" : ""}`}
        onClick={() => onToolChange("about")}
        title="About (⌘8)"
        aria-label="About"
        aria-pressed={activeTool === "about"}
      >
        <span className="sidebar-icon-tile" style={{ background: toolMeta.about.tint }}>
          <Info size={15} />
        </span>
        <span className="sidebar-btn-label">About</span>
      </button>
      <div className="sidebar-theme-toggle">
        <button className={`sidebar-theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light mode">☀️</button>
        <button className={`sidebar-theme-btn ${theme === 'auto' ? 'active' : ''}`} onClick={() => setTheme('auto')} title="Auto mode">🔄</button>
        <button className={`sidebar-theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark mode">🌙</button>
      </div>
    </div>
  );
}

export default Sidebar;
