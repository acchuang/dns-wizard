import { useState } from "react";

interface Props {
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to DNS Wizard",
    description: "Your all-in-one network toolbox for macOS. Optimize DNS, test speed, and verify your privacy.",
    icon: "🪄",
  },
  {
    title: "Find Your Fastest DNS",
    description: "Pick a profile, benchmark DNS servers, and apply the best one for your connection.",
    icon: "🌐",
  },
  {
    title: "Measure Your Speed",
    description: "Get a Network Quality Score with detailed latency, jitter, and download metrics.",
    icon: "⚡",
  },
  {
    title: "Verify Your Privacy",
    description: "Make sure your DNS queries aren't leaking to unintended servers.",
    icon: "🔍",
  },
];

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
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-icon">
          {typeof current.icon === "string" ? current.icon : current.icon}
        </div>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-desc">{current.description}</p>
        <div className="onboarding-dots">
          {steps.map((_, i) => (
            <div key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>
        <div className="onboarding-actions">
          {step > 0 && (
            <button className="onboarding-nav-btn" onClick={() => setStep(step - 1)}>Back</button>
          )}
          <button className="onboarding-nav-btn primary" onClick={handleNext}>
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
        {!isLast && (
          <button className="onboarding-skip" onClick={handleSkip}>Skip tour</button>
        )}
      </div>
    </div>
  );
}

export default OnboardingModal;
