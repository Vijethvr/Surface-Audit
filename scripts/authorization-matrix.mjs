// A declarative HTTP permission matrix against the actual Next.js server.
// Only synthetic CI credentials and test records are used. Forbidden writes
// carry deliberately invalid data; success would be an authorization bug.
import assert from "node:assert/strict";

export async function exerciseAuthorizationMatrix({request,signInAs,setCookie,adminCookie,auditId}){
 const id=encodeURIComponent(auditId);
 const reads=[
  "/api/clients","/api/projects","/api/equipment","/api/templates",
  "/api/audits",`/api/audits/${id}`,`/api/audits/${id}/events`,
  `/api/audits/${id}/findings`,`/api/audits/${id}/evidence`,
`/api/audits/${id}/assets`,
  `/api/audits/${id}/report`,`/api/audits/${id}/review`,
  "/api/operations","/api/operations/management"
 ];
 const adminReads=["/api/operators","/api/security/events","/api/security/incidents"];
 const noWrite=[
  ["/api/clients","POST"],["/api/projects","POST"],["/api/equipment","POST"],
  ["/api/templates","POST"],["/api/audits","POST"],
  [`/api/audits/${id}`,"PATCH"],[`/api/audits/${id}/equipment`,"PUT"],
  [`/api/audits/${id}/findings`,"POST"],
  [`/api/audits/${id}/evidence`,"POST"],
  [`/api/audits/${id}/assets`,"POST"]
 ];
 let assertions=0;
 async function expect(path,options,status,label){
  const {response}=await request(path,options);
  assert.equal(response.status,status,`${label} ${options?.method??"GET"} ${path}: expected ${status}, received ${response.status}`);
  assertions++;
 }
 try{
  setCookie("");
  for(const path of [...reads,...adminReads])await expect(path,undefined,401,"anonymous");
  for(const [path,method] of [...noWrite,[`/api/audits/${id}/review`,"POST"],["/api/operators","PATCH"]])
   await expect(path,{method,body:"{}"},401,"anonymous");
  for(const role of ["ci-viewer","ci-editor","ci-reviewer"]){
   await signInAs(role);
   for(const path of reads)await expect(path,undefined,200,role);
   for(const path of adminReads)await expect(path,undefined,403,role);
   if(role!=="ci-editor"){
    for(const [path,method] of noWrite)
     await expect(path,{method,body:"{}"},403,role);
   }
   if(role!=="ci-reviewer")
    await expect(`/api/audits/${id}/review`,{method:"POST",body:"{}"},403,role);
   await expect("/api/operators",{method:"PATCH",body:"{}"},403,role);
  }
  // A signed-in editor still cannot perform independent review; origin checks
  // must reject requests even from a valid editor/admin session.
  await signInAs("ci-editor");
  await expect("/api/clients",{method:"POST",headers:{Origin:"https://outside.invalid"},body:"{}"},403,"cross-site editor");
  await expect("/api/clients",{method:"POST",headers:{Origin:""},body:"{}"},403,"missing-origin editor");
  setCookie(adminCookie);
  for(const path of [...reads,...adminReads])await expect(path,undefined,200,"admin");
  await expect("/api/clients",{method:"POST",headers:{Origin:"https://outside.invalid"},body:"{}"},403,"cross-site admin");
  await expect("/api/operators",{method:"PATCH",headers:{Origin:""},body:"{}"},403,"missing-origin admin");
  console.log(`PASS: HTTP authorization matrix (${assertions} assertions; anonymous, viewer, editor, reviewer, admin and CSRF)`);
 }finally{setCookie(adminCookie)}
}
