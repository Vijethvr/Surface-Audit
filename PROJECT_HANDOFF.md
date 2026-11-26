# SURFACE Audit — Project Handoff for a New Chat

**Status date:** 25 November 2026 (Europe/Stockholm) — v2.0 development branch snapshot.  
**Canonical repository:** https://github.com/Vijethvr/Surface-Audit  
**Default branch:** `main`  
**Purpose:** Long-term continuity between ChatGPT conversations. **Always check live GitHub status and code before acting; this handoff is a dated snapshot, not live state.**

## 1. Working agreement — preserve this

The user owns the repository and approves all merges. The assistant must:

1. Verify the latest `main`, PRs, and CI before coding. A user saying **"done, proceed"** means the last PR has likely been merged, but **verify**.
2. Choose a **substantial, integrated milestone**, not only a cosmetic tweak. Implement on a new `feat/**` branch based on current `main`.
3. Use the connected GitHub tools to change files and create a **draft** PR targeting `main` directly.
4. Monitor the GitHub Actions quality jobs. Diagnose and fix every failure; rerun until **both** the Next.js/security job and PostgreSQL integration job succeed for the final commit. Only then mark the PR **ready for review**.
5. Give the user the PR link and validation run, **never merge the PR**. The user performs the merge. Avoid asking for local tests when CI can perform them.
6. Make key architectural decisions and known caveats explicit; do not claim the app is regulatory-compliant or production-ready.

**New thread starter:** "Read PROJECT_HANDOFF.md from the Surface-Audit repository, inspect the current main branch and open PRs, then continue with the next substantial milestone. Build, test in GitHub Actions, open a PR, and leave merging to me."

## 2. Product identity and scope

**SURFACE Audit** is a service-first **metrology audit and measurement assurance consulting workspace**. It is **not** SURF-AI, not an instrument profiler, and does **not** calculate Ra, Rz, Sa, Sz or analyze surface images. Core workflows: client and project registries, equipment and calibration references, frozen audit templates, checklist execution, evidence, findings and CAPA, review/approval, reporting, consulting operations and recovery.

## 3. Architecture verified through v1.5

- **UI:** Next.js 15 App Router, React 19, TypeScript, Lucide icons. Dashboard and audit workspace in `src/components/`; routes in `src/app/`.
- **Data:** Prisma 6, PostgreSQL 16 in CI, model and relationships in `prisma/schema.prisma`.
- **Schema migration ledger:** `prisma/migrations/`. Initial baseline `20261125164000_initial_baseline`, audit-revision migration `20261125190000_audit_revision`, history-trigger migration `20261125210000_append_only_history`.
- **Local identity:** database-stored individual operators and revocable sessions. Roles ADMIN/EDITOR/REVIEWER/VIEWER. `src/lib/local-auth.ts`, `src/lib/dev-api.ts`; login and operator routes.
- **Audit governance:** requirements frozen at creation; revisions for optimistic edit checks and child-record transaction locking; independent review by another operator; review content digest; completed audit report snapshot with SHA-256.
- **Evidence:** small PDF/PNG/JPEG/TXT files (1 MiB each, max 40/audit) stored as PostgreSQL bytes with SHA-256; authenticated attachment download; evidence manifest, portable dossier and offline verifier.
- **Consulting operations:** live portfolio of audits, findings, CAPA actions, evidence references, reports, CSV exports.
- **Recovery v1.5:** `scripts/local-recovery.mjs` for unencrypted backup/verify/restore into a **different empty** local database; read-only schema inspector; PostgreSQL triggers reject UPDATE/DELETE of events, reviews, report snapshots and evidence assets. CI performs a restore drill.
- **Quality gates:** `.github/workflows/quality.yml` (dependencies/audit, Prisma/typecheck/build, isolated PostgreSQL migrations, HTTP regression and recovery drill).

The demo-browser storage mode exists separately. Database mode is a local-development prototype, not a secure deployed product.

