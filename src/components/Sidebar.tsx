import { Globe, Zap, Radio, SearchCheck, Info } from "lucide-react";
import { ActiveTool } from "../types";

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
}

const tools: { id: ActiveTool; icon: typeof Globe; label: string }[] = [
  { id: "dns", icon: Globe, label: "DNS" },
  { id: "speed", icon: Zap, label: "Speed" },
  { id: "ping", icon: Radio, label: "Ping" },
  { id: "leak", icon: SearchCheck, label: "Leak" },
];

const sidebarStyle: React.CSSProperties = {
  width: 48,
  minHeight: "100%",
  backgroundColor: "#0f172a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 16,
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
  return (
    <div style={sidebarStyle}>
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