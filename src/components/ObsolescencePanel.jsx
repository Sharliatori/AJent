import React, { useState, useEffect } from "react";
import {
  Plus,
  Package,
  ShieldAlert,
  Activity,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { analyzedProjectsService } from "../lib/obsolescenceService";
import ProjectCard from "./obsolescence/ProjectCard";
import AddProjectForm from "./obsolescence/AddProjectForm";
import EmptyState from "./obsolescence/EmptyState";
import ObsolescenceDetailView from "./ObsolescenceDetailView";

export default function ObsolescencePanel() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadProjects() {
    try {
      const data = await analyzedProjectsService.getAll();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  }

  function handleProjectCreated() {
    setShowAddForm(false);
    loadProjects();
  }

  function handleBack() {
    setSelectedProjectId(null);
    loadProjects();
  }

  if (selectedProjectId) {
    return (
      <ObsolescenceDetailView
        projectId={selectedProjectId}
        onBack={handleBack}
      />
    );
  }

  const totalProjects = projects.length;
  const projectsWithScore = projects.filter((p) => p.last_health_score !== null);
  const avgScore =
    projectsWithScore.length > 0
      ? Math.round(
          projectsWithScore.reduce((s, p) => s + p.last_health_score, 0) /
            projectsWithScore.length
        )
      : null;

  const criticalCount = projectsWithScore.filter(
    (p) => p.last_health_score < 50
  ).length;

  return (
    <div className="obs-panel">
      <div className="obs-panel-header">
        <div>
          <h2 className="section-title">Obsolescence</h2>
          <p className="obs-panel-subtitle">
            Surveillance des dependances et vulnerabilites de vos projets
          </p>
        </div>
        <div className="obs-panel-actions">
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            Actualiser
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} />
            Ajouter un projet
          </button>
        </div>
      </div>

      {totalProjects > 0 && (
        <div className="obs-stats-row">
          <div className="obs-stats-card">
            <Package size={20} />
            <div>
              <span className="obs-stats-value">{totalProjects}</span>
              <span className="obs-stats-label">Projet{totalProjects > 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="obs-stats-card">
            <Activity size={20} />
            <div>
              <span
                className="obs-stats-value"
                style={{
                  color: avgScore !== null
                    ? avgScore >= 80
                      ? "var(--ok)"
                      : avgScore >= 50
                      ? "var(--warn)"
                      : "var(--danger)"
                    : "var(--text2)",
                }}
              >
                {avgScore !== null ? avgScore : "--"}
              </span>
              <span className="obs-stats-label">Score moyen</span>
            </div>
          </div>
          <div className="obs-stats-card">
            <ShieldAlert size={20} />
            <div>
              <span className="obs-stats-value">{projectsWithScore.length}</span>
              <span className="obs-stats-label">Analyses</span>
            </div>
          </div>
          <div className="obs-stats-card">
            <AlertTriangle size={20} />
            <div>
              <span
                className="obs-stats-value"
                style={{ color: criticalCount > 0 ? "var(--danger)" : "var(--text2)" }}
              >
                {criticalCount}
              </span>
              <span className="obs-stats-label">Critique{criticalCount > 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddProjectForm
          onClose={() => setShowAddForm(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {loading ? (
        <div className="obs-loading">
          <div className="spinner" />
          <span>Chargement des projets...</span>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="Aucun projet enregistre"
          description="Ajoutez votre premier projet pour commencer a surveiller ses dependances et vulnerabilites."
          action={
            <button
              className="btn btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={16} />
              Ajouter un projet
            </button>
          }
        />
      ) : (
        <div className="obs-projects-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={setSelectedProjectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
