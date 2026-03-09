import React, { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function IntegrationSnippet({ apiKey, projectName }) {
  const [copiedField, setCopiedField] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const apiUrl = `${SUPABASE_URL}/functions/v1/receive-analysis`;

  const envVars = [
    { key: "ANALYZER_API_URL", value: apiUrl, label: "URL de l'API" },
    { key: "ANALYZER_API_KEY", value: apiKey, label: "Cle API" },
    { key: "ANALYZER_PROJECT_NAME", value: projectName, label: "Nom du projet" },
  ];

  const fullEnvBlock = envVars
    .map((v) => `${v.key}=${v.value}`)
    .join("\n");

  async function handleCopyField(key, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* noop */
    }
  }

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(fullEnvBlock);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="obs-snippet">
      <div className="obs-snippet-header">
        <Terminal size={16} />
        <span>Variables d'environnement</span>
        <button
          className="btn btn-secondary obs-snippet-copy-all"
          onClick={handleCopyAll}
        >
          {copiedAll ? <Check size={13} /> : <Copy size={13} />}
          {copiedAll ? "Copie !" : "Tout copier"}
        </button>
      </div>

      <div className="obs-snippet-hint">
        Ajoutez ces variables dans le fichier <code>.env</code> de votre application cliente :
      </div>

      <div className="obs-snippet-vars">
        {envVars.map((v) => (
          <div key={v.key} className="obs-snippet-row">
            <div className="obs-snippet-label">{v.label}</div>
            <div className="obs-snippet-value-row">
              <code className="obs-snippet-value">
                <span className="obs-snippet-key">{v.key}</span>=<span className="obs-snippet-val">{v.value}</span>
              </code>
              <button
                className="obs-snippet-copy-btn"
                onClick={() => handleCopyField(v.key, v.value)}
                title="Copier la valeur"
              >
                {copiedField === v.key ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="obs-snippet-footer">
        Le module embarque dans votre application utilisera ces variables pour
        envoyer automatiquement ses rapports d'analyse a AJent.
      </div>
    </div>
  );
}
