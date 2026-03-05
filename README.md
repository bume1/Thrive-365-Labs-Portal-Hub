# Thrive 365 Labs Web App

A comprehensive platform for managing clinical laboratory implementations, service operations, and client engagement. The hub integrates launch management, field service reporting, client portals, notification automation, and CRM operations into a unified multi-portal system.

**Current Version**: 3.0.0

---

## Table of Contents

1. [Technical Stack](#technical-stack)
2. [Application Portals](#application-portals)
3. [Usage Guidelines](#usage-guidelines)
4. [Administrator Reference](#administrator-reference)
5. [Open Source Licenses](#open-source-licenses)
6. [Support & Maintenance](#support--maintenance)

---

## Technical Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Runtime** | Node.js >= 14.0.0 | Hosted on Replit (Node 20) |
| **Backend** | Express.js REST API | Single `server.js` file |
| **Frontend** | React 18 (CDN via unpkg) | In-browser Babel JSX transpilation |
| **Styling** | Tailwind CSS (CDN) | Inline config per portal |
| **Database** | Replit Key-Value Store | No SQL; key-value pairs |
| **Authentication** | JWT + bcryptjs | 24-hour token expiry, 10-round salt |
| **PDF Generation** | PDFKit, PDFMake | Service and validation reports |

### External Integrations

| Service | Purpose |
|---------|---------|
| **HubSpot** | CRM integration: deal/company pipeline sync, stage mapping, ticket management, file storage |
| **Google Drive** | Document storage for soft-pilot checklists and file hosting |
| **Resend Email** | Automated email notifications, reminders, and subscription management |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `JWT_SECRET` | **Yes** | Token signing — always set in production |
| `PORT` | No (default: 3000) | Server port |
| `HUBSPOT_PRIVATE_APP_TOKEN` | For HubSpot | HubSpot API access |
| `HUBSPOT_WEBHOOK_SECRET` | Recommended | Webhook request validation |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | For Google Drive | Google service account credentials (JSON) |
| `REPLIT_CONNECTORS_HOSTNAME` | Auto-set by Replit | Required for HubSpot/GDrive OAuth connectors |

### Custom Domain Configuration

The application supports custom domains for client portal URLs (e.g., `launch.yourdomain.com/{slug}`).

Configure via **Admin Hub > Settings > Client Portal Domain**.

---

## Application Portals

| Portal | URL | Auth | Purpose |
|--------|-----|------|---------|
| Unified Login | `/login` | No | Central authentication hub; routes users to correct portal |
| Admin Hub | `/admin` | Yes | System administration, user management, automation |
| Launch App | `/launch/home` | Yes | Project implementation tracking and task management |
| Project View | `/launch/:slug` | Yes | Individual project board |
| Client Portal | `/portal/:slug` | Yes | Client-facing progress, inventory, documents, support |
| Service Portal | `/service-portal` | Yes | Field service reports, validation assignments, PDF generation |
| Knowledge Hub | `/knowledge` | No (Public) | Documentation and guides |
| Changelog | `/changelog` | No (Public) | Version history |
| Link Directory | `/directory` | No (Public) | Resource links and quick references |

---

## Usage Guidelines

### User Roles & Permissions

| Role | Access Level |
|------|--------------|
| **Admin** | Full system access, all portals, all projects, user management |
| **Team Member** | Launch App (assigned projects), task management |
| **Client** | Client portal only (assigned practice) |
| **Vendor** | Service portal for assigned clients |

In addition to roles, individual permission flags control access to specific portals:

| Flag | Portal Unlocked |
|------|----------------|
| `hasImplementationsAccess` | Launch App (`/launch`) |
| `hasAdminHubAccess` | Admin Hub (`/admin`) |
| `hasServicePortalAccess` | Service Portal (`/service-portal`) |
| `hasClientPortalAdminAccess` | Client portal admin features |

### Portal Feature Overview

#### Unified Login Hub (`/login`)
- Single sign-in for all roles; routes to appropriate portal after authentication
- Forgot password flow (submits reset request to admin)
- Forced password change on first login (`requirePasswordChange` flag)
- Role and permission badges displayed on account card
- In-app feedback submission (bug reports and feature requests)

#### Launch App — Project Tracker (`/launch`)
- Create projects from the 102-task Biolis AU480 CLIA implementation template
- Phase-based task board: Phase 0 through Phase 4 (Financials)
- Draft / Published status toggle per project (unpublished projects hidden from clients)
- Task management: owners, due dates, start dates, dependencies, notes, subtasks, file attachments
- Subtask notifications: overdue and new assignment alerts
- Client task assignment with configurable visibility (`showToClient`)
- Bulk task editing and bulk operations
- CSV import/export with automatic dependency re-linking
- Project cloning and per-project access levels (read / write / admin)
- HubSpot CRM sync: bi-directional deal/company stage updates
- Go-live date management and project status (active, paused, completed)
- Combined onboarding document view (task-attached files + admin uploads)

#### Client Portal (`/portal/:slug`)
- **Home**: Project summary, announcements feed, quick stats (inventory, tickets, checklist status)
- **Milestones**: Phase-by-phase task tracking in list or timeline view; per-phase progress bars; task notes, file attachments, and subtask status
- **Soft Pilot Checklist**: Multi-step form with digital signature capture (name, title, date); save-in-progress and final submission; embedded document support
- **Inventory**: Weekly inventory submission with batch tracking; submission history; admin-managed custom inventory items
- **Support**: Ticket submission by category; ticket history; email notifications on updates
- **Documents**: Browse and search client-facing documents by category; service report attachments visible to client
- **Validation Progress**: Multi-day validation tracking with segment cards (onsite/offsite); days-logged vs. expected progress
- **Portal Admin** (requires `hasClientPortalAdminAccess`): Manage announcements, upload documents, configure portal branding (name, welcome message, primary color), manage client profiles

#### Service Portal (`/service-portal`)
- **Dashboard**: Assigned service visits, active validations, service report stats
- **Service Reports**: Submit, edit, and track field service reports with photo upload, file attachments, and digital signature capture; filter and sort by status, date, service type, or client
- **Validation Management**: Multi-day validation assignments with day-by-day segment logging (hours, phase type, notes); finalize with technician and customer signatures; PDF report generation
- **Vendor Assignment**: Admin tool to assign service visits to vendors/technicians; create new vendors with client assignments
- **PDF Generation**: Downloadable service and validation reports via PDFKit/PDFMake

#### Admin Hub (`/admin`)
- **User Management**: Create/edit/delete accounts; assign roles, permission flags, projects, and access levels; client assignment for vendors; email subscription toggle; bulk password reset (all/clients/vendors/users); export user list to Excel (XLSX)
- **Inbox**: Review feedback submissions (bug reports, feature requests) and pending password reset requests
- **Notifications & Automation**: Configure notification queue (enabled/disabled, check interval, daily send limit, max retries); manage automated reminder scenarios (overdue tasks, soft pilot reminders, client activity nudges, inventory submission reminders); view notification history; unsubscribe/resubscribe support
- **Service Portal Settings**: Vendor and client configuration; manage service portal access
- **Client Portal Settings**: Portal branding, welcome message, primary color
- **Activity Log**: Audit trail of system actions (last 500 entries)

### Best Practices

**Security**
- Change the default admin password immediately after first login
- Always set the `JWT_SECRET` environment variable in production
- Regularly review user access permissions and assigned projects
- New users are prompted to change their password on first login

**Project Management**
- Use the 102-task template as the starting point for new implementations
- Assign task owners by email for clear accountability
- Keep task notes updated for accurate HubSpot sync
- Use draft status while configuring a new project; publish when ready for client visibility

**Client Portals**
- Configure a unique `clientLinkSlug` for each client practice — note that changing the practice name regenerates the slug and breaks existing portal URLs
- Upload client logos for a branded portal experience
- Use the announcements feature to communicate important updates
- Review inventory submissions weekly

**Data Management**
- Regularly sync projects to HubSpot to maintain CRM accuracy
- Use CSV export for backup and external reporting
- Archive completed projects by setting status to `completed`

---

## Administrator Reference

### Default Admin Login

- **URL**: `/login`
- **Email**: bianca@thrive365labs.com
- **Password**: Thrive2025!

> **Important**: Change this password immediately after first login.

### Key Admin Functions

**User Management**
- Create and manage user accounts with role-based permissions
- Toggle individual portal access flags per user
- Assign projects and per-project access levels (read / write / admin)
- Process password reset requests from the Inbox
- Bulk password reset for user groups
- Export user list to Excel

**Project Management**
- Create projects from the 102-task Biolis AU480 CLIA template
- Clone existing projects for similar implementations
- Manage task templates and phase structure
- Configure HubSpot stage mapping for pipeline sync
- Control project draft/published status

**Client Portal Administration**
- Configure portal branding (name, welcome message, primary color)
- Manage announcements and client-facing documents
- Monitor inventory submissions and support tickets
- Manage client profiles and portal slugs

**Notification Automation**
- Enable/disable the notification queue and configure send limits
- Set automated reminders for overdue tasks, soft pilot submissions, client nudges, and inventory
- Review notification delivery history
- Manage client email subscription preferences

**System Settings**
- Configure custom domain for client portal URLs
- Manage HubSpot integration and pipeline stage mapping
- View activity log and audit trail
- Process feedback and bug reports from the Inbox

### API Endpoint Groups

| Group | Prefix | Coverage |
|-------|--------|----------|
| Authentication | `/api/auth/*` | Login, password reset, change password (8 endpoints) |
| Projects | `/api/projects/*` | CRUD, clone, export/import (9 endpoints) |
| Tasks | `/api/projects/:id/tasks/*` | Task management, files, notes, subtasks (15+ endpoints) |
| Templates | `/api/templates/*` | Template CRUD and apply (8 endpoints) |
| Users | `/api/users/*` | User management (5 endpoints) |
| Admin | `/api/admin/*` | Admin operations, bulk actions (12+ endpoints) |
| HubSpot | `/api/hubspot/*` | Sync, pipelines, tickets, webhooks (7 endpoints) |
| Client Portal | `/api/client-portal/*` | Portal data and settings (3 endpoints) |
| Announcements | `/api/announcements/*` | CRUD (4 endpoints) |
| Client Documents | `/api/client-documents/*` | Document management (5 endpoints) |
| Service Reports | `/api/service-reports/*` | Field reports (5 endpoints) |
| Validation Reports | `/api/validation-reports/*` | Validation assignments and tracking (4 endpoints) |
| Inventory | `/api/inventory/*` | Submissions and templates (8 endpoints) |
| Service Portal | `/api/service-portal/*` | Portal configuration (2 endpoints) |
| Changelog | `/api/changelog/*` | Version history management (6 endpoints) |

---

## Open Source Licenses

This application uses the following open-source packages:

| Package | License | Purpose |
|---------|---------|---------|
| express | MIT | Web application framework |
| react | MIT | User interface library |
| react-dom | MIT | React DOM rendering |
| tailwindcss | MIT | CSS utility framework |
| bcryptjs | MIT | Password hashing |
| jsonwebtoken | MIT | JWT authentication |
| axios | MIT | HTTP client |
| cors | MIT | Cross-origin resource sharing |
| body-parser | MIT | Request body parsing |
| multer | MIT | File upload handling (memory storage, 10MB limit) |
| uuid | MIT | Unique identifier generation |
| pdfkit | MIT | PDF generation |
| pdfmake | MIT | PDF document creation |
| googleapis | Apache-2.0 | Google Drive API integration |
| @hubspot/api-client | Apache-2.0 | HubSpot CRM integration |
| form-data | MIT | Form data handling |

### License Compliance Notes

- **MIT License**: Permits commercial use, modification, and distribution with attribution
- **Apache-2.0 License**: Permits commercial use with attribution and preservation of license notices

All open-source components are used in compliance with their respective licenses.

---

## Support & Maintenance

For technical support or questions:
- Use the in-app feedback form (available from the login hub)
- Contact Diamond Element Consulting
- Check the Knowledge Hub (`/knowledge`) for role-specific documentation

**Hosting**: Application is hosted on Replit (autoscale deployment; port 5000 internal, 80 external). Billing managed by Thrive 365 Labs.

**Maintenance & Support**: Application maintenance, updates, and technical support are provided by **Bianca G. C. Ume, MD, MBA, MS** until an internal developer is onboarded.

For technical support or maintenance requests, contact Bianca G. C. Ume, MD, MBA, MS.

---

## License

Proprietary — Thrive 365 Labs

---

*Developed by Diamond Element Consulting for Thrive 365 Labs*
*Last Updated: March 2026*
