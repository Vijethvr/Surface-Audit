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

  // v0.5 consulting registries: protected read/write operations.
  const createdClient=await request("/api/clients",{method:"POST",body:JSON.stringify({name:"Registry Client "+unique})});
  assert.equal(createdClient.response.status,201,JSON.stringify(createdClient.body));
  const clientId=createdClient.body.client.id;
  const clientList=await request("/api/clients");
  assert.ok(clientList.body.clients.some(item=>item.id===clientId));
  const duplicateClient=await request("/api/clients",{method:"POST",body:JSON.stringify({name:"Registry Client "+unique})});
  assert.equal(duplicateClient.response.status,409);

  const project=await request("/api/projects",{method:"POST",body:JSON.stringify({clientId,name:"Metrology assurance "+unique,reference:"P-100"})});
  assert.equal(project.response.status,201,JSON.stringify(project.body));
  assert.equal(project.body.project.client.name,"Registry Client "+unique);
  const projects=await request("/api/projects");
  assert.ok(projects.body.projects.some(row=>row.id===project.body.project.id));
  const badProject=await request("/api/projects",{method:"POST",body:JSON.stringify({clientId:"bad-id",name:"Invalid project"})});
  assert.equal(badProject.response.status,400);

  const instrument=await request("/api/equipment",{method:"POST",body:JSON.stringify({identifier:"CI-"+unique,name:"Reference profilometer",instrumentType:"Stylus profilometer",calibrationReference:"CERT-01",calibrationDue:"2027-06-01"})});
  assert.equal(instrument.response.status,201,JSON.stringify(instrument.body));
  assert.ok((await request("/api/equipment")).body.equipment.some(row=>row.id===instrument.body.equipment.id));
  const duplicateInstrument=await request("/api/equipment",{method:"POST",body:JSON.stringify({identifier:"CI-"+unique,name:"Reference profilometer",instrumentType:"Stylus profilometer"})});
  assert.equal(duplicateInstrument.response.status,409);

  const template=await request("/api/templates",{method:"POST",body:JSON.stringify({title:"CI measurement assurance "+unique,description:"Temporary test template",revision:"1.0",criteria:[{code:"REQ-01",text:"Instrument verification evidence reviewed"}]})});
  assert.equal(template.response.status,201,JSON.stringify(template.body));
  const templates=await request("/api/templates");
  assert.ok(templates.body.templates.some(row=>row.id===template.body.template.id));
  const noCriteria=await request("/api/templates",{method:"POST",body:JSON.stringify({title:"Invalid",criteria:[]})});
  assert.equal(noCriteria.response.status,400);

  // v0.6: project ownership, frozen checklist, instrument associations.
  const engagement=await request("/api/audits",{method:"POST",body:JSON.stringify({
    title:"Template-based measurement review "+unique,
    client:"Registry Client "+unique,
    projectId:project.body.project.id,
    templateId:template.body.template.id,
  })});
  assert.equal(engagement.response.status,201,JSON.stringify(engagement.body));
  const engagementId=engagement.body.audit.id;
  assert.equal(engagement.body.audit.project.id,project.body.project.id);
  assert.equal(engagement.body.audit.templateSnapshot.revision,"1.0");
  assert.equal(engagement.body.audit.templateSnapshot.criteria.length,1);
  const details=await request("/api/audits/"+encodeURIComponent(engagementId));
  assert.equal(details.response.status,200);
  assert.equal(details.body.templateSnapshot.title,"CI measurement assurance "+unique);
  assert.equal(details.body.project.name,"Metrology assurance "+unique);
  const custom={answers:{"REQ-01":{answer:"Conforms",comment:"Procedure reviewed",reference:"TEST-EVD-1"}},summary:"Test",reviewer:"CI"};
  const savedCustom=await request("/api/audits/"+encodeURIComponent(engagementId),{
    method:"PATCH",body:JSON.stringify({record:custom})
  });
  assert.equal(savedCustom.response.status,200,JSON.stringify(savedCustom.body));
  const updatedCustom=(await request("/api/audits")).body.audits.find(a=>a.id===engagementId);
  assert.equal(updatedCustom.progress,100);
  const badCustom=await request("/api/audits/"+encodeURIComponent(engagementId),{
    method:"PATCH",body:JSON.stringify({record:{...custom,answers:{"REQ-99":custom.answers["REQ-01"]}}})
  });
  assert.equal(badCustom.response.status,400);
  const assigned=await request("/api/audits/"+encodeURIComponent(engagementId)+"/equipment",{
    method:"PUT",body:JSON.stringify({equipmentIds:[instrument.body.equipment.id]})
  });
  assert.equal(assigned.response.status,200,JSON.stringify(assigned.body));
  const reloadedDetail=await request("/api/audits/"+encodeURIComponent(engagementId));
  assert.equal(reloadedDetail.body.equipment.length,1);
  assert.equal(reloadedDetail.body.equipment[0].identifier,"CI-"+unique);
  const badEquip=await request("/api/audits/"+encodeURIComponent(engagementId)+"/equipment",{
    method:"PUT",body:JSON.stringify({equipmentIds:["bad-id"]})
  });
  assert.equal(badEquip.response.status,400);
  const otherClient=await request("/api/clients",{method:"POST",body:JSON.stringify({name:"Unrelated "+unique})});
  assert.equal(otherClient.response.status,201);
  const unrelated=await request("/api/audits",{method:"POST",body:JSON.stringify({
    title:"Wrong client test",client:"Unrelated "+unique,projectId:project.body.project.id
  })});
  assert.equal(unrelated.response.status,409);
  const historyV6=await request("/api/audits/"+encodeURIComponent(engagementId)+"/events");
  assert.deepEqual(historyV6.body.events.map(e=>e.action),["AUDIT_CREATED","AUDIT_UPDATED","EQUIPMENT_ASSIGNED"]);

  // v0.7: structured evidence, findings, corrective action and gated closure.
  const ev=await request("/api/audits/"+encodeURIComponent(engagementId)+"/evidence",{method:"POST",body:JSON.stringify({
    requirementCode:"REQ-01",reference:"CERT-"+unique,description:"Calibration reference"
  })});
  assert.equal(ev.response.status,201,JSON.stringify(ev.body));
  assert.equal((await request("/api/audits/"+encodeURIComponent(engagementId)+"/evidence")).body.evidence[0].reference,"CERT-"+unique);
  const badEv=await request("/api/audits/"+encodeURIComponent(engagementId)+"/evidence",{method:"POST",body:JSON.stringify({
    requirementCode:"REQ-99",reference:"INVALID"
  })});
  assert.equal(badEv.response.status,400);
  const badFinding=await request("/api/audits/"+encodeURIComponent(engagementId)+"/findings",{method:"POST",body:JSON.stringify({
    requirementCode:"REQ-99",title:"Wrong requirement",description:"Cannot match selected template"
  })});
  assert.equal(badFinding.response.status,400);
  const newFinding=await request("/api/audits/"+encodeURIComponent(engagementId)+"/findings",{method:"POST",body:JSON.stringify({
    requirementCode:"REQ-01",title:"Missing review evidence",description:"No approved document reference",severity:"HIGH"
  })});
  assert.equal(newFinding.response.status,201,JSON.stringify(newFinding.body));
  const findingId=newFinding.body.finding.id;
  const root="/api/audits/"+encodeURIComponent(engagementId)+"/findings/"+encodeURIComponent(findingId);
  const blockedCompletion=await request("/api/audits/"+encodeURIComponent(engagementId),{method:"PATCH",body:JSON.stringify({status:"Completed"})});
  assert.equal(blockedCompletion.response.status,409);
  assert.ok(blockedCompletion.body.blockers.some(reason=>reason.includes("Finding")));
  const closeEarly=await request(root,{method:"PATCH",body:JSON.stringify({status:"CLOSED"})});
  assert.equal(closeEarly.response.status,409);
  const actionCreated=await request(root+"/actions",{method:"POST",body:JSON.stringify({
    description:"Obtain current certificate",owner:"Metrology reviewer",dueDate:"2027-01-30"
  })});
  assert.equal(actionCreated.response.status,201,JSON.stringify(actionCreated.body));
  const actionId=actionCreated.body.action.id;
  const actionPath=root+"/actions/"+encodeURIComponent(actionId);
  const incompleteVerification=await request(actionPath,{method:"PATCH",body:JSON.stringify({status:"VERIFIED"})});
  assert.equal(incompleteVerification.response.status,400);
  const actionUpdated=await request(actionPath,{method:"PATCH",body:JSON.stringify({
    status:"VERIFIED",closureEvidence:"CERT-VERIFIED-"+unique,verifiedBy:"Second reviewer"
  })});
  assert.equal(actionUpdated.response.status,200,JSON.stringify(actionUpdated.body));
  assert.equal(actionUpdated.body.action.status,"VERIFIED");
  const closed=await request(root,{method:"PATCH",body:JSON.stringify({status:"CLOSED"})});
  assert.equal(closed.response.status,200,JSON.stringify(closed.body));
  const draft=await request("/api/audits/"+encodeURIComponent(engagementId)+"/report");
  assert.equal(draft.response.status,200,JSON.stringify(draft.body));
  assert.equal(draft.body.report.readiness.ready,true,JSON.stringify(draft.body.report.readiness));
  assert.equal(draft.body.report.reportStatus,"UNAPPROVED DRAFT — NOT A COMPLIANCE CERTIFICATE");
  assert.equal(draft.body.report.requirements[0].assessment,"Conforms");
  assert.equal(draft.body.report.requirements[0].evidenceReferences[0].reference,"CERT-"+unique);
  assert.equal(draft.body.report.requirements[0].findings[0].actions[0].verifiedBy,"Second reviewer");
  const invalidSimultaneous=await request("/api/audits/"+encodeURIComponent(engagementId),{
    method:"PATCH",body:JSON.stringify({status:"Completed",record:custom})
  });
  assert.equal(invalidSimultaneous.response.status,409);
  // v1.0: live cross-audit portfolio and downloadable CSVs.
  const ops=await request("/api/operations");
  assert.equal(ops.response.status,200,JSON.stringify(ops.body));
  assert.ok(ops.body.summary.audits>=2);
  assert.ok(ops.body.summary.openFindings>=0);
  assert.ok(ops.body.actions.some(row=>row.id===actionId));
  assert.ok(ops.body.findings.some(row=>row.id===findingId));
  assert.ok(ops.body.evidence.some(row=>row.reference==="CERT-"+unique));
  const csvExport=await fetch(base+"/api/operations/export?type=evidence",{headers:{Cookie:sessionCookie}});
  assert.equal(csvExport.status,200);
  assert.ok(csvExport.headers.get("content-type")?.includes("text/csv"));
  assert.ok((await csvExport.text()).includes("CERT-"+unique));
  const invalidExport=await request("/api/operations/export?type=unsupported");
  assert.equal(invalidExport.response.status,400);
  const completion=await request("/api/audits/"+encodeURIComponent(engagementId),{
    method:"PATCH",body:JSON.stringify({status:"Completed"})
  });
  assert.equal(completion.response.status,200,JSON.stringify(completion.body));
  assert.equal((await request("/api/audits")).body.audits.find(a=>a.id===engagementId).status,"Completed");
  const sealedReport=await request("/api/audits/"+encodeURIComponent(engagementId)+"/report");
  assert.equal(sealedReport.response.status,200);
  assert.equal(sealedReport.body.integrity.snapshot,true);
  assert.equal(sealedReport.body.integrity.verified,true);
  assert.match(sealedReport.body.integrity.sha256,/^[a-f0-9]{64}$/);
  assert.equal(sealedReport.body.report.audit.status,"COMPLETED");
  assert.ok(sealedReport.body.report.requirements[0].evidenceReferences.some(e=>e.reference==="CERT-"+unique));
  const blockedEdit=await request("/api/audits/"+encodeURIComponent(engagementId),{method:"PATCH",body:JSON.stringify({record:custom})});
  assert.equal(blockedEdit.response.status,409);
  const blockedEquipment=await request("/api/audits/"+encodeURIComponent(engagementId)+"/equipment",{method:"PUT",body:JSON.stringify({equipmentIds:[]})});
  assert.equal(blockedEquipment.response.status,409);
  const blockedEvidence=await request("/api/audits/"+encodeURIComponent(engagementId)+"/evidence",{method:"POST",body:JSON.stringify({requirementCode:"REQ-01",reference:"LATE-EVD"})});
  assert.equal(blockedEvidence.response.status,409);
  const blockedFinding=await request("/api/audits/"+encodeURIComponent(engagementId)+"/findings",{method:"POST",body:JSON.stringify({requirementCode:"REQ-01",title:"Late finding",description:"Post-completion edit"})});
  assert.equal(blockedFinding.response.status,409);
  const cannotChangeClosed=await request(actionPath,{method:"PATCH",body:JSON.stringify({status:"OPEN"})});
  assert.equal(cannotChangeClosed.response.status,409);
  const listedFindings=await request("/api/audits/"+encodeURIComponent(engagementId)+"/findings");
  assert.equal(listedFindings.body.findings[0].actions[0].verifiedBy,"Second reviewer");
  const historyV7=await request("/api/audits/"+encodeURIComponent(engagementId)+"/events");
  assert.deepEqual(historyV7.body.events.map(e=>e.action).slice(-6),[
    "EVIDENCE_REFERENCE_ADDED","FINDING_CREATED","CAPA_CREATED","CAPA_STATUS_CHANGED","FINDING_STATUS_CHANGED","AUDIT_UPDATED"
  ]);

  const logout=await request("/api/auth/logout",{method:"POST",body:"{}"});
  assert.equal(logout.response.status,200);
  sessionCookie="";
  assert.equal((await request("/api/audits")).response.status,401);
  assert.equal((await request("/api/clients")).response.status,401);
  assert.equal((await request("/api/equipment")).response.status,401);
  assert.equal((await request("/api/templates")).response.status,401);
  assert.equal((await request("/api/projects")).response.status,401);
  assert.equal((await request("/api/audits/"+encodeURIComponent(engagementId)+"/findings")).response.status,401);
  assert.equal((await request("/api/audits/"+encodeURIComponent(engagementId)+"/evidence")).response.status,401);
  assert.equal((await request("/api/audits/"+encodeURIComponent(engagementId)+"/report")).response.status,401);
  assert.equal((await request("/api/operations")).response.status,401);
  assert.equal((await request("/api/operations/export?type=audits")).response.status,401);
  console.log("PASS: authentication, origin validation, database persistence, audit history and logout.");
} finally {
  child.kill("SIGTERM");
  await delay(500);
  if (child.exitCode === null) child.kill("SIGKILL");
}
