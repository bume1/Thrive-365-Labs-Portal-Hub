# Thrive 365 Labs — Client Portal Hub

## Overview

The Thrive 365 Labs Client Portal Hub is a comprehensive, proprietary web platform for managing clinical laboratory implementations. It serves multiple user roles (admins, field technicians, clients) and integrates project launch management, field service reporting, inventory tracking, and client communication into a single hub.

**Key capabilities:**
- Multi-phase project launch tracking (10+ phases) with task management and Gantt/calendar views
- Client-facing portal with white-label branding per client (custom name, color, logo, slug)
- Field service portal for technicians to submit service reports with photo uploads and digital signatures
- Admin hub for user management, notifications, activity logs, analytics, and system configuration
- Automated notification queue (email via Resend) for service reports, task deadlines, inventory reminders, go-live alerts, and announcements
- HubSpot CRM integration for deal/ticket sync and notes
- Google Drive integration for file storage and document management
- PDF generation for service reports and project summaries
- Knowledge Hub with guides and resources
- Changelog system (admin-editable, DB-stored entries)

**Entry point:** `server.js` (Express backend, port 3000)  
**Frontend:** Static HTML files in `/public` with React loaded via CDN (no build step)

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Backend
- **Runtime:** Node.js with Express (`server.js` as monolithic server)
- **Pattern:** Single-file API server with all routes defined inline; helper modules for email, HubSpot, Google Drive, PDF generation, and config
- **Auth:** JWT-based authentication (`jsonwebtoken`), passwords hashed with `bcryptjs`. Tokens expire in 24h by default. Role-based access (admin, staff, client, technician roles)
- **File uploads:** `multer` with in-memory storage, limited to 10MB per file and 5 concurrent uploads to prevent memory exhaustion
- **Config:** Centralized in `config.js`, reads from environment variables with sensible defaults

### Frontend
- **Architecture:** Multi-page application (MPA) — each portal is a separate HTML file in `/public`
- **Framework:** React 18 loaded via CDN unpkg, JSX compiled in-browser by Babel Standalone (no build pipeline)
- **Styling:** Tailwind CSS via CDN with custom theme config inline in each HTML file
- **Pages:**
  - `/index.html` — Internal staff dashboard (project tracker)
  - `/client.html` — Simplified client-facing project view
  - `/portal.html` — Full client portal (inventory, support tickets, documents, announcements)
  - `/service-portal.html` — Field technician service report portal
  - `/admin-hub.html` — Full admin interface (users, projects, notifications, analytics, settings)
  - `/knowledge.html` — Knowledge Hub
  - `/changelog.html` — Changelog viewer
  - `/login.html` — Unified login page with role-based redirect
  - `/password-reset.html` — Password reset flow
  - `/link-directory.html` — Portal URL reference page

### Data Storage
- **Primary database:** `@replit/database` (Replit's built-in key-value store) — all application data stored as JSON values under string keys
- **No SQL/relational DB is used.** Data is organized by key namespaces (e.g., `users`, `projects`, `email_templates`, `pending_notifications`, `notification_log`, `activity_log`)
- **Caching:** In-memory cache on the server side for users (5s TTL) and project slugs (30s TTL) to reduce DB reads

### Notifications System
- **Queue:** Pending notifications stored under `pending_notifications` DB key; processed in batches
- **Email delivery:** `resend` npm package (Resend API) via `email.js`; supports single, bulk, and batch sending
- **Templates:** Admin-editable email templates stored in DB under `email_templates` key, with `{{variable}}` placeholder substitution at send time; 9 default templates seeded if empty

### PDF Generation
- **Libraries:** `pdfkit` (primary) and `pdf-lib` (for manipulation/merging)
- **Use cases:** Service report PDFs with embedded photos (fetched with timeout to avoid hangs), project summaries
- **Photo fetching:** Supports Google Drive file IDs and public URLs with an 8-second fetch timeout

### Project Templates
- JSON template files (e.g., `template-biolis-au480-clia.json`) define pre-built task sets for specific analyzer/CLIA configurations that can be loaded when creating new projects

---

## External Dependencies

### Third-Party Services
| Service | Integration | Purpose |
|---|---|---|
| **HubSpot** | `@hubspot/api-client` via Replit Connector (`hubspot.js`) | Deal/ticket sync, notes, task creation, service type mapping |
| **Google Drive** | `googleapis` via Replit Connector (`googledrive.js`) | File storage, document uploads, photo retrieval for reports |
| **Resend** | `resend` npm package (`email.js`) | Transactional email delivery (notifications, announcements, password resets) |

### Authentication to External Services
- HubSpot and Google Drive use **Replit Connectors** (`REPLIT_CONNECTORS_HOSTNAME` env var) for OAuth token management — tokens are fetched fresh and cached with a 60-second expiry buffer

### Key npm Packages
| Package | Role |
|---|---|
| `express` | HTTP server and routing |
| `@replit/database` | Primary data store (key-value) |
| `jsonwebtoken` + `bcryptjs` | Auth (JWT issuance, password hashing) |
| `multer` | Multipart file upload handling |
| `pdfkit` + `pdf-lib` | PDF generation and manipulation |
| `uuid` | Unique ID generation for records |
| `axios` + `form-data` | HTTP requests to HubSpot REST APIs |
| `resend` | Email delivery |
| `googleapis` | Google Drive API access |

### Environment Variables Required
- `JWT_SECRET` — JWT signing secret
- `RESEND_API_KEY` — Resend email API key
- `EMAIL_FROM_ADDRESS` — Sender email address
- `REPLIT_CONNECTORS_HOSTNAME` — Replit connector host for HubSpot/Google Drive OAuth
- `REPL_IDENTITY` or `WEB_REPL_RENEWAL` — Replit identity token for connector auth
- Optional tuning vars: `PORT`, `BCRYPT_SALT_ROUNDS`, `HUBSPOT_POLL_INTERVAL_SECONDS`, etc. (all have defaults in `config.js`)