import React from "react";

const TYPE_STYLES = {
  "up-to-date": { background: "rgba(132, 148, 166, 0.15)", color: "var(--text2)" },
  patch: { background: "rgba(0, 212, 168, 0.15)", color: "var(--accent)" },
  minor: { background: "rgba(245, 158, 11, 0.15)", color: "var(--warn)" },
  major: { background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)" },
};

export default function UpdateTypeBadge({ type }) {
  const style = TYPE_STYLES[type] || TYPE_STYLES["up-to-date"];
  return (
    <span
      className="obs-badge"
      style={{ background: style.background, color: style.color }}
    >
      {type}
    </span>
  );
}