## 4. Release and PR history

| Release | Main feature | PR |
|---|---|---|
| v0.1–v0.7 | Dashboard, checklist, PostgreSQL, local auth, registries, project/template instrument links, findings/CAPA/evidence references | #1–#10 (some early PRs stacked, consolidated by #10) |
| v0.8 | Draft reporting and closure-readiness checks | #11 |
| v1.0 | Consulting operations center, CSV exports, sealed report snapshots | #12 |
| v1.1 | Evidence vault, portable dossier with offline digest verification | #13 |
| v1.2 | Individual operator accounts, roles, independent review | #14 |
| v1.3 | Account lockout, content-bound review, versioned migration baseline | #15 |
| v1.4 | Audit optimistic revisions, concurrent-write coordination, migration inspector | #16 |
| v1.5 | Local backup and restore drill, append-only database history triggers | #17 |
| **v1.6** | **Encrypted local recovery package + safe local configuration preflight + continuity document** | **#18, verified present on main at start of v1.7** |\n| **v1.7** | **Offline independently verifiable Ed25519 signed sealed audit dossiers** | **#19, verified present on main at start of v1.8** |\n| **v1.8** | **Public-key trust registry, local security attack tests and deployment threat model** | **#20 verified on main at start of v1.9** |\n| **v1.9** | **Restricted app database role, security event ledger and administrator console** | **#21 verified in main at start of v2.0** |\n| **v2.0** | **Portfolio management review, client risk triage, overdue aging, printable decision pack, JSON/CSV exports** | **In development; verify PR and final CI before merge** |

As of the start of v1.6, the v1.5 migration file and recovery tool were confirmed on `main`. Verify v1.6 and any later merges afresh.

## 5. v1.6 in progress — review before further work

Branch `feat/encrypted-recovery-preflight-v1.6` targeting `main`; **PR #18**: https://github.com/Vijethvr/Surface-Audit/pull/18. Its full development/recovery CI run **#45703071441 succeeded** and the PR was marked ready for review. **The user has not yet confirmed a merge in this conversation.** Files added:

- `scripts/secure-backup.mjs`: AES-256-GCM/scrypt encrypted **package** for previously created local PostgreSQL backup and manifest; separate output directories, nonoverwriting, passphrase from `SURFACE_AUDIT_BACKUP_PASSPHRASE`; decrypt to a new plaintext directory for existing restore flow. **Never deletes plaintext automatically.** Up to 256 MiB; not a production backup service.
- `scripts/local-preflight.mjs`: read-only local config safety gate; requires Node 22, dev mode, PostgreSQL mode, loopback DB, defined credentials, loopback bind host. Does not itself launch the server or guarantee firewall safety.
- CI integration: encrypted round-trip, wrong-passphrase and tamper rejection; unsafe wildcard bind rejection; existing restore drill unchanged.
- This `PROJECT_HANDOFF.md` and a user-downloadable .docx handoff companion.

**Important:** The prior CI run #45703071441 passed both jobs; changes to this handoff file may trigger a newer final-commit run. Always verify the latest commit and CI before merging, and confirm merged status on `main` in the next chat.

## 5A. v1.7 offline dossier signatures (new milestone)

Current branch: `feat/offline-signed-dossiers-v1.7` targeting `main`. The new `scripts/dossier-signature.mjs` implements key-pair generation, signing and offline public-key verification of **sealed** audit dossiers using Node 22's Ed25519 cryptography; `scripts/test-dossier-signatures.mjs` supplies negative tests on a real exported PostgreSQL dossier. The signing private key is stored as password-encrypted PKCS#8 **outside the repo**, and recipients must trust a separately distributed public key. The signer label and timestamp are signed but **not independently authenticated**. README includes Windows commands. The report view points to the offline workflow. No digital key operations occur on the app server or through the API.

