# SURFACE Audit
A proprietary, service-first surface metrology **measurement assurance and audit management** workspace.

This project is separate from SURF-AI and does not calculate surface roughness parameters or replace specialist metrology packages.

## v0.1.0 dashboard prototype
- Responsive consulting dashboard with illustrative audit KPIs, audit trend chart, assurance readiness and activity.
- Searchable audit register with status filtering.
- Create-audit dialog (session-only state).
- Findings and interactive CAPA completion indicators.
- Navigation placeholders for templates, equipment, evidence, clients, reports and settings.

**v0.2 workspace:** Open any audit by clicking its title. The assurance checklist has 8 demo requirements with assessments, evidence references, observations and reviewer notes. Audit list, CAPA checkbox states and workspace entries persist using browser localStorage. This is **not** a server database, secure evidence repository, validated audit trail or approval system. Do not enter sensitive client information. Deleting browser storage removes the data.

**All initial data is illustrative.** There is no backend persistence, authentication, controlled audit trail, evidence upload or PDF reporting yet. No compliance certification is implied.

## Windows Node.js portable installation

If Node.js is extracted at `C:\\Users\\vijred\\Desktop\\Vijeth\\website\\node-v22.23.5-win-x64\\node-v22.23.5-win-x64`, launch PowerShell and use:

```powershell
$nodeDir = 'C:\\Users\\vijred\\Desktop\\Vijeth\\website\\node-v22.23.5-win-x64\\node-v22.23.5-win-x64'
$env:Path = "$nodeDir;$env:Path"
node --version
npm.cmd --version
```

Then clone this repository and run `npm.cmd install`, followed by `npm.cmd run dev`. On PowerShell, `npm.cmd` avoids execution-policy issues with `npm.ps1`.

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
