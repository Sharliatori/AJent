# Composant Obsolescence — Guide de réutilisation standard

## Version: 2026-7-0

Ce document est un guide autonome pour intégrer le module de surveillance d'obsolescence sur **n'importe quel projet**. Il contient tout le nécessaire : schéma de base de données, edge functions, composants React, et snippet d'intégration côté site client.

---

## Vue d'ensemble du système

```
Votre site (ex: site Next.js)          Dashboard Lutecia (ce projet)
        │                                         │
        │  1. Analyse des dépendances              │
        │  2. POST /functions/v1/receive-analysis  │
        │     Authorization: Bearer ak_xxxxx       │
        └─────────────────────────────────────────►│
                                                   │  3. Stockage en base
                                                   │  4. Affichage dans backoffice
                                                   │     /backoffice (obsolescence)
```

Le flux en détail :
1. Le site client exécute un analyseur de dépendances (npm audit, outdated, etc.)
2. Il envoie le rapport à l'edge function `receive-analysis` avec sa clé API
3. Le dashboard stocke le rapport et met à jour le score du projet
4. Le backoffice Lutecia affiche les dépendances, vulnérabilités et historique de score

---

## 1. Base de données — Migrations Supabase

Appliquer ces deux migrations dans l'ordre.

### Migration 1 : Schéma principal

```sql
/*
# Obsolescence Monitoring Schema

1. Tables créées
- analyzed_projects : registre des projets connectés
- analysis_reports : rapports d'analyse avec score global
- dependency_snapshots : état des dépendances par rapport
- vulnerability_findings : vulnérabilités CVE par rapport

2. Sécurité
- RLS activé sur toutes les tables
- Politiques anon+authenticated (app sans auth)
*/

CREATE TABLE IF NOT EXISTS analyzed_projects (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name     text        NOT NULL,
  project_url      text,
  api_key          text        NOT NULL UNIQUE,
  framework        text,
  last_health_score integer,
  last_analysis_at timestamptz,
  is_active        boolean     NOT NULL DEFAULT true,
  webhook_url      text,
  last_trigger_at  timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_reports (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES analyzed_projects(id) ON DELETE CASCADE,
  health_score        integer     NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  total_dependencies  integer     NOT NULL DEFAULT 0,
  outdated_count      integer     NOT NULL DEFAULT 0,
  vulnerable_count    integer     NOT NULL DEFAULT 0,
  deprecated_count    integer     NOT NULL DEFAULT 0,
  raw_data            jsonb,
  analyzed_at         timestamptz NOT NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dependency_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid        NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
  package_name    text        NOT NULL,
  current_version text        NOT NULL,
  latest_version  text        NOT NULL,
  latest_patch    text,
  latest_minor    text,
  update_type     text        NOT NULL CHECK (update_type IN ('patch','minor','major','up-to-date')),
  is_deprecated   boolean     NOT NULL DEFAULT false,
  days_behind     integer     NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vulnerability_findings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid        NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
  package_name     text        NOT NULL,
  cve_id           text,
  severity         text        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description      text,
  fixed_in_version text,
  source_url       text,
  created_at       timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_analysis_reports_project ON analysis_reports(project_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dep_snapshots_report ON dependency_snapshots(report_id);
CREATE INDEX IF NOT EXISTS idx_vuln_findings_report ON vulnerability_findings(report_id, severity);
CREATE INDEX IF NOT EXISTS idx_analyzed_projects_api_key ON analyzed_projects(api_key);

-- RLS
ALTER TABLE analyzed_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerability_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_analyzed_projects"      ON analyzed_projects;
DROP POLICY IF EXISTS "anon_insert_analyzed_projects"      ON analyzed_projects;
DROP POLICY IF EXISTS "anon_update_analyzed_projects"      ON analyzed_projects;
DROP POLICY IF EXISTS "anon_delete_analyzed_projects"      ON analyzed_projects;
DROP POLICY IF EXISTS "anon_select_analysis_reports"       ON analysis_reports;
DROP POLICY IF EXISTS "anon_insert_analysis_reports"       ON analysis_reports;
DROP POLICY IF EXISTS "anon_select_dependency_snapshots"   ON dependency_snapshots;
DROP POLICY IF EXISTS "anon_insert_dependency_snapshots"   ON dependency_snapshots;
DROP POLICY IF EXISTS "anon_select_vulnerability_findings" ON vulnerability_findings;
DROP POLICY IF EXISTS "anon_insert_vulnerability_findings" ON vulnerability_findings;

CREATE POLICY "anon_select_analyzed_projects"      ON analyzed_projects     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_analyzed_projects"      ON analyzed_projects     FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_analyzed_projects"      ON analyzed_projects     FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_analyzed_projects"      ON analyzed_projects     FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "anon_select_analysis_reports"       ON analysis_reports      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_analysis_reports"       ON analysis_reports      FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_select_dependency_snapshots"   ON dependency_snapshots  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_dependency_snapshots"   ON dependency_snapshots  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_select_vulnerability_findings" ON vulnerability_findings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_vulnerability_findings" ON vulnerability_findings FOR INSERT TO anon, authenticated WITH CHECK (true);
```

