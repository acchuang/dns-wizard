import { useState } from "react";
import { Globe, Zap, Radio, SearchCheck, Heart } from "lucide-react";

interface Props {
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to DNS Wizard",
    subtitle: "Your all-in-one network toolkit for macOS",
    description: "DNS Wizard helps you optimize your internet connection with 5 powerful tools. Let's walk you through them.",
    icon: "🔮",
  },
  {
    title: "DNS Wizard",
    subtitle: "Faster browsing in one click",
    description: "Your ISP's default DNS is often slow. DNS Wizard benchmarks providers like Cloudflare, Google, and Quad9 to find the fastest one for you. Apply it with a single admin prompt — or use Quick Fix to do it automatically.",
    icon: <Globe size={32} color="#7c3aed" />,
  },
  {
    title: "Speed Test",
    subtitle: "Measure your real network quality",
    description: "Tests download speed across 5 stages, plus latency and jitter. Gives you a letter grade (A+ to F) based on weighted metrics. History is saved so you can track improvements over time.",
    icon: <Zap size={32} color="#7c3aed" />,
  },
  {
    title: "Ping & Traceroute",
    subtitle: "Diagnose connectivity issues",
    description: "TCP ping to any host on port 443, and traceroute to map every hop between you and your destination. Includes presets for popular DNS servers.",
    icon: <Radio size={32} color="#7c3aed" />,
  },
  {
    title: "DNS Leak Test",
    subtitle: "Verify your privacy",
    description: "After applying a DNS profile, run a leak test to confirm your queries are actually going through your chosen servers — not leaking to your ISP.",
    icon: <SearchCheck size={32} color="#7c3aed" />,
  },
  {
    title: "Network Health",
    subtitle: "At-a-glance status check",
    description: "Traffic-light indicators for DNS, Speed, and Security. Instantly see if anything needs fixing, with one-click buttons to jump to the right tool.",
    icon: <Heart size={32} color="#7c3aed" />,
  },
  {
    title: "You're all set!",
    subtitle: "Tips to get the most out of DNS Wizard",
    description: "• Press Cmd+1–6 to switch tabs quickly\n• Toggle the eye icon in the sidebar for Simple Mode\n• Use Quick Fix on the DNS tab for one-click optimization\n• Export your results as CSV or JSON",
    icon: "✨",
  },
];

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#16213e",
  borderRadius: 16,
  padding: 32,
  maxWidth: 440,
  width: "90%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4)",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 32px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#7c3aed",
  color: "#fff",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "1px solid #334155",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "#94a3b8",
};

const dotStyle = (active: boolean): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  backgroundColor: active ? "#7c3aed" : "#334155",
  transition: "background-color 0.2s",
});

const ONBOARDING_KEY = "dnswizard-onboarded";

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    if (isLast) {
      markOnboardingComplete();
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    markOnboardingComplete();
    onComplete();
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 4 }}>
          {typeof current.icon === "string" ? current.icon : current.icon}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0, textAlign: "center" }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#a78bfa", margin: 0, textAlign: "center" }}>
          {current.subtitle}
        </p>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, textAlign: "center", lineHeight: 1.6, whiteSpace: "pre-line" }}>
          {current.description}
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          {steps.map((_, i) => (
            <div key={i} style={dotStyle(i === step)} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, width: "100%", justifyContent: "center" }}>
          {!isFirst && (
            <button style={btnSecondary} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button style={btnPrimary} onClick={handleNext}>
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>

        {!isLast && (
          <button
            onClick={handleSkip}
            style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}

export default OnboardingModal;