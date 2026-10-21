import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import {hash,check} from './core.mjs';
export async function createEncoder({modelRoot=path.resolve(import.meta.dirname,'../models'),runtimeRoot=process.env.CP9_RUNTIME_ROOT??path.resolve(import.meta.dirname,'..')}={}){
 try{const manifest=JSON.parse(fs.readFileSync(path.join(modelRoot,'model-manifest.json'),'utf8'));for(const a of manifest.artifacts){const b=fs.readFileSync(path.join(modelRoot,'all-MiniLM-L6-v2',a.file));check(createHash('sha256').update(b).digest('hex')===a.sha256,'MODEL_ARTIFACT_HASH_MISMATCH');}
 const packageFile=path.join(runtimeRoot,'node_modules/@huggingface/transformers/package.json'),pkg=JSON.parse(fs.readFileSync(packageFile,'utf8'));check(pkg.version===manifest.transformers,'MODEL_RUNTIME_VERSION_MISMATCH');
 const {pipeline,env}=await import(pathToFileURL(path.join(path.dirname(packageFile),'dist/transformers.node.mjs')));env.allowRemoteModels=false;env.allowLocalModels=true;
 const model=await pipeline('feature-extraction',path.join(modelRoot,'all-MiniLM-L6-v2'),{dtype:'q8',device:'cpu',local_files_only:true});
 const version={...manifest,runtime:process.version,platform:process.platform,arch:process.arch,onnxruntime:JSON.parse(fs.readFileSync(path.join(runtimeRoot,'node_modules/onnxruntime-node/package.json'),'utf8')).version};
 return{available:true,version:{...version,digest:hash(version)},async embed(texts){if(!texts.length)return[];return(await model(texts,{pooling:'mean',normalize:true})).tolist();},close:()=>model.dispose()};
 }catch(e){return{available:false,reason:e.message,version:{digest:'unavailable'},embed:async()=>{throw Error('SEMANTIC_UNAVAILABLE');},close:async()=>{}};}
}
export async function buildIndex(release,encoder){const entries=release.rows.filter(r=>r.active&&r.admission.class!=='Rejected from corpus').map(r=>({id:r.case.id,featureDigest:r.case.features.digest,text:r.case.features.text})),vectors=encoder.available?await encoder.embed(entries.map(e=>e.text)):null;
 const body={corpusDigest:release.digest,model:encoder.version,semanticAvailable:encoder.available,reason:encoder.reason??null,entries:entries.map((e,i)=>({...e,vector:vectors?.[i]??null}))};return{...body,digest:hash(body)};
}