---

## 2. Edge Functions Supabase (Deno)

Déployer avec `mcp__supabase__deploy_edge_function`. Toutes les fonctions utilisent `verify_jwt: true`.

### 2.1 `register-project`

Crée un nouveau projet et génère sa clé API (`ak_` + 32 chars aléatoires).

```typescript
// supabase/functions/register-project/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { project_name, project_url, webhook_url } = await req.json();
    if (!project_name?.trim()) {
      return new Response(JSON.stringify({ error: "project_name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = "ak_" + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, "0")).join("");
    const { data, error } = await supabase.from("analyzed_projects").insert({
      project_name: project_name.trim(), project_url: project_url || null,
      webhook_url: webhook_url || null, api_key: apiKey,
    }).select().single();
    if (error) throw error;
    return new Response(JSON.stringify({ project: data, api_key: apiKey }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
```

### 2.2 `receive-analysis`

Reçoit un rapport d'analyse depuis un site client via sa clé API. **C'est l'endpoint que le site client appelle.**

```typescript
// supabase/functions/receive-analysis/index.ts
// (voir le code complet dans supabase/functions/receive-analysis/index.ts de ce projet)
// Endpoint: POST /functions/v1/receive-analysis
// Header: Authorization: Bearer ak_xxxxx
// Body: AnalysisPayload (voir schéma ci-dessous)
```

**Schéma du payload attendu :**

```typescript
interface AnalysisPayload {
  health_score: number;         // 0–100
  total_dependencies: number;
  outdated_count: number;
  vulnerable_count: number;
  deprecated_count: number;
  framework?: string;            // ex: "Next.js", "Laravel"
  analyzed_at: string;           // ISO 8601 : "2026-07-02T10:00:00.000Z"
  dependencies: {
    package_name: string;
    current_version: string;
    latest_version: string;
    latest_patch?: string;
    latest_minor?: string;
    update_type: "patch" | "minor" | "major" | "up-to-date";
    is_deprecated?: boolean;
    days_behind?: number;
  }[];
  vulnerabilities: {
    package_name: string;
    cve_id?: string;
    severity: "low" | "medium" | "high" | "critical";
    description?: string;
    fixed_in_version?: string;
    source_url?: string;
  }[];
}
```

**Réponse :** `{ "success": true, "report_id": "uuid" }`

### 2.3 `trigger-analysis`

Déclenche une analyse sur le site client via son webhook URL. Protégé par un cooldown de 60 secondes.

```typescript
// supabase/functions/trigger-analysis/index.ts
// POST /functions/v1/trigger-analysis
// Body: { "project_id": "uuid" }
// Le dashboard envoie un POST au webhook_url configuré sur le projet
```

### 2.4 `delete-project`

Soft-delete d'un projet (is_active = false, données conservées).

```typescript
// DELETE /functions/v1/delete-project
// Body: { "project_id": "uuid" }
```

### 2.5 `get-reports`

Retourne les rapports paginés avec dépendances et vulnérabilités.

```typescript
// GET /functions/v1/get-reports?project_id=uuid&limit=10&offset=0
```

---

## 3. Service JavaScript — `obsolescenceService.js`

À copier dans `src/lib/obsolescenceService.js` :

