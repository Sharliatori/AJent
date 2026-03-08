import React, { useState } from "react";
import { Plus, Copy, Check, X, Loader2 } from "lucide-react";
import { analyzedProjectsService } from "../../lib/obsolescenceService";

export default function AddProjectForm({ onClose, onProjectCreated }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const data = await analyzedProjectsService.register(name.trim(), url.trim());
      setResult(data);
      if (onProjectCreated) onProjectCreated(data);
    } catch (err) {
      setError(err.message || "Erreur lors de la creation du projet");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.api_key) return;
    try {
      await navigator.clipboard.writeText(result.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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
        <div className="obs-api-key-block">
          <label className="label">Cle API du projet</label>
          <div className="obs-api-key-row">
            <code className="obs-api-key-value">{result.api_key}</code>
            <button className="btn btn-secondary" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copie" : "Copier"}
            </button>
          </div>
          <p className="obs-api-key-hint">
            Conservez cette cle. Ajoutez-la dans les variables d'environnement de votre
            application sous <code>ANALYZER_API_KEY</code>.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 12 }}>
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
        <label className="label">URL (optionnel)</label>
        <input
          className="input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://mon-app.netlify.app"
        />
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
