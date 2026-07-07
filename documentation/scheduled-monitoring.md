# Scheduled Monitoring & Weekly Reports

## Version: 2026-7-0

## Overview

This module introduces two automated workflows:

1. **Daily bi-analysis** — all sites are checked at 10H and 18H (Paris time). If any site changes status between the two runs, an alert email is sent to `nicolas.sinou@live.fr`.
2. **Weekly personalized reports** — every Monday at 10H, each registered recipient receives an email about their specific client's site(s). Obsolescence data is excluded.

---

## Architecture

### New Database Table: `daily_snapshots`

Stores a per-client snapshot for each daily slot (morning / evening).

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `client_id` | uuid | FK → clients (CASCADE) |
| `slot` | text | `'morning'` or `'evening'` |
| `snapshot_date` | date | Calendar date of the snapshot |
| `http_ok` | boolean | HTTP check passed |
| `ssl_ok` | boolean | SSL check passed |
| `dns_ok` | boolean | DNS check passed |
| `http_status_code` | integer | HTTP response code |
| `ssl_days_left` | integer | Days before SSL expiry |
| `response_time_ms` | integer | HTTP response time in ms |
| `issues` | text[] | Detected issues |
| `checked_at` | timestamptz | Exact check time |

Unique constraint: `(client_id, slot, snapshot_date)` — safe for upserts.

---

## Scheduled Jobs (pg_cron)

All times are **UTC**. France summer (CEST = UTC+2): add 2 hours. France winter (CET = UTC+1): add 1 hour.

| Job name | Cron expression | UTC time | France summer | Function called |
|---|---|---|---|---|
| `daily-check-morning` | `0 8 * * *` | 08:00 | 10H | `daily-check` `{slot:"morning"}` |
| `daily-check-evening` | `0 16 * * *` | 16:00 | 18H | `daily-check` `{slot:"evening"}` |
| `weekly-report-monday` | `0 8 * * 1` | 08:00 Mon | 10H Mon | `weekly-report` `{}` |

> **Note:** In winter (November–March, CET = UTC+1), jobs will fire at 09H and 17H Paris time. Update the cron expressions to `0 9` / `0 17` / `0 9 * * 1` in a new migration if needed.

---

## Edge Functions

### `daily-check`

**Purpose:** Runs all site checks, stores daily snapshots, and sends a diff alert on the evening run.

**Endpoint:** `POST /functions/v1/daily-check`

**Body:** `{ "slot": "morning" | "evening" }`

**Logic:**
1. Fetches all clients from `clients` table
2. Calls `check-site` for each client in batches of 3 (with `skip_alert: true` to avoid duplicate immediate alerts)
3. Upserts results into `daily_snapshots` for today's date and the given slot
4. Purges snapshots older than 30 days
5. **If slot = evening:** compares with morning snapshots, detects:
   - Site becoming inaccessible or coming back online
   - HTTP status code changes
   - SSL becoming invalid
   - DNS resolution failures
   - New issues appearing or issues being resolved
6. If any diffs found: sends a summary alert email to `nicolas.sinou@live.fr`

**Response:**
```json
{
  "slot": "evening",
  "clients_checked": 5,
  "snapshots_saved": 5,
  "diffs_detected": 2,
  "alert_sent": true
}
```

---

### `weekly-report`

**Purpose:** Sends personalized weekly monitoring reports to each client's recipients. Obsolescence data is excluded.

**Endpoint:** `POST /functions/v1/weekly-report`

**Body:** `{}` (no parameters)

**Logic:**
1. Fetches SMTP config, all clients, and all recipients with `receive_reports = true`
2. Fetches the latest `monitoring_results`, `dns_email_results`, and `performance_results` for each client
3. **Per-client recipients** (`client_id = that client's id`): each gets a personalized email with data for their client only
4. **Global recipients** (`client_id IS NULL`): receive a full summary of all clients
5. Each email contains: HTTP, SSL, DNS, Email DNS, Performance — no obsolescence

**Email subject format:**
- Per-client: `Rapport hebdomadaire — [Client Name] · Semaine du [date]`
- Global: `Rapport hebdomadaire — Tous les sites · Semaine du [date]`

**Response:**
```json
{
  "sent": 3,
  "recipients": ["alice@example.com (Client A)", "bob@example.com (global)"],
  "errors": []
}
```

---

### `check-site` (modified)

Added `skip_alert` flag: when `true`, the function performs all checks and stores results in `monitoring_results` but does **not** call `send-alert`. This prevents duplicate alerts during batch daily checks.

---

## UI Changes

### Dashboard — Daily Analysis Banner

A banner at the top of the Dashboard shows:
- Last morning (10H) check status and time
- Last evening (18H) check status and time
- Manual trigger buttons to run a morning or evening check immediately

### ReportView — Weekly Report Button

A new **"Rapport hebdomadaire"** button triggers `weekly-report` manually, useful for testing without waiting for Monday.

---

## Alert Email Format

When differences are detected between morning and evening runs, an alert email is sent to `nicolas.sinou@live.fr` with:
- Header clearly labeled "Ecarts détectés"
- Table listing each affected client and the specific changes detected
- Styled to match existing Lutecia email design

---

## Recipient Configuration

Recipients are managed in the **Destinataires** tab:

| Recipient type | Who gets what |
|---|---|
| `client_id = specific_client` + `receive_reports = true` | Weekly report for that client only |
| `client_id = NULL` + `receive_reports = true` | Weekly report with all clients summary |
| `receive_alerts = true` | Immediate alerts (unchanged behavior from `send-alert`) |

The diff alert to `nicolas.sinou@live.fr` is hardcoded in `daily-check` and does **not** require a recipient entry in the database.
