import http from 'node:http';import fs from 'node:fs';
export function createCP9Server({previewFile,product,scenarios,validation,service=null,queryProvider=null,releaseId=null,indexId=null}){
 return http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const json=(status,v)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(v));};
 if(req.method!=='GET')return json(405,{error:'READ_ONLY_CP9_RETRIEVAL_API'});
 if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync(previewFile));return;}
 if(url.pathname==='/api/cp9/product')return json(200,product);
 if(url.pathname==='/api/cp9/validation')return json(200,validation);
 if(url.pathname==='/api/cp9/qa')return json(200,scenarios);
 if(url.pathname==='/api/cp9/inspect'&&service&&queryProvider){try{const queryId=url.searchParams.get('queryId'),candidateId=url.searchParams.get('candidateId'),q=queryProvider.get(queryId,candidateId),result=await service.inspect({queryId,candidateId,releaseId,indexId,queryAsOf:q.asOf,expectedQueryDigest:(await import('./core.mjs')).hash(q)});return json(200,result);}catch(e){return json(409,{error:e.message});}}
 return json(404,{error:'NO_SUCH_CP9_READ_ROUTE'});
 });
}
