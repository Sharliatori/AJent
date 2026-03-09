import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Package,
  ShieldAlert,
  AlertTriangle,
  Archive,
  Trash2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import {
  analyzedProjectsService,
  analysisReportsService,
  dependencySnapshotsService,
  vulnerabilityFindingsService,
} from "../lib/obsolescenceService";
import HealthScoreGauge from "./obsolescence/HealthScoreGauge";
import DependencyTable from "./obsolescence/DependencyTable";
import VulnerabilityTable from "./obsolescence/VulnerabilityTable";
import ScoreHistory from "./obsolescence/ScoreHistory";
import IntegrationSnippet from "./obsolescence/IntegrationSnippet";
import WebhookUrlEditor from "./obsolescence/WebhookUrlEditor";

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "deps", label: "Dependances" },
  { key: "vulns", label: "Vulnerabilites" },
  { key: "history", label: "Historique" },
  { key: "integration", label: "Integration" },
];

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

export default function ObsolescenceDetailView({ projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [dependencies, setDependencies] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [proj, latest, history] = await Promise.all([
        analyzedProjectsService.getById(projectId),
        analysisReportsService.getLatest(projectId),
        analysisReportsService.getScoreHistory(projectId, 12),
      ]);

      setProject(proj);
      setLatestReport(latest);
      setScoreHistory(history);

      if (latest) {
        const [deps, vulns] = await Promise.all([
          dependencySnapshotsService.getByReport(latest.id),
          vulnerabilityFindingsService.getByReport(latest.id),
        ]);
        setDependencies(deps);
        setVulnerabilities(vulns);
      }

      const reportsResult = await analysisReportsService.getByProject(projectId, 20, 0);
      setAllReports(reportsResult.reports || []);
    } catch (err) {
      console.error("Failed to load project data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyApiKey() {
    if (!project?.api_key) return;
    try {
      await navigator.clipboard.writeText(project.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await analyzedProjectsService.softDelete(projectId);
      onBack();
    } catch (err) {
      console.error("Failed to delete project:", err);
      setDeleting(false);
    }
  }

  async function handleTriggerAnalysis() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const result = await analyzedProjectsService.triggerAnalysis(projectId);
      setTriggerResult({ success: true, message: "Analyse declenchee" });
      setTimeout(() => {
        setTriggerResult(null);
        loadData();
      }, 5000);
    } catch (err) {
      const msg = err.message || "Erreur lors du declenchement";
      setTriggerResult({ success: false, message: msg });
      setTimeout(() => setTriggerResult(null), 5000);
    } finally {
      setTriggering(false);
    }
  }

  if (loading) {
    return (
      <div className="obs-panel">
        <div className="obs-loading">
          <div className="spinner" />
          <span>Chargement du projet...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="obs-panel">
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="obs-table-empty" style={{ marginTop: 32 }}>
          Projet introuvable.
        </div>
      </div>
    );
  }

  return (
    <div className="obs-panel">
      <div className="obs-detail-header">
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Retour
        </button>

        <div className="obs-detail-title-row">
          <div>
            <h2 className="section-title">{project.project_name}</h2>
            <div className="obs-detail-meta">
              {project.project_url && (
                <a
                  href={project.project_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="obs-project-url"
                >
                  <ExternalLink size={12} />
                  {project.project_url.replace(/^https?:\/\//, "")}
                </a>
              )}
              {project.framework && (
                <span className="obs-framework-tag">{project.framework}</span>
              )}
            </div>
          </div>
          <div className="obs-detail-actions">
            {project.webhook_url && (
              <button
                className="btn btn-primary"
                onClick={handleTriggerAnalysis}
                disabled={triggering}
              >
                {triggering ? (
                  <Loader2 size={14} className="spinner-icon" />
                ) : (
                  <Play size={14} />
                )}
                {triggering ? "Envoi..." : "Lancer une analyse"}
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleCopyApiKey}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copie" : "Cle API"}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {triggerResult && (
        <div
          className="card obs-trigger-feedback"
          style={{
            borderLeft: `3px solid ${triggerResult.success ? "var(--ok)" : "var(--danger)"}`,
            padding: "10px 16px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {triggerResult.success ? (
            <RefreshCw size={14} style={{ color: "var(--ok)" }} />
          ) : (
            <AlertTriangle size={14} style={{ color: "var(--danger)" }} />
          )}
          <span style={{ color: triggerResult.success ? "var(--ok)" : "var(--danger)" }}>
            {triggerResult.message}
          </span>
          {triggerResult.success && (
            <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: "auto" }}>
              Les resultats apparaitront dans quelques instants...
            </span>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="card obs-delete-confirm">
          <p>Supprimer le projet "{project.project_name}" ? Cette action est irreversible.</p>
          <div className="obs-add-form-actions">
            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
              Annuler
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={14} className="spinner-icon" /> : <Trash2 size={14} />}
              Confirmer
            </button>
          </div>
        </div>
      )}

      <div className="obs-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`obs-tab ${tab === t.key ? "obs-tab-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="obs-tab-content">
        {tab === "overview" && (
          <OverviewTab
            project={project}
            latestReport={latestReport}
            dependencies={dependencies}
            vulnerabilities={vulnerabilities}
            scoreHistory={scoreHistory}
          />
        )}
        {tab === "deps" && <DependencyTable dependencies={dependencies} />}
        {tab === "vulns" && <VulnerabilityTable vulnerabilities={vulnerabilities} />}
        {tab === "history" && <HistoryTab reports={allReports} />}
        {tab === "integration" && (
          <div className="obs-integration-tab">
            <IntegrationSnippet
              apiKey={project.api_key}
              projectName={project.project_name}
              webhookUrl={project.webhook_url}
            />
            <div style={{ marginTop: 16 }}>
              <WebhookUrlEditor
                project={project}
                onUpdated={(updated) => setProject(updated)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ project, latestReport, dependencies, vulnerabilities, scoreHistory }) {
  if (!latestReport) {
    return (
      <div className="obs-table-empty">
        Aucune analyse disponible pour ce projet. Les rapports apparaitront ici
        une fois que le module embarque aura envoye sa premiere analyse.
      </div>
    );
  }

  const outdatedDeps = dependencies.filter((d) => d.update_type !== "up-to-date");
  const deprecatedDeps = dependencies.filter((d) => d.is_deprecated);
  const criticalVulns = vulnerabilities.filter((v) => v.severity === "critical" || v.severity === "high");

  return (
    <div className="obs-overview">
      <div className="obs-overview-top">
        <div className="obs-overview-gauge-block">
          <HealthScoreGauge score={latestReport.health_score} />
          <div className="obs-overview-date">
            <Clock size={14} />
            Derniere analyse: {timeAgo(latestReport.analyzed_at)}
          </div>
        </div>

        <div className="obs-overview-metrics">
          <div className="obs-metric-card">
            <Package size={18} />
            <span className="obs-metric-value">{latestReport.total_dependencies}</span>
            <span className="obs-metric-label">Dependances</span>
          </div>
          <div className="obs-metric-card">
            <AlertTriangle size={18} style={{ color: "var(--warn)" }} />
            <span className="obs-metric-value" style={{ color: latestReport.outdated_count > 0 ? "var(--warn)" : "var(--text2)" }}>
              {latestReport.outdated_count}
            </span>
            <span className="obs-metric-label">Obsoletes</span>
          </div>
          <div className="obs-metric-card">
            <ShieldAlert size={18} style={{ color: "var(--danger)" }} />
            <span className="obs-metric-value" style={{ color: latestReport.vulnerable_count > 0 ? "var(--danger)" : "var(--text2)" }}>
              {latestReport.vulnerable_count}
            </span>
            <span className="obs-metric-label">Vulnerables</span>
          </div>
          <div className="obs-metric-card">
            <Archive size={18} style={{ color: "var(--text3)" }} />
            <span className="obs-metric-value" style={{ color: latestReport.deprecated_count > 0 ? "var(--danger)" : "var(--text2)" }}>
              {latestReport.deprecated_count}
            </span>
            <span className="obs-metric-label">Deprecated</span>
          </div>
        </div>
      </div>

      {scoreHistory.length > 1 && (
        <div className="obs-overview-section">
          <h3 className="obs-overview-section-title">Evolution du score</h3>
          <ScoreHistory history={scoreHistory} />
        </div>
      )}

      {criticalVulns.length > 0 && (
        <div className="obs-overview-section">
          <h3 className="obs-overview-section-title" style={{ color: "var(--danger)" }}>
            <ShieldAlert size={16} /> Vulnerabilites critiques
          </h3>
          <div className="obs-critical-list">
            {criticalVulns.slice(0, 5).map((v) => (
              <div key={v.id} className="obs-critical-item">
                <span className="obs-td-mono">{v.package_name}</span>
                <span className="obs-badge" style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger)" }}>
                  {v.severity}
                </span>
                {v.cve_id && <span className="obs-td-mono">{v.cve_id}</span>}
                {v.fixed_in_version && (
                  <span style={{ color: "var(--ok)" }}>Fix: {v.fixed_in_version}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {outdatedDeps.length > 0 && (
        <div className="obs-overview-section">
          <h3 className="obs-overview-section-title">
            <AlertTriangle size={16} /> Top dependances obsoletes
          </h3>
          <div className="obs-critical-list">
            {outdatedDeps
              .sort((a, b) => (b.days_behind || 0) - (a.days_behind || 0))
              .slice(0, 5)
              .map((d) => (
                <div key={d.id} className="obs-critical-item">
                  <span className="obs-td-mono">{d.package_name}</span>
                  <span className="obs-td-mono" style={{ color: "var(--text2)" }}>
                    {d.current_version} → {d.latest_version}
                  </span>
                  <span style={{ color: "var(--warn)" }}>{d.days_behind}j de retard</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ reports }) {
  if (!reports || reports.length === 0) {
    return <div className="obs-table-empty">Aucun rapport dans l'historique.</div>;
  }

  return (
    <div className="obs-history-list">
      {reports.map((report) => (
        <div key={report.id} className="card obs-history-item">
          <div className="obs-history-item-header">
            <div className="obs-history-score" style={{
              color: report.health_score >= 80
                ? "var(--ok)"
                : report.health_score >= 50
                ? "var(--warn)"
                : "var(--danger)",
            }}>
              {report.health_score}
            </div>
            <div className="obs-history-item-info">
              <span className="obs-history-date">
                {new Date(report.analyzed_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="obs-history-item-stats">
                <span>{report.total_dependencies} deps</span>
                <span style={{ color: "var(--warn)" }}>{report.outdated_count} obsoletes</span>
                <span style={{ color: "var(--danger)" }}>{report.vulnerable_count} vulns</span>
                <span>{report.deprecated_count} deprecated</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
