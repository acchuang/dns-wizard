import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Globe, Zap, Radio, SearchCheck, Heart, Info, Eye, EyeOff } from "lucide-react";
import { ActiveTool, PublicIpInfo } from "../types";
import { useSimpleMode } from "./SimpleModeContext";

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

const sidebarStyle: React.CSSProperties = {
  width: 56,
  minHeight: "100%",
  backgroundColor: "#0f172a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 8,
  gap: 4,
  borderRight: "1px solid #1e293b",
  boxSizing: "border-box",
  overflow: "hidden",
};

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: 36,
  height: 36,
  borderRadius: 8,
  border: "none",
  outline: "none",
  margin: "0 0 0 6px",
  backgroundColor: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "#64748b",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 0.2s",
});

function Sidebar({ activeTool, onToolChange }: Props) {
  const { simpleMode, toggleSimpleMode } = useSimpleMode();
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
    <div style={sidebarStyle}>
      {ipInfo && (
        <div
          style={{
            width: 48,
            padding: "6px 2px",
            textAlign: "center" as const,
            fontSize: 8,
            color: "#475569",
            lineHeight: 1.3,
            marginBottom: 4,
            borderBottom: "1px solid #1e293b",
            paddingBottom: 6,
            wordBreak: "break-all" as const,
            overflowWrap: "break-word" as const,
          }}
          title={`IP: ${ipInfo.ip}\nISP: ${ipInfo.isp}\n${ipInfo.city}, ${ipInfo.country}`}
        >
          <div style={{ fontSize: 7, color: "#64748b", marginBottom: 2, letterSpacing: 0.5 }}>MY IP</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8" }}>{ipInfo.ip}</div>
        </div>
      )}
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            style={btnStyle(activeTool === tool.id)}
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
        style={{
          ...btnStyle(false),
          backgroundColor: simpleMode ? "#7c3aed33" : "transparent",
          color: simpleMode ? "#a78bfa" : "#475569",
        }}
        onClick={toggleSimpleMode}
        title={simpleMode ? "Show technical details" : "Hide technical details"}
        aria-label={simpleMode ? "Switch to detailed mode" : "Switch to simple mode"}
      >
        {simpleMode ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <button
        style={btnStyle(activeTool === "about")}
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