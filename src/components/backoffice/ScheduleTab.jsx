import React, { useState, useEffect } from "react";
import {
  Calendar, Bell, Clock, Mail, CheckCircle, AlertCircle,
  Save, Play, History, ToggleLeft, ToggleRight
} from "lucide-react";
import { selfAnalyzeService } from "../../lib/selfAnalyzeService";

const FREQUENCIES = [
  { id: "daily", label: "Quotidien" },
  { id: "weekly", label: "Hebdomadaire" },
  { id: "monthly", label: "Mensuel" },
];

const DAYS_OF_WEEK = [
  { v: 1, l: "Lundi" }, { v: 2, l: "Mardi" }, { v: 3, l: "Mercredi" },
  { v: 4, l: "Jeudi" }, { v: 5, l: "Vendredi" }, { v: 6, l: "Samedi" }, { v: 0, l: "Dimanche" },
];

const THRESHOLDS = [
  { id: "critical", label: "Critique uniquement" },
  { id: "high", label: "Critique + Haute" },
  { id: "all", label: "Toutes vulnérabilités" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({ v: i, l: `${String(i).padStart(2, "0")}:00` }));

function computeNextRun(schedule) {
  if (!schedule?.enabled) return null;
  const now = new Date();
  const next = new Date();
  const hourParis = schedule.hour_paris ?? 8;
  next.setHours(hourParis, 0, 0, 0);

  if (schedule.frequency === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (schedule.frequency === "weekly") {
    const targetDay = schedule.day_of_week ?? 1;
    const diff = (targetDay - now.getDay() + 7) % 7;
    next.setDate(now.getDate() + (diff === 0 && next <= now ? 7 : diff));
  } else if (schedule.frequency === "monthly") {
    const targetDay = schedule.day_of_month ?? 1;
    next.setDate(targetDay);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDay);
    }
  }
  return next;
}

