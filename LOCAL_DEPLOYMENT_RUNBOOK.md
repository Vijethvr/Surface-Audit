# SURFACE Audit v1.9 — Controlled LOCAL PostgreSQL Runtime Runbook

**Development only.** Not an invitation to expose SURFACE Audit on a network, store real customer evidence, or certify its security. This runbook separates **schema/recovery administration** from **everyday application database access**.

## 1. Why separate database roles?

Prior prototypes reused database-owner credentials in the development app, giving an attacker who stole the app's connection string broad powers to change schema and disable audit-history triggers. This release adds a separate **application account** with ordinary table DML access but without PostgreSQL superuser, schema CREATE, database CREATE or role-administration authority. It cannot install/alter migrations or disable triggers. The schema/migration owner still controls the database and can bypass this protection; PostgreSQL is not an immutable third-party archive.

GitHub Actions automatically tests a **throwaway** nonowner role (`surfaceaudit_app_ci`), runs the full audit lifecycle through that role, refuses runtime DDL, verifies append-only triggers, then exercises recovery under the original owner credentials. This is the authoritative tested example; instructions below describe a manual local setup and are **not** a test of your actual Windows database.

## 2. Setup prerequisites

- Node.js 22; locally installed PostgreSQL 16 (or matching supported clients) and `psql` on PATH.
- A separate **disposable loopback-only development database** and a role that owns its tables and applies Prisma migrations.
- Verified backup of any existing data; do not run initial baseline migrations on older `db push` databases without a migration ledger.
- Keep the Next.js server stopped during schema changes; use `node scripts/inspect-local-db.mjs` to identify old schemas.

## 3. Apply migrations with the owner, then grant runtime permissions

From a trusted Windows terminal, point `DATABASE_URL` temporarily to your existing **migration-owner** account on your local development PostgreSQL database. Check status and apply the versioned migrations:

```bat
npx prisma migrate status
npx prisma migrate deploy
npm run db:generate
```

With `psql` connected as the database/schema owner to the **same** local development database, execute the following reviewed SQL, replacing the account name with a unique local operator database role. Use psql's interactive `\password surfaceaudit_app` to set a private, strong password rather than committing one in SQL or shell history:

```sql
CREATE ROLE surfaceaudit_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
-- In psql: \password surfaceaudit_app

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE surface_audit TO surfaceaudit_app;
GRANT USAGE ON SCHEMA public TO surfaceaudit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO surfaceaudit_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE "_prisma_migrations" FROM surfaceaudit_app;
```

Adapt the database name if it differs; the SQL above is illustrative. Restrict the network at PostgreSQL's `listen_addresses`, `pg_hba.conf` and firewall as appropriate; never put the app on a public network. Note PostgreSQL privileges granted to `PUBLIC` or through other inherited roles can still broaden access; inspect effective grants rather than only direct grants.

**After future migrations:** as the migration owner, grant DML privileges on any newly created application tables to the app role, and ensure the app role never receives migration-ledger write permissions before restarting the app. Review migration SQL and test on a disposable copy first. Do not use a database owner string as `DATABASE_URL` for the running app.

## 4. Run with the restricted account

Set the project-root local environment for **application runtime**:

```env
DATABASE_URL="postgresql://surfaceaudit_app:<URL-encoded-password>@127.0.0.1:5432/surface_audit?schema=public"
SURFACE_AUDIT_ENABLE_LOCAL_API="true"
NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE="postgres"
```

Never commit `.env.local` or include credentials in tickets/chats. From the project directory:

```bat
node scripts/check-db-privileges.mjs
node scripts/local-preflight.mjs
npm run dev -- -H 127.0.0.1 -p 3001
```

The privilege checker prints `PASS` only if the runtime role lacks SQL schema CREATE, database CREATE/ownership, superuser and role-admin rights. It does **not** certify every possible privilege, account configuration or network exposure. The preflight likewise checks configuration only. Real production access requires a professional review, proper TLS/network controls, MFA and other missing safeguards.

**Recovery and migrations must use separate owner credentials in a separate session.** Do not reuse the application role for `prisma migrate deploy`, `pg_restore` or role management.

## 5. Administrator security register

Visit `http://127.0.0.1:3001/operators` while signed in as an ADMIN. Alongside the local account manager, the new security register shows up to 50 recent events. The API `GET /api/security/events?limit=50` accepts 1–100 records and an optional allowlisted event type. All non-admin identities get HTTP 403 and signed-out requests get HTTP 401.

The register records only allowlisted event categories:
`LOGIN_FAILED`, `LOGIN_LOCKED`, `LOGIN_SUCCEEDED`, `LOGOUT`, `OPERATOR_DISABLED`, `OPERATOR_ENABLED`, `LOGIN_LOCKOUT_RESET`, `REVIEW_APPROVED`, `REVIEW_REJECTED`. It excludes passwords, session tokens, raw request bodies, evidence bytes and raw network addresses. Existing rows are protected against UPDATE/DELETE through the PostgreSQL trigger from the new migration.

**Limits:** security events are **not** independently retained, exported to SIEM or tamper-proof against schema/database owners. Unknown-username sign-in attempts are deliberately not recorded to avoid unbounded log growth and user enumeration. Concurrency-safe login throttling, external notification, immutable event anchoring, trusted timestamps and centralized alert monitoring remain out of scope.

## 6. Recovery and incident checks

Use the established `scripts/local-recovery.mjs` and `scripts/secure-backup.mjs` instructions in README. A recovery archive contains security events and potentially sensitive evidence; encrypt it separately, safeguard the passphrase, and never overwrite an existing populated target. A corrupt or missing security register requires manual investigation; this prototype does not provide an incident response service.

**Production readiness gate:** see `SECURITY_DEPLOYMENT_GATE.md`. Do not treat passing GitHub Actions as a penetration test or security certification.
