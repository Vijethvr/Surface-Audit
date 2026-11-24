// Development-only PostgreSQL API integration smoke test.
// Requires DATABASE_URL pointing to an isolated throwaway database and
// SURFACE_AUDIT_ENABLE_LOCAL_API=true. Never execute against client records.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 3017;
const base = `http://127.0.0.1:${port}`;
const timeoutMs = 90000;
let sessionCookie = "";

if (process.env.CI !== "true" || process.env.SURFACE_AUDIT_ENABLE_LOCAL_API !== "true") {
  throw new Error("Refusing integration test outside an explicitly enabled CI environment.");
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
  env: { ...process.env, NODE_ENV: "development" },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", chunk => process.stdout.write(chunk));
child.stderr.on("data", chunk => process.stderr.write(chunk));

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", ...(sessionCookie?{"Cookie":sessionCookie}:{}), ...(["POST","PATCH","PUT","DELETE"].includes(options.method)?{"Origin":base}:{}), ...options.headers },
  });
  const body = await response.json();
  return { response, body };
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`Next server exited: ${child.exitCode}`);
    try {
      const { response } = await request("/api/health");
      if (response.ok) return;
    } catch { /* Starting up */ }
    await delay(900);
  }
  throw new Error("Development server failed to start within 90 seconds.");
}

try {
  await waitForServer();

  const health = await request("/api/health");
  assert.equal(health.body.storage, "postgres-prototype");

  const denied=await request("/api/audits");
  assert.equal(denied.response.status,401,"Unauthenticated audit access should be denied");
  const badLogin=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username:"local-admin",password:"wrong"})});
  assert.equal(badLogin.response.status,401);
  const login=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username:process.env.SURFACE_AUDIT_ADMIN_USERNAME,password:"CI-password-only-not-for-real-users"})});
  assert.equal(login.response.status,200,JSON.stringify(login.body));
  sessionCookie=login.response.headers.get("set-cookie")?.split(";")[0]??"";
  assert.ok(sessionCookie.startsWith("surface_audit_session="));
  const crossSite=await request("/api/audits",{method:"POST",headers:{Origin:"https://attacker.example"},body:JSON.stringify({title:"Disallowed",client:"Disallowed"})});
  assert.equal(crossSite.response.status,403);
  const unique = `CI-${Date.now()}`;
  const created = await request("/api/audits", {
    method: "POST",
    body: JSON.stringify({
      title: `Traceability assessment ${unique}`,
      client: `CI Test Client ${unique}`,
      type: "Measurement assurance",
    }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const auditId = created.body.audit?.id;
  assert.ok(typeof auditId === "string" && auditId.length > 0);
  assert.equal(created.body.audit.status, "Scheduled");

  const listed = await request("/api/audits");
  assert.equal(listed.response.status, 200);
  assert.ok(listed.body.audits.some(audit => audit.id === auditId));

  const saved = {
    answers: {
      "REQ-01": {
        answer: "Conforms",
        comment: "Reviewed within CI integration test",
        reference: "CI-CERT-01",
      },
      "REQ-03": {
        answer: "Nonconformity",
        comment: "Missing calibration evidence",
        reference: "CI-FINDING-01",
      },
    },
    summary: "Automated integration smoke test",
    reviewer: "CI Runner",
  };
  const patched = await request(`/api/audits/${encodeURIComponent(auditId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "In review", record: saved }),
  });
  assert.equal(patched.response.status, 200, JSON.stringify(patched.body));
  assert.equal(patched.body.ok, true);

  const reloaded = await request(`/api/audits/${encodeURIComponent(auditId)}`);
  assert.equal(reloaded.response.status, 200);
  assert.deepEqual(reloaded.body.record, saved);

  const updated = await request("/api/audits");
  const audit = updated.body.audits.find(a => a.id === auditId);
  assert.equal(audit.status, "In review");
  assert.equal(audit.progress, 25);

  const history=await request(`/api/audits/${encodeURIComponent(auditId)}/events`);
  assert.equal(history.response.status,200);
  assert.deepEqual(history.body.events.map(e=>e.action),["AUDIT_CREATED","AUDIT_UPDATED"]);
  assert.ok(history.body.events.every(e=>e.actor==="local-admin"));
  const invalid = await request("/api/audits", {
    method: "POST",
    body: JSON.stringify({ title: "", client: "" }),
  });
  assert.equal(invalid.response.status, 400);

  const logout=await request("/api/auth/logout",{method:"POST",body:"{}"});
  assert.equal(logout.response.status,200);
  sessionCookie="";
  assert.equal((await request("/api/audits")).response.status,401);
  console.log("PASS: authentication, origin validation, database persistence, audit history and logout.");
} finally {
  child.kill("SIGTERM");
  await delay(500);
  if (child.exitCode === null) child.kill("SIGKILL");
}
