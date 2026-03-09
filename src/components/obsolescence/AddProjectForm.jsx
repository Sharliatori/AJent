import React, { useState } from "react";
import { Plus, Copy, Check, X, Loader2 } from "lucide-react";
import { analyzedProjectsService } from "../../lib/obsolescenceService";
import IntegrationSnippet from "./IntegrationSnippet";

export default function AddProjectForm({ onClose, onProjectCreated }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const data = await analyzedProjectsService.register(name.trim(), url.trim(), webhookUrl.trim());
      setResult(data);
      if (onProjectCreated) onProjectCreated(data);
    } catch (err) {
      setError(err.message || "Erreur lors de la creation du projet");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="card obs-add-form">
        <div className="obs-add-form-header">
          <h3>Projet cree avec succes</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <IntegrationSnippet
          apiKey={result.api_key}
          projectName={result.project_name}
        />

        <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 4 }}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <form className="card obs-add-form" onSubmit={handleSubmit}>
      <div className="obs-add-form-header">
        <h3>Ajouter un projet</h3>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {error && <div className="obs-form-error">{error}</div>}

      <div className="field">
        <label className="label">Nom du projet *</label>
        <input
          className="input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mon application web"
          required
        />
      </div>

      <div className="field">
        <label className="label">URL du projet (optionnel)</label>
        <input
          className="input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://mon-app.netlify.app"
        />
      </div>

      <div className="field">
        <label className="label">URL Webhook d'analyse (optionnel)</label>
        <input
          className="input"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://mon-app.netlify.app/.netlify/functions/analyze-trigger"
        />
        <span className="obs-field-hint">
          Permet de lancer une analyse a distance depuis le dashboard
        </span>
      </div>

      <div className="obs-add-form-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
          {loading ? <Loader2 size={16} className="spinner-icon" /> : <Plus size={16} />}
          {loading ? "Creation..." : "Creer le projet"}
        </button>
      </div>
    </form>
  );
}