**Before treating v1.7 as complete:** verify the new PR, latest final commit, both GitHub Actions jobs, and merge status. The CI test must verify wrong keys/passphrase, changed report including recomputed hashes, altered evidence, metadata tamper, unsigned draft and overwrite rejection. This is **not** an accredited electronic signature, certificate authority, trusted timestamp, external record archive or attested author identity.

The prior downloadable Word handoff dated 2026-11-25 is a historical snapshot. This repository file is the **more current, maintained** handoff and should take precedence in new threads.

## 5B. v1.8 security assurance and trusted key governance

Current development branch `feat/security-assurance-trust-registry-v1.8` from `main`; verify its PR, final CI run and merge status. New `scripts/trusted-signers.mjs` is an **offline local** Ed25519 trusted-public-key registry with fingerprint-confirmed enrollment, revocation, and signed-dossier verification by a policy-pinned public key. No private keys are moved into the Next.js app; do not treat an editable JSON registry as a certificate authority or independent evidence of author identity.

`src/lib/local-auth.ts`, `src/lib/dev-api.ts` and login route have additional loopback Host/URL checks. `scripts/smoke-db.mjs` now rejects spoofed hosts, missing/incorrect Origin, and tests cookie attributes alongside existing reviewer/role/session tests. `scripts/test-dossier-signatures.mjs` tests key enrollment, rejection of unknown keys, tampering and revocation. New `SECURITY_DEPLOYMENT_GATE.md` documents threats, mitigations, gaps and production-release blockers.

**Before calling v1.8 complete**: check final two GitHub Actions jobs for the final commit, mark PR ready only after both pass and leave merge to user. Production remains prohibited.

## 5C. v1.9 restricted PostgreSQL runtime and security events

Current development branch: `feat/db-least-privilege-security-events-v1.9` targeting `main`. See **`LOCAL_DEPLOYMENT_RUNBOOK.md`** for a Windows-oriented owner-vs-runtime PostgreSQL role setup. A new `SecurityEvent` model and additive migration provide append-only security events; `src/lib/security-events.ts`, login/logout, operator admin route and review route write allowlisted sign-in, lockout, account and reviewer events. Admin-only `/api/security/events` and an extended `/operators` page display recent safe metadata without credentials or evidence files.

In GitHub Actions the migrator remains the PostgreSQL owner but the HTTP integration test uses a separately provisioned `surfaceaudit_app_ci` role with table DML privileges only, explicitly lacking schema/database creation and role-administration privileges. New `scripts/check-db-privileges.mjs` performs read-only privilege checks. **Actual Windows databases are not changed by this PR.**

Important remaining limits: ordinary app DML remains broad (no client row-level security), owners can bypass all triggers and controls, logs are not immutable against owners, and this does not establish production readiness. Do not use real client data.

**Before calling v1.9 complete:** Verify its PR, final-commit GitHub Actions results, and ensure migration/CI least-privilege assertions, security events and complete backup/restore tests all pass. The user alone merges.

## 5D. v2.0 cross-audit management review (new milestone)

Branch `feat/management-review-v2` based on `main`; verify current PR and CI. This release connects the existing database-backed operations center to a new `/management` view, calculations in `src/lib/management-review.ts`, protected `/api/operations/management` endpoints and printable/JSON/CSV management decision packs. Client-level scorecards, action overdue buckets, risk heuristic and six-month audit-start cohorts are supported.

**Critical scope boundary:** The portfolio source returns a maximum of 500 most recent records **per category**. These are *sample analytics*, not global accounting totals. Risk ranking is a heuristic, not independent assurance. The management pack is live, unsigned and unsealed; keep completed-audit immutable snapshot and offline signing separate.

Tests extend `scripts/smoke-db.mjs` with endpoint authorization, filters, metrics, CSV/JSON and no-store checks. Before calling v2.0 complete, verify both GitHub Actions jobs pass for the final commit. The user alone reviews and merges the PR.

## 6. Windows developer environment

Historically used local directory:

