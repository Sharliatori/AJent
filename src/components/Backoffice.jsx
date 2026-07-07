import { useState, useEffect, useCallback } from "react";
import { selfAnalyzeService } from "../lib/selfAnalyzeService";
import { smtpService } from "../lib/supabase";
import AnalysisTab from "./backoffice/AnalysisTab";
import PromptTab from "./backoffice/PromptTab";
import ScheduleTab from "./backoffice/ScheduleTab";
import pkgJson from "../../package.json";
import "../App.css";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const SESSION_KEY = "lutecia_bo_session";
const SESSION_HOURS = 8;
const E = btoa("nicolas.sinou@lutecia.ai");
const P = btoa("Liamsanz2018!");

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.expiry) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

function setSession(email) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    email,
    expiry: Date.now() + SESSION_HOURS * 3600 * 1000,
  }));
}

function isValidCredentials(email, password) {
  return btoa(email.trim()) === E && btoa(password) === P;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    if (isValidCredentials(email, password)) {
      setSession(email.trim());
      onLogin(email.trim());
    } else {
      setError("Identifiants incorrects. Vérifiez votre email et mot de passe.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ color: "var(--accent)", fontSize: 28 }}>◈</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text)" }}>Lutec<span style={{ color: "var(--accent)" }}>.IA</span></span>
            <div style={{
              padding: "2px 10px", borderRadius: 4,
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
              color: "#F59E0B", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>Backoffice</div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>Accès restreint — surveillance technique interne</p>
        </div>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "32px 28px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="field">
              <label className="label">Adresse email</label>
              <input className="input" type="email" placeholder="vous@domaine.com" value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </div>
            <div className="field">
              <label className="label">Mot de passe</label>
              <div style={{ position: "relative" }}>
                <input className="input" type={showPass ? "text" : "password"} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} tabIndex={-1}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 4, fontSize: 12 }}>
                  {showPass ? "Masquer" : "Voir"}
                </button>
              </div>
            </div>
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "var(--danger)" }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading || !email || !password}
              style={{ width: "100%", justifyContent: "center", padding: "11px 16px", fontSize: 14, marginTop: 4 }}>
              {loading ? <><span className="spinner" /> Connexion…</> : "Se connecter"}
            </button>
          </form>
        </div>
        <p style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>
          Session active pendant {SESSION_HOURS}h · Lutecia Monitoring
        </p>
      </div>
    </div>
  );
}

// ─── Backoffice App ───────────────────────────────────────────────────────────

const TABS = [
  { id: "analysis", label: "Analyse" },
  { id: "prompt", label: "Prompt bolt.new" },
  { id: "schedule", label: "Planification" },
];

function BackofficeApp({ session, onLogout }) {
  const [tab, setTab] = useState("analysis");
  const [analysis, setAnalysis] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // Load last analysis + SMTP status on mount
  useEffect(() => {
    async function init() {
      try {
        const [run, smtp] = await Promise.all([
          selfAnalyzeService.getLastRun(),
          smtpService.get(),
        ]);
        if (run?.raw_results) {
          setAnalysis(run.raw_results);
          setLastRun(run);
        }
        setSmtpConfigured(!!smtp?.host);
      } catch (err) {
        console.error("Backoffice init error:", err);
      }
    }
    init();
  }, []);

  const runAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
      const devPkgs = Object.keys(pkgJson.devDependencies || {});
      const result = await selfAnalyzeService.runAnalysis(allDeps, devPkgs);
      // Build raw_results shape consistent with what getLastRun returns
      const raw = {
        packages: allDeps,
        health_score: result.health_score,
        total: result.deps_total,
        outdated: result.deps_outdated,
        deprecated: result.dependencies?.filter((d) => d.is_deprecated).length ?? 0,
        dependencies: result.dependencies || [],
        vulnerabilities: result.vulnerabilities || [],
      };
      setAnalysis(raw);
      setLastRun({ completed_at: new Date().toISOString(), triggered_by: "manual" });
    } catch (err) {
      setAnalysisError(err.message);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,12,15,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "auto", padding: "0 24px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="logo">
              <span className="logo-icon">◈</span>
              <span className="logo-text">Lutec<span style={{ color: "var(--accent)" }}>.IA</span></span>
            </div>
            <div style={{
              padding: "2px 10px", borderRadius: 4,
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
              color: "#F59E0B", fontSize: 11, fontFamily: "var(--mono)",
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>Backoffice</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>{session.email}</span>
            <a href="/" style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none", padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 6 }}>
              ← App
            </a>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 14px" }} onClick={onLogout}>
              Déconnexion
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth: 1200, margin: "auto", padding: "0 24px", display: "flex", gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--sans)", fontSize: 13, fontWeight: 500,
                padding: "10px 18px",
                color: tab === t.id ? "var(--accent)" : "var(--text2)",
                borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "all 0.15s", marginBottom: -1,
              }}
            >
              {t.label}
              {t.id === "prompt" && analysis && !analysis.dependencies?.every((d) => d.update_type === "up-to-date") && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontFamily: "var(--mono)",
                  background: "rgba(245,158,11,0.15)", color: "var(--warn)",
                  padding: "1px 5px", borderRadius: 3,
                }}>
                  {analysis.outdated}
                </span>
              )}
              {t.id === "analysis" && analysis?.vulnerabilities?.length > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontFamily: "var(--mono)",
                  background: "rgba(239,68,68,0.12)", color: "var(--danger)",
                  padding: "1px 5px", borderRadius: 3,
                }}>
                  {analysis.vulnerabilities.filter((v) => v.severity === "critical").length} crit.
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1200, margin: "auto", padding: "32px 24px" }}>
        {analysisError && (
          <div style={{
            marginBottom: 20, padding: "12px 16px", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            fontSize: 13, color: "var(--danger)",
          }}>
            Erreur d'analyse : {analysisError}
          </div>
        )}

        {tab === "analysis" && (
          <AnalysisTab
            analysis={analysis}
            lastRun={lastRun}
            loading={analysisLoading}
            onRunAnalysis={runAnalysis}
          />
        )}
        {tab === "prompt" && (
          <PromptTab analysis={analysis} />
        )}
        {tab === "schedule" && (
          <ScheduleTab smtpConfigured={smtpConfigured} />
        )}
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Backoffice() {
  const [session, setSession] = useState(() => getSession());

  const handleLogin = (email) => {
    setSession({ email, expiry: Date.now() + SESSION_HOURS * 3600 * 1000 });
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (!session) return <LoginScreen onLogin={handleLogin} />;
  return <BackofficeApp session={session} onLogout={handleLogout} />;
}
