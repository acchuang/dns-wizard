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
  marginBottom: 24,
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
