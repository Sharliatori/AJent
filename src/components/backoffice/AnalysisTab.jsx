import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Shield, Package, AlertTriangle, Activity, ChevronUp, ChevronDown, Search } from "lucide-react";
import HealthScoreGauge from "../obsolescence/HealthScoreGauge";
import pkgJson from "../../../package.json";

const UPDATE_TYPE_COLORS = {
  major: { bg: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "rgba(239,68,68,0.25)" },
  minor: { bg: "rgba(245,158,11,0.1)", color: "var(--warn)", border: "rgba(245,158,11,0.25)" },
  patch: { bg: "rgba(16,185,129,0.1)", color: "var(--ok)", border: "rgba(16,185,129,0.25)" },
  "up-to-date": { bg: "var(--bg3)", color: "var(--text3)", border: "var(--border)" },
};

const SEV_COLORS = {
  critical: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", border: "rgba(239,68,68,0.3)" },
  high: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  medium: { bg: "rgba(99,102,241,0.12)", color: "#818cf8", border: "rgba(99,102,241,0.3)" },
  low: { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "rgba(148,163,184,0.2)" },
};

function TypeBadge({ type }) {
  const s = UPDATE_TYPE_COLORS[type] || UPDATE_TYPE_COLORS["up-to-date"];
  const labels = { major: "MAJEUR", minor: "MINEUR", patch: "PATCH", "up-to-date": "À JOUR" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700,
      letterSpacing: "0.06em", background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {labels[type] || type}
    </span>
  );
}

function SevBadge({ sev }) {
  const s = SEV_COLORS[sev] || SEV_COLORS.low;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {sev}
    </span>
  );
}

