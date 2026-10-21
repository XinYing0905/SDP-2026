import fs from 'node:fs';import path from 'node:path';
import {createInterventionDecisionRepository} from '../../src/data/repositories/intervention-decision-repository.mjs';
import {createInterventionDecisionService} from '../../src/services/intervention-decision-service.mjs';
import {createApprovedPlanProvider} from '../../src/data/providers/approved-plan-provider.mjs';
import {createOutcomeReviewRepository} from '../../src/data/repositories/outcome-review-repository.mjs';
import {createOutcomeReviewService} from '../../src/services/outcome-review-service.mjs';
import {makeOutcomePlanInputs,makeOutcomeRecords,DEMO_TIME,APPROVAL_TIME} from '../../src/data/synthetic/outcome-review-cases.mjs';
import {interventionCaseSnapshots} from '../../src/data/synthetic/intervention-case-snapshots.mjs';
import {proposeInterventionDecision} from '../../src/intervention/decision-proposal.mjs';
import {featuresFromPlan} from './features.mjs';import {readHistoricalCases} from './history.mjs';import {hash,copy,check} from './core.mjs';
export const AS_OF='2026-10-01T12:00:00.000Z';
export const texts={
 food:['Residents want practical cookery classes and a communal kitchen programme. Adjust the existing weekly slot while retaining access.','Current users seek food preparation workshops and shared recipes in the hall. Adjust the existing weekly slot while retaining access.','The hall programme should include baking lessons and meal preparation skills. Adjust the existing weekly slot while retaining access.'],
 music:['Residents want group singing, choir rehearsals and music practice. Adjust the existing weekly slot while retaining access.','Current users seek instrumental lessons and community performances. Adjust the existing weekly slot while retaining access.','The hall programme should include rhythm workshops and vocal training. Adjust the existing weekly slot while retaining access.'],
 exercise:['Residents want fitness sessions, stretching and gentle exercise. Adjust the existing weekly slot while retaining access.','Current users seek aerobics and physical activity classes. Adjust the existing weekly slot while retaining access.','The hall programme should include movement and balance training. Adjust the existing weekly slot while retaining access.']};
const defs=[];
for(const [code,key]of Object.entries({repair:'A',reprogramme:'C',monitor:'I',validate:'N',pilot:'E',shared:'G',preserve:'H'}))for(let n=0;n<3;n++)defs.push({id:`${code}-${n}`,code,key:code==='shared'?'G':key,label:`${code==='reprogramme'?'Community Hall':code} — township ${n+1}`,description:code==='reprogramme'?texts.food[n]:null,family:`reference:${code}:${n}`});
for(const group of ['music','exercise'])for(let n=0;n<3;n++)defs.push({id:`${group}-${n}`,code:'reprogramme',key:'C',label:`Community Hall — ${group} township ${n+1}`,description:texts[group][n],family:`reference:${group}:${n}`});
defs.push({id:'programme-not-1',code:'reprogramme',key:'D',label:'Community Hall — unmet programme objective',description:texts.food[0],family:'reference:not-1'},
 {id:'programme-not-2',code:'reprogramme',key:'D',label:'Community Hall — second unmet objective',description:texts.food[1],family:'reference:not-2'},
 {id:'programme-breach',code:'reprogramme',key:'C',label:'Community Hall — access breach',description:texts.food[2],breach:true,family:'reference:breach'},
 {id:'programme-different-protection',code:'reprogramme',key:'C',label:'Community Hall — limited substitute capacity',description:texts.food[0],differentProtection:true,family:'reference:different'},
 ...[['missing','J','repair'],['unexecuted','K','repair'],['deviated','L','reprogramme'],['conflict','O','repair']].map(([id,key,code])=>({id,code,key,label:`Limited history — ${id}`,description:code==='reprogramme'?texts.food[0]:null,family:'reference:'+id})));
