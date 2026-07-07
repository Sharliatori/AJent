import React, { useState, useMemo } from "react";
import { Copy, Check, ExternalLink, Zap, Shield, TrendingUp, Wrench } from "lucide-react";

// ─── Migration guides for known major version bumps ───────────────────────────

const MIGRATION_GUIDES = {
  react: {
    "19": `**Étape 1 — Mettre à jour les packages**
\`\`\`bash
npm install react@19 react-dom@19 @types/react@^19 @types/react-dom@^19
\`\`\`
**Étape 2 — Migrer le code**
- \`forwardRef()\` est obsolète : les refs passent maintenant directement dans les props
- Supprimer les imports de \`React\` non nécessaires (JSX transform automatique)
- Vérifier la compatibilité de lucide-react avec React 19
- Corriger les erreurs TypeScript : \`npm run typecheck\`

**Étape 3 — Vérification**
\`\`\`bash
npm run build && npm run typecheck
\`\`\``,
  },
  "react-dom": {
    "19": `Mettre à jour en même temps que \`react\` (voir ci-dessus). Même commande.`,
  },
  tailwindcss: {
    "4": `**Étape 1 — Migration automatique**
\`\`\`bash
npm install tailwindcss@4 @tailwindcss/postcss
npx @tailwindcss/upgrade
\`\`\`
**Étape 2 — Adapter \`postcss.config.js\`**
\`\`\`js
export default { plugins: { "@tailwindcss/postcss": {} } }
\`\`\`
**Étape 3 — Remplacer \`tailwind.config.js\`**
La config CSS-first remplace le fichier JS. Ajouter dans \`src/index.css\` :
\`\`\`css
@import "tailwindcss";
\`\`\`
**Étape 4 — Vérification et corrections manuelles**
\`\`\`bash
npm run build
\`\`\`
Corriger les classes renommées (consulter le guide de migration officiel).`,
  },
  vite: {
    "6": `**Étape 1 — Mettre à jour Vite et ses plugins**
\`\`\`bash
npm install vite@6 @vitejs/plugin-react@latest
\`\`\`
**Étape 2 — Vérifier \`vite.config.ts\`**
- Nouvelle Environment API disponible (optionnel)
- Vérifier la compatibilité des plugins tiers
- Certains comportements CJS ont changé

**Étape 3 — Vérification**
\`\`\`bash
npm run build && npm run dev
\`\`\``,
  },
  typescript: {
    "6": `**Étape 1 — Mettre à jour TypeScript**
\`\`\`bash
npm install typescript@6 typescript-eslint@latest
\`\`\`
**Étape 2 — Vérifier les erreurs de type**
\`\`\`bash
npm run typecheck
\`\`\`
Corriger les nouvelles erreurs strictes (narrowing renforcé, types utilitaires modifiés).`,
  },
  eslint: {
    "10": `**Mise à jour mineure — format flat config maintenu**
\`\`\`bash
npm install eslint@10 @eslint/js@10
\`\`\`
Vérifier \`eslint.config.js\` — peu de changements attendus depuis v9.`,
  },
};

function getMigrationGuide(name, currentMajor, latestMajor) {
  const guide = MIGRATION_GUIDES[name]?.[String(latestMajor)];
  return guide || null;
}

// ─── Prompt generator ─────────────────────────────────────────────────────────

