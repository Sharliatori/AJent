# Module Obsolescence Lutecia -- Documentation

**Version : 2026-03-002**

## Vue d'ensemble

Le module Obsolescence est un systeme de monitoring de dependances integre a Lutecia. Il recoit les rapports d'analyse envoyes par des modules embarques dans chaque application cliente, les stocke dans Supabase, et les presente via un dashboard interactif dans l'onglet "Obsolescence".

## Architecture

```
[App 1]  [App 2]  [App N]
   |        |        |
   v        v        v
POST /functions/v1/receive-analysis (Edge Function)
   |
   v
Supabase (Tables: analyzed_projects, analysis_reports, dependency_snapshots, vulnerability_findings)
   |
   v
Dashboard Lutecia - Onglet Obsolescence (consultation des rapports)
```

## Schema de base de donnees

### analyzed_projects
Registre de tous les projets surveilles.

| Colonne            | Type         | Description                                    |
|--------------------|--------------|------------------------------------------------|
| id                 | uuid         | Identifiant unique                             |
| user_id            | uuid         | Proprietaire (ref auth.users, nullable)        |
| project_name       | text         | Nom lisible du projet                          |
| project_url        | text         | URL de production                              |
| api_key            | text         | Cle unique pour l'authentification des envois  |
| framework          | text         | Framework detecte (next, vite, etc.)           |
| webhook_url        | text         | URL du webhook pour declenchement a distance   |
| last_health_score  | integer      | Cache du dernier score                         |
| last_analysis_at   | timestamptz  | Date de la derniere analyse                    |
| last_trigger_at    | timestamptz  | Date du dernier declenchement manuel           |
| is_active          | boolean      | Actif ou soft-deleted                          |
| created_at         | timestamptz  | Date de creation                               |
| updated_at         | timestamptz  | Date de derniere modification                  |

### analysis_reports
Un enregistrement par execution d'analyse.

| Colonne              | Type         | Description                     |
|----------------------|--------------|---------------------------------|
| id                   | uuid         | Identifiant unique              |
| project_id           | uuid         | Ref vers analyzed_projects      |
| health_score         | integer      | Score de sante 0-100            |
| total_dependencies   | integer      | Nombre total de deps            |
| outdated_count       | integer      | Nombre de deps obsoletes        |
| vulnerable_count     | integer      | Nombre de deps avec CVE         |
| deprecated_count     | integer      | Nombre de deps deprecated       |
| raw_data             | jsonb        | Rapport complet en JSON         |
| analyzed_at          | timestamptz  | Date d'execution de l'analyse   |
| created_at           | timestamptz  | Date de creation                |

### dependency_snapshots
Detail de chaque dependance analysee dans un rapport.

| Colonne          | Type    | Description                              |
|------------------|---------|------------------------------------------|
| id               | uuid    | Identifiant unique                       |
| report_id        | uuid    | Ref vers analysis_reports                |
| package_name     | text    | Nom du package npm                       |
| current_version  | text    | Version utilisee                         |
| latest_version   | text    | Derniere version disponible              |
| latest_patch     | text    | Derniere version patch disponible        |
| latest_minor     | text    | Derniere version minor disponible        |
| update_type      | text    | patch / minor / major / up-to-date       |
| is_deprecated    | boolean | Package deprecie                         |
| days_behind      | integer | Jours de retard                          |
| created_at       | timestamptz | Date de creation                     |

### vulnerability_findings
Vulnerabilites de securite detectees.

| Colonne          | Type    | Description                    |
|------------------|---------|--------------------------------|
| id               | uuid    | Identifiant unique             |
| report_id        | uuid    | Ref vers analysis_reports      |
| package_name     | text    | Package concerne               |
| cve_id           | text    | Identifiant CVE                |
| severity         | text    | low / medium / high / critical |
| description      | text    | Description de la faille       |
| fixed_in_version | text    | Version qui corrige            |
| source_url       | text    | Lien vers les details          |
| created_at       | timestamptz | Date de creation           |

## Edge Functions (API)

### POST /functions/v1/receive-analysis
Point d'entree pour les modules embarques.

**Headers requis :**
- `Authorization: Bearer {api_key}`
- `Content-Type: application/json`

**Body (AnalysisPayload) :**
```json
{
  "health_score": 72,
  "total_dependencies": 45,
  "outdated_count": 12,
  "vulnerable_count": 3,
  "deprecated_count": 1,
  "framework": "vite",
  "analyzed_at": "2026-03-08T08:00:00Z",
  "dependencies": [
    {
      "package_name": "react",
      "current_version": "18.2.0",
      "latest_version": "18.3.1",
      "update_type": "minor",
      "is_deprecated": false,
      "days_behind": 120
    }
  ],
  "vulnerabilities": [
    {
      "package_name": "lodash",
      "cve_id": "CVE-2024-1234",
      "severity": "high",
      "description": "Prototype pollution",
      "fixed_in_version": "4.17.22",
      "source_url": "https://nvd.nist.gov/vuln/detail/CVE-2024-1234"
    }
  ]
}
```

**Reponses :**
- `200` : `{ "success": true, "report_id": "uuid" }`
- `401` : `{ "error": "Invalid or inactive API key" }`
- `400` : `{ "error": "Validation failed", "details": [...] }`
- `500` : `{ "error": "Internal server error" }`

