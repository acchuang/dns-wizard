export interface DnsProvider {
  name: string;
  ip: string;
  latency: number | null;
}

export interface ConfigResult {
  success: boolean;
  message: string;
}

// --- Expanded profiles ---
export type Profile =
  | "Gamer"
  | "Privacy"
  | "Family"
  | "AdBlock"
  | "Balanced"
  | "ControlD"
  | "OpenDNS"
  | "Comodo";

export interface ProfileDef {
  id: Profile;
  label: string;
  description: string;
  icon: "zap" | "shield" | "users" | "ban" | "scale" | "filter" | "lock" | "shieldCheck";
}

// --- Navigation ---
export type ActiveTool = "dns" | "speed" | "ping" | "leak" | "about";

// --- Speed Test ---
export interface SpeedResult {
  downloadMbps: number;
  bytesReceived: number;
  elapsedMs: number;
}

export interface SpeedTestState {
  status: "idle" | "running" | "done" | "error";
  result: SpeedResult | null;
  error: string | null;
}

// --- Ping / Traceroute ---
export interface PingResult {
  seq: number;
  latencyMs: number | null;
  success: boolean;
}

export interface HopResult {
  hop: number;
  host: string;
  latencyMs: number | null;
  success: boolean;
}

export interface PingState {
  host: string;
  mode: "ping" | "traceroute";
  isRunning: boolean;
  results: PingResult[] | HopResult[];
  error: string | null;
}

// --- DNS Leak Test ---
export interface LeakResult {
  configuredServers: string[];
  detectedServers: string[];
  isLeaking: boolean | null;
}

export interface LeakTestState {
  status: "idle" | "running" | "done" | "error";
  result: LeakResult | null;
  error: string | null;
}

export interface WizardState {
  step: 1 | 2 | 3;
  selectedProfile: Profile | null;
  appliedProfile: Profile | null;
  benchmarkResults: DnsProvider[];
  isRunning: boolean;
  error: string | null;
  applied: boolean;
  selectedIp: string | null;
  selectedSecondaryIp: string | null;
  isApplying: boolean;
}

export const UNREACHABLE_SENTINEL = 99999;
