import http from 'node:http';import fs from 'node:fs/promises';
import { guard } from '../shared/outcome-review-contract.mjs';
import { createOutcomeReviewRepository } from '../data/repositories/outcome-review-repository.mjs';
import { createApprovedPlanProvider } from '../data/providers/approved-plan-provider.mjs';
import { createOutcomeReviewService } from '../services/outcome-review-service.mjs';
import { importOutcomeScenario,DEMO_TIME } from '../data/synthetic/outcome-review-cases.mjs';
export function createOutcomeReviewServer({filename,cp7Filename,demoPlans=null}){
 const repository=createOutcomeReviewRepository(filename),planProvider=createApprovedPlanProvider(cp7Filename),service=createOutcomeReviewService({repository,planProvider,...(demoPlans?{clock:()=>DEMO_TIME}:{})});
 const server=http.createServer(async(req,res)=>{
  const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{const url=new URL(req.url,'http://127.0.0.1');let b={};
   if(req.method==='POST'){guard(!req.headers.origin||req.headers.origin===`http://${req.headers.host}`,'CROSS_ORIGIN_WRITE_BLOCKED',403);guard(req.headers['content-type']?.startsWith('application/json'),'JSON_REQUIRED',415);let size=0,parts=[];for await(const chunk of req){size+=chunk.length;guard(size<=1048576,'BODY_TOO_LARGE',413);parts.push(chunk);}try{b=JSON.parse(Buffer.concat(parts).toString());}catch{guard(false,'INVALID_JSON',400);}}
   if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'"});return res.end(await fs.readFile(new URL('../../frontend/cp8.html',import.meta.url)));}
   if(req.method==='GET'&&url.pathname==='/cp8-app.mjs'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(await fs.readFile(new URL('../../frontend/cp8-app.mjs',import.meta.url)));}
   if(req.method==='GET'&&url.pathname==='/api/cp8/plans')return send(200,{plans:service.plans(),demoPlans});
   if(url.pathname==='/api/cp8/reviews'){if(req.method==='GET')return send(200,service.list());if(req.method==='POST')return send(201,service.open(b));}
   const m=/^\/api\/cp8\/reviews\/([\w-]+)(?:\/(execution-evidence|observations|evaluate|confirm|history|demo-import))?$/.exec(url.pathname);
   if(m){const[,id,action]=m;if(req.method==='GET'&&!action)return send(200,service.get(id));if(req.method==='GET'&&action==='history')return send(200,service.history(id));
    if(req.method==='POST'){
     const method={'execution-evidence':'addExecution',observations:'addObservation',evaluate:'evaluate',confirm:'confirm'}[action];if(method)return send(200,service[method](id,b));
     if(action==='demo-import'&&demoPlans){const row=demoPlans.find(p=>p.planId===service.get(id).plan.planId);guard(row,'UNKNOWN_DEMO_PLAN');return send(200,importOutcomeScenario(service,id,row.key));}
    }
   }return send(404,{code:'NOT_FOUND'});
  }catch(e){send(e.status??500,{code:e.code??'INTERNAL_ERROR',message:e.status?e.message:'Outcome operation failed; no result published.'});}
 });return{server,service,repository,planProvider,close:()=>new Promise(resolve=>server.close(()=>{planProvider.close();repository.close();resolve();}))};
}
