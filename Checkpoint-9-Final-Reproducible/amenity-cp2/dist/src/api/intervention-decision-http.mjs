import http from 'node:http';import fs from 'node:fs/promises';
import { createInterventionDecisionRepository } from '../data/repositories/intervention-decision-repository.mjs';
import { createInterventionDecisionService } from '../services/intervention-decision-service.mjs';
import { interventionCaseSnapshots } from '../data/synthetic/intervention-case-snapshots.mjs';
import { assertDecision } from '../shared/intervention-decision-contract.mjs';
export function makeDecisionDemoSources(){
 const rows=structuredClone(interventionCaseSnapshots),preference=structuredClone(rows.find(r=>r.case==='N'));
 preference.case='N-preference';preference.title='A documented lower-impact comparison';
 Object.assign(preference.scopes.reprogramme.reversibility,{disruption:'none',rollback:'immediate'});
 preference.scopes.reprogramme.scopeBounds.extent='Adjust only the format within an existing slot; keep the same users, timing, access and allocation.';
 preference.scopes.reprogramme.rollbackPlan.steps='Restore the previous format immediately; no physical setup changes.';
 preference.scopes.pilot.scopeBounds.extent='Temporarily test a compatible programme in a spare slot, with bounded setup and reversal steps.';
 preference.scopes.pilot.rollbackPlan.steps='Stop the test and restore the previous compatible slot setup in an operator review cycle.';
 preference.actionEvidence.find(r=>r.scopeId===preference.scopes.reprogramme.id&&r.field==='reversibilityProfile').value=structuredClone(preference.scopes.reprogramme.reversibility);
 return [...rows,preference];
}
export function createInterventionDecisionServer({filename,fixtures}){
 const repository=createInterventionDecisionRepository(filename);
 fixtures??=new Map(repository.loadDemoSources(makeDecisionDemoSources).map(r=>[r.case,r]));
 const service=createInterventionDecisionService({repository,fixtures,clock:()=> '2026-07-29T12:00:00.000Z',clockBasis:'simulated'});
 const server=http.createServer(async(req,res)=>{
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{const url=new URL(req.url,'http://127.0.0.1');let body={};
   if(req.method==='POST'){assertDecision(!req.headers.origin||req.headers.origin===`http://${req.headers.host}`,'CROSS_ORIGIN_WRITE_BLOCKED',403);assertDecision(req.headers['content-type']?.startsWith('application/json'),'JSON_REQUIRED',415);let size=0,parts=[];for await(const part of req){size+=part.length;assertDecision(size<=16384,'BODY_TOO_LARGE',413);parts.push(part);}try{body=JSON.parse(Buffer.concat(parts).toString());}catch{assertDecision(false,'INVALID_JSON',400);}}
   if((url.pathname==='/'||url.pathname==='/cp7.html')&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'"});return res.end(await fs.readFile(new URL('../../frontend/cp7.html',import.meta.url)));}
   if(url.pathname==='/cp7-app.mjs'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(await fs.readFile(new URL('../../frontend/cp7-app.mjs',import.meta.url)));}
   if(url.pathname==='/api/cp7/cases'&&req.method==='GET')return send(200,service.cases());
   if(url.pathname==='/api/cp7/proposals'){if(req.method==='GET')return send(200,service.list());if(req.method==='POST')return send(201,service.prepare(body));}
   const m=/^\/api\/cp7\/proposals\/([a-zA-Z0-9-]+)(?:\/(decision|history))?$/.exec(url.pathname);
   if(m){const[,id,action]=m;if(req.method==='GET'&&!action)return send(200,service.get(id));if(req.method==='GET'&&action==='history')return send(200,service.history(id));if(req.method==='POST'&&action==='decision')return send(200,service.record(id,body));}
   return send(404,{code:'NOT_FOUND'});
  }catch(e){send(e.status??500,{code:e.code??'INTERNAL_ERROR',message:e.status?e.message:'No decision was published; request failed.'});}
 });
 return {server,service,repository,fixtures,close:()=>new Promise(resolve=>server.close(()=>{repository.close();resolve();}))};
}
