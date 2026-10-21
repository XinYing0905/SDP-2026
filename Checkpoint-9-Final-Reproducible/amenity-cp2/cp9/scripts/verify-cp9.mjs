import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(root,'../checkpoint-9-review');
function run(args,{file,cwd=root}={}){const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024});if(file)fs.writeFileSync(path.join(out,file),r.stdout+r.stderr);else console.log(r.stdout);if(r.status!==0){console.error(r.stderr);throw Error('Verification failed: '+args.join(' '));}}
for(const name of ['refresh-history','evaluate-semantic','build-review-data','build-preview','verify-preview','check-preservation'])run(['cp9/scripts/'+name+'.mjs']);
run(['--test','--test-reporter=tap','cp9/tests/*.test.mjs'],{file:'CP9-Tests.tap'});
run(['--test','--test-reporter=tap','tests/*.test.mjs','cp9/tests/*.test.mjs'],{file:'Full-Regression.tap'});
run(['cp9/scripts/build-report.mjs']);console.log('CP9 implementation review verification complete.');