```javascript
import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFunction(functionName, options = {}) {
  const { method = "POST", body, queryParams } = options;
  let url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  if (queryParams) url += `?${new URLSearchParams(queryParams)}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export const analyzedProjectsService = {
  getAll: () => supabase.from("analyzed_projects").select("*").eq("is_active", true).order("created_at", { ascending: false }).then(({ data, error }) => { if (error) throw error; return data || []; }),
  getById: (id) => supabase.from("analyzed_projects").select("*").eq("id", id).eq("is_active", true).maybeSingle().then(({ data, error }) => { if (error) throw error; return data; }),
  register: (name, url, webhookUrl) => callEdgeFunction("register-project", { body: { project_name: name, project_url: url || null, webhook_url: webhookUrl || null } }),
  triggerAnalysis: (id) => callEdgeFunction("trigger-analysis", { body: { project_id: id } }),
  softDelete: (id) => callEdgeFunction("delete-project", { method: "DELETE", body: { project_id: id } }),
  update: (id, updates) => supabase.from("analyzed_projects").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single().then(({ data, error }) => { if (error) throw error; return data; }),
};

export const analysisReportsService = {
  getByProject: (id, limit = 10, offset = 0) => callEdgeFunction("get-reports", { method: "GET", queryParams: { project_id: id, limit: String(limit), offset: String(offset) } }),
  getLatest: (id) => supabase.from("analysis_reports").select("*").eq("project_id", id).order("analyzed_at", { ascending: false }).limit(1).maybeSingle().then(({ data, error }) => { if (error) throw error; return data; }),
  getScoreHistory: (id, limit = 12) => supabase.from("analysis_reports").select("id, health_score, total_dependencies, outdated_count, vulnerable_count, deprecated_count, analyzed_at").eq("project_id", id).order("analyzed_at", { ascending: true }).limit(limit).then(({ data, error }) => { if (error) throw error; return data || []; }),
};

export const dependencySnapshotsService = {
  getByReport: (id) => supabase.from("dependency_snapshots").select("*").eq("report_id", id).order("package_name").then(({ data, error }) => { if (error) throw error; return data || []; }),
};

export const vulnerabilityFindingsService = {
  getByReport: (id) => supabase.from("vulnerability_findings").select("*").eq("report_id", id).order("severity").then(({ data, error }) => { if (error) throw error; return data || []; }),
};
```

---

## 4. Composants React (à copier)

### Arbre des composants

```
ObsolescencePanel.jsx                 ← point d'entrée principal
├── ObsolescenceDetailView.jsx        ← vue projet individuel
├── obsolescence/
│   ├── ProjectCard.jsx               ← carte de projet dans la liste
│   ├── AddProjectForm.jsx            ← formulaire d'ajout
│   ├── EmptyState.jsx                ← état vide générique
│   ├── HealthScoreGauge.jsx          ← jauge SVG circulaire
│   ├── DependencyTable.jsx           ← tableau des dépendances
│   ├── VulnerabilityTable.jsx        ← tableau des vulnérabilités CVE
│   ├── ScoreHistory.jsx              ← historique des scores
│   ├── IntegrationSnippet.jsx        ← variables d'env à copier
│   ├── WebhookUrlEditor.jsx          ← éditeur URL webhook
│   ├── SeverityBadge.jsx             ← badge de sévérité CVE
│   └── UpdateTypeBadge.jsx           ← badge type de mise à jour
```

Copier l'ensemble du dossier `src/components/obsolescence/` et les deux fichiers `ObsolescencePanel.jsx` / `ObsolescenceDetailView.jsx`.

### Prérequis CSS

Les composants utilisent des classes CSS préfixées `.obs-*` et `.gauge-*`. Copier le bloc CSS du fichier `App.css` de la ligne `/* ─── Obsolescence Module */` jusqu'à la fin du bloc (avant les media queries).

### Variables CSS requises

Les composants utilisent ces CSS custom properties (définies dans `:root`) :

```css
:root {
  --bg: #0a0c0f;
  --bg2: #10141a;
  --bg3: #161c24;
  --border: #1e2730;
  --border2: #2a3442;
  --text: #e8edf2;
  --text2: #8494a6;
  --text3: #4a5a6a;
  --accent: #00d4a8;
  --accent2: #0099ff;
  --warn: #f59e0b;
  --danger: #ef4444;
  --ok: #10b981;
  --mono: 'Space Mono', monospace;
  --sans: 'DM Sans', sans-serif;
}
```

---

## 5. Intégration côté site client

### 5.1 Enregistrer le projet dans le dashboard

Depuis le backoffice Lutecia (`/backoffice`) → cliquer **"Ajouter un projet"** → renseigner le nom, URL et webhook optionnel → récupérer la **clé API** (`ak_xxxxx`).

### 5.2 Variables d'environnement sur le site client

```bash
ANALYZER_API_URL=https://<project-ref>.supabase.co/functions/v1/receive-analysis
ANALYZER_API_KEY=ak_xxxxx
ANALYZER_PROJECT_NAME=Mon Site
```

### 5.3 Snippet d'analyse — Node.js / npm (exemple complet)

Copier ce script dans votre projet client, ex : `scripts/analyze-deps.mjs`

```javascript
#!/usr/bin/env node
// scripts/analyze-deps.mjs
// Lancer avec: node scripts/analyze-deps.mjs
// Ou ajouter dans package.json scripts: "analyze": "node scripts/analyze-deps.mjs"

