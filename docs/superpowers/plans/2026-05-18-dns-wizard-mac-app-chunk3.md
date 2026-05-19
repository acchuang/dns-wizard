## Chunk 3: Frontend Components

### Task 3.1: Types and App state machine

**Files:**
- Create: `src/types.ts`
- Modify: `src/App.tsx` (replace stub)

- [ ] **Step 1: Create shared types**

Write to `src/types.ts`:
```typescript
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
}

export const UNREACHABLE_SENTINEL = Number.MAX_SAFE_INTEGER;

export const ADMIN_ERROR_MESSAGE = "Admin privileges required to update DNS settings.";
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: No errors.

- [ ] **Step 3: Rewrite App.tsx with state machine**

Write to `src/App.tsx`:
```tsx
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WizardState, Profile, DnsProvider, ConfigResult } from "./types";
import ProgressDots from "./components/ProgressDots";
import Step1_ChooseProfile from "./components/Step1_ChooseProfile";
import Step2_Benchmark from "./components/Step2_Benchmark";
import Step3_Results from "./components/Step3_Results";

const initialState: WizardState = {
  step: 1,
  selectedProfile: null,
  appliedProfile: null,
  benchmarkResults: [],
  isRunning: false,
  error: null,
  applied: false,
  selectedIp: null,
  selectedSecondaryIp: null,
};

