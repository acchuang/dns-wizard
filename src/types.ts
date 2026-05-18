export interface DnsProvider {
  name: string;
  ip: string;
  latency: number | null;
}

export interface ConfigResult {
  success: boolean;
  message: string;
}

export type Profile =
  | "Gamer"
  | "Privacy"
  | "Family"
  | "AdBlock"
  | "Balanced";

export interface ProfileDef {
  id: Profile;
  label: string;
  description: string;
  icon: "zap" | "shield" | "users" | "ban" | "scale";
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