function generatePrompt(analysis, scope) {
  if (!analysis) return "";
  const { dependencies = [], vulnerabilities = [], health_score, total, outdated } = analysis;

  const vulnPkgSet = new Set(vulnerabilities.map((v) => v.package_name));

  let filtered = dependencies;
  if (scope === "security") filtered = dependencies.filter((d) => vulnPkgSet.has(d.name));
  else if (scope === "major") filtered = dependencies.filter((d) => d.update_type === "major");
  else if (scope === "patch") filtered = dependencies.filter((d) => ["patch", "minor"].includes(d.update_type));

  // Security packages that need a major version bump require full migration guidance in P1
  const securityMajors = filtered.filter((d) => vulnPkgSet.has(d.name) && d.update_type === "major");
  const securityNonMajors = filtered.filter((d) => vulnPkgSet.has(d.name) && d.update_type !== "up-to-date" && d.update_type !== "major");
  const patches = filtered.filter((d) => d.update_type === "patch" && !vulnPkgSet.has(d.name));
  const minors = filtered.filter((d) => d.update_type === "minor" && !vulnPkgSet.has(d.name));
  // Exclude packages already covered in P1 (security majors) from P4
  const securityMajorNames = new Set(securityMajors.map((d) => d.name));
  const majors = filtered.filter((d) => d.update_type === "major" && !securityMajorNames.has(d.name));

  const criticalVulns = vulnerabilities.filter((v) => v.severity === "critical");
  const highVulns = vulnerabilities.filter((v) => v.severity === "high");

  let lines = [];

  lines.push(`# Mise à jour des dépendances — Lutecia Dashboard`);
  lines.push(``);
  lines.push(`## Contexte du projet`);
  lines.push(`- **Framework**: React 18 + Vite 5 + TypeScript`);
  lines.push(`- **Runtime**: Navigateur (SPA) + Supabase Edge Functions (Deno)`);
  lines.push(`- **Score de santé actuel**: ${health_score}/100`);
  lines.push(`- **Total**: ${total} dépendances, ${outdated} à mettre à jour`);
  if (vulnerabilities.length > 0) {
    lines.push(`- **Vulnérabilités**: ${criticalVulns.length} critiques, ${highVulns.length} hautes, ${vulnerabilities.filter((v) => v.severity === "medium").length} moyennes`);
  }
  lines.push(``);

  const hasSecuritySection = securityNonMajors.length > 0 || securityMajors.length > 0 || vulnerabilities.length > 0;
  if (hasSecuritySection) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## PRIORITÉ 1 — Corrections de sécurité (appliquer immédiatement)`);
    lines.push(``);

    if (vulnerabilities.length > 0) {
      lines.push(`### Vulnérabilités détectées`);
      lines.push(``);
      vulnerabilities.forEach((v) => {
        const sev = v.severity.toUpperCase();
        const isMajorFix = securityMajorNames.has(v.package_name);
        lines.push(`- **${v.package_name}** [${sev}]${isMajorFix ? " ⚠ migration majeure requise" : ""}${v.cve_id ? ` — ${v.cve_id}` : ""}`);
        if (v.summary) lines.push(`  - ${v.summary}`);
        if (v.fixed_in) lines.push(`  - Corrigé dans : \`${v.package_name}@${v.fixed_in}\``);
      });
      lines.push(``);
    }

    // Simple security fixes (patch/minor version bump)
    if (securityNonMajors.length > 0) {
      lines.push(`### Mise à jour directe (patch/minor)`);
      lines.push(``);
      lines.push(`\`\`\`bash`);
      lines.push(`npm install ${securityNonMajors.map((d) => `${d.name}@${d.latest}`).join(" ")}`);
      lines.push(`\`\`\``);
      lines.push(``);
      lines.push(`\`\`\`bash`);
      lines.push(`npm run build`);
      lines.push(`\`\`\``);
      lines.push(``);
    }

    // Security fixes requiring a major migration — show full migration plan
    if (securityMajors.length > 0) {
      lines.push(`### Migrations de sécurité (mise à jour majeure requise pour corriger la vulnérabilité)`);
      lines.push(``);
      lines.push(`> Ces packages ont des vulnérabilités qui ne sont corrigées que dans une version majeure.`);
      lines.push(`> Appliquer chaque migration séparément et vérifier le build après chaque étape.`);
      lines.push(``);
      securityMajors.forEach((d) => {
        const currentMajor = parseInt(d.current.split(".")[0] || "0");
        const latestMajor = parseInt((d.latest || "0").split(".")[0] || "0");
        const guide = getMigrationGuide(d.name, currentMajor, latestMajor);
        const pkgVulns = vulnerabilities.filter((v) => v.package_name === d.name);
        lines.push(`### \`${d.name}\` : ${d.current} → **${d.latest}** [MIGRATION REQUISE — SÉCURITÉ]`);
        lines.push(``);
        if (pkgVulns.length > 0) {
          pkgVulns.forEach((v) => {
            lines.push(`> [${v.severity.toUpperCase()}]${v.cve_id ? ` ${v.cve_id}` : ""} — ${v.summary || v.description || ""}`);
          });
          lines.push(``);
        }
        if (guide) {
          lines.push(guide);
        } else {
          lines.push(`\`\`\`bash`);
          lines.push(`npm install ${d.name}@${d.latest}`);
          lines.push(`\`\`\``);
          lines.push(`\`\`\`bash`);
          lines.push(`npm run build && npm run typecheck`);
          lines.push(`\`\`\``);
        }
        lines.push(``);
      });
    }
    lines.push(``);
  }

  if (patches.length > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## PRIORITÉ 2 — Patches (non-breaking, sans risque)`);
    lines.push(``);
    patches.forEach((d) => {
      lines.push(`- \`${d.name}\` : ${d.current} → **${d.latest}** (patch)`);
    });
    lines.push(``);
    lines.push(`\`\`\`bash`);
    lines.push(`npm install ${patches.map((d) => `${d.name}@${d.latest}`).join(" ")}`);
    lines.push(`\`\`\``);
    lines.push(``);
  }

  if (minors.length > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## PRIORITÉ 3 — Mises à jour mineures (nouvelles fonctionnalités, non-breaking)`);
    lines.push(``);
    minors.forEach((d) => {
      lines.push(`- \`${d.name}\` : ${d.current} → **${d.latest}** (minor)`);
    });
    lines.push(``);
    lines.push(`\`\`\`bash`);
    lines.push(`npm install ${minors.map((d) => `${d.name}@${d.latest}`).join(" ")}`);
    lines.push(`\`\`\``);
    lines.push(``);
    lines.push(`Vérification après mise à jour :`);
    lines.push(`\`\`\`bash`);
    lines.push(`npm run build && npm run typecheck`);
    lines.push(`\`\`\``);
    lines.push(``);
  }

  if (majors.length > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## PRIORITÉ 4 — Migrations majeures (breaking changes — traiter individuellement)`);
    lines.push(``);
    lines.push(`> Appliquer chaque migration séparément. Vérifier le build après chaque étape.`);
    lines.push(``);
    majors.forEach((d) => {
      const currentMajor = parseInt(d.current.split(".")[0] || "0");
      const latestMajor = parseInt((d.latest || "0").split(".")[0] || "0");
      const guide = getMigrationGuide(d.name, currentMajor, latestMajor);

      lines.push(`### \`${d.name}\` : ${d.current} → **${d.latest}** [MIGRATION MAJEURE]`);
      lines.push(``);
      if (guide) {
        lines.push(guide);
      } else {
        lines.push(`Mise à jour majeure — vérifier le changelog officiel pour les breaking changes.`);
        lines.push(``);
        lines.push(`**Étape 1 — Mettre à jour le package**`);
        lines.push(`\`\`\`bash`);
        lines.push(`npm install ${d.name}@${d.latest}`);
        lines.push(`\`\`\``);
        lines.push(`**Étape 2 — Corriger les erreurs de compilation**`);
        lines.push(`\`\`\`bash`);
        lines.push(`npm run build && npm run typecheck`);
        lines.push(`\`\`\``);
      }
      lines.push(``);
    });
  }

  if (filtered.length === 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`Aucune mise à jour à effectuer pour la portée sélectionnée.`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Instructions pour bolt.new`);
  lines.push(``);
  lines.push(`1. Appliquer les étapes dans l'ordre (Priorité 1 → 4)`);
  lines.push(`2. Après chaque groupe, exécuter \`npm run build\` pour vérifier`);
  lines.push(`3. Pour les migrations majeures, suivre chaque étape avant de passer à la suivante`);
  lines.push(`4. En cas d'erreur TypeScript, lancer \`npm run typecheck\` pour le détail`);
  lines.push(`5. Ne pas mélanger plusieurs migrations majeures dans le même changement`);

  return lines.join("\n");
}

