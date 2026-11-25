# SURFACE Audit — Project Handoff for a New Chat

**Status date:** 25 November 2026 (Europe/Stockholm) — v1.8 development branch snapshot.  
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
| **v1.6** | **Encrypted local recovery package + safe local configuration preflight + continuity document** | **#18, verified present on main at start of v1.7** |\n| **v1.7** | **Offline independently verifiable Ed25519 signed sealed audit dossiers** | **#19, verified present on main at start of v1.8** |\n| **v1.8** | **Public-key trust registry, local security attack tests and deployment threat model** | **New development PR; verify status and final CI before merging** |

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

1. **v1.8 acceptance:** validate trusted-key governance, Host/Origin boundary tests and the new threat model through GitHub Actions, then leave merge approval to the user.
2. **Security assessment:** automated local attack-boundary tests, database access restrictions, authentication response timing/concurrency, session protections and dependency patch management.
3. **Backup operations:** secure passphrase management, offsite encrypted archival with restore drill, retention and cleanup policy, recovery objectives and a deployment runbook.
4. **Independent evidentiary integrity:** v1.7 provides signatures and v1.8 provides an editable local key trust/revocation registry; independently protected registry, certified signing authority, trusted timestamps and key-custody operations remain unimplemented.
5. **Production architecture decision:** threat model, hosting/deployment plan, migration/rollback drills, secure file scanning/storage and external security review before any client data.

These are recommendations, not implemented capabilities.

---
**Maintaining this file:** At each future milestone update the date, main/PR status, architecture changes, CI link and risks; then update the downloadable handoff companion. The **live repository and CI results outrank this document**.
