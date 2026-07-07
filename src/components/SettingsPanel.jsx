import { useState, useEffect } from "react";
import { keepaliveService } from "../lib/supabase";

export default function SettingsPanel({ smtpConfig, onSave }) {
  const [config, setConfig] = useState({
    host: smtpConfig?.host || "",
    port: smtpConfig?.port || 587,
    user: smtpConfig?.user || "",
    pass: smtpConfig?.pass || "",
    alertTo: smtpConfig?.alertTo || "",
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Keep-alive state
  const [lastPing, setLastPing] = useState(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingError, setPingError] = useState(null);
  const [pingSuccess, setPingSuccess] = useState(false);

  useEffect(() => {
    if (smtpConfig?.host) {
      setConfig({
        host: smtpConfig.host || "",
        port: smtpConfig.port || 587,
        user: smtpConfig.user || "",
        pass: smtpConfig.pass || "",
        alertTo: smtpConfig.alertTo || "",
      });
    }
  }, [smtpConfig]);

  useEffect(() => {
    keepaliveService.getLastPing().then(setLastPing).catch(() => {});
  }, []);

  const handlePing = async () => {
    setPingLoading(true);
    setPingError(null);
    setPingSuccess(false);
    try {
      const result = await keepaliveService.ping();
      setLastPing({ pinged_at: result.pinged_at, status: "manual" });
      setPingSuccess(true);
      setTimeout(() => setPingSuccess(false), 4000);
    } catch (err) {
      setPingError(err.message || "Erreur de connexion");
    } finally {
      setPingLoading(false);
    }
  };

  const getPingAge = () => {
    if (!lastPing?.pinged_at) return null;
    const ms = Date.now() - new Date(lastPing.pinged_at).getTime();
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `il y a ${days}j ${hours}h`;
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `il y a ${hours}h ${mins}min`;
    return `il y a ${mins} min`;
  };

  const isPingHealthy = () => {
    if (!lastPing?.pinged_at) return false;
    const days = (Date.now() - new Date(lastPing.pinged_at).getTime()) / 86400000;
    return days < 4;
  };

  const handleTestSmtp = async () => {
    if (!config.host || !config.user || !config.pass) {
      setTestResult({ ok: false, message: "Remplissez le serveur, l'utilisateur et le mot de passe avant de tester.", hint: "" });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-smtp`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          user: config.user,
          pass: config.pass,
          alertTo: config.alertTo || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTestResult({ ok: true, message: `Email de test envoyé à ${data.to}` });
      } else {
        setTestResult({ ok: false, message: data.error || "Échec", hint: data.hint || "" });
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message || "Erreur réseau", hint: "" });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.host || !config.user || !config.pass) {
      alert("Veuillez remplir au minimum le serveur SMTP, l'utilisateur et le mot de passe");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Erreur inconnue lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (confirm("Supprimer la configuration SMTP ?")) {
      setSaving(true);
      setSaveError(null);
      try {
        await onSave({});
        setConfig({ host: "", port: 587, user: "", pass: "", alertTo: "" });
      } catch (err) {
        setSaveError(err.message || "Erreur lors de la suppression");
      } finally {
        setSaving(false);
      }
    }
  };

  const hasConfig = smtpConfig?.host && smtpConfig?.user;
  const pingAge = getPingAge();
  const pingHealthy = isPingHealthy();

  return (
    <div>
      {/* ─── Database health card ─── */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: "var(--mono)",
            fontSize: 14,
            letterSpacing: "0.08em",
            color: "var(--text2)",
            marginBottom: 16,
          }}
        >
          SANTE DE LA BASE DE DONNEES
        </h2>

        <div
          className="card"
          style={{
            maxWidth: 700,
            background: pingHealthy
              ? "rgba(0,212,168,0.04)"
              : lastPing
              ? "rgba(245,158,11,0.04)"
              : "rgba(99,99,110,0.04)",
            borderColor: pingHealthy
              ? "rgba(0,212,168,0.25)"
              : lastPing
              ? "rgba(245,158,11,0.25)"
              : "var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Keep-Alive automatique</h3>
                {lastPing ? (
                  <span
                    className={pingHealthy ? "badge badge-ok" : "badge badge-warn"}
                    style={{ fontSize: 11, padding: "3px 10px" }}
                  >
                    {pingHealthy ? "● Actif" : "⚠ Ancien"}
                  </span>
                ) : (
                  <span
                    className="badge"
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      background: "var(--bg3)",
                      color: "var(--text3)",
                    }}
                  >
                    Aucun ping
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
                Un job pg_cron tourne toutes les 72h pour maintenir la base active.
                {lastPing ? (
                  <>
                    {" "}Dernier ping :{" "}
                    <span style={{ color: "var(--text1)", fontFamily: "var(--mono)" }}>
                      {new Date(lastPing.pinged_at).toLocaleString("fr-FR")}
                    </span>
                    {" "}({pingAge})
                    {lastPing.status && (
                      <span style={{ color: "var(--text3)" }}> via {lastPing.status}</span>
                    )}
                  </>
                ) : (
                  " Aucun ping enregistre. Cliquez sur Tester pour initialiser."
                )}
              </p>
              {pingError && (
                <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>
                  Erreur : {pingError}
                </p>
              )}
              {pingSuccess && (
                <p style={{ fontSize: 12, color: "var(--ok)", marginTop: 6 }}>
                  Ping reussi — base de donnees operationnelle.
                </p>
              )}
            </div>
            <button
              className="btn btn-secondary"
              onClick={handlePing}
              disabled={pingLoading}
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {pingLoading ? (
                <><span className="spinner" /> Test en cours...</>
              ) : (
                "Tester la connexion"
              )}
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.06em", marginBottom: 4 }}>
                FREQUENCE
              </div>
              <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text1)" }}>
                toutes les 72h
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.06em", marginBottom: 4 }}>
                PLANIFICATEUR
              </div>
              <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text1)" }}>
                pg_cron (natif Supabase)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.06em", marginBottom: 4 }}>
                RETENTION LOGS
              </div>
              <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text1)" }}>
                30 jours
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.06em", marginBottom: 4 }}>
                SEUIL D'ALERTE
              </div>
              <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text1)" }}>
                {"> 4 jours sans ping"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SMTP section ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--mono)",
            fontSize: 14,
            letterSpacing: "0.08em",
            color: "var(--text2)",
            flex: 1,
          }}
        >
          CONFIGURATION SMTP
        </h2>
        {hasConfig && (
          <span
            className="badge badge-ok"
            style={{ fontSize: 12, padding: "4px 12px" }}
          >
            ● Configuré
          </span>
        )}
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Alertes par Email
          </h3>
          <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
            Configurez un serveur SMTP pour recevoir des alertes automatiques
            lorsqu'un site devient inaccessible, qu'un certificat SSL expire
            bientôt, ou que des problèmes DNS sont détectés.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label className="label">Serveur SMTP *</label>
            <input
              className="input"
              placeholder="smtp.gmail.com"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
            />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
              Exemples : smtp.gmail.com, smtp.office365.com, smtp.sendgrid.net
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field">
              <label className="label">Port SMTP</label>
              <input
                className="input"
                type="number"
                placeholder="587"
                value={config.port}
                onChange={(e) =>
                  setConfig({ ...config, port: parseInt(e.target.value) || 587 })
                }
              />
              <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                Par défaut : 587 (STARTTLS)
              </p>
            </div>

            <div className="field">
              <label className="label">Email / Utilisateur *</label>
              <input
                className="input"
                type="email"
                placeholder="votre-email@example.com"
                value={config.user}
                onChange={(e) => setConfig({ ...config, user: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Mot de passe SMTP *</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={config.pass}
              onChange={(e) => setConfig({ ...config, pass: e.target.value })}
            />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
              Utilisez un mot de passe d'application pour Gmail/Outlook
            </p>
          </div>

          <div className="field">
            <label className="label">Destinataire des alertes</label>
            <input
              className="input"
              type="email"
              placeholder="alertes@example.com (optionnel)"
              value={config.alertTo}
              onChange={(e) =>
                setConfig({ ...config, alertTo: e.target.value })
              }
            />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
              Si vide, les alertes seront envoyées à l'adresse utilisateur
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 24,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
          }}
        >
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : saved ? "Enregistre" : "Enregistrer"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleTestSmtp}
            disabled={testLoading || saving}
          >
            {testLoading ? <><span className="spinner" /> Test en cours...</> : "Tester"}
          </button>
          {hasConfig && (
            <button className="btn btn-danger" onClick={handleClear} disabled={saving}>
              Supprimer la configuration
            </button>
          )}
        </div>
        {testResult && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            background: testResult.ok ? "rgba(0,212,168,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${testResult.ok ? "rgba(0,212,168,0.25)" : "rgba(239,68,68,0.25)"}`,
            borderRadius: 8,
            fontSize: 13,
            color: testResult.ok ? "var(--ok)" : "var(--danger)",
          }}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.message}
            {testResult.hint && (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--warn)" }}>{testResult.hint}</div>
            )}
          </div>
        )}
        {saveError && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            color: "#ef4444",
            fontSize: 13,
          }}>
            Erreur : {saveError}
          </div>
        )}
      </div>

      {/* ─── Info panels ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 24,
          maxWidth: 700,
        }}
      >
        <div
          className="card"
          style={{
            background: "rgba(0,212,168,0.05)",
            borderColor: "rgba(0,212,168,0.2)",
          }}
        >
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Gmail
          </h4>
          <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
            • Serveur : smtp.gmail.com<br />
            • Port : 587<br />
            • Utilisez un mot de passe d'application
          </p>
        </div>
        <div
          className="card"
          style={{
            background: "rgba(0,153,255,0.05)",
            borderColor: "rgba(0,153,255,0.2)",
          }}
        >
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Outlook / Office 365
          </h4>
          <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
            • Serveur : smtp.office365.com<br />
            • Port : 587<br />
            • Email + mot de passe
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 16,
          maxWidth: 700,
          background: "rgba(245,158,11,0.05)",
          borderColor: "rgba(245,158,11,0.2)",
        }}
      >
        <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--warn)" }}>
          Note de securite
        </h4>
        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
          Les identifiants SMTP sont stockés en base de données Supabase.
          Utilisez toujours un mot de passe d'application plutôt que votre mot
          de passe principal pour plus de sécurité.
        </p>
      </div>
    </div>
  );
}
