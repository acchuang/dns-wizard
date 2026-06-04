import { SpeedHistoryEntry } from "../types";
import { getHealthGradeClass } from "../utils/grades";

interface Props {
  history: SpeedHistoryEntry[];
  onSelect?: (entry: SpeedHistoryEntry) => void;
}

const BAR_WIDTH = 12;
const BAR_GAP = 2;
const CHART_HEIGHT = 60;
const MAX_BARS = 20;

function SparklineChart({ history, onSelect }: Props) {
  const visible = history.slice(0, MAX_BARS).reverse();
  const chartWidth = visible.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

  if (visible.length === 0) return null;

  return (
    <div className="sparkline-chart">
      <svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        {visible.map((entry, i) => {
          const barHeight = Math.max(4, (entry.qualityScore / 100) * CHART_HEIGHT);
          const y = CHART_HEIGHT - barHeight;
          const gradeClass = getHealthGradeClass(entry.qualityGrade);
          return (
            <g key={entry.timestamp} className="sparkline-bar-group" onClick={() => onSelect?.(entry)}>
              <rect
                x={i * (BAR_WIDTH + BAR_GAP)}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                rx={2}
                className={`sparkline-bar sparkline-bar-${gradeClass}`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default SparklineChart;