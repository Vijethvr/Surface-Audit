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
