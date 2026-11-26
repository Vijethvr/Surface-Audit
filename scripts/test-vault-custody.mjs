import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const home=mkdtempSync(join(tmpdir(),"surface-custody-test-"));
function run(args,expect=0){
 const r=spawnSync(process.execPath,["scripts/vault-custody.mjs",...args],{encoding:"utf8"});
 assert.equal(r.status,expect,JSON.stringify({args,stdout:r.stdout,stderr:r.stderr}));
 return r.stdout;
}
try{
 const root=join(home,"archive"),input=join(home,"encrypted");
 mkdirSync(root);mkdirSync(input);
 const vault=join(input,"surface-audit.vault");
 writeFileSync(vault,Buffer.concat([Buffer.from("SURFAUD1"),Buffer.alloc(80,13)]));
 run(["store",input,root,"backup-001"]);
 run(["verify",root,"backup-001"]);
 run(["store",input,root,"backup-001"],1);
 run(["store",input,root,"../escape"],1);
 run(["store",input,root,"backup-002"]);
 run(["store",input,root,"backup-003"]);
 const list=run(["inventory",root]);
 assert.match(list,/"count":3/);
 const plan=run(["plan",root,"2"]);
 assert.match(plan,/"deleted":0/);
 assert.match(plan,/"candidatesForManualReview":\["backup-/);
 run(["plan",root,"1"],1);
 const archived=join(root,"backup-001","surface-audit.vault");
 const mutated=readFileSync(archived);mutated[60]^=1;writeFileSync(archived,mutated);
 run(["verify",root,"backup-001"],1);
 run(["inventory",root],1);
 // The source vault may be well-formed as a header without being decryptable:
 // custody authenticates only local SHA-256 receipts, never claims cryptographic GCM verification.
 const unsafe=join(home,"unsafe");symlinkSync(input,unsafe,"dir");
 run(["store",unsafe,root,"backup-004"],1);
 console.log("PASS: encrypted custody copy, immutable labels, tamper checks, traversal, symlink and dry-run retention");
}finally{rmSync(home,{recursive:true,force:true})}
