import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
// Offline text-level guard to check that export handles spreadsheet injection,
// and incident API never accepts arbitrary filters or unbounded export sizes.
const source=readFileSync("src/lib/security-incident-review.ts","utf8");
const route=readFileSync("src/app/api/security/incidents/route.ts","utf8");
assert.match(source,/limit>500/);
assert.match(source,/incidentWindows=\[24,168,720\]/);
assert.match(source,/replace\(\/"\/g,'""'\)/);
assert.match(source,/\[=\+@/);
assert.match(route,/session\?\.role!=="ADMIN"/);
assert.match(route,/private, no-store/);
assert.match(route,/Content-Disposition/);
console.log("PASS: incident export source checks (HTTP tests run in smoke-db.mjs)");
