import React from "react";

function getBarColor(score) {
  if (score >= 80) return "var(--ok)";
  if (score >= 50) return "var(--warn)";
  return "var(--danger)";
}

export default function ScoreHistory({ history }) {
  if (!history || history.length === 0) {
    return <div className="obs-table-empty">Aucun historique disponible.</div>;
  }

  const maxScore = 100;
  const barWidth = Math.max(24, Math.min(48, 600 / history.length));
  const chartHeight = 160;
  const chartWidth = history.length * (barWidth + 8) + 16;

  return (
    <div className="obs-chart-wrapper">
      <svg
        width={chartWidth}
        height={chartHeight + 32}
        viewBox={`0 0 ${chartWidth} ${chartHeight + 32}`}
        className="obs-chart-svg"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = chartHeight - (tick / maxScore) * chartHeight;
          return (
            <g key={tick}>
              <line
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <text
                x={0}
                y={y - 4}
                fill="var(--text3)"
                fontSize={10}
                fontFamily="var(--mono)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {history.map((item, i) => {
          const x = 16 + i * (barWidth + 8);
          const barHeight = (item.health_score / maxScore) * chartHeight;
          const y = chartHeight - barHeight;
          const color = getBarColor(item.health_score);
          const date = new Date(item.analyzed_at);
          const label = `${date.getDate()}/${date.getMonth() + 1}`;

          return (
            <g key={item.id || i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={color}
                opacity={0.85}
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                fill="var(--text)"
                fontSize={11}
                fontFamily="var(--mono)"
                textAnchor="middle"
              >
                {item.health_score}
              </text>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 16}
                fill="var(--text3)"
                fontSize={9}
                fontFamily="var(--mono)"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