### POST /functions/v1/register-project
Enregistrer un nouveau projet.

**Body :**
```json
{
  "project_name": "Mon site e-commerce",
  "project_url": "https://mon-site.netlify.app"
}
```

**Reponse 201 :**
```json
{
  "project_id": "uuid",
  "api_key": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "project_name": "Mon site e-commerce"
}
```

### GET /functions/v1/get-reports
Consulter les rapports d'un projet.

**Query params :**
- `project_id` (requis)
- `limit` (optionnel, default 10, max 100)
- `offset` (optionnel, default 0)

**Reponse 200 :**
```json
{
  "reports": [...],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

### POST /functions/v1/trigger-analysis
Declencher une analyse a distance via le webhook configure pour un projet.

**Body :**
```json
{
  "project_id": "uuid"
}
```

**Comportement :**
1. Verifie que le projet existe et est actif
2. Verifie qu'un webhook_url est configure
3. Applique un cooldown de 60 secondes entre deux declenchements
4. Envoie un POST au webhook de l'application avec :
   - Header `Authorization: Bearer {api_key}`
   - Body contenant `action`, `project_id`, `project_name`, `api_key`, `callback_url`
5. Timeout de 15 secondes sur l'appel webhook

**Reponses :**
- `200` : `{ "status": "triggered", "webhook_status": 200, "project_name": "..." }`
- `404` : Projet introuvable
- `422` : Aucun webhook configure
- `429` : Cooldown actif (attendre N secondes)
- `502` : Webhook injoignable, timeout, ou erreur HTTP

### DELETE /functions/v1/delete-project
Desactiver un projet (soft delete).

**Body :**
```json
{
  "project_id": "uuid"
}
```

**Reponse 200 :**
```json
{
  "success": true,
  "message": "Project \"Mon site\" has been deactivated"
}
```

## Composants UI

| Composant              | Fichier                                              | Description                                    |
|------------------------|------------------------------------------------------|------------------------------------------------|
| ObsolescencePanel      | src/components/ObsolescencePanel.jsx                 | Vue principale avec grille de projets          |
| ObsolescenceDetailView | src/components/ObsolescenceDetailView.jsx            | Detail d'un projet avec onglets                |
| HealthScoreGauge       | src/components/obsolescence/HealthScoreGauge.jsx     | Jauge circulaire SVG animee                    |
| SeverityBadge          | src/components/obsolescence/SeverityBadge.jsx        | Badge colore par severite                      |
| UpdateTypeBadge        | src/components/obsolescence/UpdateTypeBadge.jsx      | Badge colore par type de mise a jour           |
| ProjectCard            | src/components/obsolescence/ProjectCard.jsx          | Carte resume d'un projet                       |
| DependencyTable        | src/components/obsolescence/DependencyTable.jsx      | Tableau triable des dependances                |
| VulnerabilityTable     | src/components/obsolescence/VulnerabilityTable.jsx   | Tableau des vulnerabilites CVE                 |
| ScoreHistory           | src/components/obsolescence/ScoreHistory.jsx         | Graphique en barres SVG de l'historique        |
| EmptyState             | src/components/obsolescence/EmptyState.jsx           | Etat vide avec icone et CTA                    |
| AddProjectForm         | src/components/obsolescence/AddProjectForm.jsx       | Formulaire d'ajout de projet                   |
| IntegrationSnippet     | src/components/obsolescence/IntegrationSnippet.jsx   | Bloc env vars + instructions webhook           |
| WebhookUrlEditor       | src/components/obsolescence/WebhookUrlEditor.jsx     | Editeur inline du webhook URL                  |

## Flux d'onboarding d'un nouveau projet

1. L'utilisateur ouvre l'onglet "Obsolescence" dans Lutecia
2. Il clique sur "Ajouter un projet"
3. Il entre le nom, l'URL du projet, et optionnellement l'URL webhook
4. Le systeme genere une api_key unique (prefixee ak_)
5. L'utilisateur copie l'api_key et les variables d'environnement affichees
6. Dans son application, il configure les variables d'environnement :
   - `ANALYZER_API_KEY` = la cle copiee
   - `ANALYZER_API_URL` = URL Supabase + `/functions/v1/receive-analysis`
   - `ANALYZER_PROJECT_NAME` = nom du projet
7. Il deploie le module embarque (BLOC A)
8. Les analyses automatiques envoient les rapports
9. Les rapports apparaissent dans le dashboard
10. (Optionnel) L'URL webhook peut etre ajoutee/modifiee a tout moment dans l'onglet Integration

## Securite

- Les api_keys ne sont jamais exposees cote client dans les apps analysees
- L'Edge Function receive-analysis utilise le service_role key pour inserer les donnees (bypass RLS)
- RLS est actif sur toutes les tables
- Les payloads sont valides avant toute insertion
- Le soft-delete preserve les donnees historiques

## Palette de couleurs

| Usage    | Couleur | Hex     |
|----------|---------|---------|
| Primaire | Teal    | #00d4a8 |
| Accent   | Blue    | #0099ff |
| Warning  | Amber   | #f59e0b |
| Danger   | Red     | #ef4444 |
| Success  | Green   | #10b981 |

## Maintenance

Chaque modification du schema ou de l'API doit etre accompagnee :
- D'une nouvelle migration Supabase
- D'une mise a jour de cette documentation
- D'un increment de version (YYYY-MM-NNN)