```bat
C:\Users\vijred\Desktop\Vijeth\website\Surface-Audit
```

Portable Node 22.23.5 was used. The app normally opens at `http://127.0.0.1:3001` and is started using:

```bat
npm run dev -- -H 127.0.0.1 -p 3001
```

An earlier conversation delivered a Windows desktop shortcut/launcher; **do not assume those generated files persist across chats**. Check the user's actual files or repository before modifying the shortcut.

For **brand-new disposable PostgreSQL databases** review `.env.example`, `README.md`, and apply `npx prisma migrate deploy`, generate Prisma client, then provision local operators via `scripts/create-local-operator.mjs`. **Never blindly apply the migration baseline to legacy databases without a Prisma migration ledger**. Use `node scripts/inspect-local-db.mjs` first.

**Never put secrets or passwords into the handoff.** Do not guess database credentials or request users paste secret keys into chat.

## 7. Important technical and trust boundaries

- **LOCAL DEVELOPMENT ONLY**; no confidential client records, public exposure or representation as an ISO compliance certificate.
- Internal hashes and stored digests are **not independently signed or timestamped**; a database owner can alter stored content and hashes or disable triggers.
- v1.5 backups are unencrypted; v1.6 adds a separate encrypt/decrypt step and **does not erase original plaintext files**. Use separate secure storage and protect passphrases.
- Document signatures, trusted audit custody, malware scanning, MFA, offsite encrypted backups, production migration history/restore tests and independent security audit remain missing.
- The read-only inspector and config preflight are safeguards, **not** proof of safety.
- Maintain correct separation between audit content/readiness, role approval, and legal or accredited sign-off.

## 8. GitHub development actions

Use the connected GitHub connector in the chat for repository files, commits, branches, PRs and Actions. Fetch exact source before modifying. Avoid `create_tree` without specifying a base tree: earlier work accidentally dropped files this way. Prefer `create_file` / `update_file`. The user does not want local-test instructions as the primary release gate; use CI.

Check the latest PR, `main` and workflow runs before saying a milestone is complete. Never infer a merge merely from the user's "done".

## 9. Prioritized substantial next steps

1. **v2.0 acceptance:** verify cross-audit management review, scoped exports and full CI/security/recovery tests. Leave merge approval to the user.
2. **Security assessment:** automated local attack-boundary tests, database access restrictions, authentication response timing/concurrency, session protections and dependency patch management.
3. **Backup operations:** secure passphrase management, offsite encrypted archival with restore drill, retention and cleanup policy, recovery objectives and a deployment runbook.
4. **Independent evidentiary integrity:** v1.7 provides signatures and v1.8 provides an editable local key trust/revocation registry; independently protected registry, certified signing authority, trusted timestamps and key-custody operations remain unimplemented.
5. **Production architecture decision:** threat model, hosting/deployment plan, migration/rollback drills, secure file scanning/storage and external security review before any client data.

These are recommendations, not implemented capabilities.

---
**Maintaining this file:** At each future milestone update the date, main/PR status, architecture changes, CI link and risks; then update the downloadable handoff companion. The **live repository and CI results outrank this document**.

## v2.1 pending — security incident review (26 Nov 2026)

Independent branch `feat/security-incident-review-v2.1` starts from **main at v1.9**, after v2.0 management review PR #22 merged into main. This is intentionally not a stacked PR. New administrator-only `GET /api/security/incidents` supports fixed 24-hour, 7-day and 30-day windows, optional allowlisted event type, bounded 1–500 entries, outcome summaries, failed-login/lockout totals, and Excel-safe CSV download. Operator console provides window controls and a clear truncated-results warning; integration tests cover auth, parameters, CSV and cache policy.

**Limits:** This is local development only. Counts are event occurrences (not identified attacks), no alerting, automated containment, external archival, independently immutable logs or production approval. CSV is at most 500 newest rows; totals/summary cover the selected time window. Database owner can rewrite history. Test final CI before requesting merge. PR #22 is merged; PR #23 requires the repository owner's review and merge.

