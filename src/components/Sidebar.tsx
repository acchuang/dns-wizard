import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Globe, Zap, Radio, SearchCheck, Heart, Info, Eye, EyeOff } from "lucide-react";
import { ActiveTool, PublicIpInfo } from "../types";
import { useSimpleMode } from "./SimpleModeContext";
import { useTheme } from "./ThemeContext";

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
}

const tools: { id: ActiveTool; icon: typeof Globe; label: string }[] = [
  { id: "dns", icon: Globe, label: "DNS" },
  { id: "speed", icon: Zap, label: "Speed" },
  { id: "ping", icon: Radio, label: "Ping" },
  { id: "leak", icon: SearchCheck, label: "Leak" },
  { id: "health", icon: Heart, label: "Health" },
];

function Sidebar({ activeTool, onToolChange }: Props) {
  const { simpleMode, toggleSimpleMode } = useSimpleMode();
  const { theme, setTheme } = useTheme();
  const [ipInfo, setIpInfo] = useState<PublicIpInfo | null>(null);

  useEffect(() => {
    invoke<PublicIpInfo>("get_public_ip")
      .then(setIpInfo)
      .catch(() => {});
    const interval = setInterval(() => {
      invoke<PublicIpInfo>("get_public_ip")
        .then(setIpInfo)
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sidebar">
      <div className="sidebar-logo">D</div>
      {ipInfo && (
        <div className="sidebar-ip" title={`IP: ${ipInfo.ip}\nISP: ${ipInfo.isp}\n${ipInfo.city}, ${ipInfo.country}`}>
          <div className="sidebar-ip-label">MY IP</div>
          <div className="sidebar-ip-value">{ipInfo.ip}</div>
        </div>
      )}
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            className={`sidebar-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={activeTool === tool.id}
          >
            <Icon size={20} />
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button
        className="sidebar-btn"
        style={{
          background: simpleMode ? 'var(--accent-muted)' : 'transparent',
          color: simpleMode ? 'var(--accent)' : 'var(--text-tertiary)',
        }}
        onClick={toggleSimpleMode}
        title={simpleMode ? "Show technical details" : "Hide technical details"}
        aria-label={simpleMode ? "Switch to detailed mode" : "Switch to simple mode"}
      >
        {simpleMode ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <div className="sidebar-theme-toggle">
        <button className={`sidebar-theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light mode">☀️</button>
        <button className={`sidebar-theme-btn ${theme === 'auto' ? 'active' : ''}`} onClick={() => setTheme('auto')} title="Auto mode">🔄</button>
        <button className={`sidebar-theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark mode">🌙</button>
      </div>
      <button
        className={`sidebar-btn ${activeTool === 'about' ? 'active' : ''}`}
        onClick={() => onToolChange("about")}
        title="About"
        aria-label="About"
        aria-pressed={activeTool === "about"}
      >
        <Info size={20} />
      </button>
    </div>
  );
}

export default Sidebar;
