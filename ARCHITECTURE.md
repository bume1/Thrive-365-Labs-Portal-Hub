# Thrive 365 Labs Portal Hub — Architecture

> **Living document.** Update this file with every significant change, bug fix, or architectural decision.
>
> Last updated: 2026-03-26

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Portal Inventory](#portal-inventory)
4. [Authentication & Session Management](#authentication--session-management)
5. [Database Structure](#database-structure)
6. [API Route Groups](#api-route-groups)
7. [Notification System](#notification-system)
8. [File Upload Pipeline](#file-upload-pipeline)
9. [External Integrations](#external-integrations)
10. [Scheduled Tasks](#scheduled-tasks)
11. [Configuration Reference](#configuration-reference)
12. [Architectural Decisions & Patterns](#architectural-decisions--patterns)
13. [Bug History & Fixes](#bug-history--fixes)
14. [Known Pitfalls](#known-pitfalls)
15. [Future Recommendations](#future-recommendations)

---

## System Overview

Multi-portal SaaS platform for managing clinical laboratory implementations (Biolis AU480 CLIA). Single Express server serves multiple React frontends as separate HTML pages. All data stored in Replit Key-Value Store (no SQL).

**Core capabilities:**
- 10-phase project implementation tracking (102-task template)
- Client portal with milestones, inventory, soft pilot checklists
- Field service reporting with multi-day validation tracking and PDF generation
- Automated notification queue with reminder scanning
- HubSpot CRM sync (deals, tickets, contacts)
- Google Drive document storage
- Knowledge Hub and Changelog

**Version:** 3.0.0
**License:** Proprietary — Thrive 365 Labs
**Developer:** Bianca G. C. Ume, MD, MBA, MS (OnboardHealth)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 (Replit) |
| Server | Express.js |
| Frontend | React 18 (CDN via unpkg) + Babel JSX transpilation |
| Styling | Tailwind CSS (CDN) |
| Database | Replit Key-Value Store (`@replit/database`) |
| Auth | JWT (`jsonwebtoken`) + bcryptjs |
| Email | Resend API (`resend`) |
| CRM | HubSpot API (`@hubspot/api-client`) |
| File Storage | Google Drive (Replit Connectors OAuth) |
| PDF | PDFKit + PDFMake |
| Uploads | Multer (memoryStorage, 10MB limit, max 5 concurrent) |

---

## Portal Inventory

Each portal is a separate HTML page with its own React app. They share the same Express backend and JWT tokens.

| Portal | File | URL | Primary Token Key | Primary User Key |
|--------|------|-----|-------------------|-----------------|
| Login / Portal Hub | `public/login.html` | `/login` | `unified_token` | `unified_user` |
| Implementations (Launch App) | `public/index.html` + `public/app.js` | `/launch` | `token` | `user` |
| Admin Hub | `public/admin-hub.html` | `/admin` | `admin_token` | `admin_user` |
| Client Portal | `public/portal.html` | `/portal/:slug` | `portal_token` | `portal_user` |
| Service Portal | `public/service-portal.html` | `/service` | `service_token` | `service_user` |
| Knowledge Hub | `public/knowledge.html` | `/knowledge` | — | — |
| Changelog | `public/changelog.html` | `/changelog` | — | — |
| Link Directory | `public/link-directory.html` | `/links` | — | — |
| Password Reset | `public/password-reset.html` | `/password-reset-:token` | — | — |
| Legacy Client | `public/client.html` | `/client/:linkId` | — | — |

---

## Authentication & Session Management

### How It Works

1. User submits email/password to `POST /api/auth/login`
2. Server validates credentials, returns JWT token (24h expiry) + user object
3. Frontend stores token and user in `localStorage` under portal-specific keys
4. All API calls send token via `Authorization: Bearer <token>` header
5. `authenticateToken` middleware verifies JWT and fetches fresh user data from DB on every request
6. Inactive accounts are blocked at middleware level (403)

### The 10 localStorage Keys

These are the **only** auth-related keys used across all portals:

| Key | Set By | Purpose |
|-----|--------|---------|
| `token` | Implementations app | Legacy token key |
| `user` | Implementations app | Legacy user object |
| `unified_token` | Login page | Cross-portal token (checked by login.html) |
| `unified_user` | Login page | Cross-portal user object |
| `admin_token` | Login page, Admin Hub | Admin hub token |
| `admin_user` | Login page, Admin Hub | Admin hub user object |
| `portal_token` | Client Portal | Client portal token |
| `portal_user` | Client Portal | Client portal user object |
| `service_token` | Service Portal | Service portal token |
| `service_user` | Service Portal | Service portal user object |

### Login Page Token Check (login.html)

```javascript
const [token, setToken] = useState(
  localStorage.getItem('unified_token') || localStorage.getItem('admin_token')
);
```

**This is critical.** The login page checks `unified_token` first, then falls back to `admin_token`. If ANY of these keys survive a logout, the login page will think the user is already authenticated and skip the login form.

### Session Verification

On page load, `login.html` calls `GET /api/auth/me` to verify the stored session is still valid and to get the fresh `requirePasswordChange` flag from the server. If the token is expired or invalid, localStorage is cleared and the login form is shown.

### Logout Contract

> **RULE: Every portal's logout handler MUST use `localStorage.clear(); sessionStorage.clear();`**

This is the only pattern that is future-proof. If a new token key is ever added, `localStorage.clear()` will still work. Selective `removeItem()` calls are the source of recurring logout bugs.

| Portal | Logout Method | Status |
|--------|--------------|--------|
| login.html | `localStorage.clear()` | Correct |
| admin-hub.html | `localStorage.clear(); sessionStorage.clear();` | Correct |
| app.js (implementations) | `localStorage.clear(); sessionStorage.clear();` | Fixed 2026-03-26 |
| portal.html | `localStorage.clear(); sessionStorage.clear();` | Fixed 2026-03-26 |
| service-portal.html | Removes all 10 keys explicitly | Works but fragile |

### Session Expiry Contract

Every `handleResponse` / fetch wrapper that detects a 401/403 auth error MUST also clear all auth keys before redirecting, using the same `localStorage.clear(); sessionStorage.clear();` pattern.

### Password Change Flow

- New accounts and admin-reset accounts have `requirePasswordChange: true`
- On login, the frontend checks this flag and shows a non-dismissible password change modal
- The modal includes a "Sign out and return to login" escape link
- `POST /api/auth/change-password` sets the flag to `false` after success
- `GET /api/auth/me` returns the fresh flag so stale localStorage doesn't trap users

### Roles & Permissions

| Role | Value | Access |
|------|-------|--------|
| Super Admin | `admin` | Full system access |
| Team Member | `user` | Assigned projects only (read/write per project) |
| Client | `client` | Own portal only (slug-based) |
| Vendor | `vendor` | Service portal only |

**Additional flags:** `isManager`, `hasServicePortalAccess`, `hasAdminHubAccess`, `hasImplementationsAccess`, `hasClientPortalAdminAccess`

### Middleware Chain

| Middleware | Purpose |
|-----------|---------|
| `authenticateToken` | Verifies JWT, fetches fresh user, blocks inactive accounts |
| `requireAdmin` | Super admin only |
| `requireAdminHubAccess` | Admin, managers, or users with `hasAdminHubAccess` |
| `requireImplementationsAccess` | Admin or users with `hasImplementationsAccess` |
| `requireClientPortalAdmin` | Admin, managers, or users with `hasClientPortalAdminAccess` |

---

## Database Structure

Replit Key-Value Store. No schemas — all data is JSON arrays/objects stored by key.

### Core Collections

| Key | Type | Purpose |
|-----|------|---------|
| `users` | Array | All user accounts with credentials, roles, permissions |
| `projects` | Array | Implementation projects with metadata |
| `tasks_${projectId}` | Array | Tasks for a specific project (per-project key) |
| `clients` | Array | Client practices |
| `activity_log` | Array | Audit trail (max 500 entries, FIFO) |
| `announcements` | Array | Portal-wide announcements |

### Service Reporting

| Key | Type | Purpose |
|-----|------|---------|
| `service_reports` | Array | Service report submissions with signatures |
| `validation_reports` | Array | Multi-day validation tracking |
| `inventory_submissions_${slug}` | Array | Weekly inventory per client |
| `inventory_custom_${slug}` | Array | Custom inventory items per client |
| `inventory_template` | Array | Default inventory categories (3 categories, 63 items) |

### Notifications

| Key | Type | Purpose |
|-----|------|---------|
| `pending_notifications` | Array | Unsent notification queue with status |
| `notification_log` | Array | Send history (max 2000 entries) |
| `notification_settings` | Object | Enable/disable queue, send limits |
| `reminder_settings` | Object | Scenario toggles and thresholds |
| `email_templates` | Array | Admin-editable email templates |

### Client Portal

| Key | Type | Purpose |
|-----|------|---------|
| `client_documents` | Array | Portal documents by category |
| `portal_settings` | Object | Portal branding, domain config |
| `portal_tickets` | Array | Support tickets from portal |

### Auth & Admin

| Key | Type | Purpose |
|-----|------|---------|
| `password_reset_requests` | Array | Forgot-password requests (admin queue) |
| `password_reset_links` | Array | Token-based reset links (24h expiry) |
| `feedback_requests` | Array | User feedback/suggestions |
| `knowledge_guides` | Array | Knowledge Hub articles |
| `changelog` | Array | Changelog entries |

### HubSpot

| Key | Type | Purpose |
|-----|------|---------|
| `ticket_polling_config` | Object | Polling schedule, filter mode, stats |
| `hubspot_stage_mapping` | Object | Deal stage → project phase mapping |

### Caching

| Cache | TTL | Purpose |
|-------|-----|---------|
| `_usersCache` (in-memory) | 5s | Reduces DB reads for user lookups |
| `_projectSlugCache` (in-memory) | 30s | Reduces DB reads for slug lookups |

---

## API Route Groups

~248 endpoints across 40+ sections in `server.js`. Major groups:

| Group | Prefix | Auth | Key Endpoints |
|-------|--------|------|--------------|
| Auth | `/api/auth/*` | Public/Mixed | login, signup, client-login, forgot-password, change-password, me |
| Users | `/api/users/*` | Admin | CRUD, team-members |
| Projects | `/api/projects/*` | Auth | CRUD, clone |
| Tasks | `/api/projects/:id/tasks/*` | Auth | CRUD, reorder, bulk-update, bulk-edit, bulk-delete |
| Subtasks | `*/tasks/:taskId/subtasks/*` | Auth | CRUD |
| Notes | `*/tasks/:taskId/notes/*` | Auth | CRUD |
| Files | `*/tasks/:taskId/files/*` | Admin | Upload/delete (Google Drive) |
| Client Portal | `/api/client-portal/*` | Auth | Data, soft-pilot, documents |
| Service Portal | `/api/client/service-reports/*` | Auth | CRUD, sign, PDF, assignments |
| Inventory | `/api/inventory/*` | Auth | Custom items, template |
| HubSpot | `/api/hubspot/*` | Admin | Upload, deals, webhooks |
| Admin | `/api/admin/*` | Admin | Feedback, activity, password resets, tickets |
| Knowledge | `/api/knowledge/*` | Auth/Public | Guides CRUD |
| Notifications | Internal | System | Queue processing, reminder scanning |
| Config | `/api/config` | Public | Non-sensitive brand/phase config |

---

## Notification System

Two-part system that runs on intervals:

### Feature 1: Notification Queue (every 15 min)

`processNotificationQueue()` — async email dispatcher

1. `queueNotification()` creates entries in `pending_notifications`
2. Deduplication: skips if identical pending notification exists
3. Cooldown: prevents re-sending same type within configurable hours
4. Queue processor sends batches via Resend API
5. Daily limit: 500 emails
6. Failed sends retry up to 3 times

### Feature 2: Reminder Scanner (every 30 min)

`scanAndQueueNotifications()` — scans for trigger conditions and queues notifications

| Scenario | Trigger | Cooldown |
|----------|---------|----------|
| Task deadline approaching | 1, 3, 7 days before | 20h |
| Task overdue | Past due date | 20h |
| Task overdue escalation | 7+ days overdue → admin | 20h |
| Service report signature needed | 3+ days waiting | 20h |
| Service report review needed | 3+ days waiting | 20h |
| Inventory reminder | 7 days since last submission | 144h |
| Go-live reminder | 7, 14, 30 days before | 20h |
| Milestone reached | 25%, 50%, 75%, 100% | One-time |

---

## File Upload Pipeline

```
Client/Admin → Multer (memoryStorage, 10MB limit) → Google Drive API → Store driveFileId in DB
```

- Max 5 concurrent uploads (rate limiter prevents OOM from in-memory storage)
- Google Drive OAuth via Replit Connectors API
- Token caching: reuses access token if >60s remaining

---

## External Integrations

| Service | Module | Purpose |
|---------|--------|---------|
| HubSpot | `hubspot.js` | CRM sync — deals, tickets, contacts, file uploads |
| Google Drive | `googledrive.js` | Document storage for task files and checklists |
| Resend | `email.js` | Transactional email (FROM: no-reply@thrive365labs.live) |

### HubSpot Ticket Polling

Separate polling engine (configurable interval) syncs HubSpot tickets to local `portal_tickets`. Supports stage-based filtering and automatic status mapping.

---

## Scheduled Tasks

| Task | Interval | Initial Delay | Function |
|------|----------|--------------|----------|
| Notification queue | 15 min | 5s | `processNotificationQueue()` |
| Reminder scanner | 30 min | 8s | `scanAndQueueNotifications()` |
| HubSpot ticket poll | Configurable | On startup | `pollHubSpotTickets()` |

---

## Configuration Reference

All in `config.js`. Key values:

| Setting | Default | Env Var |
|---------|---------|---------|
| JWT_SECRET | `thrive365-secret-change-in-production` | `JWT_SECRET` |
| JWT_EXPIRY | `24h` | `JWT_EXPIRY` |
| BCRYPT_SALT_ROUNDS | 10 | `BCRYPT_SALT_ROUNDS` |
| MIN_PASSWORD_LENGTH | 8 | `MIN_PASSWORD_LENGTH` |
| PORT | 3000 | `PORT` |
| BODY_PARSER_LIMIT | 50mb | — |
| MAX_FILE_SIZE | 10MB | — |
| MAX_CONCURRENT_UPLOADS | 5 | — |
| USERS_CACHE_TTL | 5000ms | — |
| DAILY_SEND_LIMIT | 500 | — |

---

## Architectural Decisions & Patterns

### 1. Always use `localStorage.clear()` for logout

**Decision:** All logout handlers and session-expiry handlers must use `localStorage.clear(); sessionStorage.clear();` instead of selective `removeItem()` calls.

**Reason:** The app has 10 localStorage keys across 5 portals. Selective removal is error-prone and has caused the same "ghost session" bug multiple times. `localStorage.clear()` is the only future-proof approach.

### 2. Verify session on page load

**Decision:** `login.html` calls `GET /api/auth/me` on page load to verify stored sessions.

**Reason:** Stale localStorage (e.g., `requirePasswordChange: true` after admin clears it server-side) was trapping users on the password change modal with no escape.

### 3. Fresh user data on every authenticated request

**Decision:** `authenticateToken` middleware fetches fresh user data from DB (with 5s cache) instead of trusting JWT claims alone.

**Reason:** Permission changes, account deactivation, and role updates take effect within seconds without requiring re-login.

### 4. Per-project task storage

**Decision:** Tasks are stored under `tasks_${projectId}` instead of a single `tasks` collection.

**Reason:** Avoids loading all tasks for all projects on every request. Each project's tasks are isolated.

### 5. Notification cooldowns over deduplication

**Decision:** Notifications use time-based cooldowns (hours between same notification type to same user) rather than just checking for duplicates.

**Reason:** Prevents notification storms when conditions persist (e.g., a task stays overdue for weeks).

---

## Bug History & Fixes

### 2026-03-26: Implementations logout redirects to Portal Hub instead of login

**Symptom:** Clicking "Logout" in the implementations app shows the Portal Hub instead of the login form.

**Root cause:** `app.js` `handleLogout` only removed 4 of 10 localStorage keys (`token`, `user`, `unified_token`, `unified_user`). The leftover `admin_token` caused `login.html` to think the user was still authenticated (line 701: `localStorage.getItem('unified_token') || localStorage.getItem('admin_token')`).

**Fix:** Replaced selective `removeItem()` calls with `localStorage.clear(); sessionStorage.clear();` in `app.js` (both `handleLogout` and `handleResponse` auth error path) and `portal.html` (both logout button and auth error path).

**Files changed:** `public/app.js`, `public/portal.html`

**Lesson:** Always use `localStorage.clear()` — see [Architectural Decision #1](#1-always-use-localstorageclear-for-logout).

---

### 2026-03-26: Stuck on password reset page after login

**Symptom:** Users see a non-dismissible "Create New Password" modal when visiting `/login` with no way to escape.

**Root cause:** Two issues:
1. The password change modal had no logout/escape option when `isRequired` was true
2. `requirePasswordChange` flag was read from stale localStorage without server verification — even if admin cleared the flag, the user stayed stuck

**Fix:**
1. Added "Sign out and return to login" link on the required password change modal
2. Added `GET /api/auth/me` endpoint to verify session on page load
3. Default admin account now explicitly sets `requirePasswordChange: false`

**Files changed:** `public/login.html`, `server.js`

**Lesson:** Always verify server-side state on page load for critical flags. Never trust stale localStorage as the sole source of truth.

---

### 2026-03-26: Email links routing to wrong portal for client users

**Symptom:** Task reminder emails sent to client users contained internal `/launch` links instead of `/portal/:slug` links.

**Root cause:** `getLoginUrlForRole()` wasn't being used for all email link generation. Some email templates hardcoded internal paths.

**Fix:** Updated email link generation to use role-based routing — clients get `/portal/:slug#task-:id`, team members get `/launch` links.

**Files changed:** `server.js`

---

### 2026-03-26: Debug console.logs exposing user emails

**Symptom:** User email addresses were being logged to the server console via debug statements.

**Fix:** Removed debug `console.log` statements that logged user data.

**Files changed:** `server.js`

---

### 2026-03-26: Password reset email using hardcoded URL

**Symptom:** Password reset emails contained wrong domain.

**Fix:** Made password reset email URL dynamic based on request origin.

**Files changed:** `server.js`

---

## Known Pitfalls

### 1. Cross-portal token leakage

`login.html` checks `unified_token || admin_token` to determine if a user is logged in. If any portal's logout fails to clear all keys, the user appears logged in when they're not. **Always use `localStorage.clear()`.**

### 2. Replit KV Store is not atomic

Multiple concurrent writes to the same key can cause data loss. The app mitigates this with a 5-second user cache, but race conditions are possible under heavy concurrent load.

### 3. In-memory file uploads

Multer uses `memoryStorage()` — files are held in RAM until uploaded to Google Drive. The 5-concurrent-upload limiter exists to prevent OOM. Do not increase `MAX_CONCURRENT_UPLOADS` without testing memory usage.

### 4. server.js is a monolith

All 248 endpoints, middleware, scheduled tasks, and business logic live in one ~13,600-line file. When editing, use the section header comments (`// =====`) to navigate.

### 5. No database migrations

Schema changes must be handled with one-time migration flags (e.g., `mig_projects_phase`) or backward-compatible code that handles missing fields with defaults.

### 6. service-portal.html still uses selective removeItem

While it removes all 10 keys, it doesn't use `localStorage.clear()`. If an 11th key is added, it will have the same ghost session bug. Should be migrated to `localStorage.clear()`.

---

## Future Recommendations

1. **Centralize auth helpers** — Create a shared `auth-utils.js` with `logout()`, `getToken()`, `getUser()`, `isAuthenticated()` functions imported by all portals. This eliminates the duplicated logout logic that keeps breaking.

2. **Add a server-side logout endpoint** — `POST /api/auth/logout` that invalidates the JWT (via a token blacklist or short-lived tokens + refresh tokens). Currently logout is purely client-side.

3. **Split server.js** — Extract route groups into separate files (e.g., `routes/auth.js`, `routes/projects.js`, `routes/service-reports.js`). The monolith is increasingly hard to navigate and test.

4. **Add database migration system** — Track schema versions and run migrations on startup instead of relying on ad-hoc migration flags.

5. **Move to a proper database** — Replit KV Store lacks indexing, querying, transactions, and atomic operations. PostgreSQL or SQLite would significantly improve reliability and performance.
