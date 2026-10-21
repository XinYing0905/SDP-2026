import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(root,'../checkpoint-9-review'),baseline=JSON.parse(fs.readFileSync(path.join(out,'CP1-CP8-Baseline.json'),'utf8'));
const rows=baseline.map(r=>({...r,actual:createHash('sha256').update(fs.readFileSync(path.join(root,r.file))).digest('hex')})).map(r=>({...r,unchanged:r.sha256===r.actual}));
fs.writeFileSync(path.join(out,'CP1-CP8-Preservation.json'),JSON.stringify({files:rows.length,allUnchanged:rows.every(r=>r.unchanged),rows},null,2));if(rows.some(r=>!r.unchanged))throw Error('APPROVED_BASELINE_CHANGED');console.log(rows.length+'/'+rows.length+' approved source files byte-identical');