## v2.2 encrypted-vault custody (26 November 2026)

PR #23 was verified merged into `main` before this branch was created. New branch `feat/encrypted-vault-custody-v2.2` adds a local encrypted vault custody CLI (`scripts/vault-custody.mjs`) with strict source/destination separation, non-overwriting labels, SHA-256 ciphertext receipt/verification, inventory and **dry-run-only** retention plan (minimum keep count 2). Tests in `scripts/test-vault-custody.mjs` cover tamper detection, traversal, symlinks, overwrites and safe retention; PostgreSQL CI additionally verifies a real encrypted backed-up vault copy and rechecks the full existing backup-restore drill. Update Windows instructions in README.

This is not external immutable retention or verified offsite backup. Custody receipts remain editable locally; they do not decrypt or independently authenticate the envelope, and retention suggestions NEVER delete records. Encryption and restore continue to use preexisting tools. Preserve the owner-only merge workflow, verify final-commit Actions before marking ready, and never authorize production/customer data.


## v2.3 authorization regression milestone (26 November 2026)

At branch creation PR #24 was verified merged into `main` (merge `df95b5fccfd7f7cd289780dbc894c8ccb7321772`). Branch `feat/authorization-assurance-v2.3` adds `scripts/authorization-matrix.mjs`, a declarative live-HTTP permission regression against real ephemeral PostgreSQL data and individually authenticated ADMIN/EDITOR/REVIEWER/VIEWER sessions, plus unauthenticated denials. It is invoked from `scripts/smoke-db.mjs` before role-specific audit workflow testing. It explicitly tests core read scopes, admin-only incident/account endpoints, disallowed writes and reviews, and cross-origin/missing-origin defenses. Keep the full existing signature, backup, custody and management review CI checks. Before marking ready verify both final-commit CI jobs pass. Owner alone merges.

Known limits: enumerated regression probes are not comprehensive authorization proof, all roles still see cross-client data, no production tenancy or external penetration testing; prototype remains local development only.


## v2.4 authentication concurrency milestone (26 November 2026)

PR #25 verified merged to `main` (merge commit `916e5b0fce5b629c8f6dea55acf298986f244fd3`) before creating `feat/atomic-auth-lockout-v2.4`. This milestone replaces local login read/modify/write counters with an operator-level PostgreSQL row lock and atomic Prisma transaction for failure counts, lockout expiration, successful reset, security-event persistence and session issuance. All password outcomes are generic; the code makes dummy scrypt work for unknown/disabled/locked identities. The CI smoke test exercises seven concurrent invalid HTTP credentials, exact 5-attempt lockout, correct-password rejection during lockout, administrator reset and successful login.

Preserve local-development-only status. Remaining security gaps include IP/device throttling, DoS protection, MFA/SSO, independently monitored auth attempts, production hardening and independent security testing. **User alone merges after successful final GitHub CI**. Always re-check live repository and actions.


## v3.0 major product delivery milestone (26 November 2026)

PR #26 was confirmed merged into `main` at the start of this milestone. Branch `feat/delivery-command-center-v3` introduces a fully integrated read/write delivery planning workspace, `/delivery`, backed by new scoped `GET /api/delivery` and audited `PATCH /api/delivery/schedule`; it combines active audit targets with outstanding CAPA deadlines, 13-week capacity visualization, client/owner/kind/horizon filters, overdue/unscheduled scorecards and tentative ICS calendar export. Navigation and management review link to the planner; direct audit links open the existing audit workspace. Real PostgreSQL HTTP integration coverage includes schedule updates, audit events, JSON/ICS exports, invalid input and anonymous authorization.

