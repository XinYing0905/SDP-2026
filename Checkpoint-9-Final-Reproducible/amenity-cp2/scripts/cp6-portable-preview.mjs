import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { makeCp6Fixture } from '../src/cp6/fixtures.mjs';
import { browserCryptoSource, memoryRepositorySource } from './cp6-browser-runtime.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(root,'../checkpoint-6-review');await fs.mkdir(out,{recursive:true});
const modules=new Map();
async function add(filename){const id=path.relative(root,filename).replaceAll('\\','/');if(modules.has(id))return id;modules.set(id,'');let src=await fs.readFile(filename,'utf8');
 const imports=[...src.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g)];
 for(const match of imports){const dep=match[2]==='node:crypto'?'node:crypto':await add(path.resolve(path.dirname(filename),match[2]));const names=match[1].trim().replace(/\s+as\s+/g,':');src=src.replace(match[0],`const {${names}}=require(${JSON.stringify(dep)});`);}
 if(/\bimport\s/.test(src.replace(/\/\/[^\n]*/g,'')))throw Error(`Unsupported import in ${id}`);
 const names=[...src.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let)\s+(\w+)/g)].map(m=>m[1]);src=src.replace(/export\s+(?=(?:async\s+)?(?:function|class|const|let))/g,'');
 modules.set(id,`function(require,exports){${src}\nObject.assign(exports,{${names.join(',')}});}`);return id;
}
const entry=await add(path.join(root,'src/cp6/service.mjs'));
const seeds=Object.fromEntries(['resolving','insufficient','protection','impact'].map(k=>[k,makeCp6Fixture(k)]));
const runtime=`(()=>{'use strict';${browserCryptoSource}\n${memoryRepositorySource}\nconst modules={${[...modules].map(([id,src])=>`${JSON.stringify(id)}:${src}`).join(',')}},cache={'node:crypto':nodeCrypto};function require(id){if(cache[id])return cache[id];const exports={};cache[id]=exports;modules[id](require,exports);return exports;}
const fixtures=new Map(Object.entries(${JSON.stringify(seeds)})),repository=createMemoryRepository(),service=require(${JSON.stringify(entry)}).createResidentResponseService({repository,fixtures});
window.__cp6Offline={api(path,body,token){
 if(path==='/api/cp6/cases')return [...fixtures].map(([key,f])=>({key,name:f.name,before:f.before,change:f.changeResult,plan:f.plan}));
 if(path==='/api/cp6/collections')return body?service.open(body):service.list();
 const m=/^\\/api\\/cp6\\/collections\\/([^/]+)(?:\\/(resident|responses|close|reassess|history))?$/.exec(path);if(!m)throw Error('NOT_FOUND');const [,id,action]=m;
 if(action==='resident')return service.residentPreview(id,token);if(action==='responses'){const r=service.submit(id,token,body);if(!r.accepted)throw Error(r.code);return r;}if(action==='close')return service.close(id,body.expectedRevision);if(action==='reassess')return service.reassess(id,body.expectedRevision);if(action==='history')return service.history(id);return service.get(id);
}};
window.__cp6PreviewVerification={sha256,service,repository};})();`;
new vm.Script(runtime);
// Execute the exact bundled service/adapter, not a parallel preview-only diagnosis.
const context={window:{},crypto:webcrypto,TextEncoder,Uint8Array,Uint32Array,DataView,structuredClone,console,Date};vm.runInNewContext(runtime,context);
for(const text of ['', 'abc','2–5 years · 中文', 'x'.repeat(1000)]){const actual=context.window.__cp6PreviewVerification.sha256(text),expected=createHash('sha256').update(text).digest('hex');if(actual!==expected)throw Error('Browser SHA compatibility failed');}
const api=context.window.__cp6Offline.api,results=[];
for(const key of ['resolving','insufficient']){const o=api('/api/cp6/collections',{fixtureKey:key,operatorApproved:true}),id=o.collection.id;for(let i=0;i<9;i++)api(`/api/cp6/collections/${id}/responses`,{optionId:i===8?'PF-MOSTLY':'PF-NOT-REALLY',idempotencyKey:String(i),questionVersion:o.collection.pair.questionVersion,cohortVersion:o.collection.pair.cohortVersion,planDigest:o.collection.planDigest},o.access[i].token);api(`/api/cp6/collections/${id}/close`,{expectedRevision:api(`/api/cp6/collections/${id}`).revision});const r=api(`/api/cp6/collections/${id}/reassess`,{expectedRevision:api(`/api/cp6/collections/${id}`).revision});const expected=key==='resolving'?'Sufficient Evidence':'Insufficient Evidence';if(r.after.evidenceSufficiency.explanationSufficiency.state!==expected)throw Error('Portable pipeline failed');results.push({key,actual:expected});}
let html=await fs.readFile(path.join(root,'frontend/cp6.html'),'utf8'),ui=await fs.readFile(path.join(root,'frontend/cp6-app.mjs'),'utf8');
html=html.replace('Simulated local demo','Offline · volatile demo').replace('Local hackathon implementation · SQLite persistence · no production dispatch or identity system · no intervention or AI/ML','Portable review: the real CP6 service, aggregation and diagnosis engines run in memory. Reload clears ALL responses. Use the supplied Node + SQLite application for persistent collections. No network, notifications, intervention or AI/ML.').replace('<script type="module" src="/cp6-app.mjs"></script>',`<script>${runtime.replaceAll('</script','<\\/script')}</script><script type="module">${ui.replaceAll('</script','<\\/script')}</script>`).replace('</head>',`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'"></head>`);
if(/<script[^>]+src=|<link\b|@import/.test(html))throw Error('External review resource');
// A visible persistent banner distinguishes this preview from the on-disk application.
html=html.replace('<div id="feedback"','<p style="margin:0;padding:12px 5%;background:#fff0dd;color:#88683d;font-size:11px">Offline review · responses last only until this file is refreshed or closed. Persistent Node + SQLite application is included in the source package.</p><div id="feedback"');
await fs.writeFile(path.join(out,'Checkpoint-6-Interactive-Preview.html'),html);
await fs.writeFile(path.join(out,'Portable-Preview-Verification.json'),JSON.stringify({bundleModules:modules.size,externalResources:false,networkRequired:false,persistence:'volatile memory only',sameServiceAndEngines:true,sha256Compatible:true,actualPipelineResults:results,bytes:Buffer.byteLength(html)},null,2));
console.log(JSON.stringify({bundleModules:modules.size,actualPipelineResults:results,bytes:Buffer.byteLength(html)},null,2));