for(const code of ['reprogramme','pilot'])for(let n=0;n<3;n++)defs.push({id:`comparison-${code}-${n}`,code,key:code==='reprogramme'?'D':'E',label:`Same-purpose comparison — ${code} ${n+1}`,nContext:true,benefitOverride:code==='pilot',description:null,family:`reference:comparison:${code}:${n}`});
export const corpusDefinitions=defs;
function inputFor(def){const template=makeOutcomePlanInputs().find(r=>r.key===def.key),i=copy(def.nContext?interventionCaseSnapshots.find(r=>r.case==='N'):template.input),old=i.amenityId;
 if(def.nContext){for(const code of ['reprogramme','pilot']){const t=makeOutcomePlanInputs().find(r=>r.code===code).input.scopes[code],s=i.scopes[code];s.reviewCohort=t.reviewCohort;s.outcomeContract=copy(t.outcomeContract);s.outcomeContract.purpose=s.purpose;s.reversibility.disruption=code==='reprogramme'?'limited':'substantial';s.reversibility.rollback=code==='reprogramme'?'simple':'complex';const r=i.actionEvidence.find(r=>r.scopeId===s.id&&r.field==='reversibilityProfile');r.value={disruption:s.reversibility.disruption,functionLoss:s.reversibility.functionLoss,rollback:s.reversibility.rollback};}}
 let input=JSON.parse(JSON.stringify(i).replaceAll(old,'history:'+def.id));input.amenityId='history:'+def.id;input.changeResult.amenityId=input.amenityId;input.amenityType='Community Hall';input.case='CP9-'+def.id;input.title=def.label;input.amenityName='Community Hall';input.changeResult.amenityName='Community Hall';
 const oldIntervention=input.scopes[def.code].interventionId;input=JSON.parse(JSON.stringify(input).replaceAll(oldIntervention,'episode:'+def.id));
 if(def.description)input.scopes[def.code].description=def.description;
 if(def.differentProtection)input.evidence.dependency.alternatives[0].availableCapacity=5;
 return input;
}
export function buildDemoCorpus(directory){fs.mkdirSync(directory,{recursive:true});const cp7file=path.join(directory,'cp9-approved-plans.sqlite'),cp8file=path.join(directory,'cp9-outcome-history.sqlite');
 check(!fs.existsSync(cp7file)&&!fs.existsSync(cp8file),'DEMO_STORAGE_ALREADY_EXISTS');
 const repository=createInterventionDecisionRepository(cp7file),fixtures=new Map(defs.map(d=>[d.id,inputFor(d)])),service=createInterventionDecisionService({repository,fixtures,clock:()=>APPROVAL_TIME,clockBasis:'simulated'}),metadata={},records=[];
 try{for(const d of defs){const p=service.prepare({fixtureKey:d.id});service.record(p.id,{choice:'approve',candidateId:d.code,expectedRevision:p.revision,inputDigest:p.inputDigest,operatorId:'Simulated historical plan approver',rationale:'Simulation of an eligible operator-approved plan'});metadata[p.id]={episodeId:'episode:'+d.id,family:d.family,label:d.label};records.push({def:d,planId:p.id});}}finally{repository.close();}
 const provider=createApprovedPlanProvider(cp7file),r=createOutcomeReviewRepository(cp8file),out=createOutcomeReviewService({repository:r,planProvider:provider,clock:()=>DEMO_TIME});
 try{for(const{def:d,planId}of records){const s=out.open({planId,operatorId:'Simulated outcome reviewer'}),data=makeOutcomeRecords(s.plan,d.key);let n=0;const call=(method,body)=>out[method](s.id,{expectedRevision:out.get(s.id).revision,idempotencyKey:`import-${++n}`,...body});
  if(d.breach)data.observations.find(o=>o.metric==='protectedAccessMaintained').value=false;
  if(d.benefitOverride)data.observations.find(o=>o.metric==='pilotBenefit').value=true;
  if(data.execution)call('addExecution',{record:data.execution});for(const record of data.observations)call('addObservation',{record});call('evaluate',{asOf:DEMO_TIME});
  // A real repeated review creates a superseded review version; it is not another episode.
  if(d.id==='repair-0')call('evaluate',{asOf:DEMO_TIME});
  if(d.id==='repair-1'){const prior=out.get(s.id).observations.find(o=>o.metric==='functionRestored'),record=copy(prior);delete record.id;delete record.version;delete record.recordedAt;record.value=false;record.correction={replacesId:prior.id,authoritative:true,reason:'The original reviewed test source corrects its previously misrecorded restoration result.',evidenceRefs:['simulated-authoritative-source-correction']};call('addObservation',{record});call('evaluate',{asOf:DEMO_TIME});}
 }}finally{r.close();provider.close();}
 fs.writeFileSync(path.join(directory,'source-metadata.json'),JSON.stringify(metadata,null,2));return{cp7file,cp8file,metadata,cases:readHistoricalCases(cp7file,cp8file,metadata)};
}
// A current query is evaluated by unchanged CP7, independently of historical outcomes.
export function makeQuery(code='reprogramme',{description=texts.food[0],sourceKey=null,asOf=AS_OF,blocked=false}={}){
 const key=sourceKey??({reprogramme:'C',repair:'A',preserve:'H',pilot:'E',shared:'G',monitor:'I',validate:'N'}[code]);
 let input=sourceKey==='comparison'?inputFor({id:'current-'+code,code,key:code==='pilot'?'E':'D',label:'Current comparison',description:null,family:'query',nContext:true}):key.length===1&&makeOutcomePlanInputs().some(r=>r.key===key)?inputFor({id:'current-'+code,code,key,label:'Current Community Hall',description,family:'query'}):copy(interventionCaseSnapshots.find(r=>r.case===key));
 if(blocked){const r=input.actionEvidence.find(r=>r.scopeId===input.scopes[code].id&&r.field==='accessSafeguardsPass');check(r,'BLOCK_FIXTURE_REQUIREMENT_MISSING');r.value=false;}
 const proposal=proposeInterventionDecision(input),candidate=proposal.candidates.find(c=>c.id===code);check(candidate,'UNKNOWN_QUERY_CANDIDATE');
 const scope=candidate.scope,plan={originalInput:input,scope,approvedAt:input.asOf,decisionId:'current-proposed-scope',scopeDigest:hash(scope),pathway:candidate.pathway};
 // Current plans are not historically approved or executed; this constructs query features only.
 return{features:featuresFromPlan(plan),candidate,comparison:proposal.comparison,proposalDigest:hash(proposal),inputDigest:hash(input),asOf,amenityId:input.amenityId,episodeId:'current-episode',interventionId:candidate.interventionId,excludeFamilies:['query'],stale:input.stale,conflictingInput:input.conflictingInput};
}
