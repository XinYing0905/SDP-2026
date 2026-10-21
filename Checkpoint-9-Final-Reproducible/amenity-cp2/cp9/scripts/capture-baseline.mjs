import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(root,'../checkpoint-9-review/CP1-CP8-Baseline.json');
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>{const f=path.join(p,x.name);return x.isDirectory()?['cp9','node_modules','data','dist','.git'].includes(x.name)?[]:walk(f):/\.(mjs|json|html|css|ts|md)$/.test(x.name)?[f]:[];});}
if(fs.existsSync(out))throw Error('Baseline already frozen');const rows=walk(root).map(f=>({file:path.relative(root,f).replaceAll('\\','/'),sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex')}));fs.writeFileSync(out,JSON.stringify(rows,null,2));console.log('Frozen',rows.length,'existing files');
