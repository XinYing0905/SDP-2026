import http from 'node:http';
import fs from 'node:fs/promises';
import { createResponseRepository } from './repository.mjs';
import { createResidentResponseService } from './service.mjs';
import { makeCp6Fixture } from './fixtures.mjs';
import { publicCollection, requireThat } from './contract.mjs';

export function createCp6Server({filename,clock,fixtures=new Map(['resolving','insufficient','protection','impact'].map(k=>[k,makeCp6Fixture(k)]))}) {
  const repository=createResponseRepository(filename),service=createResidentResponseService({repository,fixtures,clock});
  const html=new URL('../../frontend/cp6.html',import.meta.url);
  const js=new URL('../../frontend/cp6-app.mjs',import.meta.url);
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      // Local simulated demo only; do not expose operator endpoints as production authorisation.
      if(req.method==='POST') {
        requireThat(!req.headers.origin||req.headers.origin===`http://${req.headers.host}`,'CROSS_ORIGIN_WRITE_BLOCKED',403);
        requireThat(req.headers['content-type']?.startsWith('application/json'),'JSON_REQUIRED',415);
      }
      let body={};
      if(req.method==='POST'){let bytes=0,parts=[];for await(const part of req){bytes+=part.length;requireThat(bytes<=32768,'BODY_TOO_LARGE',413);parts.push(part);}try{body=JSON.parse(Buffer.concat(parts).toString());}catch{requireThat(false,'INVALID_JSON',400);}}
      if(url.pathname==='/'||url.pathname==='/cp6.html'){requireThat(req.method==='GET','METHOD_NOT_ALLOWED',405);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'"});return res.end(await fs.readFile(html));}
      if(url.pathname==='/cp6-app.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(await fs.readFile(js));}
      if(url.pathname==='/api/cp6/cases'&&req.method==='GET')return send(200,[...fixtures.entries()].map(([key,f])=>({key,name:f.name,before:f.before,change:f.changeResult,plan:f.plan})));
      if(url.pathname==='/api/cp6/collections') {
        if(req.method==='GET')return send(200,service.list());
        if(req.method==='POST')return send(201,service.open(body));
      }
      const match=/^\/api\/cp6\/collections\/([a-zA-Z0-9-]+)(?:\/(resident|responses|close|reassess|history))?$/.exec(url.pathname);
      if(match){const [,id,action]=match;
        if(req.method==='GET'&&!action)return send(200,service.get(id));
        if(req.method==='GET'&&action==='history')return send(200,service.history(id));
        if(req.method==='GET'&&action==='resident')return send(200,service.residentPreview(id,req.headers['x-demo-access']??''));
        if(req.method==='POST'&&action==='responses') {const r=service.submit(id,req.headers['x-demo-access']??'',body);return send(r.accepted?200:409,r);}
        if(req.method==='POST'&&action==='close')return send(200,service.close(id,body.expectedRevision));
        if(req.method==='POST'&&action==='reassess')return send(200,service.reassess(id,body.expectedRevision));
      }
      send(404,{code:'NOT_FOUND'});
    }catch(e){send(e.status??500,{code:e.code??'INTERNAL_ERROR',message:e.status?e.message:'Request could not be completed; no partial result was published.'});}
  });
  return {server,service,repository,close:()=>new Promise(resolve=>server.close(()=>{repository.close();resolve();}))};
}
