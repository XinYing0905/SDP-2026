import { interventionCaseSnapshots } from './intervention-case-snapshots.mjs';
import { criterionTemplates,bindOutcomeContract } from '../../outcome/contract-binding.mjs';
import { createInterventionDecisionService } from '../../services/intervention-decision-service.mjs';
import { digest,clone } from '../../shared/outcome-review-contract.mjs';
export const DEMO_TIME='2026-09-15T12:00:00.000Z';
export const APPROVAL_TIME='2026-07-29T12:00:00.000Z';
export const scenarioDefinitions=[
 ['A','C','repair','Successful repair, usage unchanged'],['B','C','repair','Restored function and later usage recovery'],['C','A','reprogramme','Relevant programme participation improves'],['D','A','reprogramme','Programme goal not met despite conforming execution'],
 ['E','K','pilot','Pilot benefit fails; decision question answered'],['F','K','pilot','Pilot benefit with protected-access breach'],['G','I','shared','Shared benefit cannot offset protected-access loss'],['H','F','preserve','Protected function continues with low utilisation'],
 ['I','E','monitor','Comparable observation without usage recovery'],['J','C','repair','Missing outcome evidence'],['K','C','repair','Approval without execution evidence'],['L','A','reprogramme','Materially different executed scope'],
 ['M','C','repair','Authoritative original-period correction weakens operational support'],['N','M','validate','New verified original-period evidence strengthens support'],['O','C','repair','Independent outcome sources conflict']
];
const perPath={repair:['functionRestored','downtime','recurrence'],reprogramme:['participation'],pilot:['benefit','evidence','stopRollback'],shared:['sharedBenefit'],preserve:['preserve'],monitor:['observe'],validate:['validate']};
export function makeOutcomePlanInputs(){return scenarioDefinitions.map(([key,source,code,title])=>{
 const f=clone(interventionCaseSnapshots.find(x=>x.case===source));f.case='CP8-'+key;f.title=title;f.originalReferenceWindow={start:'2026-02-09',end:'2026-07-26'};
 const scope=f.scopes[code];scope.reviewCohort=code==='preserve'?'Documented dependent current-function cohort':code==='reprogramme'||code==='pilot'?'Relevant programme/current-use cohort':'Documented current-function users';
 scope.outcomeContract={...scope.outcomeContract,id:`cp8-demo-contract:${key}`,criteria:[...perPath[code],'protection'].map(k=>criterionTemplates.find(t=>t.key===k).text).join('\n')};
 return{key,title,code,input:f};
});}
// Synthetic plans are actually approved through unchanged CP7 before any outcomes are created.
export function seedOutcomePlans(repository){
 const rows=repository.loadDemoSources(makeOutcomePlanInputs),fixtures=new Map(rows.map(r=>[r.key,r.input]));
 const service=createInterventionDecisionService({repository,fixtures,clock:()=>APPROVAL_TIME,clockBasis:'simulated'});
 return rows.map(row=>{let saved=repository.list().find(s=>s.fixtureKey===row.key&&s.decision?.choice==='approve');if(!saved){const p=service.prepare({fixtureKey:row.key});service.record(p.id,{choice:'approve',candidateId:row.code,expectedRevision:p.revision,inputDigest:p.inputDigest,operatorId:'Simulated plan approver'});saved=repository.get(p.id);}return{key:row.key,title:row.title,planId:saved.id,decisionId:saved.decision.id};});
}
export function makeOutcomeRecords(plan,key){
 const source=(id,type)=>({id:`simulated:${key}:${id}`,type,responsible:'Simulated external operator / reviewed source',evidenceRefs:[`simulated-document:${key}:${id}`],isSynthetic:true});
 const common={decisionId:plan.decisionId,approvedVersion:plan.approvedVersion,interventionId:plan.interventionId,contractDigest:plan.contractDigest,availableAt:'2026-09-14T09:00:00.000Z',receivedAt:'2026-09-14T10:00:00.000Z'};
 const execution={...common,scopeDigest:plan.scopeDigest,actualStart:'2026-08-01T09:00:00.000Z',actualEnd:'2026-09-12T17:00:00.000Z',executedScope:clone(plan.scope),reportedState:'Completed',deviations:[],source:source('execution','external-execution-record'),verification:{reviewed:true,evidenceRefs:[`simulated-corroboration:${key}`]}};
 if(key==='L'){execution.deviations=[{material:true,affected:'cohort/exposure',description:'Different cohort and programme frequency',reviewReason:'Changes the approved intervention mechanism',evidenceRefs:['simulated-deviation-report']}];execution.executedScope.description='Different cohort / exposure from approved scope';}
 const binding=bindOutcomeContract(plan,APPROVAL_TIME),observations=binding.criteria.map(c=>({...common,metric:c.metric,value:c.target,unit:typeof c.target==='boolean'?'boolean':c.metric==='downtimeHours'?'hours':'count',baseline:null,cohort:c.cohort,function:c.function,window:clone(c.window),source:source(c.key,c.sourceType),coverage:{observed:1,expected:1,definition:'One complete reviewed record covering the stated metric and window'},qualification:{policyId:c.sourceType,reviewed:true,completeForDeclaredMetric:true,evidenceRefs:[`simulated-qualification:${key}:${c.key}`]},missingness:[],context:[],executionDeviations:execution.deviations,referenceFrame:'post-intervention'}));
 const set=(metric,value)=>{observations.find(o=>o.metric===metric).value=value;};
 if(['D'].includes(key))set('relevantParticipation',7);
 if(key==='C')set('relevantParticipation',16);
 if(['C','D'].includes(key))observations.find(o=>o.metric==='relevantParticipation').baseline={value:8,unit:'count',window:{start:'2026-07-01',end:'2026-07-28'},sourceRef:`simulated:${key}:comparable-cohort-baseline`,meaning:'New CP8 synthetic same-cohort reference; not a replacement for the original decline series'};
 if(key==='E')set('pilotBenefit',false);
 if(['F','G'].includes(key))set('protectedAccessMaintained',false);
 if(key==='O')observations.push({...clone(observations[0]),value:false,source:source('independent-function-test','reviewed-function-test')});
 if(['A','B','H','I'].includes(key))observations.push({...clone(observations[0]),metric:'usageRecovered',value:key==='B',unit:'boolean',source:source('usage-series','reviewed-comparable-series'),qualification:{policyId:'reviewed-comparable-series',reviewed:true,completeForDeclaredMetric:true,evidenceRefs:['simulated-usage-series-review']}});
 if(['M','N'].includes(key)){
  const prior=plan.originalInput.evidence.operations,healthy=key==='M';
  observations.push({...clone(observations[0]),metric:'originalOperationsRecord',value:'Reviewed original-period register',unit:'document',window:clone(plan.originalInput.originalReferenceWindow),referenceFrame:'original-investigation',referenceEvidenceSnapshotId:plan.originalInput.evidence.snapshotId,
   source:source('original-register','reviewed-original-register'),qualification:{policyId:'reviewed-original-register',reviewed:true,completeForDeclaredMetric:true,evidenceRefs:['simulated-archive-reconciliation']},
   originalSourceCorrection:{replacesSourceId:prior.sourceId,authoritative:true,authoritySourceId:`simulated:${key}:original-register`,reason:healthy?'Authoritative reconciliation corrects a misattributed fault/downtime record for this original amenity period.':'Authoritative archive supplies the complete original register previously only partially available.',evidenceRefs:['simulated-authoritative-correction-notice']},
   diagnosticRecord:{sourceId:`simulated:${key}:original-register`,availableAt:'2026-09-14',recordCoverage:1,issueRegisterReviewed:true,inspectionHealthy:healthy,downtimeHours:healthy?0:14,complaintCount:healthy?0:6,issues:healthy?[]:[{kind:'lighting',confirmed:true,resolved:false,description:'Confirmed unresolved in the original reference period, not current post-repair health.'}]}});
 }
 return{execution:key==='K'?null:execution,observations:key==='J'?[]:observations};
}
export function importOutcomeScenario(service,id,key){
 let s=service.get(id);const data=makeOutcomeRecords(s.plan,key);let execution=null;
 if(data.execution){execution=service.addExecution(id,{expectedRevision:s.revision,idempotencyKey:`${key}:execution`,record:data.execution});s=service.get(id);}
 for(let i=0;i<data.observations.length;i++){service.addObservation(id,{expectedRevision:s.revision,idempotencyKey:`${key}:observation:${i}`,record:{...data.observations[i],...(execution?{executionRecordId:execution.id}:{})}});s=service.get(id);}
 return service.evaluate(id,{expectedRevision:s.revision,idempotencyKey:`${key}:evaluate`,asOf:DEMO_TIME});
}