function App() {
  const [state, setState] = useState<WizardState>(initialState);

  const selectProfile = useCallback((profile: Profile) => {
    setState((prev) => ({ ...prev, selectedProfile: profile, step: 2 }));
  }, []);

  const setRunning = useCallback((running: boolean) => {
    setState((prev) => ({ ...prev, isRunning: running }));
  }, []);

  const setBenchmarkResults = useCallback((results: DnsProvider[]) => {
    setState((prev) => ({
      ...prev,
      benchmarkResults: results,
      isRunning: false,
      step: 3,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, isRunning: false }));
  }, []);

  const runBenchmark = useCallback(async () => {
    if (!state.selectedProfile) return;
    setRunning(true);
    setError(null);
    try {
      const results = await invoke<DnsProvider[]>("run_benchmark", {
        profile: state.selectedProfile,
      });
      setBenchmarkResults(results);
    } catch (e) {
      setError(String(e));
    }
  }, [state.selectedProfile, setRunning, setError, setBenchmarkResults]);

  const selectResult = useCallback(
    (ip: string, secondaryIp: string) => {
      setState((prev) => ({ ...prev, selectedIp: ip, selectedSecondaryIp: secondaryIp }));
    },
    []
  );

  const applyDns = useCallback(async () => {
    if (!state.selectedIp) return;
    setError(null);
    try {
      const result = await invoke<ConfigResult>("apply_dns", {
        primary: state.selectedIp,
        secondary: state.selectedSecondaryIp ?? "",
      });
      if (result.success) {
        setState((prev) => ({
          ...prev,
          applied: true,
          appliedProfile: prev.selectedProfile,
        }));
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [state.selectedIp, state.selectedSecondaryIp, state.selectedProfile]);

  const restoreDns = useCallback(async () => {
    setError(null);
    try {
      const result = await invoke<ConfigResult>("restore_dns");
      if (result.success) {
        setState((prev) => ({ ...prev, applied: false }));
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const startOver = useCallback(() => {
    setState((prev) => ({
      ...initialState,
      applied: prev.applied,
      appliedProfile: prev.appliedProfile,
    }));
  }, []);

  const authorizeApply = useCallback(async () => {
    if (!state.selectedIp) return;
    setError(null);
    try {
      await invoke("execute_admin_apply", {
        primary: state.selectedIp,
        secondary: state.selectedSecondaryIp ?? "",
      });
      setState((prev) => ({
        ...prev,
        applied: true,
        error: null,
        appliedProfile: prev.selectedProfile,
      }));
    } catch (e) {
      setError(String(e));
    }
  }, [state.selectedIp, state.selectedSecondaryIp, state.selectedProfile]);

  const authorizeRestore = useCallback(async () => {
    setError(null);
    try {
      await invoke("execute_admin_restore");
      setState((prev) => ({ ...prev, applied: false, error: null }));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return (
    <>
      <ProgressDots step={state.step} applied={state.applied} />
      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            width: `${3 * 100}%`,
            transform: `translateX(-${(state.step - 1) * (100 / 3)}%)`,
            transition: "transform 0.3s ease",
          }}
        >
          <Step1_ChooseProfile
            onSelect={selectProfile}
            applied={state.applied}
            appliedProfile={state.appliedProfile}
          />
          <Step2_Benchmark
            profile={state.selectedProfile}
            isRunning={state.isRunning}
            error={state.error}
            onStart={runBenchmark}
          />
          <Step3_Results
            results={state.benchmarkResults}
            selectedIp={state.selectedIp}
            error={state.error}
            applied={state.applied}
            onSelect={selectResult}
            onApply={applyDns}
            onRestore={restoreDns}
            onStartOver={startOver}
            onAuthorizeApply={authorizeApply}
            onAuthorizeRestore={authorizeRestore}
          />
        </div>
      </div>
    </>
  );
}

export default App;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: Errors about missing component modules — those are created in the next tasks. No type errors within App.tsx itself.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add types and App state machine"
```

### Task 3.2: ProgressDots component

**Files:**
- Create: `src/components/ProgressDots.tsx`

- [ ] **Step 1: Write ProgressDots**

Write to `src/components/ProgressDots.tsx`:
```tsx
const dotStyle = (active: boolean): React.CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  backgroundColor: active ? "#7c3aed" : "#334155",
  transition: "background-color 0.3s ease",
});

const containerStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 32,
};

interface Props {
  step: number;
  applied: boolean;
}

function ProgressDots({ step, applied }: Props) {
  return (
    <div style={containerStyle}>
      <div
        style={{
          ...dotStyle(step === 1),
          backgroundColor: applied && step !== 1 ? "#10b981" : dotStyle(step === 1).backgroundColor,
        }}
      />
      <div style={dotStyle(step === 2)} />
      <div style={dotStyle(step === 3)} />
    </div>
  );
}

export default ProgressDots;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: New errors only from remaining missing components. ProgressDots itself has no errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add ProgressDots component"
```

### Task 3.3: ProfileCard component

**Files:**
- Create: `src/components/ProfileCard.tsx`

- [ ] **Step 1: Write ProfileCard**

Write to `src/components/ProfileCard.tsx`:
```tsx
import { Zap, Shield, Users, Ban, Scale } from "lucide-react";
import { ProfileDef } from "../types";

const iconMap = {
  zap: Zap,
  shield: Shield,
  users: Users,
  ban: Ban,
  scale: Scale,
};

interface Props {
  profile: ProfileDef;
  onSelect: () => void;
}

const cardStyle: React.CSSProperties = {
  background: "#16213e",
  borderRadius: 12,
  padding: "20px 16px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  border: "2px solid transparent",
  transition: "border-color 0.2s ease, transform 0.2s ease",
  width: 140,
};

function ProfileCard({ profile, onSelect }: Props) {
  const Icon = iconMap[profile.icon];

  return (
    <div
      style={cardStyle}
      onClick={onSelect}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#7c3aed";
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
      }}
    >
      <Icon size={28} color="#7c3aed" />
      <span style={{ fontSize: 18, fontWeight: 600 }}>{profile.label}</span>
      <span style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 1.4 }}>
        {profile.description}
      </span>
    </div>
  );
}

export default ProfileCard;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: Only remaining component errors from Step1/Step2/Step3.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add ProfileCard component"
```

### Task 3.4: Step1_ChooseProfile component

**Files:**
- Create: `src/components/Step1_ChooseProfile.tsx`

- [ ] **Step 1: Write Step1**

Write to `src/components/Step1_ChooseProfile.tsx`:
```tsx
import { Profile, ProfileDef } from "../types";
import ProfileCard from "./ProfileCard";

const profiles: ProfileDef[] = [
  {
    id: "Gamer",
    label: "Gamer",
    description: "Lowest possible latency",
    icon: "zap",
  },
  {
    id: "Privacy",
    label: "Privacy",
    description: "Privacy-respecting providers",
    icon: "shield",
  },
  {
    id: "Family",
    label: "Family",
    description: "Block adult & malicious content",
    icon: "users",
  },
  {
    id: "AdBlock",
    label: "Ad-Free",
    description: "DNS-level ad blocking",
    icon: "ban",
  },
  {
    id: "Balanced",
    label: "Balanced",
    description: "Stable, high-speed default",
    icon: "scale",
  },
];

interface Props {
  onSelect: (profile: Profile) => void;
  applied: boolean;
  appliedProfile: Profile | null;
}

const wrapperStyle: React.CSSProperties = {
  flex: "0 0 100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  paddingTop: 20,
};

const gridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  justifyContent: "center",
  maxWidth: 460,
};

