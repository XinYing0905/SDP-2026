import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runResponseScenario } from '../src/cp6/scenarios.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(root,'../checkpoint-6-review');await fs.mkdir(out,{recursive:true});
const files=(await fs.readdir(path.join(root,'tests'))).filter(f=>f.endsWith('.test.mjs'));
const results=[];
for(const [label,selection] of [['CP1-CP5',files.filter(f=>!f.startsWith('cp6-'))],['CP6',files.filter(f=>f.startsWith('cp6-'))]]){
 const r=spawnSync(process.execPath,['--test','--test-reporter=tap',...selection.map(f=>'tests/'+f)],{cwd:root,encoding:'utf8'});
 await fs.writeFile(path.join(out,`${label}-Tests.tap`),r.stdout+r.stderr);
 const counts=Object.fromEntries([...r.stdout.matchAll(/^# (tests|pass|fail|skipped) (\d+)/gm)].map(m=>[m[1],Number(m[2])]));results.push({suite:label,...counts,exitCode:r.status});console.log(label,JSON.stringify(counts));if(r.status!==0)throw Error(`${label} failed`);
}
const scenarios='ABCDEFGHI'.split('').map(runResponseScenario);
await fs.writeFile(path.join(out,'CP6-Scenarios-Actual.json'),JSON.stringify(scenarios,null,2));
const summary=scenarios.map(r=>({case:r.case,fixture:r.fixture,responseOptions:r.input.responseOptions,counts:r.collection.aggregation&&{S:r.collection.aggregation.substantive,U:r.collection.aggregation.unableToAssess,K:r.collection.aggregation.voluntarySkip,N:r.collection.aggregation.noResponse,I:r.collection.aggregation.issued},coverage:r.collection.aggregation?.substantiveCoverage??null,conversion:r.collection.conversion?.state??null,pattern:r.collection.conversion?.assertion?.pattern??null,actualState:r.result.state,beforeRaw:r.result.before?.diagnoses[2].rawEvidenceSupport??null,afterRaw:r.result.after?.diagnoses[2].rawEvidenceSupport??null,beforeRelative:r.result.before?.diagnoses[2].relativeEvidenceSupport??null,afterRelative:r.result.after?.diagnoses[2].relativeEvidenceSupport??null,explanation:r.result.after?.evidenceSufficiency.explanationSufficiency.state??null,protection:r.result.after?.evidenceSufficiency.protectionContextSufficiency.state??null,primary:r.result.after?.evidenceSufficiency.explanationSufficiency.primaryExplanation??null}));
await fs.writeFile(path.join(out,'CP6-Scenario-Summary.json'),JSON.stringify(summary,null,2));
await fs.writeFile(path.join(out,'Test-Summary.json'),JSON.stringify(results,null,2));
console.log('Exact scenario inputs, raw receipts, aggregates, evidence, snapshots and engine outputs saved.');