**Important:** Historical `PROJECT_HANDOFF.md` entries mention pending PRs that were since merged; always use live GitHub state. This planner is bounded to 500 most recent active audits and 500 outstanding actions per source, with explicit truncation warnings. This is not a whole-database report when truncated and does not provide production/client access, external calendar synchronization, notification automation or assured client isolation. Verify final GitHub Actions on the head commit and leave merging to the user.


## v3.1 Engagement Studio (26 November 2026) — major client-delivery feature

PR #27 was verified merged into `main` at this milestone's start, merge `2bb7932843713f66c5af405afba8ca9e409a0dea`. New feature branch `feat/engagement-studio-v3.1` adds `/engagements`, a client/project-level consulting delivery workbench with integrated audit/approval/sealed-report registers, outstanding CAPA, evidence inventory, authenticated original-file links and browser printable internal handoff. `GET /api/engagements` provides the client directory and exact client/project-scoped snapshots; optional `format=csv` exports a formula-neutralized Excel register. Project/client selection and authenticated exports are validated in PostgreSQL CI, including seal-state change and unauthorized requests. Main navigation, client registry and management review are linked to Engagement Studio.

The database remains the single source of truth. Source totals are exact; detailed lists/derived metrics are capped to 250 audits and 500 findings/actions/evidence per scope. It is *not* a client-access portal, independent signed final deliverable, production implementation or regulatory accreditation. No confidential data or public exposure. Preserve existing GitHub Actions CI and the user-only merge agreement.


## v3.2 full project lifecycle milestone (26 November 2026)

PR #28 was confirmed merged into `main` at start, merge `239f3ff04dcce85a4230d450227c062932ec41d4`. Branch `feat/project-lifecycle-v3.2` adds versioned `EngagementLifecycle` scoped one-to-one to existing Project plus append-only `EngagementLifecycleEvent`, migration `20261126103000_engagement_lifecycle`, server-side Zod validation and optimistic revision enforcement, stages from PROPOSED through CLOSED, milestone and deliverable status tracking and strict audit-linked internal acceptance (sealed completed audit report required). The full editing workflow lives at `/engagements/[id]/plan`, linked from Engagement Studio and Clients & Projects; printable internal lifecycle pack and history included.

The full PostgreSQL smoke test adds project lifecycle create, stale edit, invalid link, premature closure, unsealed-audit acceptance denial, accepted sealed deliverable, closure immutability, history and anonymous denial. As always verify final commit GitHub Actions and leave PR merge to user. No client-authenticated acceptance, commercial invoicing or production/customer-data approval.


## v3.3 Project Deliverables Engine (26 November 2026)

PR #29 verified merged in main before branching (merge `41b39f477e4d0e18c6d824a5cd60e9ee25a0c39f`). Branch `feat/project-deliverables-engine-v3.3` adds:
- `src/lib/compile-project-pack.ts`: deterministic selection of actual project lifecycle, audits, sealed report digest validation, findings/CAPA summary and evidence manifest (bytes excluded), exact source counts and fail-closed incomplete export.
- `src/lib/project-pack.ts`: JSON canonicalization, SHA-256 manifest/envelope and CSV formula-injection protection.
- `src/app/api/projects/[id]/pack/route.ts`: authenticated preview, closure-gated portable JSON and CSV.
- `src/app/engagements/[id]/pack/page.tsx`: structured print-ready client project handoff sections and export actions, links from Engagement Studio and lifecycle editor.
- `scripts/verify-project-pack.mjs`: offline checksum/incomplete-content verifier (not signatures or trusted client approvals).
- HTTP CI regression: draft export rejection, ready package retrieval, verify/tamper checks, CSV correctness and unauthorized denial. Preserve existing full Postgres restore/signature/security tests and update docs.

Limits: source counts exact, exported detail capped to 100 audits/500 CAPA/500 evidence entries and export refuses truncated scope. SHA-256 portable envelope not independently signed; original evidence file bytes not included; signed audit dossiers remain separate. Internal only, not production/real client use. Owner alone merges after **both final-head GitHub Actions jobs succeed**.
