import { SpeedTestState } from "../types";

interface Props {
  state: SpeedTestState;
  setState: React.Dispatch<React.SetStateAction<SpeedTestState>>;
}

function SpeedPanel({ state: _state, setState: _setState }: Props) {
  return <div style={{ padding: 24, color: "#e2e8f0" }}>Speed Test — coming soon</div>;
}

export default SpeedPanel;