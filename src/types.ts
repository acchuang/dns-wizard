export interface DnsProvider {
  name: string;
  ip: string;
  latency: number | null;
}

export interface ConfigResult {
  success: boolean;
  message: string;
}

export interface NetworkInfo {
  service: string;
  servers: string[];
}

export interface QuickFixResult {
  providerName: string;
  providerIp: string;
  latencyMs: number;
  profile: string;
}

export interface PublicIpInfo {
  ip: string;
  isp: string;
  city: string;
  country: string;
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
export type ActiveTool = "dns" | "speed" | "ping" | "leak" | "health" | "ports" | "info" | "about";

// --- Speed Test ---
export interface StageResult {
  name: string;
  downloadMbps: number;
  bytesReceived: number;
  elapsedMs: number;
  error: string | null;
}

export interface LatencyResult {
  minMs: number;
  avgMs: number;
  maxMs: number;
  jitterMs: number;
  packetLoss: number;
  pingCount: number;
  successCount: number;
}

export interface LatencyProgressEvent {
  seq: number;
  latencyMs: number | null;
  success: boolean;
}

export interface SpeedTestResult {
  latency: LatencyResult | null;
  stages: StageResult[];
  headlineMbps: number;
  qualityScore: number;
  qualityGrade: string;
  cancelled: boolean;
}

export interface SpeedProgressEvent {
  bytesReceived: number;
  elapsedMs: number;
  currentMbps: number;
  stageName: string;
}

export interface SpeedHistoryEntry {
  timestamp: string;
  latency: LatencyResult | null;
  stages: StageResult[];
  headlineMbps: number;
  qualityScore: number;
  qualityGrade: string;
}

export interface SpeedTestState {
  status: "idle" | "running" | "done" | "error" | "cancelled";
  result: SpeedTestResult | null;
  error: string | null;
  currentMbps: number;
  currentStage: string | null;
  stageResults: StageResult[];
  latencyResult: LatencyResult | null;
  testPhase: "idle" | "latency" | "download";
  pingProgress: number;
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

// --- Port Scanner ---
export interface PortResult {
  port: number;
  status: "open" | "closed" | "filtered";
  service: string;
  latencyMs: number | null;
}

export interface PortScanState {
  host: string;
  portRange: string;
  isRunning: boolean;
  results: PortResult[];
  progress: number;
  total: number;
  error: string | null;
}

export interface PortProgressEvent {
  port: number;
  status: string;
  progress: number;
}

// --- Network Info ---
export interface NetworkInfoResult {
  publicIp: string;
  isp: string;
  city: string;
  country: string;
  interfaceName: string;
  connectionType: string;
  macAddress: string;
  localIp: string;
  gateway: string;
  dnsServers: string[];
  dhcpMode: string;
}

// --- Toast ---
export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}