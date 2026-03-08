import { useState, useEffect } from "react";

export default function SettingsPanel({ smtpConfig, onSave }) {
  const [config, setConfig] = useState({
    host: smtpConfig?.host || "",
    port: smtpConfig?.port || 587,
    user: smtpConfig?.user || "",
    pass: smtpConfig?.pass || "",
    alertTo: smtpConfig?.alertTo || "",
  });

  const [saved, setSaved] = useState(false);

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

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

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
        setConfig({
          host: "",
          port: 587,
          user: "",
          pass: "",
          alertTo: "",
        });
      } catch (err) {
        setSaveError(err.message || "Erreur lors de la suppression");
      } finally {
        setSaving(false);
      }
    }
  };

  const hasConfig = smtpConfig?.host && smtpConfig?.user;

  return (
    <div>
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
          {hasConfig && (
            <button className="btn btn-danger" onClick={handleClear} disabled={saving}>
              Supprimer la configuration
            </button>
          )}
        </div>
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
          ⚠ Note de sécurité
        </h4>
        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
          Les identifiants SMTP sont stockés en local dans votre navigateur.
          Utilisez toujours un mot de passe d'application plutôt que votre mot
          de passe principal pour plus de sécurité.
        </p>
      </div>
    </div>
  );
}
