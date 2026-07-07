# Email Reports Module — Lutecia Monitoring Dashboard

**Version:** 2026-07-1  
**Module:** `email-reports`

---

## Objectif

Permettre l'envoi de rapports de monitoring par email aux responsables des sites surveilles.
Gestion multi-destinataires par site (ou globaux), alertes automatiques en cas de probleme,
et analyse complete (Monitoring + DNS + Performance) declenchable directement depuis le Rapport.

---

## Architecture

```
Onglet Rapport
  ├─> Bouton "↻ Analyser" par client → appelle check-site + dns-monitor + perf-check en parallele
  ├─> Bouton "Envoyer" par client → Edge Function send-report (client_id specifique)
  └─> Bouton "Envoyer par email" global → Edge Function send-report (tous les clients)

Onglet Destinataires (RecipientsPanel)
  ├─> Formulaire ajout/modification : email, nom, role, site associe, toggles alertes/rapports
  └─> Bouton "Envoyer rapport test"

check-site Edge Function (automatique)
  └─> Si issues detectees → appelle send-alert (debounce 24h par client)

send-alert Edge Function
  └─> Envoie email alerte aux recipients du client + globaux (receive_alerts=true)
```

---

## Tables

### `report_recipients`

| Colonne          | Type        | Description                                               |
|------------------|-------------|-----------------------------------------------------------|
| id               | uuid (PK)   | Identifiant unique                                        |
| client_id        | uuid (FK)   | FK vers clients (nullable = destinataire global)          |
| email            | text        | Adresse email du destinataire                             |
| name             | text        | Nom du contact (optionnel)                                |
| role             | text        | owner / technical / billing (defaut: owner)               |
| receive_alerts   | boolean     | Recoit les alertes en temps reel (defaut: true)           |
| receive_reports  | boolean     | Recoit les rapports periodiques (defaut: true)            |
| created_at       | timestamptz | Date de creation                                          |

**RLS :** SELECT/INSERT/UPDATE/DELETE ouverts a anon + authenticated.

**Logique client_id :**
- `client_id = NULL` → destinataire global : recoit les rapports de TOUS les sites
- `client_id = <uuid>` → destinataire specifique a un site

### `clients` (colonne ajoutee)

| Colonne              | Type        | Description                               |
|----------------------|-------------|-------------------------------------------|
| last_alert_sent_at   | timestamptz | Timestamp de la derniere alerte envoyee   |

Utilisee par `send-alert` pour le debounce de 24h.

---

## Edge Functions

### `send-report`

- **Chemin :** `supabase/functions/send-report/index.ts`
- **Methode :** POST
- **Body optionnel :** `{ client_id?: string }`
  - Avec `client_id` → envoie le rapport d'un seul site
  - Sans `client_id` → envoie le rapport global de tous les sites
- **Retour :** `{ sent: number, recipients: string[], errors: string[] }`

**Logique :**
1. Recupere la config SMTP (table smtp_config)
2. Recupere les clients cibles
3. Recupere les derniers resultats (monitoring_results + dns_email_results + performance_results)
4. Recupere les destinataires (report_recipients avec receive_reports=true)
5. Genere un email HTML professionnel (600px, couleurs Lutecia)
6. Envoie via nodemailer (FROM = smtp_user)

**Erreurs courantes :**
- `Configuration SMTP non trouvee` → configurer le SMTP dans Parametres
- `Aucun destinataire configure` → ajouter des recipients dans Destinataires
- `Aucun destinataire pour ce client` → le client n'a pas de recipients assignes

### `send-alert`

- **Chemin :** `supabase/functions/send-alert/index.ts`
- **Methode :** POST
- **Body :** `{ client_id, client_name, client_url, issues: string[], checked_at }`
- **Retour :** `{ sent: number, errors: string[] }` ou `{ skipped: true, reason: string }`

**Logique :**
1. Verifie le debounce (24h) via clients.last_alert_sent_at
2. Recupere la config SMTP
3. Recupere les recipients du client + globaux avec receive_alerts=true
4. Envoie un email d'alerte HTML (fond rouge, liste des problemes)
5. Met a jour clients.last_alert_sent_at

**Cas de skip (sans erreur) :**
- Alerte deja envoyee il y a moins de 24h
- Aucune config SMTP
- Aucun recipient configure

---

## Services Frontend

Dans `src/lib/supabase.js` — `recipientsService` :

```js
recipientsService.getAll()              // Tous les destinataires
recipientsService.getByClient(id)       // Destinataires d'un client
recipientsService.getGlobal()           // Destinataires globaux
recipientsService.create(recipient)     // Ajouter
recipientsService.update(id, data)      // Modifier
recipientsService.delete(id)            // Supprimer
recipientsService.sendReport(clientId)  // Envoyer rapport (null = global)
```

---

## Composants

### `RecipientsPanel.jsx`

Onglet "Destinataires" dans la navigation.

- Formulaire d'ajout/modification avec toggle Alertes / Rapports
- Groupement par client + section globaux
- Bouton "Envoyer rapport test" (envoie a tous les destinataires)
- Avertissement si SMTP non configure

### `ReportView.jsx` (mis a jour)

Nouveautes dans l'onglet Rapport :

- **Tableau de synthese** : desormais inclut les colonnes Email DNS et Perf
- **Bouton "Envoyer par email"** en haut (rapport global)
- **Section "ANALYSE PAR CLIENT"** : une carte par client avec
  - Status actuels (monitoring, DNS, perf)
  - Bouton "↻ Analyser" : lance Monitoring + DNS + Perf en parallele
  - Bouton "Envoyer" : envoie le rapport de ce client par email
  - Liste des alertes detaillees

---

## Configuration requise

1. **SMTP configure** dans Parametres (host, user, pass)
2. **Au moins un destinataire** dans l'onglet Destinataires

L'expediteur des emails est le `smtp_user` de la config SMTP, ce qui permet d'envoyer
les rapports en tant que votre propre domaine mail (ex: monitoring@monentreprise.fr).

---

## Flux complet d'une alerte automatique

```
Utilisateur clique "↻ Tout verifier" (Monitoring)
  → check-site edge function detecte des issues
  → fetch vers send-alert
    → verifie debounce 24h (clients.last_alert_sent_at)
    → recupere recipients du client + globaux
    → envoie email alerte HTML (fond rouge)
    → met a jour clients.last_alert_sent_at
```

## Flux complet d'un rapport manuel par client

```
Utilisateur va dans Rapport
  → clique "↻ Analyser" sur un client
    → check-site + dns-monitor + perf-check en parallele
  → clique "Envoyer" sur le client
    → send-report avec client_id
    → recupere les derniers resultats BDD pour ce client
    → envoie email HTML aux recipients du client + globaux
    → retourne { sent, recipients, errors }
```
