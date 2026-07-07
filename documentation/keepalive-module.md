# Keep-Alive Module — Lutecia Monitoring Dashboard

**Version:** 2026-07-1  
**Module:** `keepalive`  
**Auteur:** Lutecia  

---

## Objectif

Empecher la base de donnees Supabase (plan gratuit) de se mettre en pause automatiquement.
Supabase suspend les projets inactifs apres 7 jours sans requete. Ce module maintient la base
active en envoyant un heartbeat toutes les 72 heures via un job pg_cron.

---

## Architecture

```
pg_cron job (toutes les 72h)
  └─> INSERT INTO keepalive_log (status='cron')
  └─> DELETE logs > 30 jours

Edge Function keep-alive (appel manuel depuis le dashboard)
  └─> SELECT 1 FROM clients (ping la DB)
  └─> INSERT INTO keepalive_log (status='manual')
  └─> DELETE logs > 30 jours
  └─> Retourne { success, pinged_at }

SettingsPanel.jsx
  └─> Affiche le dernier ping (date + age)
  └─> Badge vert si < 4 jours, orange sinon
  └─> Bouton "Tester la connexion"
```

---

## Composants

### Table `keepalive_log`

| Colonne    | Type        | Description                        |
|------------|-------------|------------------------------------|
| id         | uuid (PK)   | Identifiant unique                 |
| pinged_at  | timestamptz | Timestamp du ping (default: now()) |
| status     | text        | Source: 'cron', 'manual', 'ok'     |

**RLS :** Activee. SELECT/INSERT/DELETE ouverts a anon + authenticated.

**Index :** `idx_keepalive_log_pinged_at` sur `pinged_at DESC` pour acces rapide au dernier ping.

---

### Job pg_cron : `siteguard-keepalive`

- **Schedule :** `0 0 */3 * *` (minuit tous les 3 jours)
- **Action :** Insere une ligne dans `keepalive_log` avec `status='cron'`
- **Nettoyage :** Supprime les entrees de plus de 30 jours

Pour voir le job depuis Supabase SQL editor :
```sql
SELECT * FROM cron.job WHERE jobname = 'siteguard-keepalive';
```

Pour desactiver le job (si passage en plan payant) :
```sql
SELECT cron.unschedule('siteguard-keepalive');
```

---

### Edge Function `keep-alive`

- **Chemin :** `supabase/functions/keep-alive/index.ts`
- **Methode :** POST (pas d'authentification requise)
- **Acces :** Public (verify_jwt: false)
- **Retour :** `{ success: boolean, pinged_at: string }`

**Appel manuel :**
```
POST /functions/v1/keep-alive
Authorization: Bearer <SUPABASE_ANON_KEY>
```

---

### Service Frontend `keepaliveService`

Localisation : `src/lib/supabase.js`

```js
keepaliveService.getLastPing()  // Retourne la derniere entree de keepalive_log
keepaliveService.ping()         // Appelle la edge function keep-alive
```

---

### Indicateur dans SettingsPanel

Section "SANTE DE LA BASE DE DONNEES" affichant :

- **Badge vert "Actif"** — si le dernier ping date de moins de 4 jours
- **Badge orange "Ancien"** — si le dernier ping date de plus de 4 jours
- **Badge gris "Aucun ping"** — si aucune entree dans keepalive_log
- Timestamp du dernier ping + age relatif (ex: "il y a 2j 3h")
- Source du ping (cron ou manual)
- Metadonnees : frequence, planificateur, retention, seuil d'alerte
- Bouton "Tester la connexion" — declenche un ping manuel immediat

---

## Logique d'alertes visuelles

| Etat          | Condition                      | Couleur  |
|---------------|-------------------------------|----------|
| Actif         | Dernier ping < 4 jours        | Vert     |
| Ancien        | Dernier ping >= 4 jours       | Orange   |
| Non initialise| Aucun ping enregistre         | Gris     |

Le seuil de 4 jours laisse une marge de 3 jours avant le timeout Supabase (7 jours).

---

## Retention des logs

- Les entrees de plus de 30 jours sont purgees automatiquement
- Par le job pg_cron a chaque execution
- Par la edge function a chaque appel manuel

---

## Extensions utilisees

| Extension | Version | Usage                          |
|-----------|---------|-------------------------------|
| pg_cron   | 1.6.4   | Planification des jobs cron   |
| pg_net    | 0.19.5  | Client HTTP asynchrone (futur)|

---

## FAQ

**Q : Le job pg_cron ne tourne pas encore, comment initialiser ?**  
R : Cliquez sur "Tester la connexion" dans Parametres > Sante de la base pour creer la premiere entree manuellement.

**Q : Comment verifier que le job tourne bien ?**  
R : Dans Supabase SQL editor : `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

**Q : Que se passe-t-il si la base est deja en pause ?**  
R : Le premier acces depuis le dashboard Supabase ou depuis l'application reactivera la base. Le job pg_cron reprendra ensuite automatiquement.

**Q : Comment desactiver completement le systeme ?**  
R : `SELECT cron.unschedule('siteguard-keepalive');` dans Supabase SQL editor. La table keepalive_log peut rester en place.
