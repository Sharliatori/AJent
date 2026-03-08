import React from "react";
import { PackageOpen } from "lucide-react";

export default function EmptyState({ icon: Icon = PackageOpen, title, description, action }) {
  return (
    <div className="obs-empty">
      <div className="obs-empty-icon">
        <Icon size={48} strokeWidth={1.2} />
      </div>
      <h3 className="obs-empty-title">{title}</h3>
      {description && <p className="obs-empty-desc">{description}</p>}
      {action && action}
    </div>
  );
}
