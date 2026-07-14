import { ActiveTool } from "../types";
import { toolMeta } from "../toolMeta";

interface Props {
  tool: ActiveTool;
  title?: string;
}

function PaneHeader({ tool, title }: Props) {
  const meta = toolMeta[tool];
  const Icon = meta.icon;
  return (
    <div className="pane-header">
      <span className="pane-header-icon" style={{ background: meta.tint }}>
        <Icon size={20} />
      </span>
      <h2 className="pane-header-title">{title ?? meta.label}</h2>
    </div>
  );
}

export default PaneHeader;
