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

## v1.2 — Individual local accounts and independent review governance

The older single shared-operator login is superseded by **database-backed local operator identities**. A user must sign in using a uniquely named account created in the local development PostgreSQL database. Cookies hold an opaque, random session token; PostgreSQL stores only its SHA-256 digest and an expiry time. Sign-out deletes that session. An administrator can disable an account and revoke its sessions at `/operators`.

Roles: **ADMIN** (read, edit, approve others' work, account status); **EDITOR** (read and edit, cannot approve); **REVIEWER** (read and independently review, cannot edit assessment data); **VIEWER** (read only). All database APIs check the session server-side. A review can be recorded only when the audit is **In review**, and the reviewing operator cannot be the operator who last changed the audit. Approval requires current checklist/CAPA readiness. An approval expires if subsequent operational events change the audit. Audit completion requires a current independent approval, then retains the existing sealed report snapshot.

**Local first-use setup:** Configure a throwaway PostgreSQL development database, `SURFACE_AUDIT_ENABLE_LOCAL_API=true`, and `NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE=postgres` in `.env.local`. Run `npm install`, `npm run db:generate`, then `npx prisma migrate dev --name local_operator_governance` against the disposable database. Create separate local accounts using:
```bat
node scripts/create-local-operator.mjs local-admin ADMIN
node scripts/create-local-operator.mjs auditor EDITOR
node scripts/create-local-operator.mjs reviewer REVIEWER
node scripts/create-local-operator.mjs observer VIEWER
```
In v1.3, the CLI operator-creation script reads the project-root `.env.local` on Node 22; earlier v1.2 setup instructions requiring duplicate shell configuration are superseded. Never commit passwords. The older `SURFACE_AUDIT_ADMIN_USERNAME`, `SURFACE_AUDIT_ADMIN_PASSWORD_SCRYPT` and `SURFACE_AUDIT_SESSION_SECRET` variables are no longer used by the new local login.

**Important limits:** This is role separation within a **local development prototype**, not a production identity system. There is still no tested production migration history, MFA, rate limiting, centralized identity, trustworthy audit-signature service, robust transaction isolation for concurrent reviewer/editor changes, or independent external timestamping. A local DB administrator can still alter review or history data. Review approval is a development workflow decision, **not a regulatory signature or calibration approval**. Do not expose the application publicly or enter confidential customer data.

The isolated CI database seeds fake admin/editor/reviewer/viewer identities and tests session revocation, role restrictions, self-review rejection and independent approval. Do not apply a new migration blindly to a real database; back it up and review the generated SQL first.


## v1.3 — Local security gate and versioned PostgreSQL baseline

This release introduces three safeguards together:

1. **Account lockout and recovery.** Five failed password attempts in a fifteen-minute period temporarily block a local operator login. Errors remain generic. A signed-in administrator can inspect failed-attempt counts and reset a lockout at `/operators`. This is account-based throttling, **not** an IP-wide denial-of-service defense or distributed rate limiter. Multiple concurrent attempts are not yet transactionally serialized.
2. **Content-bound independent review.** The audit record stores the last authenticated assessment preparer. An operator cannot approve an assessment they prepared, even if someone else subsequently changes the workflow status. Approval stores a SHA-256 of the substantive report content; generated timestamps and activity-event counts are excluded. Changing underlying assessment content invalidates approval, even if no normal audit event is created. A new independent review is needed before completion. The digest still is not externally anchored or a regulatory electronic signature.
3. **Committed initial database migration.** The full v1.3 schema is captured in `prisma/migrations/20261125164000_initial_baseline/migration.sql`. The GitHub PostgreSQL job starts with an empty database, runs `prisma migrate deploy`, verifies that its schema matches `schema.prisma` using Prisma's `migrate diff --exit-code`, then runs the complete authenticated HTTP regression suite. This replaces CI's earlier `prisma db push` shortcut.

### First-time setup of a disposable local development database

Set `DATABASE_URL` to a new, empty PostgreSQL development database. Set `SURFACE_AUDIT_ENABLE_LOCAL_API=true` and `NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE=postgres` in your local development environment. With Node 22 installed:

```bat
npm install
npm run db:generate
npx prisma migrate deploy
node scripts/create-local-operator.mjs local-admin ADMIN
node scripts/create-local-operator.mjs auditor EDITOR
node scripts/create-local-operator.mjs reviewer REVIEWER
npm run dev -- -p 3001
```

The operator-creation script now reads a project-root `.env.local` on Node 22. Ensure `DATABASE_URL` and `SURFACE_AUDIT_ENABLE_LOCAL_API=true` are set there before running it. The project must use a disposable local database. Never commit passwords or actual client records.

### Existing local databases require a separate decision

**Do not apply the initial baseline migration to an existing database containing tables.** Earlier prototypes used `prisma db push` and have no migration ledger. Back up and inspect any database with information you want to preserve. The safest supported development path is to use a **fresh, disposable database** with the committed migration. Adopting a pre-existing database requires a separately reviewed data-preserving migration or a carefully validated Prisma baseline-resolution procedure; it is deliberately not automated by this release.

### Security limits

The application remains **development only**. There is no public-service network hardening, MFA, per-IP distributed throttling, encrypted offline backup, external audit-history anchoring, trusted timestamps or production migration-upgrade test from historical databases. Approval and content hashes prove only consistency with database-stored data, not independent authenticity. The PostgreSQL CI gate validates a fresh installation, not upgrades of customer databases. Never expose the local API publicly or use confidential client files.


## v1.4 — Safe local database upgrades and concurrent audit write protection

**Versioned database upgrade path:** The new additive migration `20261125190000_audit_revision` introduces a monotonic audit revision field. GitHub CI explicitly applies the v1.3 migration first, upgrades through the v1.4 migration, validates migration status and absence of schema drift, then runs the full PostgreSQL HTTP test suite. This exercises an incremental upgrade between **versioned, disposable development databases**, not an upgrade from every historical v0.x database.

**Read-only database inspector:** Run `node scripts/inspect-local-db.mjs` before running migrations against an existing local database. The script refuses remote/non-loopback database hosts and prints whether the database is empty, is already versioned and current, needs an incremental versioned migration, has failed migrations, or contains legacy tables without a Prisma migration ledger. The inspector **never applies migrations, changes data or creates backups**.

**Concurrency protection:** Audits now have a database revision. Assessment and status saves claim their previously read revision; a stale edit returns HTTP 409 rather than silently overwriting another operator's changes. The dashboard and audit workspace pass their last observed revision and refresh after saving. Independent review decisions also claim the audit revision transactionally before recording approval. Child-record writes (equipment, findings, corrective actions, evidence references, file uploads) first lock and advance the audit revision inside their transaction, ensuring a concurrent completion operation cannot silently succeed with out-of-date records.

**Limits:** Conflict detection is based on local PostgreSQL row coordination; it is not yet a complete distributed concurrency, backup/recovery or regulatory approval system. Reviewers still need to verify underlying evidence and production configuration. The service remains local-development only.

### Suggested local upgrade sequence

On a disposable database already using the committed v1.3 migration ledger:

```bat
node scripts/inspect-local-db.mjs
npx prisma migrate status
npx prisma migrate deploy
npm run db:generate
npm run dev -- -p 3001
```

Review and back up the database before changing its schema. **For legacy databases without `_prisma_migrations`, stop and inspect first; do not run `migrate deploy` blindly.** For a brand-new empty database, the complete versioned migration chain can be deployed directly. No actual client data or public deployment is supported yet.


## v1.5 — Backup/restore drills and append-only history safeguards

A repeatable, **local-development-only** PostgreSQL recovery toolkit now handles backup, archive verification, and restore into a **separate, already-created, empty** database. Install the PostgreSQL client commands `pg_dump`, `pg_restore` and `psql` (matching your PostgreSQL server major version), and ensure they are available on your Windows PATH. The Node 22 script reads the project-root `.env.local`. It accepts only loopback PostgreSQL connections and refuses production mode.

**Before backups, shut down the SURFACE Audit development server and stop all other database writers.** This is a single PostgreSQL consistent snapshot, not a coordinated hot backup of other external services or files. Evidence files stored in PostgreSQL are included.

On Windows Anaconda Prompt from the SURFACE Audit project directory:

```bat
node scripts/local-recovery.mjs backup C:\\surface-audit-backups\\audit-2026-11-25
node scripts/local-recovery.mjs verify C:\\surface-audit-backups\\audit-2026-11-25
```

The new directory receives `surface-audit.backup` (PostgreSQL custom-format archive) and `manifest.json` (SHA-256 and byte length). The tool refuses to overwrite an existing backup, and verification fails for changed archive bytes. **The archive is not encrypted.** Handle it as confidential if your development database contains any information you cannot disclose; keep offsite, access-controlled copies through independently managed storage.

**Restore drill (new empty database only):** First create a separate database named `surface_audit_restore` in your local PostgreSQL server with the same account permissions, then run:

```bat
node scripts/local-recovery.mjs restore C:\\surface-audit-backups\\audit-2026-11-25 surface_audit_restore --confirm=surface_audit_restore
```

The script refuses the source database, a nonempty target, remote hosts, an unconfirmed name, or an archive with the wrong digest. Restoration uses a single PostgreSQL transaction with error-on-failure behavior. **It never drops existing tables or overwrites an existing database.** After restore, update your local development `DATABASE_URL` only if you intentionally want to inspect the restored copy, and confirm the restored migration ledger and records before any further use.

**History protections:** A new versioned PostgreSQL migration installs triggers that reject `UPDATE` and `DELETE` on `AuditEvent`, `AuditReview`, `AuditReportSnapshot`, and `EvidenceAsset`. The database-backed application can still append new records. These guards protect against accidental or ordinary application-role alteration but **are not a WORM archive**: a database owner or superuser can disable triggers, alter data, or replace backups. Separate privileged infrastructure, externally anchored signatures and operational monitoring would be required for actual tamper-evident retention.

**CI verification:** The isolated PostgreSQL pipeline now creates populated audit records, attempts forbidden direct SQL mutations, backs up the database, deliberately corrupts the archive to check rejection, restores into a second empty database, compares audit/event/review/attachment/report counts and attachment content hashes, and verifies that another restore into the populated target is rejected. Production disaster recovery, backup encryption, trusted timestamps, migration upgrades from all legacy databases, and an independent offsite recovery drill remain untested.

The application remains a **local-development prototype only**. Do not expose it publicly or store confidential customer evidence.


## v1.6 — Encrypted local backup package and configuration preflight

**Local deployment preflight:** Before starting the database-backed application, run `node scripts/local-preflight.mjs`. The read-only check verifies Node 22, development mode, the explicit PostgreSQL enable flag, a loopback database URL with credentials, and a loopback web-server bind host. For Windows start the app with `npm run dev -- -H 127.0.0.1 -p 3001`. **Preflight cannot independently verify a firewall, network accessibility, confidentiality, or user identities; it is not a production certification.** Use the local database inspector and Prisma migration status checks separately.

**Encrypted recovery package:** `scripts/secure-backup.mjs` uses AES-256-GCM authenticated encryption, a random 16-byte salt and 12-byte nonce, and scrypt to derive a key from a 20+ character passphrase. It combines the `surface-audit.backup` archive and `manifest.json` into a single `surface-audit.vault` file without replacing the originals.

1. Stop writers, perform a regular PostgreSQL backup using `node scripts/local-recovery.mjs backup C:\\surface-audit-backups\\audit-unencrypted`.
2. Validate it with `node scripts/local-recovery.mjs verify C:\\surface-audit-backups\\audit-unencrypted`.
3. Set a unique, high-entropy secret in the **local shell** without placing it in Git or command history. On Windows `cmd.exe` use `set "SURFACE_AUDIT_BACKUP_PASSPHRASE=<a unique long passphrase>"` (replace the placeholder).
4. Run `node scripts/secure-backup.mjs seal C:\\surface-audit-backups\\audit-unencrypted C:\\surface-audit-backups\\audit-secured`.
5. When needed, extract to **another, newly named directory**: `node scripts/secure-backup.mjs unseal C:\\surface-audit-backups\\audit-secured C:\\surface-audit-backups\\audit-extracted`. Run the standard verification and restore on that extracted directory, restoring **only to a different already-created empty local database**.

The encryption script refuses existing destinations, invalid passphrases and modified ciphertext, and accepts at most 256 MiB of development data. **It does not automatically delete or securely erase the original plaintext backup or the extracted plaintext.** Manage those files, backups and passphrases carefully. No password recovery exists. It is a developer encryption helper, not a hosted backup manager, offsite store, KMS or independently certified archive.

CI runs the normal populated PostgreSQL restore drill, then encrypts/decrypts the backup and checks byte equality; deliberately wrong passphrases and altered encrypted files must fail. It also verifies that the preflight rejects a wildcard bind address. See `PROJECT_HANDOFF.md` for a durable project handoff to new conversations.

**Status:** Local-development only. Do not expose database APIs publicly or store sensitive client records. Threat modeling, MFA, malware scanning, externally protected signing and operational security review are still required.


## v1.7 — Independently verifiable signed audit dossier (offline, development)

**Why this exists:** The previous dossier contained only hashes stored alongside the report; anyone who could replace the entire JSON package could recalculate those hashes. v1.7 adds an **offline Ed25519 signature** to a completed, integrity-verified audit dossier. The signing private key stays on a separate trusted workstation; it is never submitted to the Next.js app, database, GitHub, API, or dossier. Recipients must obtain and trust the **public key separately** from the signed package.

The workflow is available after **Completion** and successful snapshot/evidence consistency checks. The report page explains the offline signing option. In Windows Anaconda Prompt from the repository root:

1. **Generate a key pair on a trusted offline computer (once per signer).** Set the environment variable `SURFACE_AUDIT_SIGNING_PASSPHRASE` to a strong, unique passphrase (at least 20 characters; do not commit or paste it in chat). Then run:
   ```bat
   node scripts/dossier-signature.mjs keygen C:\\surface-audit-keys\\reviewer-key
   ```
   This creates `signing-private.encrypted.pem` (encrypted PKCS#8 Ed25519 private key) and `signing-public.pem` (shareable public key) in a **new** directory. Back up the private key and passphrase **separately**, and verify the recipient received the public key through an independently trusted channel. Never place private keys inside the repository or normal backup dossier.
2. **Export** the completed audit's JSON dossier from the report screen (must be sealed and pass the existing `verifyDossier` checks). Sign the whole package on the private-key computer:
   ```bat
   node scripts/dossier-signature.mjs sign C:\\audit-export\\dossier.json C:\\surface-audit-keys\\reviewer-key\\signing-private.encrypted.pem C:\\audit-export\\signed-dossier.json "Independent reviewer"
   ```
   The resulting signed JSON includes the dossier, the signer label, a self-reported local-clock time, the public-key fingerprint and an Ed25519 signature over **all these values**.
3. **Independently verify** on another machine using the separately trusted public key:
   ```bat
   node scripts/dossier-signature.mjs verify C:\\audit-export\\signed-dossier.json C:\\trusted-keys\\signing-public.pem
   ```
   Verification checks the expected public-key fingerprint, the Ed25519 signature, all report and evidence-file hashes, the sealed snapshot, and audit completion. It fails on wrong keys, modified metadata, changed reports or file bytes, wrong passphrase, or a draft/unsealed dossier. Outputs are never overwritten.

**Security meaning:** A valid signature demonstrates that the private key corresponding to the **trusted public key** signed that exact dossier. It does **not** independently validate real-world signer identity, authorization, calibrated measurements, malware safety, or a legally binding review. The embedded signing date is the signer's **untrusted local clock**, not a trusted timestamp. Compromised keys can sign forged content; maintain a public-key trust registry and revocation procedure before real deployment. No independent TSA, HSM, certificate authority, production key rotation or durable external evidence archive is implemented.

**CI:** After real authenticated audit execution and dossier export, isolated PostgreSQL CI generates disposable Ed25519 keys, signs the sealed dossier, verifies with the correct public key, and confirms rejection for the wrong key/passphrase, altered report (including recomputed unsigned hashes), edited evidence bytes, modified signer label, missing attachments, attempts to sign a draft and output overwrite. The real application still runs **local-development only**, with no actual sensitive client data.


## v1.8 — Local security assurance and trusted-signing-key registry

This milestone expands automated local attack-boundary checks and introduces an **offline key trust policy** for the v1.7 Ed25519 dossier signatures. Key ownership is not determined from an uploaded dossier; a recipient must independently verify the signer's fingerprint before enrollment.

**Offline trust registry** (commands in Windows Anaconda Prompt):

```bat
node scripts/trusted-signers.mjs init C:\\surface-audit-keys\\trusted-signers.json
node scripts/trusted-signers.mjs fingerprint C:\\received\\signing-public.pem
node scripts/trusted-signers.mjs enroll C:\\surface-audit-keys\\trusted-signers.json C:\\received\\signing-public.pem "Verified reviewer" --confirm=<fingerprint-verified-through-separate-channel>
node scripts/trusted-signers.mjs verify C:\\surface-audit-keys\\trusted-signers.json C:\\audit-export\\signed-dossier.json
node scripts/trusted-signers.mjs revoke C:\\surface-audit-keys\\trusted-signers.json <fingerprint> "Key reported compromised"
node scripts/trusted-signers.mjs list C:\\surface-audit-keys\\trusted-signers.json
```

**Trust and revocation limits:** A key is accepted only when it matches an enrolled Ed25519 public-key fingerprint and is currently marked `TRUSTED`. Locally revoked keys are refused and cannot be re-enrolled through the CLI. The trust registry is a normal JSON file: anyone who can change that file can rewrite trust history. Store it in a separately controlled location and distribute the fingerprint through an independent channel. The policy treats revoked keys as untrusted **for all signatures**, including historical signatures. There is **no** signed key directory, trusted revocation timestamp, external certificate authority, hardware signing key or independent proof of reviewer identity.

**Local HTTP boundary:** Operator sessions, login and protected API routes reject non-loopback or mismatched Host headers. Existing Origin/Host equality checks continue to reject cross-origin writes. CI tests absent Origin, incorrect localhost origin ports, HttpOnly/SameSite cookies, session cache headers, role separation, and session revocation. Next.js may normalize raw Host headers before route handlers, so handler-level Host checks must NOT be treated as a verified network-edge defense. These checks do **not** prevent a server misconfigured to listen on an external interface from being reachable at the transport level; keep the Next.js server explicitly bound to `127.0.0.1` and rely on independent OS/network controls.

See `SECURITY_DEPLOYMENT_GATE.md` for the formal threat inventory and release-blocking checklist. **This release does not authorize public deployment, regulated signatures or confidential client data.**

## v1.9 — Restricted PostgreSQL runtime and security event console

SURFACE Audit now has a versioned, append-only `SecurityEvent` register recording local login success/failures and lockout, sign-out, administrator operator enable/disable and lockout reset, and independent reviewer decisions. It does **not** record passwords, tokens, request bodies or uploaded evidence. Admin-only `GET /api/security/events` supports a bounded 1–100 item limit and event filtering; the `/operators` page shows the latest events. This is a local incident-triage view, **not** an immutable external audit system or full security monitoring platform.

**Database least privilege:** GitHub CI provisions a separate nonowner PostgreSQL application role after applying migrations as database owner. The entire HTTP audit lifecycle then runs using that restricted role. A read-only `node scripts/check-db-privileges.mjs` command refuses application credentials that can own databases, create schema objects or administer roles; CI additionally proves the runtime role cannot execute table-creation SQL. The owner remains separate for migrations and backup/restore; owners can still bypass audit-history triggers.

See **`LOCAL_DEPLOYMENT_RUNBOOK.md`** for Windows setup, SQL grants, runtime vs owner environment variables, verification and limitations. **Do not replace an existing local database connection without reviewing its migration ledger, grants and backup first.** This remains a local-development prototype without production networking, MFA, independent log retention, SIEM monitoring or regulatory signature assurance.

## v2.0 — Portfolio management review and decision pack

In explicitly enabled **local PostgreSQL** mode, the operations dashboard now links to the new **/management** review workspace. The review brings audit delivery, corrective-action overdue aging, high/critical findings and client risk triage together with a client selector. It displays six monthly audit-start cohorts (creation dates, **not** asserted completion dates) and the top outstanding actions. An operator can print/save the management review as a PDF using the browser and download either a structured JSON snapshot or an Excel-compatible CSV of the client risk register.

**Authenticated data endpoints:** `GET /api/operations/management[?client=<exact-client-name>]` and `GET /api/operations/management/export?format=json|csv[&client=<exact-client-name>]`. Both enforce local operator sessions, deny invalid filters, refuse unsupported formats and return no-store headers. CSV values are escaped and potential spreadsheet formulas are neutralized.

**Interpretation warning:** The existing portfolio loader takes only the latest **500 audits, findings, actions and evidence references, independently**. The review explicitly labels these as *sampled records*. When a category reaches 500, a truncation warning appears. Scores and counts **must not be described as all-time totals**. The risk score is a transparent **triage heuristic**: `3 × overdue open actions + 2 × open HIGH/CRITICAL findings + undated open actions + unowned open actions`. It is **not** a compliance rating, instrument measurement, severity prediction, customer risk assessment or statutory certification. Overdue means due date before today's UTC date; actions already verified are excluded. The six-month series uses audit *creation dates*, not evidence of closure or performance improvement. Results are live and change as the database changes; management exports are **not signed or sealed**. The underlying separate audit dossier signing remains available for actual closed-audit document custody.

**Access / scope:** This management review is available to signed-in local operator accounts; it reveals client-wide portfolio names, so do not expose the application on a network or enter confidential records. It does not implement multi-tenant separation, external regulatory review, production analytics or an accredited decision process. Existing backup and security release gates continue to run in CI.



### Security incident review (v2.1 development)

Administrators may review recent local security activity on `/operators` using 24-hour, 7-day and 30-day windows. `GET /api/security/incidents?hours=168&limit=100` returns time-windowed event totals, grouped event/outcome counts, a combined failed-login/lockout **event** count, up to 500 latest rows, and a truncation flag. `GET /api/security/incidents?hours=168&limit=500&format=csv` downloads spreadsheet-safe CSV with a UTF-8 BOM; formula-like values are prefixed to reduce spreadsheet injection risk. The endpoint requires a local authenticated ADMIN, disables caching, validates filters and never includes tokens, passwords, network addresses, evidence bytes or request bodies.

This is **not** an intrusion-detection service, tamper-evident external archive, SIEM, security certification, verified incident assessment, or production approval. Summaries are exact within the requested local window as recorded in PostgreSQL; CSV is capped at the newest 500 rows. The database owner can alter history despite runtime append-only constraints. Do not upload confidential customer evidence or expose this prototype publicly.
