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

## v0.8 — Closure readiness and draft reporting

A new **Reporting & closure readiness** panel inside database-backed audit workspaces calls the authenticated `/api/audits/:id/report` endpoint and lists missing checklist assessments, missing reviewer/summary information, nonconformities without structured findings, and findings with outstanding corrective actions. Each assessed requirement must also contain an observation or evidence reference.

The status transition to **Completed** is rejected with HTTP 409 and explicit blockers until the configured checks pass. Save checklist changes before attempting completion; combining a new assessment with a completion request is intentionally rejected.

The new printable `/reports/:id` view provides the saved assessment, frozen template revision, linked equipment, evidence references, findings, actions and a draft readiness summary. The browser's **Print / Save as PDF** feature can create an *unapproved development draft*. The app itself does **not** produce a controlled PDF, digitally signed report, or independently verified compliance certificate.

**Limitations:** Readiness checks validate data completeness, not quality, ISO conformity, traceability or independent approval. Audit events are ordinary mutable database rows; the report is regenerated from current database contents and is not a versioned signed snapshot. Concurrent edits, role separation, formal approval signatures, actual evidence verification, production migrations and customer-data protections remain out of scope. Do not deploy or enter sensitive client records.

## v1.0 — Consulting operations center (development preview)

A major integration milestone connects the existing audit workspace to live, cross-engagement consulting operations.

**Live PostgreSQL dashboard:** In database mode, the main dashboard and Findings & CAPA navigation now show aggregate counts and real records instead of the demonstration readiness charts and hardcoded action lists. The Evidence Library lists requirement-linked reference metadata; Reports lists draft and sealed reports. Views include search, owner/client context, due-date flags, audit navigation, and report links. `GET /api/operations` reads at most 500 recent records per category.

**CSV handoff:** `GET /api/operations/export?type=audits|findings|actions|evidence` exports UTF-8 CSV for local review and work planning. All endpoints require the existing local development session. CSV strings are quoted, escaped and prefixed where necessary to reduce spreadsheet formula injection. These are convenience exports, not controlled record packages or trustworthy preservation artifacts.

**Sealed report copy:** When an audit meets its v0.8 readiness checks and is transitioned to Completed, the development app captures a JSON report copy in `AuditReportSnapshot`, records a SHA-256 digest, and returns the saved copy on subsequent report requests. The printable report shows whether the stored digest matches its content. The completed audit's checklist, equipment assignments, finding records, actions and evidence-reference creation endpoints then reject edits. Completion is currently **irreversible** in the local prototype; no reopen workflow is implemented.

**Cautions and limitations:** A SHA-256 digest stored beside a report is *not an independently anchored signature*: anyone with unrestricted database write access can alter both report and digest. This mechanism does not create a tamper-proof archive, approved report, legally compliant electronic signature or certified traceability evidence. Database reads and completion checks are not fully protected from concurrent-write races. The app remains single-operator, local-development only, without full authorization, credential rate limiting, file custody controls or production database migrations. **Do not use real customer or confidential data.**

To upgrade a **disposable** development PostgreSQL database after checking out v1.0, run `npm run db:generate`, then `npm run db:migrate -- --name audit_report_snapshot`. GitHub CI creates a separate ephemeral Postgres service and verifies operational exports, reporting and write restrictions through HTTP.

## v1.1 — Local evidence custody and requirement-linked file manifest

The audit workspace now includes an **Evidence file vault** next to the existing evidence-reference and CAPA functionality. In explicitly enabled local PostgreSQL mode, a signed-in operator can attach PDF, PNG, JPEG and UTF-8 TXT files to individual audit requirements. Files are stored as PostgreSQL `bytea` records alongside a SHA-256 digest, sanitized filename, content type, requirement code, size, operator name, and creation timestamp.

- **Storage limits:** 1 MiB per file and 40 attached files per audit. The cap prevents accidental large files but does not provide full resource-quota enforcement or malware scanning.
- **File checks:** The server checks file size, allowed media types and basic file signatures; it validates exact byte length and SHA-256 when each file is downloaded. Downloads use authenticated endpoints, `application/octet-stream`, `Content-Disposition: attachment` and `nosniff` rather than rendering potentially unsafe content inline.
- **Audit lifecycle:** Uploads are refused for completed audits. Evidence-file additions create an audit-activity record. Once completed, the saved report contains the list of linked filenames, identifiers and digests. It does **not** embed file content.
- **Readiness:** The report assembly checks the stored attachment bytes against their recorded hashes and blocks completion if it detects mismatches. This is an application-level consistency test, not an independent digital signature.

**Security warning:** This is a development-only document vault, *not* a production document management system. Filename and magic-byte checks do not detect all malicious content. Files are not antivirus-scanned, virus-sandboxed, encrypted using per-client keys, signed by an independent reviewer, externally backed up, or held in independently tamper-evident storage. An operator with direct database access can alter both files and digests. Do not upload confidential/identifiable customer files, real calibration records or regulated data.

For a new **disposable** local development database, regenerate Prisma Client and run `npm run db:migrate -- --name evidence_file_vault`. Back up any existing local development database first. The isolated GitHub CI job creates tables using `prisma db push`, not production database migrations, and verifies upload/download, permission rejection, sealed-audit behavior and attached-file manifests.

**Current deployment gate:** Multi-user role permissions, actual independent approval, document malware scanning, externally anchored evidence hashes, tested production migration history, and encrypted/offsite backups must be implemented and reviewed before any external deployment or real customer usage.

### Portable audit dossier and offline verification

The **Export audit dossier** link on `/reports/:id` downloads an authenticated JSON bundle containing the saved audit report and its attached files encoded as base64. Before exporting, the server recalculates all attachment hashes and refuses to package records with mismatches. Export is limited to 12 MiB of original attachment bytes; use individual download links for larger collections.

To verify a downloaded dossier on a machine with Node.js installed:

```bat
node scripts\verify-dossier.mjs C:\path\to\surface-audit-dossier-ID.json
```

The offline verifier checks the report SHA-256, the embedded evidence bytes and sizes, file identifiers and the report's attached-file manifest. It returns a non-zero exit code when it detects a mismatch. CI tests also alter an attachment and report field to confirm failures are detected.

**Security boundary:** A JSON file with embedded hashes does not establish the identity of the author, an authoritative timestamp, or an independently anchored signature. Someone who can replace the entire dossier can also recalculate its embedded hashes. Treat this as a portable, internally verifiable **development copy**, not an approved record or preservation archive. Exported bundles include full uploaded file contents and require appropriate handling; do not export confidential customer records from this prototype.
