import { useEffect, useRef, useState } from "react";
import { SpeedTestResult } from "../types";

interface Props {
  result: SpeedTestResult | null;
  currentMbps: number;
  status: "idle" | "running" | "done" | "error" | "cancelled";
  testPhase: "idle" | "latency" | "download";
  stageName: string | null;
}

const SIZE = 220;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const ARC_START = 135;
const ARC_END = 405;
const ARC_SPAN = ARC_END - ARC_START;

function getGaugeMax(mbps: number): number {
  if (mbps >= 500) return 1000;
  if (mbps >= 250) return 500;
  if (mbps >= 100) return 250;
  if (mbps >= 50) return 100;
  if (mbps >= 10) return 50;
  return 10;
}

function getArcColor(mbps: number): string {
  if (mbps >= 250) return "var(--accent)";
  if (mbps >= 50) return "var(--success)";
  if (mbps >= 10) return "var(--warning)";
  return "var(--danger)";
}

function arcPath(value: number, max: number): string {
  const ratio = Math.min(value / max, 1);
  const angle = ARC_START + ratio * ARC_SPAN;
  const startRad = (ARC_START * Math.PI) / 180;
  const endRad = (angle * Math.PI) / 180;
  const x1 = CENTER + RADIUS * Math.cos(startRad);
  const y1 = CENTER + RADIUS * Math.sin(startRad);
  const x2 = CENTER + RADIUS * Math.cos(endRad);
  const y2 = CENTER + RADIUS * Math.sin(endRad);
  const largeArc = angle - ARC_START > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function fullBgArc(max: number): string {
  return arcPath(max, max);
}

function SpeedGauge({ result, currentMbps, status, testPhase, stageName }: Props) {
  const [animatedMbps, setAnimatedMbps] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const targetRef = useRef<number>(0);

  const showDownloadArc = status === "running" && testPhase === "download";
  const showDoneArc = status === "done" && result !== null;
  const displayMbps = showDownloadArc ? currentMbps : animatedMbps;
  const gaugeMax = getGaugeMax(showDoneArc && result ? result.headlineMbps : displayMbps);
  const arcColor = getArcColor(displayMbps);

  useEffect(() => {
    if (status !== "done" || !result) {
      setAnimatedMbps(0);
      return;
    }

    targetRef.current = result.headlineMbps;
    startRef.current = 0;
    const duration = 1000;

    const animate = (ts: number) => {
      if (startRef.current === 0) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedMbps(targetRef.current * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, result]);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const angle = ARC_START + frac * ARC_SPAN;
    const rad = (angle * Math.PI) / 180;
    const innerR = RADIUS - STROKE / 2 - 4;
    const outerR = RADIUS - STROKE / 2 - 14;
    const x1 = CENTER + innerR * Math.cos(rad);
    const y1 = CENTER + innerR * Math.sin(rad);
    const x2 = CENTER + outerR * Math.cos(rad);
    const y2 = CENTER + outerR * Math.sin(rad);
    const labelR = RADIUS - STROKE / 2 - 24;
    const lx = CENTER + labelR * Math.cos(rad);
    const ly = CENTER + labelR * Math.sin(rad);
    const labelVal = Math.round(frac * gaugeMax);
    return { x1, y1, x2, y2, lx, ly, label: String(labelVal) };
  });

  const pulseStyle: React.CSSProperties = showDownloadArc
    ? { animation: "pulse 1.5s ease-in-out infinite" }
    : {};

  const showArc = displayMbps > 0 || showDownloadArc;

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <path d={fullBgArc(gaugeMax)} fill="none" stroke="var(--bg-input)" strokeWidth={STROKE} strokeLinecap="round" />
        {showArc && (
          <path
            d={arcPath(displayMbps, gaugeMax)}
            fill="none"
            stroke={arcColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            style={pulseStyle}
          />
        )}
        {ticks.map((t, i) => (
          <g key={i} className="speed-gauge-tick">
            <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
            <text x={t.lx} y={t.ly} textAnchor="middle" dominantBaseline="middle">{t.label}</text>
          </g>
        ))}
      </svg>
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {status === "running" && testPhase === "latency" && (
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Testing latency...</span>
        )}
        {status === "running" && testPhase === "download" && (
          <>
            <span style={{ fontSize: 28, fontWeight: 700, color: arcColor }}>
              {currentMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Mbps</span>
            {stageName && (
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{stageName}</span>
            )}
          </>
        )}
        {status === "done" && result && (
          <>
            <span style={{ fontSize: 32, fontWeight: 700, color: arcColor }}>
              {animatedMbps.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Mbps</span>
          </>
        )}
        {status === "idle" && (
          <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Mbps</span>
        )}
        {status === "error" && (
          <span style={{ fontSize: 14, color: "var(--danger)" }}>Error</span>
        )}
        {status === "cancelled" && (
          <span style={{ fontSize: 14, color: "var(--warning)" }}>Cancelled</span>
        )}
      </div>
    </div>
  );
}

export default SpeedGauge;