function StatusBadge({ status }) {
  const map = {
    completed: { color: "var(--ok)", bg: "rgba(16,185,129,0.1)", label: "Terminée" },
    running: { color: "var(--accent)", bg: "rgba(0,212,168,0.1)", label: "En cours" },
    failed: { color: "var(--danger)", bg: "rgba(239,68,68,0.1)", label: "Échec" },
  };
  const s = map[status] || map.completed;
  return (
    <span style={{
      fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700,
      padding: "2px 8px", borderRadius: 4, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function ScoreChip({ score }) {
  if (score == null) return <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>;
  const color = score >= 80 ? "var(--ok)" : score >= 50 ? "var(--warn)" : "var(--danger)";
  return <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color, fontSize: 13 }}>{score}</span>;
}

export default function ScheduleTab({ smtpConfigured }) {
  const [schedule, setSchedule] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [testingAlert, setTestingAlert] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [hourParis, setHourParis] = useState(8);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [alertThreshold, setAlertThreshold] = useState("critical");
  const [alertRecipient, setAlertRecipient] = useState("nicolas.sinou@lutecia.ai");

  useEffect(() => {
    async function load() {
      try {
        const [sched, hist] = await Promise.all([
          selfAnalyzeService.getSchedule(),
          selfAnalyzeService.getHistory(10),
        ]);
        if (sched) {
          setSchedule(sched);
          setEnabled(sched.enabled);
          setFrequency(sched.frequency || "weekly");
          setHourParis(sched.hour_paris ?? 8);
          setDayOfWeek(sched.day_of_week ?? 1);
          setDayOfMonth(sched.day_of_month ?? 1);
          setAlertThreshold(sched.alert_threshold || "critical");
          setAlertRecipient(sched.alert_recipient || "nicolas.sinou@lutecia.ai");
        }
        setHistory(hist);
      } catch (err) {
        console.error("Failed to load schedule:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const result = await selfAnalyzeService.saveSchedule({
        enabled, frequency, hour_paris: hourParis,
        day_of_week: dayOfWeek, day_of_month: dayOfMonth,
        alert_threshold: alertThreshold, alert_recipient: alertRecipient,
      });
      setSchedule(result.schedule);
      setSaveMsg({ ok: true, text: "Configuration sauvegardée" });
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  const nextRun = computeNextRun({ enabled, frequency, hour_paris: hourParis, day_of_week: dayOfWeek, day_of_month: dayOfMonth });
  const nextRunStr = nextRun
    ? nextRun.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })
    : null;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 24px", color: "var(--text2)", fontSize: 13 }}>
        <div className="spinner" /> Chargement de la configuration…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Schedule section ── */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <Calendar size={15} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Planification automatique</span>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Enable toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setEnabled(!enabled)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
            >
              {enabled
                ? <ToggleRight size={28} style={{ color: "var(--accent)" }} />
                : <ToggleLeft size={28} style={{ color: "var(--text3)" }} />
              }
              <span style={{ fontSize: 13, fontWeight: 500, color: enabled ? "var(--text)" : "var(--text3)" }}>
                Analyses planifiées {enabled ? "activées" : "désactivées"}
              </span>
            </button>
          </div>

          {/* Frequency */}
          <div className="field">
            <label className="label">Fréquence</label>
            <div style={{ display: "flex", gap: 8 }}>
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFrequency(f.id)}
                  disabled={!enabled}
                  style={{
                    padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500,
                    cursor: enabled ? "pointer" : "not-allowed", transition: "all 0.15s",
                    background: frequency === f.id ? "rgba(0,212,168,0.1)" : "var(--bg3)",
                    border: frequency === f.id ? "1px solid rgba(0,212,168,0.4)" : "1px solid var(--border)",
                    color: frequency === f.id ? "var(--accent)" : "var(--text2)",
                    opacity: enabled ? 1 : 0.4,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day selectors */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {frequency === "weekly" && (
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label className="label">Jour</label>
                <select
                  className="input"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  disabled={!enabled}
                  style={{ opacity: enabled ? 1 : 0.4 }}
                >
                  {DAYS_OF_WEEK.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </div>
            )}
            {frequency === "monthly" && (
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label className="label">Jour du mois</label>
                <select
                  className="input"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  disabled={!enabled}
                  style={{ opacity: enabled ? 1 : 0.4 }}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label className="label">Heure (Paris UTC+2)</label>
              <select
                className="input"
                value={hourParis}
                onChange={(e) => setHourParis(Number(e.target.value))}
                disabled={!enabled}
                style={{ opacity: enabled ? 1 : 0.4 }}
              >
                {HOURS.map((h) => <option key={h.v} value={h.v}>{h.l}</option>)}
              </select>
            </div>
          </div>

          {/* Next run preview */}
          {enabled && nextRunStr && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(0,212,168,0.06)", border: "1px solid rgba(0,212,168,0.15)",
              fontSize: 13, color: "var(--text2)",
            }}>
              <Clock size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              Prochaine analyse : <strong style={{ color: "var(--text)" }}>{nextRunStr}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── Alert section ── */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <Bell size={15} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Alertes de vulnérabilités</span>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* SMTP status */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8,
            background: smtpConfigured ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${smtpConfigured ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
            fontSize: 12,
          }}>
            {smtpConfigured
              ? <CheckCircle size={14} style={{ color: "var(--ok)", flexShrink: 0 }} />
              : <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0 }} />
            }
            <span style={{ color: smtpConfigured ? "var(--ok)" : "var(--danger)" }}>
              {smtpConfigured ? "SMTP configuré" : "SMTP non configuré — configurer dans les Paramètres"}
            </span>
            {!smtpConfigured && (
              <a href="/" style={{ marginLeft: "auto", fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>
                → Paramètres
              </a>
            )}
          </div>

          {/* Threshold */}
          <div className="field">
            <label className="label">Seuil d'alerte</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {THRESHOLDS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAlertThreshold(t.id)}
                  style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                    cursor: "pointer", transition: "all 0.15s",
                    background: alertThreshold === t.id ? "rgba(0,212,168,0.1)" : "var(--bg3)",
                    border: alertThreshold === t.id ? "1px solid rgba(0,212,168,0.4)" : "1px solid var(--border)",
                    color: alertThreshold === t.id ? "var(--accent)" : "var(--text2)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div className="field">
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Mail size={12} /> Destinataire des alertes
            </label>
            <input
              className="input"
              type="email"
              value={alertRecipient}
              onChange={(e) => setAlertRecipient(e.target.value)}
              placeholder="vous@domaine.com"
            />
          </div>

          {testMsg && (
            <div style={{
              padding: "8px 12px", borderRadius: 7, fontSize: 12,
              background: testMsg.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${testMsg.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              color: testMsg.ok ? "var(--ok)" : "var(--danger)",
            }}>
              {testMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Save button + feedback */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ gap: 8 }}
        >
          {saving ? <><span className="spinner" /> Sauvegarde…</> : <><Save size={15} /> Sauvegarder</>}
        </button>
        {saveMsg && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 13,
            color: saveMsg.ok ? "var(--ok)" : "var(--danger)",
          }}>
            {saveMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {saveMsg.text}
          </div>
        )}
      </div>

      {/* ── Run history ── */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <History size={15} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Historique des analyses</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>
            {history.length} exécution{history.length !== 1 ? "s" : ""}
          </span>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", fontSize: 13, color: "var(--text3)" }}>
            Aucune analyse effectuée
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="obs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Déclencheur</th>
                  <th>Score</th>
                  <th>À jour</th>
                  <th>Critique</th>
                  <th>Haute</th>
                  <th>Alerte</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={run.id}>
                    <td style={{ fontSize: 12, color: "var(--text2)", whiteSpace: "nowrap" }}>
                      {new Date(run.started_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontFamily: "var(--mono)",
                        color: run.triggered_by === "scheduled" ? "var(--accent2)" : "var(--text3)",
                      }}>
                        {run.triggered_by === "scheduled" ? "planifiée" : "manuelle"}
                      </span>
                    </td>
                    <td><ScoreChip score={run.health_score} /></td>
                    <td className="obs-td-mono" style={{ color: run.deps_outdated > 0 ? "var(--warn)" : "var(--text3)" }}>
                      {run.deps_outdated ?? "—"}
                    </td>
                    <td className="obs-td-mono" style={{ color: run.vulns_critical > 0 ? "var(--danger)" : "var(--text3)" }}>
                      {run.vulns_critical ?? "—"}
                    </td>
                    <td className="obs-td-mono" style={{ color: run.vulns_high > 0 ? "var(--warn)" : "var(--text3)" }}>
                      {run.vulns_high ?? "—"}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {run.alert_sent
                        ? <span style={{ color: "var(--ok)" }}>✓ Envoyée</span>
                        : <span style={{ color: "var(--text3)" }}>—</span>
                      }
                    </td>
                    <td><StatusBadge status={run.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