// ─── Scope selector ───────────────────────────────────────────────────────────

const SCOPES = [
  { id: "all", label: "Tout mettre à jour", icon: Wrench },
  { id: "security", label: "Sécurité uniquement", icon: Shield },
  { id: "major", label: "Migrations majeures", icon: TrendingUp },
  { id: "patch", label: "Patches & mineurs", icon: Zap },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function PromptTab({ analysis }) {
  const [scope, setScope] = useState("all");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => generatePrompt(analysis, scope), [analysis, scope]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!analysis) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>◈</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
          Aucune analyse disponible
        </div>
        <div style={{ fontSize: 13, color: "var(--text3)" }}>
          Lancez une analyse depuis l'onglet "Analyse" pour générer un prompt bolt.new.
        </div>
      </div>
    );
  }

  const { dependencies = [], vulnerabilities = [] } = analysis;
  const majors = dependencies.filter((d) => d.update_type === "major").length;
  const vulns = vulnerabilities.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="section-title">Prompt bolt.new</h2>
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>
            Copiez ce prompt dans bolt.new pour lancer la mise à jour de vos dépendances
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handleCopy}
            style={{ gap: 8 }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copié !" : "Copier le prompt"}
          </button>
          <a
            href="https://bolt.new"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ gap: 8, textDecoration: "none" }}
          >
            <ExternalLink size={15} />
            Ouvrir bolt.new
          </a>
        </div>
      </div>

      {/* Info pills */}
      {(majors > 0 || vulns > 0) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {vulns > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 6,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              fontSize: 12, color: "var(--danger)",
            }}>
              <Shield size={13} />
              {vulns} vulnérabilité{vulns > 1 ? "s" : ""} détectée{vulns > 1 ? "s" : ""}
            </div>
          )}
          {majors > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 6,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
              fontSize: 12, color: "var(--warn)",
            }}>
              <TrendingUp size={13} />
              {majors} migration{majors > 1 ? "s" : ""} majeure{majors > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Scope selector */}
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "16px 20px",
      }}>
        <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Portée du prompt
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SCOPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setScope(id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s",
                background: scope === id ? "rgba(0,212,168,0.1)" : "var(--bg3)",
                border: scope === id ? "1px solid rgba(0,212,168,0.4)" : "1px solid var(--border)",
                color: scope === id ? "var(--accent)" : "var(--text2)",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt preview */}
      <div style={{
        background: "var(--bg3)", border: "1px solid var(--border2)",
        borderRadius: 10, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
        }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Prompt généré
          </span>
          <button
            className="btn btn-ghost"
            onClick={handleCopy}
            style={{ fontSize: 11, padding: "3px 10px", gap: 5 }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
        <pre style={{
          margin: 0, padding: "20px", fontFamily: "var(--mono)", fontSize: 12,
          lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap",
          wordBreak: "break-word", maxHeight: 560, overflowY: "auto",
          userSelect: "all",
        }}>
          {prompt}
        </pre>
      </div>
    </div>
  );
}
