# Dependency security remediation — v0.3

The reported starting dependency tree (2026-11-24) was:

- Prisma / @prisma/client: 6.19.3
- Next.js: 15.5.29
- Zod: 3.25.76
- deepmerge-ts: 7.1.5 through @prisma/config
- effect: 3.21.0 through @prisma/config
- postcss: 8.4.31 through Next.js

## Changes in this branch

- Upgrade Zod to 4.6.7+ and adapt `z.record()` to the required two-argument signature.
- Keep Prisma 6.x temporarily; override its **transitive** `@prisma/config` dependencies to deepmerge-ts 8.0.2 and effect 3.22.5.
- Keep Next.js 15.x temporarily; override its transitive PostCSS dependency to 8.5.31.

**Caution:** deepmerge-ts 8 is a major upgrade relative to Prisma's transitive dependency expectation. Npm overrides are a temporary compatibility bridge; they are not evidence of upstream support. Confirm `prisma generate`, schema migration, runtime database operations, and the security audit before merging. If they fail, stop and plan a fully tested Prisma 7 migration.

## Windows / Anaconda Prompt verification

From your checked-out feature branch, run in order:

```bat
npm install
npm ls prisma @prisma/client next postcss zod effect deepmerge-ts
npm audit
npm run db:generate
npm run lint
npm run build
npm run dev -- -p 3001
```

Run database migrations and end-to-end test create/edit/save/load only after PostgreSQL is configured for local development. Confirm behavior of `npm audit` rather than assuming there are zero vulnerabilities.

Avoid `npm audit fix --force`. Record the output of all commands in the PR before marking it ready for merge. Do not enable the unauthenticated development API for actual client data.
