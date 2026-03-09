import React, { useState } from "react";
import { Link2, Check, Loader2, X } from "lucide-react";
import { analyzedProjectsService } from "../../lib/obsolescenceService";

export default function WebhookUrlEditor({ project, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.webhook_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const trimmed = value.trim();
    if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
      setError("URL invalide");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await analyzedProjectsService.update(project.id, {
        webhook_url: trimmed || null,
      });
      setEditing(false);
      if (onUpdated) onUpdated({ ...project, webhook_url: trimmed || null });
    } catch (err) {
      setError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setValue(project.webhook_url || "");
    setError("");
    setEditing(false);
  }

  return (
    <div className="obs-webhook-editor">
      <div className="obs-webhook-editor-header">
        <Link2 size={16} />
        <span>Webhook d'analyse</span>
      </div>

      {!editing ? (
        <div className="obs-webhook-editor-display">
          {project.webhook_url ? (
            <code className="obs-snippet-value" style={{ flex: 1 }}>
              {project.webhook_url}
            </code>
          ) : (
            <span className="obs-webhook-none">Aucun webhook configure</span>
          )}
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>
            {project.webhook_url ? "Modifier" : "Configurer"}
          </button>
        </div>
      ) : (
        <div className="obs-webhook-editor-form">
          <input
            className="input"
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://mon-app.netlify.app/.netlify/functions/trigger-analysis"
          />
          {error && <div className="obs-form-error">{error}</div>}
          <div className="obs-webhook-editor-actions">
            <button className="btn btn-ghost" onClick={handleCancel} disabled={saving}>
              <X size={14} />
              Annuler
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="spinner-icon" /> : <Check size={14} />}
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
          <span className="obs-field-hint">
            URL de la Netlify Function cote application qui declenche l'analyse.
            Laissez vide pour desactiver le declenchement a distance.
          </span>
        </div>
      )}
    </div>
  );
}
