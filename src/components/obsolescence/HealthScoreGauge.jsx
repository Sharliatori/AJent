import React from "react";

const SIZE = 120;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getScoreColor(score) {
  if (score >= 80) return "var(--ok)";
  if (score >= 50) return "var(--warn)";
  return "var(--danger)";
}

function getScoreLabel(score) {
  if (score >= 80) return "Sain";
  if (score >= 50) return "Attention";
  return "Critique";
}

export default function HealthScoreGauge({ score, size = "default" }) {
  const displayScore = score ?? 0;
  const progress = displayScore / 100;
  const offset = CIRCUMFERENCE * (1 - progress);
  const color = getScoreColor(displayScore);
  const label = getScoreLabel(displayScore);
  const isSmall = size === "small";
  const scale = isSmall ? 0.6 : 1;
  const actualSize = SIZE * scale;

  return (
    <div className="gauge-container" style={{ width: actualSize, height: actualSize }}>
      <svg
        width={actualSize}
        height={actualSize}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="gauge-svg"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--border2)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="gauge-progress"
        />
      </svg>
      <div className="gauge-label">
        <span className="gauge-score" style={{ color, fontSize: isSmall ? 18 : 28 }}>
          {displayScore}
        </span>
        {!isSmall && (
          <span className="gauge-sublabel" style={{ color }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
