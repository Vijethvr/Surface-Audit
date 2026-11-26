// Development-only PostgreSQL API integration smoke test.
// Requires DATABASE_URL pointing to an isolated throwaway database and
// SURFACE_AUDIT_ENABLE_LOCAL_API=true. Never execute against client records.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {verifyDossier} from "./verify-dossier.mjs";
import {exerciseAuthorizationMatrix} from "./authorization-matrix.mjs";

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
  // v1.9: the live API runs as a DML-only PostgreSQL role, not schema owner.
  const {PrismaClient:RuntimePrismaClient}=await import("@prisma/client");
  const runtimeDb=new RuntimePrismaClient();
  try{
   const rows=await runtimeDb.$queryRaw`SELECT current_user AS username,
     has_schema_privilege(current_user,'public','CREATE') AS can_create`;
   assert.equal(rows[0].username,"surfaceaudit_app_ci");
   assert.equal(rows[0].can_create,false);
   await assert.rejects(runtimeDb.$executeRawUnsafe('CREATE TABLE "ci_forbidden_runtime_ddl" (id INTEGER)'),/permission denied|P2010/i);
   await assert.rejects(runtimeDb.$executeRawUnsafe('DELETE FROM "_prisma_migrations"'),/permission denied|P2010/i);
  }finally{await runtimeDb.$disconnect()}
  const loginEvents=await request("/api/security/events");
  assert.equal(loginEvents.response.status,200);
  assert.ok(loginEvents.body.events.some(e=>e.eventType==="LOGIN_FAILED"&&e.subjectUsername==="local-admin"));
  assert.ok(loginEvents.body.events.some(e=>e.eventType==="LOGIN_SUCCEEDED"&&e.actorUsername==="local-admin"));
  assert.doesNotMatch(JSON.stringify(loginEvents.body),/CI-password-only-not-for-real-users/);
  const invalidLogType=await request("/api/security/events?type=INVALID");
  assert.equal(invalidLogType.response.status,400);
  const oversizedLog=await request("/api/security/events?limit=1000");
  assert.equal(oversizedLog.response.status,400);
  const crossSite=await request("/api/audits",{method:"POST",headers:{Origin:"https://attacker.example"},body:JSON.stringify({title:"Disallowed",client:"Disallowed"})});
  assert.equal(crossSite.response.status,403);
  // v1.8 local boundary regression: attacker-controlled hosts, CSRF and sessions.
  // Next.js normalizes raw Host headers in its Request object. Do not interpret
  // a raw Host test as network-edge protection; test visible write origins below.
  const missingOrigin=await request("/api/audits",{method:"POST",headers:{Origin:""},body:JSON.stringify({title:"Missing origin",client:"No client"})});
  assert.equal(missingOrigin.response.status,403,"State-changing requests must carry the same-origin header");
  const invalidOriginPort=await request("/api/audits",{method:"POST",headers:{Origin:"http://127.0.0.1:9999"},body:JSON.stringify({title:"Wrong origin port",client:"No client"})});
  assert.equal(invalidOriginPort.response.status,403);
  const sessionResponse=await request("/api/auth/session");
  assert.equal(sessionResponse.body.authenticated,true);
  assert.equal(sessionResponse.body.role,"ADMIN");
  assert.match(sessionResponse.response.headers.get("cache-control")||"",/no-store/);
  assert.match(login.response.headers.get("set-cookie")||"",/httponly/i);
  assert.match(login.response.headers.get("set-cookie")||"",/samesite=strict/i);
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
  // v3.2 end-to-end consulting project lifecycle: scope, milestones,
  // audit-linked deliverables, optimistic versioning, internal acceptance.
  const lifecyclePath="/api/projects/"+encodeURIComponent(project.body.project.id)+"/lifecycle";
  const lifecycleEmpty=await request(lifecyclePath);
  assert.equal(lifecycleEmpty.response.status,200,JSON.stringify(lifecycleEmpty.body));
  assert.equal(lifecycleEmpty.body.plan.revision,0);
  assert.equal(lifecycleEmpty.body.project.client.name,"Registry Client "+unique);
  const milestoneId=crypto.randomUUID(),deliverableId=crypto.randomUUID();
  const lifecycleDraft={expectedRevision:0,stage:"DELIVERING",objective:"Review measurement assurance at the client site",
   scope:"Review procedures, calibration references and evidence; deliver documented assessment",
   exclusions:"No independent calibration or accreditation service",
   commercialNote:"Test quote reference QA-123; no billing included",
   milestones:[{id:milestoneId,title:"Perform technical assessment",owner:"Metrology team",dueDate:"2027-02-12",status:"IN_PROGRESS",note:""}],
   deliverables:[{id:deliverableId,title:"Measurement assurance audit report",description:"Final assessment report and audit dossier",
    auditId:engagementId,dueDate:"2027-02-15",status:"PREPARING",acceptanceNote:"",acceptedBy:""}],
   summary:"Created scoped project delivery baseline"};
  const savedLifecycle=await request(lifecyclePath,{method:"PATCH",body:JSON.stringify(lifecycleDraft)});
  assert.equal(savedLifecycle.response.status,200,JSON.stringify(savedLifecycle.body));
  assert.equal(savedLifecycle.body.revision,1);
  const lifecycleAfterCreate=await request(lifecyclePath);
  assert.equal(lifecycleAfterCreate.body.plan.milestones.length,1);
  assert.equal(lifecycleAfterCreate.body.plan.deliverables[0].auditId,engagementId);
  assert.ok(lifecycleAfterCreate.body.history.some(e=>e.action==="PLAN_CREATED"&&e.revision===1));
  const staleLifecycle=await request(lifecyclePath,{method:"PATCH",body:JSON.stringify({...lifecycleDraft,summary:"Stale update attempt"})});
  assert.equal(staleLifecycle.response.status,409);
  const crossClientDeliverable=await request(lifecyclePath,{method:"PATCH",body:JSON.stringify({...lifecycleDraft,expectedRevision:1,
   deliverables:[{...lifecycleDraft.deliverables[0],auditId:"clnonexistentprojectaudit12345"}],
   summary:"Cannot reference another project audit"})});
  assert.equal(crossClientDeliverable.response.status,409);
  const earlyAcceptance=await request(lifecyclePath,{method:"PATCH",body:JSON.stringify({...lifecycleDraft,expectedRevision:1,
   milestones:[{...lifecycleDraft.milestones[0],status:"DONE"}],
   deliverables:[{...lifecycleDraft.deliverables[0],status:"ACCEPTED",acceptedBy:"Internal reviewer",acceptanceNote:"Report reviewed"}],
   summary:"Cannot accept unsealed audit report"})});
  assert.equal(earlyAcceptance.response.status,409);
  const prematureClose=await request(lifecyclePath,{method:"PATCH",body:JSON.stringify({...lifecycleDraft,expectedRevision:1,stage:"CLOSED",summary:"Premature closure"})});
  assert.equal(prematureClose.response.status,400);

  assert.equal(engagement.body.audit.project.id,project.body.project.id);
  assert.equal(engagement.body.audit.templateSnapshot.revision,"1.0");
  assert.equal(engagement.body.audit.templateSnapshot.criteria.length,1);
  // v1.4: competing audit saves must not silently overwrite a loaded version.
  const firstView=await request("/api/audits/"+encodeURIComponent(engagementId));
  assert.equal(firstView.response.status,200);
  const firstRevision=firstView.body.revision;
  assert.equal(typeof firstRevision,"number");
  const revisionWrite=await request("/api/audits/"+encodeURIComponent(engagementId),{
    method:"PATCH",body:JSON.stringify({status:"In progress",expectedRevision:firstRevision})
  });
  assert.equal(revisionWrite.response.status,200,JSON.stringify(revisionWrite.body));
  assert.equal(revisionWrite.body.revision,firstRevision+1);
  const staleWrite=await request("/api/audits/"+encodeURIComponent(engagementId),{
    method:"PATCH",body:JSON.stringify({status:"Scheduled",expectedRevision:firstRevision})
  });
  assert.equal(staleWrite.response.status,409,JSON.stringify(staleWrite.body));
  const refreshedAudit=await request("/api/audits/"+encodeURIComponent(engagementId));
  assert.equal(refreshedAudit.body.revision,firstRevision+1);
  assert.equal((await request("/api/audits")).body.audits.find(row=>row.id===engagementId).revision,firstRevision+1);
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
  assert.deepEqual(historyV6.body.events.map(e=>e.action),["AUDIT_CREATED","AUDIT_UPDATED","AUDIT_UPDATED","EQUIPMENT_ASSIGNED"]);

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
  assert.match(blockedCompletion.body.error,/In review|approval/);
  const pendingReport=await request("/api/audits/"+encodeURIComponent(engagementId)+"/report");
  assert.ok(pendingReport.body.report.readiness.blockers.some(reason=>reason.includes("Finding")));
  const closeEarly=await request(root,{method:"PATCH",body:JSON.stringify({status:"CLOSED"})});
  assert.equal(closeEarly.response.status,409);
  const actionCreated=await request(root+"/actions",{method:"POST",body:JSON.stringify({
    description:"Obtain current certificate",owner:"Metrology reviewer",dueDate:"2027-01-30"
  })});
  assert.equal(actionCreated.response.status,201,JSON.stringify(actionCreated.body));
  const actionId=actionCreated.body.action.id;
  // v3.1: client engagement studio joins project, audit, CAPA and evidence;
  // all cross-client filters remain exact (this is not tenant isolation).
  const engagementDirectory=await request("/api/engagements");
  assert.equal(engagementDirectory.response.status,200);
  assert.ok(engagementDirectory.body.clients.some(c=>c.name==="Registry Client "+unique));
  const clientName="Registry Client "+unique;
  const clientScope="/api/engagements?client="+encodeURIComponent(clientName);
  const studioBefore=await request(clientScope);
  assert.equal(studioBefore.response.status,200,JSON.stringify(studioBefore.body));
  assert.equal(studioBefore.response.headers.get("cache-control"),"private, no-store");
  assert.equal(studioBefore.body.client.name,clientName);
  assert.ok(studioBefore.body.audits.some(a=>a.id===engagementId&&a.projectId===project.body.project.id));
  assert.ok(studioBefore.body.projects.some(p=>p.id===project.body.project.id));
  assert.equal(studioBefore.body.scope.totals.audits>=1,true);
  assert.equal(studioBefore.body.metrics.activeAudits>=1,true);
  assert.ok(studioBefore.body.deliverables.some(d=>d.auditId===engagementId&&!d.reportSealed&&d.dossierPath===null));
  assert.equal((await request(clientScope+"&project="+project.body.project.id)).response.status,200);
  assert.equal((await request(clientScope+"&project="+otherClient.body.client.id)).response.status,404);
  assert.equal((await request("/api/engagements?client=nonexistent-client")).response.status,404);
  assert.equal((await request("/api/engagements?format=csv")).response.status,400);
  assert.equal((await request("/api/engagements?client=x&client=y")).response.status,400);
  assert.equal((await request("/api/engagements?format=xml")).response.status,400);
  const studioCsv=await fetch(base+clientScope+"&format=csv",{headers:{Cookie:sessionCookie}});
  assert.equal(studioCsv.status,200);
  assert.ok((studioCsv.headers.get("content-type")??"").includes("text/csv"));
  assert.match(studioCsv.headers.get("content-disposition")??"",/attachment/);
  const studioCsvBytes=Buffer.from(await studioCsv.arrayBuffer());
  assert.deepEqual([...studioCsvBytes.subarray(0,3)],[0xef,0xbb,0xbf]);
  assert.ok(studioCsvBytes.toString("utf8").includes(clientName));
  assert.doesNotMatch(studioCsvBytes.toString("utf8"),/CI-password-only-not-for-real-users/);

  // v3.0 delivery command center: cross-audit planning and editable deadlines.
  const deliveryInitial=await request("/api/delivery");
  assert.equal(deliveryInitial.response.status,200,JSON.stringify(deliveryInitial.body));
  assert.equal(deliveryInitial.response.headers.get("cache-control"),"private, no-store");
  assert.ok(deliveryInitial.body.items.some(i=>i.id==="action:"+actionId&&i.date==="2027-01-30"));
  assert.ok(deliveryInitial.body.items.some(i=>i.id==="audit:"+engagementId&&i.bucket==="UNSCHEDULED"));
  assert.equal((await request("/api/delivery?range=IMPOSSIBLE")).response.status,400);
  assert.equal((await request("/api/delivery?client=unknown-client")).response.status,400);
  assert.equal((await request("/api/delivery?format=pdf")).response.status,400);
  assert.equal((await request("/api/delivery?kind=ACTION&kind=AUDIT")).response.status,400);
  const auditScheduled=await request("/api/delivery/schedule",{method:"PATCH",body:JSON.stringify({kind:"AUDIT",id:engagementId,date:"2027-02-05"})});
  assert.equal(auditScheduled.response.status,200,JSON.stringify(auditScheduled.body));
  const actionScheduled=await request("/api/delivery/schedule",{method:"PATCH",body:JSON.stringify({kind:"ACTION",id:actionId,date:"2027-02-01"})});
  assert.equal(actionScheduled.response.status,200,JSON.stringify(actionScheduled.body));
  const invalidSchedule=await request("/api/delivery/schedule",{method:"PATCH",body:JSON.stringify({kind:"AUDIT",id:engagementId,date:"2027-02-30"})});
  assert.equal(invalidSchedule.response.status,400);
  const deliveryUpdated=await request("/api/delivery?kind=ACTION");
  assert.equal(deliveryUpdated.response.status,200);
  assert.ok(deliveryUpdated.body.items.some(i=>i.id==="action:"+actionId&&i.date==="2027-02-01"));
  const deliveryCalendar=await fetch(base+"/api/delivery?format=ics",{headers:{Cookie:sessionCookie}});
  assert.equal(deliveryCalendar.status,200);
  assert.match(deliveryCalendar.headers.get("content-type")??"",/text\/calendar/);
  assert.match(deliveryCalendar.headers.get("content-disposition")??"",/attachment/);
  const ics=await deliveryCalendar.text();
  assert.ok(ics.includes("BEGIN:VCALENDAR")&&ics.includes("END:VCALENDAR"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20270201"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20270205"));
  assert.ok(ics.includes("STATUS:TENTATIVE"));
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
  // v1.1: evidence file custody, safe downloads and integrity checks.
  const assetRoot="/api/audits/"+encodeURIComponent(engagementId)+"/assets";
  const pdfBytes=Buffer.from("%PDF-1.4\\n1 0 obj\\n<<>>\\nendobj\\n%%EOF\\n","utf8");
  async function uploadEvidence(bytes,mime,requirement="REQ-01",filename="CI-evidence.pdf"){
    const form=new FormData();
    form.append("requirementCode",requirement);
    form.append("file",new Blob([bytes],{type:mime}),filename);
    const response=await fetch(base+assetRoot,{
      method:"POST",headers:{Cookie:sessionCookie,Origin:base},body:form,signal:AbortSignal.timeout(20000)
    });
    return {response,body:await response.json()};
  }
  const invalidFile=await uploadEvidence(Buffer.from("not a pdf"),"application/pdf");
  assert.equal(invalidFile.response.status,415);
  const wrongRequirement=await uploadEvidence(pdfBytes,"application/pdf","REQ-99");
  assert.equal(wrongRequirement.response.status,400);
  const oversized=await uploadEvidence(Buffer.alloc(1024*1024+1,65),"application/pdf");
  assert.equal(oversized.response.status,413);
  const uploaded=await uploadEvidence(pdfBytes,"application/pdf");
  assert.equal(uploaded.response.status,201,JSON.stringify(uploaded.body));
  const assetId=uploaded.body.asset.id;
  assert.match(uploaded.body.asset.sha256,/^[a-f0-9]{64}$/);
  assert.equal(uploaded.body.asset.requirementCode,"REQ-01");
  const files=await request(assetRoot);
  assert.equal(files.response.status,200);
  assert.equal(files.body.assets[0].id,assetId);
  const assetResponse=await fetch(base+assetRoot+"/"+encodeURIComponent(assetId),{headers:{Cookie:sessionCookie}});
  assert.equal(assetResponse.status,200);
  assert.equal(assetResponse.headers.get("content-type"),"application/octet-stream");
  assert.ok(assetResponse.headers.get("content-disposition")?.includes("attachment"));
  assert.deepEqual(Buffer.from(await assetResponse.arrayBuffer()),pdfBytes);
  const unauthedFile=await fetch(base+assetRoot+"/"+encodeURIComponent(assetId));
  assert.equal(unauthedFile.status,401);
  const bogusFile=await request(assetRoot+"/unknown");
  assert.equal(bogusFile.response.status,404);
  const updatedDraft=await request("/api/audits/"+encodeURIComponent(engagementId)+"/report");
  assert.equal(updatedDraft.response.status,200);
  assert.equal(updatedDraft.body.report.requirements[0].evidenceFiles[0].sha256,uploaded.body.asset.sha256);

  // v1.2: database roles, review separation, revocable sessions.
  const adminCookie=sessionCookie;
  const reviewRoot="/api/audits/"+encodeURIComponent(engagementId)+"/review";
  const reviewBefore=await request(reviewRoot);
  assert.equal(reviewBefore.response.status,200);
  assert.equal(reviewBefore.body.current,false);
  const needApproval=await request("/api/audits/"+encodeURIComponent(engagementId),{method:"PATCH",body:JSON.stringify({status:"Completed"})});
  assert.equal(needApproval.response.status,409);
  const prepareForReview=await request("/api/audits/"+encodeURIComponent(engagementId),{method:"PATCH",body:JSON.stringify({status:"In review"})});
  assert.equal(prepareForReview.response.status,200);
  const selfReview=await request(reviewRoot,{method:"POST",body:JSON.stringify({decision:"APPROVED",note:"I independently checked this record"})});
  assert.equal(selfReview.response.status,403,"Preparing operator must not approve own work");
  async function signInAs(username){
   const attempt=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username,password:"CI-password-only-not-for-real-users"})});
   assert.equal(attempt.response.status,200,JSON.stringify(attempt.body));
   sessionCookie=attempt.response.headers.get("set-cookie")?.split(";")[0]??"";
   return sessionCookie;
  }
  await exerciseAuthorizationMatrix({request,signInAs,setCookie:value=>{sessionCookie=value},adminCookie,auditId:engagementId});
  const viewerCookie=await signInAs("ci-viewer");
  assert.equal((await request("/api/security/events")).response.status,403,"Viewer cannot inspect authentication history");
  const viewerRead=await request(reviewRoot);
  assert.equal(viewerRead.response.status,200);
  const viewerWrite=await request("/api/clients",{method:"POST",body:JSON.stringify({name:"Viewer rejected"})});
  assert.equal(viewerWrite.response.status,403);
  const viewerApproval=await request(reviewRoot,{method:"POST",body:JSON.stringify({decision:"APPROVED",note:"Viewer cannot authorize"})});
  assert.equal(viewerApproval.response.status,403);
  await signInAs("ci-editor");
  const editorReview=await request(reviewRoot,{method:"POST",body:JSON.stringify({decision:"APPROVED",note:"Editor cannot approve"})});
  assert.equal(editorReview.response.status,403);
  await signInAs("ci-reviewer");
  const reviewerChanges=await request("/api/audits/"+encodeURIComponent(engagementId),{method:"PATCH",body:JSON.stringify({status:"Scheduled"})});
  assert.equal(reviewerChanges.response.status,403);
  const approved=await request(reviewRoot,{method:"POST",body:JSON.stringify({decision:"APPROVED",note:"Independent reviewer confirms the saved audit readiness checks"})});
  assert.equal(approved.response.status,201,JSON.stringify(approved.body));
  assert.equal((await request(reviewRoot)).body.current,true);
  sessionCookie=adminCookie;
  // A direct database modification without an audit event must also invalidate the
  // content-bound reviewer approval. Restore it afterward for the normal lifecycle.
  const {PrismaClient}=await import("@prisma/client");
  const tamperDb=new PrismaClient();
  try{
   const original=await tamperDb.auditRecord.findUnique({where:{auditId:engagementId}});
   assert.ok(original);
   const originalContent=structuredClone(original.content);
   await tamperDb.auditRecord.update({where:{auditId:engagementId},data:{
    content:{...originalContent,summary:"Changed without an audit event"}
   }});
   assert.equal((await request(reviewRoot)).body.current,false,
     "Approval digest must reject unlogged assessment changes");
   await tamperDb.auditRecord.update({where:{auditId:engagementId},data:{content:originalContent}});
   assert.equal((await request(reviewRoot)).body.current,true);
  }finally{await tamperDb.$disconnect()}
  // Editing an assessment after independent approval must invalidate the approval.
  const changedAfterReview=await request("/api/audits/"+encodeURIComponent(engagementId),{method:"PATCH",body:JSON.stringify({record:{...custom,summary:"Summary amended after reviewer approval"}})});
  assert.equal(changedAfterReview.response.status,200);
  assert.equal((await request(reviewRoot)).body.current,false);
  const staleApproval=await request("/api/audits/"+encodeURIComponent(engagementId),{method:"PATCH",body:JSON.stringify({status:"Completed"})});
  assert.equal(staleApproval.response.status,409);
  await signInAs("ci-reviewer");
  const reapproved=await request(reviewRoot,{method:"POST",body:JSON.stringify({decision:"APPROVED",note:"Re-reviewed after updated summary was saved in the audit"})});
  assert.equal(reapproved.response.status,201,JSON.stringify(reapproved.body));
  sessionCookie=adminCookie;
  const reviewEvents=await request("/api/security/events?type=REVIEW_APPROVED");
  assert.equal(reviewEvents.response.status,200);
  assert.ok(reviewEvents.body.events.some(e=>e.actorUsername==="ci-reviewer"));
  const adminUsers=await request("/api/operators");
  assert.equal(adminUsers.response.status,200);
  assert.ok(adminUsers.body.operators.some(user=>user.username==="ci-viewer"&&user.role==="VIEWER"));
  // v1.3: repeated failed sign-ins lock an account until an administrator resets it.
  for(let n=0;n<5;n++){
   const wrong=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username:"ci-editor",password:"incorrect-password-"+n})});
   assert.equal(wrong.response.status,401);
  }
  const locked=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username:"ci-editor",password:"CI-password-only-not-for-real-users"})});
  assert.equal(locked.response.status,401,"Correct password must not bypass temporary lockout");
  const editorAccount=adminUsers.body.operators.find(row=>row.username==="ci-editor");
  const lockedListing=await request("/api/operators");
  const lockedEditor=lockedListing.body.operators.find(row=>row.username==="ci-editor");
  assert.ok(lockedEditor.loginLockedUntil);
  assert.ok(lockedEditor.failedLoginCount>=5);
  const unlock=await request("/api/operators",{method:"PATCH",body:JSON.stringify({id:editorAccount.id,resetLockout:true})});
  assert.equal(unlock.response.status,200,JSON.stringify(unlock.body));
  const unblocked=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username:"ci-editor",password:"CI-password-only-not-for-real-users"})});
  assert.equal(unblocked.response.status,200);
  // v2.4: concurrent wrong-password requests must not lose failure increments.
  // The five-request threshold must hold even when all HTTP attempts overlap.
  const simultaneousFailures=await Promise.all(Array.from({length:7},(_,n)=>
   request("/api/auth/login",{method:"POST",body:JSON.stringify({username:"ci-editor",password:"parallel-wrong-"+n})})));
  assert.ok(simultaneousFailures.every(result=>result.response.status===401));
  const afterParallel=await request("/api/operators");
  const parallelAccount=afterParallel.body.operators.find(row=>row.username==="ci-editor");
  assert.equal(parallelAccount.failedLoginCount,5,"Concurrent attempts must atomically reach the exact lockout threshold");
  assert.ok(parallelAccount.loginLockedUntil,"Concurrent attempts must activate lockout");
  const parallelCorrect=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username:"ci-editor",password:"CI-password-only-not-for-real-users"})});
  assert.equal(parallelCorrect.response.status,401,"Concurrent lockout must deny correct credentials");
  const parallelReset=await request("/api/operators",{method:"PATCH",body:JSON.stringify({id:editorAccount.id,resetLockout:true})});
  assert.equal(parallelReset.response.status,200);
  const parallelRestored=await request("/api/auth/login",{method:"POST",body:JSON.stringify({username:"ci-editor",password:"CI-password-only-not-for-real-users"})});
  assert.equal(parallelRestored.response.status,200,"Administrator reset must restore sign-in");
  // Old cookie from earlier successful login is intentionally not used here.
  // Admin session stays in effect: a newly issued editor cookie does not replace it.
  sessionCookie=adminCookie;
  // Deactivation revokes an existing viewer session in the database.
  const viewerId=adminUsers.body.operators.find(user=>user.username==="ci-viewer").id;
  const deactivate=await request("/api/operators",{method:"PATCH",body:JSON.stringify({id:viewerId,active:false})});
  assert.equal(deactivate.response.status,200);
  // v2.1: time-windowed incident review, admin isolation and bounded CSV export.
  const incidentReview=await request("/api/security/incidents?hours=168&limit=100");
  assert.equal(incidentReview.response.status,200,JSON.stringify(incidentReview.body));
  assert.ok(incidentReview.body.total>=1);
  assert.ok(incidentReview.body.summary.some(row=>row.type==="LOGIN_LOCKED"));
  assert.ok(incidentReview.body.authenticationFailuresAndLockouts>=1);
  assert.equal(incidentReview.response.headers.get("cache-control"),"private, no-store");
  assert.equal((await request("/api/security/incidents?hours=0")).response.status,400);
  assert.equal((await request("/api/security/incidents?hours=168&limit=501")).response.status,400);
  assert.equal((await request("/api/security/incidents?type=UNRECOGNIZED")).response.status,400);
  assert.equal((await request("/api/security/incidents?format=xml")).response.status,400);
  const incidentCsvResponse=await fetch(base+"/api/security/incidents?hours=168&format=csv",{headers:{Cookie:sessionCookie}});
  assert.equal(incidentCsvResponse.status,200);
  assert.ok((incidentCsvResponse.headers.get("content-type")??"").includes("text/csv"));
  assert.match(incidentCsvResponse.headers.get("content-disposition")??"",/attachment/);
  const incidentCsvBytes=Buffer.from(await incidentCsvResponse.arrayBuffer());
  assert.deepEqual([...incidentCsvBytes.subarray(0,3)],[0xEF,0xBB,0xBF]);
  const incidentCsvBody=incidentCsvBytes.toString("utf8");
  assert.ok(incidentCsvBody.includes("LOGIN_LOCKED"));
  await signInAs("ci-reviewer");
  assert.equal((await request("/api/security/incidents")).response.status,403);
  sessionCookie=adminCookie;
  const adminSecurityLog=await request("/api/security/events");
  assert.ok(adminSecurityLog.body.events.some(e=>e.eventType==="LOGIN_LOCKED"&&e.subjectUsername==="ci-editor"));
  assert.ok(adminSecurityLog.body.events.some(e=>e.eventType==="LOGIN_LOCKOUT_RESET"&&e.actorUsername==="local-admin"));
  assert.ok(adminSecurityLog.body.events.some(e=>e.eventType==="OPERATOR_DISABLED"&&e.subjectUsername==="ci-viewer"));
  sessionCookie=viewerCookie;
  assert.equal((await request(reviewRoot)).response.status,401);
  sessionCookie=adminCookie;
  const completion=await request("/api/audits/"+encodeURIComponent(engagementId),{
    method:"PATCH",body:JSON.stringify({status:"Completed"})
  });
  assert.equal(completion.response.status,200,JSON.stringify(completion.body));
  assert.equal((await request("/api/audits")).body.audits.find(a=>a.id===engagementId).status,"Completed");
  const studioAfterSeal=await request("/api/engagements?client="+encodeURIComponent(clientName));
  assert.equal(studioAfterSeal.response.status,200);
  assert.ok(studioAfterSeal.body.deliverables.some(d=>d.auditId===engagementId&&d.reportSealed&&d.dossierPath));

  const lifecycleClosed=await request(lifecyclePath,{method:"PATCH",body:JSON.stringify({...lifecycleDraft,expectedRevision:1,stage:"CLOSED",
   milestones:[{...lifecycleDraft.milestones[0],status:"DONE",note:"All technical checks completed"}],
   deliverables:[{...lifecycleDraft.deliverables[0],status:"ACCEPTED",acceptedBy:"Internal reviewer",acceptanceNote:"Reviewed sealed local report"}],
   summary:"All planned deliverables reviewed internally and lifecycle closed"})});
  assert.equal(lifecycleClosed.response.status,200,JSON.stringify(lifecycleClosed.body));
  assert.equal(lifecycleClosed.body.revision,2);
  const lifecycleHistory=await request(lifecyclePath);
  assert.equal(lifecycleHistory.body.plan.stage,"CLOSED");
  assert.equal(lifecycleHistory.body.history[0].action,"PLAN_CLOSED");
  assert.deepEqual(lifecycleHistory.body.history.map(e=>e.revision),[2,1]);
  const afterClosure=await request(lifecyclePath,{method:"PATCH",body:JSON.stringify({...lifecycleDraft,expectedRevision:2,
   summary:"Closed project must not change"})});
  assert.equal(afterClosure.response.status,409);
  const sealedReport=await request("/api/audits/"+encodeURIComponent(engagementId)+"/report");
  assert.equal(sealedReport.response.status,200);
  assert.equal(sealedReport.body.integrity.snapshot,true);
  assert.equal(sealedReport.body.integrity.verified,true);
  assert.match(sealedReport.body.integrity.sha256,/^[a-f0-9]{64}$/);
  assert.equal(sealedReport.body.report.audit.status,"COMPLETED");
  assert.ok(sealedReport.body.report.requirements[0].evidenceReferences.some(e=>e.reference==="CERT-"+unique));
  assert.equal(sealedReport.body.report.requirements[0].evidenceFiles[0].sha256,uploaded.body.asset.sha256);
  // v2.0: management intelligence, scoped decision pack and safe exports.
  const management=await request("/api/operations/management");
  assert.equal(management.response.status,200,JSON.stringify(management.body));
  assert.equal(management.body.formatVersion,"surface-audit-management-review-v2");
  assert.equal(management.body.scope.limitPerCategory,500);
  assert.match(management.body.scope.warning,/500/);
  assert.ok(management.body.metrics.audits>=1);
  assert.ok(management.body.metrics.completedAudits>=1);
  assert.ok(management.body.metrics.sealedReports>=1);
  assert.equal(management.body.auditStartsByMonth.length,6);
  assert.ok(management.body.clients.length>=1);
  assert.ok(Array.isArray(management.body.topRiskClients));
  assert.ok(Array.isArray(management.body.priorityActions));
  assert.match(management.response.headers.get("cache-control")||"",/no-store/);
  const firstClient=management.body.clients[0];
  const scoped=await request("/api/operations/management?client="+encodeURIComponent(firstClient));
  assert.equal(scoped.response.status,200);
  assert.equal(scoped.body.selectedClient,firstClient);
  assert.ok(scoped.body.topRiskClients.every(row=>row.client===firstClient));
  assert.equal((await request("/api/operations/management?client="+encodeURIComponent("CI-unknown-client"))).response.status,404);
  assert.equal((await request("/api/operations/management?client=%20invalid%20")).response.status,400);
  assert.equal((await request("/api/operations/management/export?format=xml")).response.status,400);
  const managementExport=await fetch(base+"/api/operations/management/export?format=json",{headers:{Cookie:sessionCookie}});
  assert.equal(managementExport.status,200);
  assert.match(managementExport.headers.get("content-disposition")||"",/attachment/);
  assert.equal((await managementExport.json()).formatVersion,"surface-audit-management-review-v2");
  const managementCsv=await fetch(base+"/api/operations/management/export?format=csv",{headers:{Cookie:sessionCookie}});
  assert.equal(managementCsv.status,200);
  assert.ok((managementCsv.headers.get("content-type")||"").includes("text/csv"));
  const csvBytes=new Uint8Array(await managementCsv.arrayBuffer());
  assert.deepEqual(Array.from(csvBytes.slice(0,3)),[0xEF,0xBB,0xBF]);
  const csvText=Buffer.from(csvBytes).toString("utf8");
  assert.match(csvText,/overdueActions/);
  const dossierResponse=await fetch(base+"/api/audits/"+encodeURIComponent(engagementId)+"/dossier",{headers:{Cookie:sessionCookie}});
  assert.equal(dossierResponse.status,200);
  assert.ok(dossierResponse.headers.get("content-disposition")?.includes("attachment"));
  const dossier=await dossierResponse.json();
  assert.equal(dossier.formatVersion,"surface-audit-dossier-v1");
  assert.equal(dossier.assets.length,1);
  assert.equal(dossier.assets[0].sha256,uploaded.body.asset.sha256);
  if(process.env.CI==="true")await (await import("node:fs/promises")).writeFile("/tmp/surface-audit-ci-sealed-dossier.json",JSON.stringify(dossier,null,2));
  const verifiedDossier=verifyDossier(dossier);
  assert.equal(verifiedDossier.valid,true,JSON.stringify(verifiedDossier));
  const corruptEvidence=structuredClone(dossier);
  corruptEvidence.assets[0].base64=Buffer.from("corrupted").toString("base64");
  assert.equal(verifyDossier(corruptEvidence).valid,false);
  const corruptReport=structuredClone(dossier);
  corruptReport.report.summary="Altered after export";
  assert.equal(verifyDossier(corruptReport).valid,false);
  const blockedUpload=await uploadEvidence(pdfBytes,"application/pdf");
  assert.equal(blockedUpload.response.status,409);
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
  assert.deepEqual(historyV7.body.events.map(e=>e.action).slice(-3),["AUDIT_UPDATED","REVIEW_APPROVED","AUDIT_SEALED"]);
  assert.equal((await request(reviewRoot)).body.current,true);

  // v1.5: DB-level append-only guards block direct SQL changes even when
  // bypassing the application APIs (not a defense against database owners).
  const {PrismaClient: IntegrityPrismaClient}=await import("@prisma/client");
  const integrityDb=new IntegrityPrismaClient();
  try{
    const event=await integrityDb.auditEvent.findFirst({where:{auditId:engagementId},orderBy:{createdAt:"asc"}});
    assert.ok(event);
    await assert.rejects(
      integrityDb.auditEvent.update({where:{id:event.id},data:{actor:"altered"}}),
      /history is append-only|constraint|P2004/i);
    await assert.rejects(
      integrityDb.auditEvent.delete({where:{id:event.id}}),
      /history is append-only|constraint|P2004/i);
    const reviewRow=await integrityDb.auditReview.findFirst({where:{auditId:engagementId}});
    assert.ok(reviewRow);
    await assert.rejects(
      integrityDb.auditReview.update({where:{id:reviewRow.id},data:{note:"tampered"}}),
      /history is append-only|constraint|P2004/i);
    const snapshotRow=await integrityDb.auditReportSnapshot.findUnique({where:{auditId:engagementId}});
    assert.ok(snapshotRow);
    await assert.rejects(
      integrityDb.auditReportSnapshot.update({where:{id:snapshotRow.id},data:{sha256:"bad"}}),
      /history is append-only|constraint|P2004/i);
    const securityRow=await integrityDb.securityEvent.findFirst();
    assert.ok(securityRow);
    await assert.rejects(integrityDb.securityEvent.update({where:{id:securityRow.id},data:{outcome:"ALTERED"}}),/history is append-only|constraint|P2004/i);
    await assert.rejects(integrityDb.securityEvent.delete({where:{id:securityRow.id}}),/history is append-only|constraint|P2004/i);
    const assetRow=await integrityDb.evidenceAsset.findFirst({where:{auditId:engagementId}});
    assert.ok(assetRow);
    await assert.rejects(
      integrityDb.evidenceAsset.delete({where:{id:assetRow.id}}),
      /history is append-only|constraint|P2004/i);
  }finally{await integrityDb.$disconnect()}

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
  assert.equal((await request("/api/operations/management")).response.status,401);
  assert.equal((await request("/api/operations/management/export?format=json")).response.status,401);
  assert.equal((await request(assetRoot)).response.status,401);
  assert.equal((await request("/api/audits/"+encodeURIComponent(engagementId)+"/dossier")).response.status,401);
  assert.equal((await request(reviewRoot)).response.status,401);
  assert.equal((await request("/api/operators")).response.status,401);
  assert.equal((await request("/api/security/events")).response.status,401);
  assert.equal((await request("/api/security/incidents")).response.status,401);
  assert.equal((await request("/api/delivery")).response.status,401);
  assert.equal((await request("/api/engagements")).response.status,401);
  assert.equal((await request(lifecyclePath)).response.status,401);
  assert.equal((await request(lifecyclePath,{method:"PATCH",body:"{}"})).response.status,401);
  assert.equal((await request("/api/delivery/schedule",{method:"PATCH",body:"{}"})).response.status,401);
  console.log("PASS: authentication, origin validation, database persistence, audit history and logout.");
} finally {
  child.kill("SIGTERM");
  await delay(500);
  if (child.exitCode === null) child.kill("SIGKILL");
}
