import React from "react";
import { ExternalLink, AlertTriangle, Package, Clock } from "lucide-react";
import HealthScoreGauge from "./HealthScoreGauge";

function timeAgo(dateStr) {
  if (!dateStr) return "Jamais";
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "A l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

export default function ProjectCard({ project, onSelect }) {
  const score = project.last_health_score;
  const hasScore = score !== null && score !== undefined;

  return (
    <div className="card obs-project-card" onClick={() => onSelect(project.id)}>
      <div className="obs-project-card-header">
        <div className="obs-project-card-info">
          <h3 className="obs-project-name">{project.project_name}</h3>
          {project.project_url && (
            <a
              href={project.project_url}
              target="_blank"
              rel="noopener noreferrer"
              className="obs-project-url"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
              {project.project_url.replace(/^https?:\/\//, "")}
            </a>
          )}
          {project.framework && (
            <span className="obs-framework-tag">{project.framework}</span>
          )}
        </div>
        <div className="obs-project-card-gauge">
          {hasScore ? (
            <HealthScoreGauge score={score} size="small" />
          ) : (
            <div className="obs-no-score">--</div>
          )}
        </div>
      </div>

      <div className="obs-project-card-stats">
        <div className="obs-stat">
          <Package size={14} />
          <span className="obs-stat-value">
            {hasScore ? project.last_health_score : "--"}
          </span>
          <span className="obs-stat-label">score</span>
        </div>
        <div className="obs-stat">
          <AlertTriangle size={14} />
          <span className="obs-stat-label">
            {project.last_analysis_at ? timeAgo(project.last_analysis_at) : "Aucune analyse"}
          </span>
        </div>
        <div className="obs-stat">
          <Clock size={14} />
          <span className="obs-stat-label">
            {timeAgo(project.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