function Step1_ChooseProfile({ onSelect, applied, appliedProfile }: Props) {
  return (
    <div style={wrapperStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Choose a Profile</h1>
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, textAlign: "center" }}>
        What do you want your internet to do?
      </p>
      {applied && appliedProfile && (
        <p style={{ fontSize: 12, color: "#10b981", margin: 0 }}>
          DNS is active ({appliedProfile} profile applies)
        </p>
      )}
      <div style={gridStyle}>
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            onSelect={() => onSelect(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default Step1_ChooseProfile;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: Only Step2 and Step3 component errors remain.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Step1_ChooseProfile component"
```

### Task 3.5: Step2_Benchmark component

**Files:**
- Create: `src/components/Step2_Benchmark.tsx`

- [ ] **Step 1: Write Step2**

Write to `src/components/Step2_Benchmark.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { Profile } from "../types";

interface Props {
  profile: Profile | null;
  isRunning: boolean;
  error: string | null;
  onStart: () => void;
}

const wrapperStyle: React.CSSProperties = {
  flex: "0 0 100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  paddingTop: 20,
};

const spinnerStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  border: "4px solid #334155",
  borderTop: "4px solid #7c3aed",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

function Step2_Benchmark({ profile, isRunning, error, onStart }: Props) {
  const hasStarted = useRef(false);

  useEffect(() => {
    hasStarted.current = false;
  }, [profile]);

  useEffect(() => {
    if (!isRunning && !hasStarted.current) {
      hasStarted.current = true;
      onStart();
    }
  }, [profile, isRunning, onStart]);

  return (
    <div style={wrapperStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Benchmarking</h1>
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, textAlign: "center" }}>
        Testing DNS servers for the {profile} profile...
      </p>
      {isRunning && <div style={spinnerStyle} />}
      {isRunning && (
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          This may take a few seconds
        </p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: "#ef4444", margin: 0, textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default Step2_Benchmark;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: Only Step3 component error remains.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Step2_Benchmark component"
```

### Task 3.6: Step3_Results component

**Files:**
- Create: `src/components/Step3_Results.tsx`

- [ ] **Step 1: Write Step3**

Write to `src/components/Step3_Results.tsx`:
```tsx
import { DnsProvider, UNREACHABLE_SENTINEL, ADMIN_ERROR_MESSAGE } from "../types";
import { useMemo } from "react";

interface Props {
  results: DnsProvider[];
  selectedIp: string | null;
  error: string | null;
  applied: boolean;
  onSelect: (ip: string, secondaryIp: string) => void;
  onApply: () => void;
  onRestore: () => void;
  onStartOver: () => void;
  onAuthorizeApply: () => void;
  onAuthorizeRestore: () => void;
}

const wrapperStyle: React.CSSProperties = {
  flex: "0 0 100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  paddingTop: 20,
  overflowY: "auto" as const,
  maxHeight: "calc(100vh - 120px)",
};

const btnBase: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.2s",
};

const applyBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "#7c3aed",
  color: "#fff",
};

const restoreBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
};

const startOverBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "transparent",
  color: "#64748b",
  fontSize: 13,
};

const authBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "#ef4444",
  color: "#fff",
};

function Step3_Results({
  results,
  selectedIp,
  error,
  applied,
  onSelect,
  onApply,
  onRestore,
  onStartOver,
  onAuthorizeApply,
  onAuthorizeRestore,
}: Props) {
  const reachable = useMemo(
    () => results.filter((r) => r.latency !== null && r.latency < UNREACHABLE_SENTINEL),
    [results]
  );

  const allUnreachable = results.length > 0 && reachable.length === 0;

  const secondaryFor = (ip: string) => {
    const others = reachable.filter((r) => r.ip !== ip);
    return others.length > 0 ? others[0].ip : "";
  };

  return (
    <div style={wrapperStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
        {applied ? "DNS Active" : "Benchmark Results"}
      </h1>

      {allUnreachable && (
        <p style={{ fontSize: 14, color: "#ef4444", margin: 0, textAlign: "center" }}>
          No DNS servers responded. Check your internet connection and try again.
        </p>
      )}

      {results.length > 0 && !allUnreachable && (
        <table style={{ width: "100%", maxWidth: 440, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              <th style={thStyle}>Provider</th>
              <th style={thStyle}>Latency</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.ip}
                style={{
                  borderBottom: "1px solid #1e293b",
                  backgroundColor:
                    selectedIp === r.ip ? "rgba(124, 58, 237, 0.15)" : "transparent",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
                onClick={() => onSelect(r.ip, secondaryFor(r.ip))}
              >
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                  {r.latency === null
                    ? "--"
                    : r.latency >= UNREACHABLE_SENTINEL
                    ? <span style={{ color: "#ef4444" }}>Unreachable</span>
                    : `${r.latency}ms`}
                </td>
                <td style={tdStyle}>
                  {selectedIp === r.ip && <span style={{ color: "#7c3aed" }}>Selected</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && (
        <p style={{ fontSize: 13, color: "#ef4444", margin: 0, textAlign: "center" }}>
          {error}
        </p>
      )}

      {error && error.includes(ADMIN_ERROR_MESSAGE) && (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={authBtn} onClick={onAuthorizeApply}>
            Authorize Apply
          </button>
          <button style={authBtn} onClick={onAuthorizeRestore}>
            Authorize Restore
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {!applied && (
          <button
            style={{
              ...applyBtn,
              opacity: selectedIp ? 1 : 0.4,
              cursor: selectedIp ? "pointer" : "not-allowed",
            }}
            disabled={!selectedIp}
            onClick={onApply}
          >
            Apply DNS
          </button>
        )}
        {applied && (
          <button style={restoreBtn} onClick={onRestore}>
            Restore Default DNS
          </button>
        )}
      </div>

      <button style={startOverBtn} onClick={onStartOver}>
        Start Over
      </button>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase" as const,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
};

export default Step3_Results;
```

- [ ] **Step 2: Verify full TypeScript compilation**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: No errors — all components resolve.

- [ ] **Step 3: Add spinner animation to CSS**

Append to `src/styles/index.css`:
```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Step3_Results component and spinner animation"
```

---
