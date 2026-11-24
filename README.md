# SURFACE Audit
A proprietary, service-first surface metrology **measurement assurance and audit management** workspace.

This project is separate from SURF-AI and does not calculate surface roughness parameters or replace specialist metrology packages.

## v0.1.0 dashboard prototype
- Responsive consulting dashboard with illustrative audit KPIs, audit trend chart, assurance readiness and activity.
- Searchable audit register with status filtering.
- Create-audit dialog (session-only state).
- Findings and interactive CAPA completion indicators.
- Navigation placeholders for templates, equipment, evidence, clients, reports and settings.

**All data in this release is demonstration data.** There is no backend persistence, authentication, controlled audit trail, evidence upload or PDF reporting yet. No compliance certification is implied.

## Development
Install Node.js 20+ and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Check types and production build:

```bash
npm run lint
npm run build
```

## Roadmap
1. Persist clients, projects, audits, requirements, findings, and CAPA in PostgreSQL.
2. Add identity, permissions, and tamper-evident audit history.
3. Build controlled audit templates and measurement procedure review.
4. Attach original instrument reports and calibration evidence with metadata.
5. Add approvals and professionally formatted audit PDFs.
6. Introduce opt-in customer integrations only when needed.

**Principle:** SURFACE Audit verifies measurement workflows and manages assurance evidence. SURF-AI interprets engineering data.
