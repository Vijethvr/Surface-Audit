# SURFACE Audit — Security Threat Model and Deployment Gate

**Version:** development milestone v1.8, 25 November 2026. **Scope:** local-only PostgreSQL prototype. This document is a security engineering checklist, **not** a penetration-test certificate, ISO declaration or authorization to handle regulated client data.

## 1. System boundaries

- **Browser and desktop:** Next.js 15 local development server bound to 127.0.0.1:3001; browser-demo mode has separate local-only data and is not a reliable records system.
- **API and identity:** local-only operator account database, short-lived opaque HttpOnly SameSite=Strict cookie, role checks (ADMIN, EDITOR, REVIEWER, VIEWER), local-only origin validation for writes; operators are not linked to enterprise SSO or MFA.
- **Database:** PostgreSQL 16 tested in CI, Prisma schema and versioned migrations. Contains audit assessments, review decisions, equipment/evidence metadata, uploaded bytes, session digests and salted password hashes.
- **Evidence and dossiers:** 1 MiB/file and 40 files/audit locally, non-rendered authenticated downloads, sealed report snapshot with hash; portable JSON dossier with complete evidence files.
- **Offline signing:** Ed25519 signer operates *outside* browser and database, with encrypted local private key. v1.8 adds an independently populated local policy registry of trusted public-key fingerprints and irreversible status revocation by CLI. A valid public-key signature cannot establish real signer identity on its own.
- **Backups:** PostgreSQL custom dump/restore and optional encrypted envelope (separate step); original plaintext persists until separately managed. No offsite service or scheduled retention manager.

## 2. Threats, existing mitigations and open risks

| Threat / attacker | Existing protections | Gaps / required decision |
|---|---|---|
| Cross-site form submission / hostile web origin | Origin equals loopback Host for state-changing APIs; SameSite Strict cookie; v1.8 checks loopback/mismatched request metadata on protected APIs and login, but Next.js may normalize raw Host headers | No independent penetration test; browser extensions/local malware remain possible |
| Remote access caused by an accidentally exposed development server | Development-only API flag, explicit local preflight, loopback Host and URL checks | **Not a firewall**: listener binding and network policies need independent verification; no supported production server |
| Password guessing and session theft | scrypt password hash, local lockout after five failures, opaque session hash stored in DB, session expiry/revocation | No MFA, per-IP throttling, credential-breach checks, concurrent-failure atomicity or device trust |
| Unauthorized role escalation and inappropriate approval | Role checks on HTTP routes, independent reviewer role, preparer separation, approval digest, audit revision checks | DB superuser bypasses checks; no verified HR identity or accredited electronic signature |
| Stored-file tampering or malicious uploads | Size caps, basic header signatures, SHA-256 consistency, attachment downloads, append-only triggers | No antivirus/sandbox, file provenance checks, external evidence anchoring or immutable object store |
| Forged exported audit dossier | v1.7 signature covers full dossier, requires sealed report and trusted offline public key | Compromised signer key, misleading label/timestamp, key substitution unless fingerprint is independently confirmed |
| Reused or compromised signing key | v1.8 pinned fingerprint enrollment and local revocation list; verification fails for untrusted/revoked key | Registry is an editable local JSON file, not signed or distributed; no authoritative revocation or historic validity at signing time |
| Irrecoverable database failure | Versioned migrations, tested populated backup/restore in CI, optional encrypted backup | No scheduled offsite recovery, key escrow, tested restore on the user's actual machine or agreed recovery point/time objectives |
| Sensitive information exposure through exported files | Authenticated API, private backup and keys stored outside repo, explicit development banners | No encryption-at-rest policy for live database, data retention governance, per-client tenancy or confidential-data processing approval |
| Software supply-chain compromise | npm audit at moderate level, TypeScript, Prisma schema checks and GitHub Actions | No independent SAST/DAST, SBOM attestation, signed release artifact or approved dependency-update program |

