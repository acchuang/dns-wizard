import { Globe, Zap, Radio, SearchCheck, Heart, Info, Shield, Globe2 } from "lucide-react";
import { ActiveTool } from "./types";

// Single source for each tool's icon, label, tint, and ⌘-shortcut (order fixed by toolKeys in App.tsx)
export const toolMeta: Record<ActiveTool, { icon: typeof Globe; label: string; shortcut: number; tint: string }> = {
  dns: { icon: Globe, label: "DNS", shortcut: 1, tint: "linear-gradient(135deg, #60a5fa, #3b82f6)" },
  speed: { icon: Zap, label: "Speed", shortcut: 2, tint: "linear-gradient(135deg, #fbbf24, #f59e0b)" },
  ping: { icon: Radio, label: "Ping", shortcut: 3, tint: "linear-gradient(135deg, #22d3ee, #06b6d4)" },
  leak: { icon: SearchCheck, label: "Leak Test", shortcut: 4, tint: "linear-gradient(135deg, #a78bfa, #8b5cf6)" },
  health: { icon: Heart, label: "Health", shortcut: 5, tint: "linear-gradient(135deg, #fb7185, #f43f5e)" },
  ports: { icon: Shield, label: "Ports", shortcut: 6, tint: "linear-gradient(135deg, #34d399, #10b981)" },
  info: { icon: Globe2, label: "Info", shortcut: 7, tint: "linear-gradient(135deg, #38bdf8, #0ea5e9)" },
  about: { icon: Info, label: "About", shortcut: 8, tint: "linear-gradient(135deg, #a5b4fc, #818cf8)" },
};
