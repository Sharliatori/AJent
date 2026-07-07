import { useState, useEffect } from "react";
import { recipientsService } from "../lib/supabase";

const ROLES = [
  { value: "owner", label: "Responsable" },
  { value: "technical", label: "Technique" },
  { value: "billing", label: "Facturation" },
];

function emptyForm() {
  return { email: "", name: "", role: "owner", client_id: null, receive_alerts: true, receive_reports: true };
}

export default function RecipientsPanel({ clients, smtpConfig }) {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    recipientsService.getAll().then(setRecipients).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError("Adresse email invalide");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        email: form.email,
        name: form.name || null,
        role: form.role,
        client_id: form.client_id || null,
        receive_alerts: form.receive_alerts,
        receive_reports: form.receive_reports,
      };
      if (editId) {
        const updated = await recipientsService.update(editId, payload);
        setRecipients(recipients.map((r) => (r.id === editId ? updated : r)));
      } else {
        const created = await recipientsService.create(payload);
        setRecipients([created, ...recipients]);
      }
      setForm(emptyForm());
      setEditId(null);
      setShowForm(false);
    } catch (err) {
      setFormError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r) => {
    setForm({
      email: r.email,
      name: r.name || "",
      role: r.role,
      client_id: r.client_id || null,
      receive_alerts: r.receive_alerts,
      receive_reports: r.receive_reports,
    });
    setEditId(r.id);
    setFormError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce destinataire ?")) return;
    try {
      await recipientsService.delete(id);
      setRecipients(recipients.filter((r) => r.id !== id));
    } catch (err) {
      alert("Erreur : " + err.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyForm());
    setEditId(null);
    setFormError(null);
    setShowForm(false);
  };

  const handleTestReport = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await recipientsService.sendReport(null);
      setTestResult({ ok: true, message: `Rapport envoyé à ${result.sent} destinataire${result.sent > 1 ? "s" : ""}` });
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  const globalRecipients = recipients.filter((r) => !r.client_id);
  const clientRecipients = clients.map((c) => ({
    client: c,
    items: recipients.filter((r) => r.client_id === c.id),
  })).filter((g) => g.items.length > 0);

  const hasSmtp = smtpConfig?.host && smtpConfig?.user;
  const clientName = (clientId) => clients.find((c) => c.id === clientId)?.name || "Inconnu";

  const Toggle = ({ checked, onChange, label }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "var(--accent)" : "var(--bg3)",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
          cursor: "pointer",
          border: "1px solid var(--border2)",
        }}
      >
        <div style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 12, color: "var(--text2)" }}>{label}</span>
    </label>
  );

  const RecipientRow = ({ r }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.email}</div>
        {r.name && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{r.name}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span className="badge" style={{ fontSize: 11, padding: "2px 8px", background: "var(--bg3)", color: "var(--text2)" }}>
          {ROLES.find((ro) => ro.value === r.role)?.label || r.role}
        </span>
        {r.receive_alerts && (
          <span className="badge badge-warn" style={{ fontSize: 11, padding: "2px 8px" }}>Alertes</span>
        )}
        {r.receive_reports && (
          <span className="badge badge-ok" style={{ fontSize: 11, padding: "2px 8px" }}>Rapports</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => handleEdit(r)}>
          Modifier
        </button>
        <button className="btn btn-danger" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => handleDelete(r.id)}>
          Suppr.
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--mono)", fontSize: 14, letterSpacing: "0.08em", color: "var(--text2)", flex: 1 }}>
          DESTINATAIRES DES RAPPORTS
        </h2>
        <button className="btn btn-secondary" onClick={handleTestReport} disabled={testLoading || !hasSmtp || recipients.length === 0}>
          {testLoading ? <><span className="spinner" /> Envoi...</> : "Envoyer rapport test"}
        </button>
        <button className="btn btn-primary" onClick={() => { handleCancel(); setShowForm(true); }}>
          + Ajouter
        </button>
      </div>

      {!hasSmtp && (
        <div className="card" style={{ marginBottom: 24, maxWidth: 700, background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.25)" }}>
          <p style={{ fontSize: 13, color: "var(--warn)", margin: 0 }}>
            ⚠ Configurez d'abord le serveur SMTP dans <strong>Paramètres</strong> pour activer l'envoi d'emails.
          </p>
        </div>
      )}

      {testResult && (
        <div className="card" style={{
          marginBottom: 24,
          maxWidth: 700,
          background: testResult.ok ? "rgba(0,212,168,0.05)" : "rgba(239,68,68,0.05)",
          borderColor: testResult.ok ? "rgba(0,212,168,0.25)" : "rgba(239,68,68,0.25)",
        }}>
          <p style={{ fontSize: 13, color: testResult.ok ? "var(--ok)" : "var(--danger)", margin: 0 }}>
            {testResult.ok ? "✓" : "✗"} {testResult.message}
          </p>
        </div>
      )}

      {/* ─── Add / Edit form ─── */}
      {showForm && (
        <div className="card" style={{ maxWidth: 700, marginBottom: 24, borderColor: "var(--accent)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
            {editId ? "Modifier le destinataire" : "Nouveau destinataire"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">Email *</label>
              <input
                className="input"
                type="email"
                placeholder="contact@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label">Nom du contact</label>
              <input
                className="input"
                placeholder="Jean Dupont"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label">Rôle</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ cursor: "pointer" }}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">Site associé</label>
              <select
                className="input"
                value={form.client_id || ""}
                onChange={(e) => setForm({ ...form, client_id: e.target.value || null })}
                style={{ cursor: "pointer" }}
              >
                <option value="">Tous les sites (destinataire global)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.domain}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                "Tous les sites" = reçoit les rapports pour l'ensemble des sites monitorés
              </p>
            </div>
            <div className="field">
              <Toggle
                checked={form.receive_alerts}
                onChange={(v) => setForm({ ...form, receive_alerts: v })}
                label="Recevoir les alertes en temps réel"
              />
            </div>
            <div className="field">
              <Toggle
                checked={form.receive_reports}
                onChange={(v) => setForm({ ...form, receive_reports: v })}
                label="Recevoir les rapports périodiques"
              />
            </div>
          </div>
          {formError && (
            <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 12 }}>Erreur : {formError}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "Enregistrement..." : editId ? "Mettre à jour" : "Ajouter"}
            </button>
            <button className="btn btn-ghost" onClick={handleCancel}>Annuler</button>
          </div>
        </div>
      )}

      {/* ─── Lists ─── */}
      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
          <span className="spinner" /> Chargement...
        </div>
      ) : recipients.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "var(--text3)", maxWidth: 700 }}>
          <div style={{ fontSize: 40, marginBottom: 16, color: "var(--accent)" }}>◈</div>
          <p style={{ fontSize: 14 }}>Aucun destinataire configuré.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            Ajoutez des adresses email pour recevoir les rapports et alertes de monitoring.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 700 }}>
          {globalRecipients.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 10 }}>
                DESTINATAIRES GLOBAUX — tous les sites ({globalRecipients.length})
              </div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {globalRecipients.map((r) => <RecipientRow key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {clientRecipients.map(({ client, items }) => (
            <div key={client.id}>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 10 }}>
                {client.name.toUpperCase()} — {client.domain} ({items.length})
              </div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {items.map((r) => <RecipientRow key={r.id} r={r} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