## 3. Release-blocking checklist for any real customer use

- [ ] Formal data classification and legitimate handling of client evidence; threat model approved by accountable organization.
- [ ] Multi-user production identity (SSO or equivalent), MFA, rate limiting, secure credentials/secrets service, session-device logging and tested account recovery.
- [ ] HTTPS termination and host/network exposure controls verified from a separate machine; no reliance on Host checks or local preflight as security boundaries alone.
- [ ] Server-side authorization review for **every** API route; no cross-client IDOR or multi-tenancy leakage; automated authorization matrix.
- [ ] Antivirus scanning, quarantine and separate secure file storage with encryption, quotas and retention.
- [ ] Independently anchored signing-key ownership, rotation and revocation; trusted timestamping and evidence chain-of-custody controls.
- [ ] Backup encryption, secure offsite storage, passphrase recovery controls, retention and *independent* restore drills with RPO/RTO.
- [ ] Review of Prisma baseline/adoption for existing database; non-destructive migration/rollback rehearsal for each release.
- [ ] Dependency, source and configuration scanning; manual or independent penetration testing; incident response and vulnerability disclosure plan.
- [ ] Explicit regulatory/contractual sign-off before anyone represents an audit report as approved certification.

## 4. Automated coverage added in v1.8

The PostgreSQL HTTP test suite checks unauthorized reads and edits, role separation, self-review rejection, session revocation, csrf Origin mismatch, visible request metadata, mismatched origin port, HttpOnly/SameSite session cookies and cache headers. The signing suite tests independently pinned public-key enrollment, unknown-key rejection, correct-key approval, wrong key and passphrase, report/evidence tampering and key revocation. **These tests cover selected threats; they are not a comprehensive attack simulation.**

## 5. Next safe security milestones

1. Enforce a complete endpoint-by-role permissions matrix and local database non-superuser role privileges.
2. Formalize offline key custody and independent key verification/registry distribution, rotation and compromise response.
3. Add structured security event logging and independent log retention, configured without secrets or client PII.
4. Decide on a production deployment and identity architecture only after an external assessment.
5. Keep the app in local development and use synthetic data until the above gate is satisfied.

**Review rule:** Update this document together with the repository-root `PROJECT_HANDOFF.md` each security milestone. The live code and CI results supersede this text.

## v1.9 additions: database privilege separation and security monitoring

- **New protection:** Owner/migrator PostgreSQL account is separate from a restricted application role in isolated CI. The app role has table DML access but no schema CREATE, database CREATE/ownership, PostgreSQL superuser or role-administration privileges. SQL DDL refusal is exercised in CI. The live user environment must be configured separately using the documented runbook.
- **New security register:** Append-only `SecurityEvent` model with login failures/lockouts/success, logout, account disable/reactivation, lockout reset and independent approval decisions. The admin-only console excludes password/token/evidence content and limits returned event rows.
- **Residual risk:** Database owner can alter audit/monitoring data by disabling triggers, and a compromised app role retains table-level UPDATE/DELETE access to ordinary audit and account tables. No row-level security, multi-client tenancy, external immutable log store, production monitoring/alerting, distributed rate limiter, formal network isolation verification or external penetration test is provided.
- **Next release gate:** threat assessment of all data-changing endpoints and role checks, migration rollback/recovery rehearsal, structured alerting with privacy controls, and production identity design before deployment.

## v2.0 portfolio reporting boundary

The new management review is **not** a trust boundary or compliance rating. Authenticated local users can access cross-client summary data; there is no multi-tenant authorization. Review data uses a 500-record-per-category sample rather than a formally complete ledger, and exports are not signed. The transparent client risk heuristic identifies possible follow-ups but does not independently validate evidence, measurements, severity or regulatory obligations. Additional work before production includes complete data coverage, authorizations by customer/project, reporting provenance, export controls and independently auditable report retention.
