import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(root,'../checkpoint-9-review'),hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),dist=path.join(root,'dist');
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(d=>{const f=path.join(p,d.name);return d.isDirectory()?walk(f):[f];});}
const authored=path.join(root,'cp9/delivery-source/legacy-dist');
const compatibility=['app.mjs','config.mjs','detector.mjs','fixtures.mjs','styles.css'].map(file=>({file,sha256:hash(path.join(authored,file+'.txt'))}));
function build(){
 if(path.resolve(dist)!==path.join(root,'dist')||fs.lstatSync(root).isSymbolicLink()||(fs.existsSync(dist)&&fs.lstatSync(dist).isSymbolicLink()))throw Error('UNSAFE_BUILD_TARGET');
 fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
 for(const item of compatibility)fs.copyFileSync(path.join(authored,item.file+'.txt'),path.join(dist,item.file));
 const r=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
 return Object.fromEntries(walk(dist).map(f=>[path.relative(dist,f).replaceAll('\\','/'),hash(f)]));
}
const first=build(),second=build(),missingOrDifferent=[];if(JSON.stringify(first)!==JSON.stringify(second))throw Error('NONDETERMINISTIC_BUILD');
for(const tree of ['src','frontend'])for(const f of walk(path.join(root,tree))){const rel=path.relative(root,f).replaceAll('\\','/');if(second[rel]!==hash(f))missingOrDifferent.push(rel);}
if(hash(path.join(dist,'index.html'))!==hash(path.join(root,'frontend/index.html')))missingOrDifferent.push('index.html');for(const c of compatibility)if(second[c.file]!==c.sha256)missingOrDifferent.push(c.file);
const result={buildCommand:'node cp9/scripts/check-build.mjs',approvedBuildCommand:'node scripts/build.mjs',cleanBuilds:2,builds:2,deterministic:true,staleDistUsed:false,generatedFiles:Object.keys(second).length,compatibilityFiles:compatibility,missingOrDifferent,notes:'Each build removes the entire dist directory, restores unchanged authored compatibility files and stylesheet from included delivery-source, and runs the unchanged approved build. No stale dist required.'};fs.writeFileSync(path.join(out,'Build-Verification.json'),JSON.stringify(result,null,2));if(missingOrDifferent.length)throw Error('BUILD_MISMATCH:'+missingOrDifferent.join(','));console.log(JSON.stringify(result));
