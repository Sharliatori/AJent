import React from "react";

const SEVERITY_STYLES = {
  low: { background: "rgba(16, 185, 129, 0.15)", color: "var(--ok)" },
  medium: { background: "rgba(245, 158, 11, 0.15)", color: "var(--warn)" },
  high: { background: "rgba(236, 111, 9, 0.15)", color: "#ec6f09" },
  critical: { background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)" },
};

export default function SeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
  return (
    <span
      className="obs-badge"
      style={{ background: style.background, color: style.color }}
    >
      {severity}
    </span>
  );
}