import { execSync } from "child_process";
import { readFileSync } from "fs";

const API_URL = process.env.ANALYZER_API_URL;
const API_KEY = process.env.ANALYZER_API_KEY;

if (!API_URL || !API_KEY) {
  console.error("ANALYZER_API_URL and ANALYZER_API_KEY are required");
  process.exit(1);
}

function getOutdated() {
  try {
    const out = execSync("npm outdated --json", { encoding: "utf8" });
    return JSON.parse(out || "{}");
  } catch (e) {
    // npm outdated exits with code 1 when packages are outdated
    try { return JSON.parse(e.stdout || "{}"); } catch { return {}; }
  }
}

function getAudit() {
  try {
    const out = execSync("npm audit --json", { encoding: "utf8" });
    return JSON.parse(out || "{}");
  } catch (e) {
    try { return JSON.parse(e.stdout || "{}"); } catch { return {}; }
  }
}

function getUpdateType(current, latest) {
  if (current === latest) return "up-to-date";
  const [cM, cm, cp] = current.replace(/^[\^~]/, "").split(".").map(Number);
  const [lM, lm, lp] = latest.split(".").map(Number);
  if (lM > cM) return "major";
  if (lM === cM && lm > cm) return "minor";
  return "patch";
}

function computeHealthScore(total, outdated, vulnerable, deprecated) {
  if (total === 0) return 100;
  let score = 100;
  score -= Math.round((outdated / total) * 30);
  score -= Math.round((vulnerable / total) * 40);
  score -= Math.round((deprecated / total) * 20);
  return Math.max(0, Math.min(100, score));
}

async function main() {
  console.log("Analyzing dependencies...");

  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const outdatedMap = getOutdated();
  const audit = getAudit();

  const dependencies = Object.entries(allDeps).map(([name, version]) => {
    const o = outdatedMap[name];
    const current = version.replace(/^[\^~]/, "");
    const latest = o?.latest || current;
    return {
      package_name: name,
      current_version: current,
      latest_version: latest,
      latest_patch: o?.wanted || null,
      update_type: getUpdateType(current, latest),
      is_deprecated: false,
      days_behind: 0,
    };
  });

  const vulnMap = audit?.vulnerabilities || {};
  const vulnerabilities = Object.entries(vulnMap).map(([pkg, v]) => ({
    package_name: pkg,
    severity: v.severity || "medium",
    description: v.title || v.description || null,
    cve_id: v.cves?.[0] || null,
    fixed_in_version: v.fixAvailable?.version || null,
  }));

  const outdated_count = dependencies.filter(d => d.update_type !== "up-to-date").length;
  const vulnerable_count = vulnerabilities.length;
  const deprecated_count = dependencies.filter(d => d.is_deprecated).length;

  const payload = {
    health_score: computeHealthScore(dependencies.length, outdated_count, vulnerable_count, deprecated_count),
    total_dependencies: dependencies.length,
    outdated_count,
    vulnerable_count,
    deprecated_count,
    framework: pkg.dependencies?.next ? "Next.js" : pkg.dependencies?.react ? "React" : "Node.js",
    analyzed_at: new Date().toISOString(),
    dependencies,
    vulnerabilities,
  };

  console.log(`Score: ${payload.health_score}/100 | ${dependencies.length} deps | ${outdated_count} outdated | ${vulnerable_count} vuln`);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("API error:", data);
    process.exit(1);
  }
  console.log("Report sent successfully. ID:", data.report_id);
}