function StatCard({ icon: Icon, value, label, color }) {
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <Icon size={18} style={{ color: color || "var(--text3)", flexShrink: 0 }} />
      <div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700,
          color: color || "var(--text)", lineHeight: 1.1,
        }}>{value}</div>
        <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export default function AnalysisTab({ analysis, lastRun, loading, onRunAnalysis }) {
  const [depFilter, setDepFilter] = useState("");
  const [depSort, setDepSort] = useState({ col: "update_type", dir: "asc" });
  const [showDevDeps, setShowDevDeps] = useState(true);

  const deps = analysis?.dependencies || [];
  const vulns = analysis?.vulnerabilities || [];

  const sortOrder = { major: 0, minor: 1, patch: 2, "up-to-date": 3 };

  const filteredDeps = deps
    .filter((d) => {
      if (!showDevDeps && d.is_dev) return false;
      if (!depFilter) return true;
      return d.name.toLowerCase().includes(depFilter.toLowerCase());
    })
    .sort((a, b) => {
      const dir = depSort.dir === "asc" ? 1 : -1;
      if (depSort.col === "update_type") {
        return ((sortOrder[a.update_type] ?? 4) - (sortOrder[b.update_type] ?? 4)) * dir;
      }
      if (depSort.col === "name") return a.name.localeCompare(b.name) * dir;
      return 0;
    });

  const toggleSort = (col) => {
    setDepSort((s) => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" });
  };

  const SortIcon = ({ col }) => {
    if (depSort.col !== col) return null;
    return depSort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const lastRunDate = lastRun?.completed_at
    ? new Date(lastRun.completed_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : null;

  if (!analysis && !loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,212,168,0.08)", border: "1px solid rgba(0,212,168,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Package size={28} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Première analyse des dépendances
          </div>
          <div style={{ fontSize: 13, color: "var(--text3)", maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Analysez les {Object.keys({ ...pkgJson.dependencies, ...pkgJson.devDependencies }).length} dépendances
            de ce projet pour détecter les mises à jour et vulnérabilités.
          </div>
          <button className="btn btn-primary" onClick={onRunAnalysis} style={{ gap: 8 }}>
            <RefreshCw size={15} />
            Lancer l'analyse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="section-title">Analyse des dépendances</h2>
          {lastRunDate && (
            <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
              Dernière analyse : {lastRunDate}
              {lastRun?.triggered_by === "scheduled" && " · Planifiée"}
            </p>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={onRunAnalysis}
          disabled={loading}
          style={{ gap: 8 }}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          {loading ? "Analyse en cours…" : "Analyser maintenant"}
        </button>
      </div>

      {loading && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "20px 24px",
          background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
        }}>
          <div className="spinner" />
          <div>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>Analyse en cours…</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              Interrogation du registre npm et vérification OSV des vulnérabilités
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <>
          {/* Score + stats */}
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
              padding: "20px 24px", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10, flexShrink: 0,
            }}>
              <HealthScoreGauge score={analysis.health_score} />
              <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Score de santé
              </div>
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <StatCard icon={Package} value={analysis.total} label="Dépendances" />
              <StatCard
                icon={RefreshCw}
                value={analysis.outdated}
                label="À mettre à jour"
                color={analysis.outdated > 0 ? "var(--warn)" : undefined}
              />
              <StatCard
                icon={AlertTriangle}
                value={vulns.filter((v) => v.severity === "critical").length}
                label="Critiques"
                color={vulns.some((v) => v.severity === "critical") ? "var(--danger)" : undefined}
              />
              <StatCard
                icon={Shield}
                value={vulns.length}
                label="Vulnérabilités"
                color={vulns.length > 0 ? "var(--warn)" : undefined}
              />
            </div>
          </div>

          {/* Vulnerabilities */}
          {vulns.length > 0 && (
            <div style={{ background: "var(--bg2)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 18px", borderBottom: "1px solid var(--border)",
                background: "rgba(239,68,68,0.04)",
              }}>
                <Shield size={15} style={{ color: "var(--danger)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  Vulnérabilités ({vulns.length})
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="obs-table">
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Sévérité</th>
                      <th>CVE / ID</th>
                      <th>Description</th>
                      <th>Corrigé dans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vulns.map((v, i) => (
                      <tr key={i}>
                        <td className="obs-td-mono">{v.package_name}</td>
                        <td><SevBadge sev={v.severity} /></td>
                        <td>
                          {v.url ? (
                            <a href={v.url} target="_blank" rel="noopener noreferrer" className="obs-cve-link">
                              {v.cve_id || v.id}
                            </a>
                          ) : (
                            <span className="obs-td-mono">{v.cve_id || v.id || "—"}</span>
                          )}
                        </td>
                        <td className="obs-td-desc" style={{ maxWidth: 280 }}>{v.summary || "—"}</td>
                        <td className="obs-td-mono" style={{ color: v.fixed_in ? "var(--ok)" : "var(--text3)" }}>
                          {v.fixed_in || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dependencies table */}
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px", borderBottom: "1px solid var(--border)", flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <Activity size={15} style={{ color: "var(--text3)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  Dépendances ({filteredDeps.length})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
                  <input
                    className="input"
                    placeholder="Filtrer…"
                    value={depFilter}
                    onChange={(e) => setDepFilter(e.target.value)}
                    style={{ paddingLeft: 28, fontSize: 12, height: 30, maxWidth: 180 }}
                  />
                </div>
                <button
                  onClick={() => setShowDevDeps(!showDevDeps)}
                  style={{
                    background: "none", border: "1px solid var(--border)", borderRadius: 6,
                    padding: "4px 10px", fontSize: 11, fontFamily: "var(--mono)",
                    color: showDevDeps ? "var(--accent)" : "var(--text3)", cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  DEV
                </button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="obs-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>
                      <span className="obs-th-inner">Package <SortIcon col="name" /></span>
                    </th>
                    <th>Version actuelle</th>
                    <th>Dernière version</th>
                    <th onClick={() => toggleSort("update_type")} style={{ cursor: "pointer" }}>
                      <span className="obs-th-inner">Type <SortIcon col="update_type" /></span>
                    </th>
                    <th>Info</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeps.map((dep, i) => (
                    <tr key={i}>
                      <td>
                        <span className="obs-td-mono">{dep.name}</span>
                        {dep.is_dev && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text3)", fontFamily: "var(--mono)" }}>dev</span>
                        )}
                      </td>
                      <td className="obs-td-mono">{dep.current}</td>
                      <td className="obs-td-mono" style={{ color: dep.update_type !== "up-to-date" ? "var(--accent)" : "var(--text3)" }}>
                        {dep.latest}
                      </td>
                      <td><TypeBadge type={dep.update_type} /></td>
                      <td style={{ fontSize: 12, color: "var(--text3)" }}>
                        {dep.is_deprecated && (
                          <span style={{ color: "var(--danger)", fontSize: 11, fontFamily: "var(--mono)" }}>DÉPRÉCIÉ</span>
                        )}
                        {dep.vuln_count > 0 && (
                          <span style={{ color: "var(--danger)", fontSize: 11, marginLeft: dep.is_deprecated ? 6 : 0 }}>
                            <Shield size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
                            {dep.vuln_count}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredDeps.length === 0 && (
                    <tr>
                      <td colSpan={5} className="obs-table-empty">Aucun résultat</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
