# Client Portal Module

## Version 2026-7-0

## Overview
A complete client-facing dashboard portal accessible at `/portal`, allowing each client to view the status and history of their monitored site, interact with their provider, and track interventions and payments.

## Architecture

### Authentication
- Supabase Auth with email/password and Google OAuth
- Auth context (`src/portal/AuthContext.jsx`) manages session state
- Protected routes redirect unauthenticated users to `/portal/login`
- `client_users` table maps authenticated users to their assigned client site

### Routing
- `/` — Admin back-office (unchanged)
- `/portal/login` — Client login page
- `/portal/dashboard` — Site health overview
- `/portal/reports` — Historical analyses and daily snapshots
- `/portal/improvements` — Improvement recommendations
- `/portal/requests` — Support requests and questions (with threaded replies)
- `/portal/interventions` — Maintenance intervention timeline
- `/portal/payments` — Invoice and payment tracking
- `/portal/technical` — Software component inventory

### Database Tables (new)
- `client_users` — Maps auth users to clients
- `improvement_axes` — Improvement recommendations per client
- `client_requests` — Support requests from clients
- `client_request_replies` — Threaded replies on requests
- `interventions` — Maintenance actions per client
- `payments` — Invoices and payments per client
- `site_components` — Technical software inventory per site

### Admin Back-office Extensions
The "Portail Client" tab in the admin panel allows managing:
- Client portal users
- Improvement axes (CRUD per client)
- Support request replies and status changes
- Interventions (CRUD per client)
- Payments/invoices (CRUD per client)
- Technical components (CRUD per client)

## File Structure
```
src/portal/
  AuthContext.jsx       — Authentication context + hooks
  ProtectedRoute.jsx    — Route guard component
  PortalLayout.jsx      — Sidebar + header layout
  LoginPage.jsx         — Login/signup page
  pages/
    PortalDashboard.jsx — Site health overview
    PortalReports.jsx   — Reports history
    PortalImprovements.jsx — Improvement axes
    PortalRequests.jsx  — Support requests
    PortalInterventions.jsx — Intervention timeline
    PortalPayments.jsx  — Payments table
    PortalTechnical.jsx — Tech component inventory

src/components/admin/
  PortalAdminPanel.jsx  — Admin CRUD for all portal data
```

## Setup for a New Client
1. Create the client in the admin back-office (existing flow)
2. The client signs up at `/portal/login` (email/password or Google)
3. In the admin "Portail Client" > "Utilisateurs" tab, associate the auth user ID with the client
4. Client can now log in and see their dashboard

## Security
- RLS on all new tables
- Authenticated users can only read data associated with their client
- Admin (anon key) can manage all data for all clients
- Requests are scoped to the authenticated user's own submissions
