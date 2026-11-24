# SURFACE Audit

Proprietary, service-first metrology assurance and consulting workspace. Independent of SURF-AI.

## v0.3 — PostgreSQL foundation

The existing dashboard and audit checklist remain available in **browser demo mode by default**.
v0.3 adds a Prisma/PostgreSQL schema, audit CRUD endpoints, and an explicitly enabled **local-development database mode**. It does not include authentication and **must not be deployed or used for actual customer data**.

### Requirements
- Node.js 22 (portable Windows Node.js is supported)
- A local PostgreSQL instance with a database and a least-privileged application account

### Windows Anaconda Prompt (cmd.exe)
Set your existing Node.js path:

```bat
set "PATH=C:\\Users\\vijred\\Desktop\\Vijeth\\website\\node-v22.23.5-win-x64\\node-v22.23.5-win-x64;%PATH%"
cd /d C:\\Users\\vijred\\Desktop\\Vijeth\\website\\Surface-Audit
npm install
```

### Run in browser demo mode (no database necessary)
```bat
npm run dev -- -p 3001
```
Open http://localhost:3001.

### Opt into development PostgreSQL mode
1. Install and start PostgreSQL. Create a database `surface_audit` and application user with database ownership/appropriate schema creation permissions for development. Do not use superuser credentials in the app.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your local connection string. Replace the example password, never commit it.
3. In `.env.local`, change:
   `SURFACE_AUDIT_ENABLE_LOCAL_API="true"`
   `NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE="postgres"`
4. Run:
```bat
npm run db:generate
npm run db:migrate -- --name init
npm run lint
npm run build
npm run dev -- -p 3001 -H 127.0.0.1
```
5. Visit http://127.0.0.1:3001. The database starts **empty**: create a new audit and open its checklist. Click **Save assessment to PostgreSQL** when editing a checklist. Audit status saves when changed.

**Do not expose this server on any network**, and do not enter sensitive or identifiable client records. The development API explicitly rejects all requests under `NODE_ENV=production`. It does not yet provide user access controls, controlled audit logs, signed reports, or real evidence file storage.

Browser demo entries are **not automatically migrated** into PostgreSQL. Demo CAPA checkboxes remain in browser storage. Preserve any local demo notes before switching modes.

### Validate
```bat
npm audit
npm run lint
npm run build
```
Avoid `npm audit fix --force` without inspecting the changes.

### Roadmap
1. **v0.3:** PostgreSQL persistence foundation and optional development database mode.
2. **v0.4:** Secure authentication and authorization, then server-side multi-entity data management.
3. Normalized requirements, equipment, evidence metadata, audit trails, and report approvals.
4. Controlled PDF generation and optional enterprise connectors.

SURFACE Audit audits processes and evidence. It does not calculate surface texture parameters or replace professional metrology software.

## v0.4 local operator authentication + audit activity history

This stage adds a password-protected development-only session, checks authenticated access to all audit APIs, enforces same-origin API writes, and records audit create/edit events in an `AuditEvent` table.

**Setup:** In `.env.local`, supply `SURFACE_AUDIT_ADMIN_USERNAME`, generate a scrypt password hash with `node scripts/generate-local-password.mjs`, and generate a 32-byte random secret using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Set `SURFACE_AUDIT_ADMIN_PASSWORD_SCRYPT` and `SURFACE_AUDIT_SESSION_SECRET` to the generated values. Do not commit `.env.local`.

Run `npm run db:generate` and `npm run db:migrate -- --name add_audit_events` against a local throwaway database. Start the app on loopback (`npm run dev -- -p 3001 -H 127.0.0.1`) and sign in at `/login`.

**Limitations:** This is a single-operator, development-only authentication prototype: signed sessions expire after eight hours, but there is no central identity provider, multi-user authorization, password reset, server-side revocation, or rate limiting. Audit events are ordinary database rows, not immutable or cryptographically tamper-evident. It must not be deployed publicly or used for confidential client data.


## v0.5 — Consulting registry foundation

The dashboard's **Clients & Projects**, **Equipment & Traceability**, and **Audit Templates** sections now have database-backed registers and creation forms when local PostgreSQL mode is enabled.

- Clients: names and counts of related audits/projects.
- Projects: belong to existing clients, with optional reference number.
- Equipment: unique instrument identifier, name, instrument type, and optional calibration due date.
- Templates: title, revision, description, and an ordered list of review criteria captured as draft JSON.

These are **development-stage records**. Template requirements are not yet applied to audits; equipment records are not yet linked to a specific audit or calibration certificate. A date in a field is not proof of calibration or traceability. No uploads, approval history, or validated ISO-compliance checks are implemented.

The API endpoints `/api/clients`, `/api/projects`, `/api/equipment`, and `/api/templates` use the existing development-only authenticated access check. PostgreSQL starts empty and browser demo mode continues to show a guarded informational state for these modules.

To update a disposable local development database after switching to v0.5, run `npm run db:generate` and `npm run db:migrate -- --name consulting_registry`. Back up important local data before running migrations. The GitHub CI integration test uses an isolated temporary PostgreSQL instance and `prisma db push`.

**Security boundary:** Do not enter customer-identifiable or confidential records. Single-operator local authentication is not production authorization. A future release must connect controlled template revisions, equipment evidence and approvals to audit engagements.

## v0.6 — Controlled audit execution foundation

When creating an audit in **local PostgreSQL mode**, choose an optional client project and an optional audit-template draft. The API checks that the project belongs to the named client and **copies the template's requirements and revision into the audit**. Once saved, edits to a template draft do not change that audit's criteria. The audit workspace displays its selected project, frozen template revision, and corresponding checklist. Previously created audits retain the original demonstration checklist.

The audit workspace can assign instruments from the equipment register. Assignments and checklist revisions create audit activity events. Evidence references remain plain text per requirement; they are not stored or verified as controlled documents. Equipment assignments do not assert traceability or calibration validity.

Run `npm run db:generate` and then `npm run db:migrate -- --name audit_engagement_links` for a local disposable PostgreSQL development database. The isolated GitHub integration test uses `prisma db push`; production migrations, template change history, approvals, finding/CAPA ownership, and secure document handling remain future work.

This milestone is **not production-ready** and should not contain real or confidential customer records.

## v0.7 — Findings, CAPA and evidence-reference management

The database-backed audit workspace includes a **Findings, CAPA & evidence references** panel. It allows the local operator to:

- Create findings linked to specific assessment requirement codes, with descriptions and severity.
- Assign corrective actions to open findings with an owner, due date and description.
- Track action status and record a closure evidence reference and verifier identifier.
- Move findings through open, in-progress, ready-for-verification and closed stages.
- Register separate evidence **references** against a requirement, without uploading files.
- Track creation and changes with existing development-stage audit events.

**Closure gate:** At least one corrective action must be present, and every action must be marked verified before a finding can be closed. An action cannot be verified without a closure evidence reference and verifier identifier. This validates required fields, **not** the real identity of the verifier or the underlying evidence.

Only requirement codes belonging to the audit's frozen template snapshot (or the legacy eight-item checklist) are accepted.

To add the models to a disposable local development database, generate the Prisma client and run `npm run db:migrate -- --name findings_capa_evidence`. PostgreSQL CI tests use an isolated temporary database.

**Not production-ready:** All records are local-development prototypes. Evidence references are plain strings, not stored or authenticated documents; audit-event rows are not tamper-evident, and identity is a single-operator development login. There are no independent reviewer permissions, approved verification signatures, or validated ISO conformance decisions. Do not enter confidential customer records.
