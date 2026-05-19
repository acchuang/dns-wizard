import { LeakTestState } from "../types";

interface Props {
  state: LeakTestState;
  setState: React.Dispatch<React.SetStateAction<LeakTestState>>;
}

function LeakPanel({ state: _state, setState: _setState }: Props) {
  return <div style={{ padding: 24, color: "#e2e8f0" }}>DNS Leak Test — coming soon</div>;
}

export default LeakPanel;