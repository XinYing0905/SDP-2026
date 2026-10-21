import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),AdmZip=require('../node_modules/adm-zip'),project=path.resolve(import.meta.dirname,'../../..'),root=path.join(project,'amenity-cp2'),review=path.join(project,'checkpoint-9-review'),zip=new AdmZip(),manifest=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function add(local,name){const bytes=fs.readFileSync(local);zip.addFile(name,bytes);manifest.push({file:name,bytes:bytes.length,sha256:sha(bytes)});}
// Preservation is an integrity reference, NEVER a source inclusion allowlist.
function walk(p){for(const d of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.join(p,d.name),relative=path.relative(root,f).replaceAll('\\','/');
 if(d.isSymbolicLink())throw Error('SYMLINK_NOT_ALLOWED_IN_DELIVERY:'+relative);
 if(d.isDirectory()){if(['node_modules','.git','.openai'].includes(d.name)||relative==='cp9/demo-storage')continue;walk(f);}
 else{if(/\.sqlite-wal$/.test(d.name)){if(fs.statSync(f).size)throw Error('NONEMPTY_SQLITE_WAL_REQUIRES_CHECKPOINT:'+relative);continue;}if(/\.sqlite-shm$/.test(d.name))continue;add(f,'amenity-cp2/'+relative);}}
}
walk(root);
// Retain every frozen preservation reference as well as the complete runtime
// tree. The only skipped host-config reference is the benign static hosting
// descriptor already included in the original delivery (no credentials).
const preservation=JSON.parse(fs.readFileSync(path.join(review,'CP1-CP8-Baseline.json'),'utf8'));
for(const r of preservation)if(!manifest.some(m=>m.file==='amenity-cp2/'+r.file)){if(r.file.startsWith('.openai/')&&r.file!=='.openai/hosting.json')throw Error('UNREVIEWED_HOST_METADATA:'+r.file);add(path.join(root,r.file),'amenity-cp2/'+r.file);}
for(const f of fs.readdirSync(review).sort()){if(/^(?:Corpus-Source-Paths|Model-Download|Scenario-Build|Final-Verification|Delivery-Verification|Clean-Room-Transcript)/.test(f)||f.endsWith('.png'))continue;const local=path.join(review,f);if(fs.statSync(local).isFile())add(local,'checkpoint-9-review/'+f);}
add(path.join(project,'START-HERE-CP9.md'),'START-HERE-CP9.md');
for(const name of ['dist/detector.mjs','dist/config.mjs','dist/fixtures.mjs','src/data/providers/approved-plan-provider.mjs','src/data/repositories/outcome-review-repository.mjs','src/data/synthetic/outcome-review-cases.mjs'])if(!manifest.some(r=>r.file==='amenity-cp2/'+name))throw Error('REQUIRED_RUNTIME_FILE_NOT_PACKAGED:'+name);
zip.addFile('Source-Manifest.json',Buffer.from(JSON.stringify(manifest,null,2)));
const output=path.resolve(project,process.argv[2]??'Checkpoint-9-Reproducible-Package.zip');zip.writeZip(output);
const check=new AdmZip(output),entries=check.getEntries(),names=new Set(entries.map(e=>e.entryName)),bad=[];
for(const item of manifest){const e=check.getEntry(item.file);if(!e||sha(e.getData())!==item.sha256)bad.push(item.file);}
if(entries.some(e=>e.entryName.startsWith('/')||e.entryName.includes('..')||/^[a-z]:/i.test(e.entryName)))throw Error('UNSAFE_ARCHIVE_PATH');
if(entries.length!==manifest.length+1||names.size!==entries.length||bad.length)throw Error('ZIP_MANIFEST_VERIFICATION_FAILED:'+bad.join(','));
const verification={files:manifest.length,allEntriesVerified:true,missingOrDifferent:bad,archiveBytes:fs.statSync(output).size,archiveSha256:sha(fs.readFileSync(output)),method:'Complete project traversal, including src/data and dist; preservation manifest is not the inclusion list.'};
fs.writeFileSync(path.join(review,'Delivery-Verification.json'),JSON.stringify(verification,null,2));console.log(JSON.stringify({output,...verification}));