main().catch(console.error);
```

### 5.4 Intégration PHP / Composer (exemple)

```php
<?php
// scripts/analyze-deps.php
// Lancer avec: php scripts/analyze-deps.php

$apiUrl = getenv('ANALYZER_API_URL');
$apiKey = getenv('ANALYZER_API_KEY');

$outdated = json_decode(shell_exec('composer outdated --format=json 2>/dev/null'), true) ?? [];
$audit = json_decode(shell_exec('composer audit --format=json 2>/dev/null'), true) ?? [];

$packages = $outdated['installed'] ?? [];
$dependencies = array_map(fn($p) => [
    'package_name'    => $p['name'],
    'current_version' => $p['version'],
    'latest_version'  => $p['latest'] ?? $p['version'],
    'update_type'     => ($p['latest-status'] ?? 'up-to-date') === 'up-to-date' ? 'up-to-date' : 'major',
    'is_deprecated'   => false,
    'days_behind'     => 0,
], $packages);

$vulnerabilities = array_map(fn($v) => [
    'package_name' => $v['packageName'],
    'severity'     => strtolower($v['severity'] ?? 'medium'),
    'description'  => $v['title'] ?? null,
    'cve_id'       => $v['cve'] ?? null,
], $audit['advisories'] ?? []);

$outdatedCount = count(array_filter($dependencies, fn($d) => $d['update_type'] !== 'up-to-date'));
$vulnCount = count($vulnerabilities);
$total = count($dependencies);
$score = max(0, min(100, 100 - round(($outdatedCount / max(1, $total)) * 30) - round(($vulnCount / max(1, $total)) * 40)));

$payload = [
    'health_score'       => $score,
    'total_dependencies' => $total,
    'outdated_count'     => $outdatedCount,
    'vulnerable_count'   => $vulnCount,
    'deprecated_count'   => 0,
    'framework'          => 'PHP/Composer',
    'analyzed_at'        => date('c'),
    'dependencies'       => $dependencies,
    'vulnerabilities'    => $vulnerabilities,
];

$ch = curl_init($apiUrl);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ["Content-Type: application/json", "Authorization: Bearer $apiKey"],
    CURLOPT_POSTFIELDS     => json_encode($payload),
]);
$response = json_decode(curl_exec($ch), true);
echo $response['success'] ? "OK: " . $response['report_id'] : "Error: " . $response['error'];
```

### 5.5 Automatisation CI/CD (GitHub Actions)

```yaml
# .github/workflows/analyze-deps.yml
name: Dependency Analysis
on:
  schedule:
    - cron: '0 8 * * 1'   # Chaque lundi à 8H UTC
  workflow_dispatch:

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: node scripts/analyze-deps.mjs
        env:
          ANALYZER_API_URL: ${{ secrets.ANALYZER_API_URL }}
          ANALYZER_API_KEY: ${{ secrets.ANALYZER_API_KEY }}
```

---

## 6. Système de webhook (analyse à la demande)

Si vous souhaitez déclencher une analyse depuis le dashboard Lutecia (bouton "Analyser maintenant") :

1. Créer un endpoint sur votre serveur, ex : `POST /api/ajent-webhook`
2. Renseigner l'URL de ce webhook lors de la création du projet dans le backoffice
3. Quand le dashboard appelle ce webhook, il envoie :

```json
{
  "action": "trigger_analysis",
  "project_id": "uuid",
  "project_name": "Mon Site",
  "api_key": "ak_xxxxx",
  "callback_url": "https://<ref>.supabase.co/functions/v1/receive-analysis"
}
```

4. Votre endpoint doit lancer l'analyse et appeler le `callback_url` avec le rapport.

---

## 7. Checklist d'intégration rapide

- [ ] Appliquer la migration SQL (section 1)
- [ ] Déployer les 5 edge functions (section 2)
- [ ] Copier `obsolescenceService.js` dans `src/lib/` (section 3)
- [ ] Copier les composants React et CSS (section 4)
- [ ] Ajouter `ObsolescencePanel` dans votre backoffice protégé
- [ ] Créer le projet dans le backoffice → récupérer la clé API
- [ ] Configurer les 3 variables d'env sur le site client (section 5.2)
- [ ] Lancer le script d'analyse manuellement pour tester
- [ ] Mettre en place l'automatisation CI/CD (section 5.5)
