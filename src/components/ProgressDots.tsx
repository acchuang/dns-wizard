interface Props {
  step: number;
  applied: boolean;
}

function getDotClass(n: number, step: number, applied: boolean): string {
  if (n === 1) {
    if (applied || step !== 1) return "progress-dot done";
    return "progress-dot active";
  }
  if (n === 2) {
    if (step === 3) return "progress-dot done";
    if (step === 2) return "progress-dot active";
    return "progress-dot";
  }
  if (n === 3) {
    if (applied) return "progress-dot done";
    if (step === 3) return "progress-dot active";
    return "progress-dot";
  }
  return "progress-dot";
}

function getDotContent(n: number, step: number, applied: boolean): string {
  if (n === 1) {
    return (applied || step !== 1) ? "\u2713" : "1";
  }
  if (n === 2) {
    if (step === 3) return "\u2713";
    return "2";
  }
  if (n === 3) {
    if (applied) return "\u2713";
    return "3";
  }
  return String(n);
}

function ProgressDots({ step, applied }: Props) {
  return (
    <div className="progress-dots">
      <div className={getDotClass(1, step, applied)}>{getDotContent(1, step, applied)}</div>
      <div className={getDotClass(2, step, applied)}>{getDotContent(2, step, applied)}</div>
      <div className={getDotClass(3, step, applied)}>{getDotContent(3, step, applied)}</div>
    </div>
  );
}

export default ProgressDots;
