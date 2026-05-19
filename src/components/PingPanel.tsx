import { PingState } from "../types";

interface Props {
  state: PingState;
  setState: React.Dispatch<React.SetStateAction<PingState>>;
}

function PingPanel({ state: _state, setState: _setState }: Props) {
  return <div style={{ padding: 24, color: "#e2e8f0" }}>Ping — coming soon</div>;
}

export default PingPanel;