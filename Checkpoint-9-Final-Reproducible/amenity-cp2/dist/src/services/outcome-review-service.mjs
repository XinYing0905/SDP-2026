import { randomUUID } from 'node:crypto';
import { guard,fields,digest,clone,validTime,OUTCOME_VERSION,RULE_VERSION } from '../shared/outcome-review-contract.mjs';
import { bindOutcomeContract } from '../outcome/contract-binding.mjs';
import { validateSource,validateObservation } from '../outcome/observation-admission.mjs';
import { evaluateOutcome } from '../outcome/evaluate-contract.mjs';
import { planOutcomeConversion } from '../outcome/outcome-evidence-conversion.mjs';
import { reassessOutcomeEvidence } from '../outcome/reassessment-orchestrator.mjs';
export function createOutcomeReviewService({repository,planProvider,clock=()=>new Date().toISOString(),reassess=reassessOutcomeEvidence}){
 const current=s=>{const p=planProvider.get(s.plan.planId);guard(p.approvalPayloadDigest===s.plan.approvalPayloadDigest&&p.contractDigest===s.plan.contractDigest&&p.scopeDigest===s.plan.scopeDigest,'STALE_APPROVAL_INPUT');return p;};
 function mutate(id,b,kind,allowed,fn){
  fields(b,['expectedRevision','idempotencyKey',...allowed]);guard(Number.isInteger(b.expectedRevision)&&typeof b.idempotencyKey==='string'&&b.idempotencyKey.length>0&&b.idempotencyKey.length<256,'VERSION_AND_IDEMPOTENCY_REQUIRED',400);
  return repository.transact(id,null,s=>{
   const fp=digest({kind,...Object.fromEntries(Object.entries(b).filter(([k])=>k!=='expectedRevision'))}),prior=s.receipts[b.idempotencyKey];
   if(prior){guard(prior.fingerprint===fp,'IDEMPOTENCY_PAYLOAD_CONFLICT');return{noWrite:true,value:clone(prior.value)};}
   guard(s.revision===b.expectedRevision,'VERSION_CONFLICT');current(s);const at=clock(),value=fn(s,at);s.receipts[b.idempotencyKey]={fingerprint:fp,value:clone(value)};
   return{events:[{kind,at,actor:b.operatorId??b.record?.source?.responsible??'Simulated source',payloadDigest:fp,value:clone(value)}],value};
  });
 }
 const view=s=>{let currentValidity=s.binding.ruleVersion===RULE_VERSION?'Current':'Stale rule / review required';try{current(s);}catch{currentValidity='Stale approval / review required';}return{...clone(s),currentValidity,newerInputsAvailable:!!s.reviews.length&&s.reviews.at(-1).inputDigest!==digest({executions:s.executions,observations:s.observations,binding:s.binding}),executionImplemented:false,aiImplemented:false};};
 return Object.freeze({
  plans:()=>planProvider.list(),list:()=>repository.list().map(view),get:id=>view(repository.get(id)),history:id=>({events:repository.events(id),revisions:repository.history(id)}),
  open(b){fields(b,['planId','operatorId']);guard(b.operatorId?.trim(),'OPERATOR_REQUIRED',400);const plan=planProvider.get(b.planId),at=clock();
   const existing=repository.list().find(s=>s.plan.decisionId===plan.decisionId);if(existing)return view(existing);
   const state={id:randomUUID(),revision:0,contractVersion:OUTCOME_VERSION,createdAt:at,plan:clone(plan),binding:bindOutcomeContract(plan,at),executions:[],observations:[],reviews:[],conversions:[],snapshots:[],reassessments:[],receipts:{}};
   repository.create(state,{kind:'OUTCOME_REVIEW_OPENED',at,operatorId:b.operatorId,contractDigest:plan.contractDigest,bindingDigest:state.binding.digest});return view(state);
  },
  addExecution(id,b){return mutate(id,b,'EXTERNAL_EXECUTION_EVIDENCE_RECORDED',['record'],(s,at)=>{
   const x=clone(b.record);fields(x,['decisionId','approvedVersion','interventionId','contractDigest','scopeDigest','actualStart','actualEnd','executedScope','reportedState','deviations','source','verification','availableAt','receivedAt','correction']);validateSource(x,at);
   guard(x.decisionId===s.plan.decisionId&&x.approvedVersion===s.plan.approvedVersion&&x.interventionId===s.plan.interventionId&&x.contractDigest===s.plan.contractDigest,'EXECUTION_PLAN_MISMATCH');
   guard(['Completed','Partial','In progress','Not executed','Unable to establish'].includes(x.reportedState)&&Array.isArray(x.deviations),'INVALID_EXECUTION_STATE',400);
   if(!['Not executed','Unable to establish'].includes(x.reportedState)){guard(validTime(x.actualStart)&&Date.parse(x.actualStart)<=Date.parse(x.availableAt),'INVALID_EXECUTION_START',400);if(x.actualEnd)guard(validTime(x.actualEnd)&&Date.parse(x.actualEnd)>=Date.parse(x.actualStart)&&Date.parse(x.actualEnd)<=Date.parse(x.availableAt),'INVALID_EXECUTION_END',400);}
   if(x.reportedState==='Completed')guard(x.actualEnd,'COMPLETION_END_REQUIRED',400);
   if(x.correction){const prior=s.executions.find(r=>r.id===x.correction.replacesId);guard(prior&&prior.source.id===x.source.id&&x.correction.authoritative===true&&x.correction.reason&&x.correction.evidenceRefs?.length&&!s.executions.some(r=>r.correction?.replacesId===prior.id),'AUTHORITATIVE_EXECUTION_CORRECTION_REQUIRED');}
   const duplicate=s.executions.find(({id,version,recordedAt,...stored})=>digest(stored)===digest(x));if(duplicate)return clone(duplicate);
   const record={...x,id:randomUUID(),version:x.correction?s.executions.find(r=>r.id===x.correction.replacesId).version+1:1,recordedAt:at};s.executions.push(record);return record;
  });},
  addObservation(id,b){return mutate(id,b,'OUTCOME_OBSERVATION_RECORDED',['record'],(s,at)=>{
   const o=clone(b.record);fields(o,['decisionId','approvedVersion','interventionId','contractDigest','metric','value','unit','baseline','cohort','function','window','source','availableAt','receivedAt','coverage','qualification','missingReason','missingness','context','executionDeviations','executionRecordId','referenceFrame','referenceEvidenceSnapshotId','diagnosticRecord','originalSourceCorrection','correction']);validateObservation(o,s.plan,at);
   if(o.executionRecordId)guard(s.executions.some(x=>x.id===o.executionRecordId),'UNKNOWN_EXECUTION_RECORD');
   if(o.correction){const prior=s.observations.find(x=>x.id===o.correction.replacesId);guard(prior&&prior.source.id===o.source.id&&prior.metric===o.metric&&!s.observations.some(r=>r.correction?.replacesId===prior.id),'CORRECTION_SOURCE_OR_CHAIN_MISMATCH');}
   const duplicate=s.observations.find(({id,version,recordedAt,...stored})=>digest(stored)===digest(o));if(duplicate)return clone(duplicate);
   const record={...o,id:randomUUID(),version:o.correction?s.observations.find(r=>r.id===o.correction.replacesId).version+1:1,recordedAt:at};s.observations.push(record);return record;
  });},
  evaluate(id,b){return mutate(id,b,'OUTCOME_REVIEW_EVALUATED',['asOf'],(s,at)=>{
   guard(validTime(b.asOf)&&Date.parse(b.asOf)<=Date.parse(at),'INVALID_REVIEW_AS_OF',400);guard(s.binding.ruleVersion===RULE_VERSION,'STALE_RULE_BINDING');
   guard(digest(s.binding)===digest(bindOutcomeContract(s.plan,s.binding.frozenAt)),'CONTRACT_BINDING_TAMPERED');
   const plan=current(s),inputDigest=digest({executions:s.executions,observations:s.observations,binding:s.binding});
   const findings=evaluateOutcome({plan,binding:s.binding,executions:s.executions,observations:s.observations,asOf:b.asOf});
   const conversion=planOutcomeConversion({plan,observations:s.observations,asOf:b.asOf});
   // A standalone original-period documentary validation does not rely on an intervention-response inference.
   if(conversion.mapping)findings.diagnosisFinding={state:'Direct original-period evidence admitted for review',inference:conversion.inference,cannotEstablish:conversion.cannotEstablish,sourceRefs:conversion.sourceRefs};
   const review={id:randomUUID(),version:s.reviews.length+1,createdAt:at,asOf:b.asOf,ruleVersion:RULE_VERSION,inputDigest,bindingDigest:s.binding.digest,manifest:{executionIds:s.executions.map(x=>x.id),observationIds:s.observations.map(x=>x.id)},...findings};s.reviews.push(review);
   const disputed=s.conversions.find(x=>x.fingerprint&&x.fingerprint===conversion.fingerprint&&x.state==='Disputed mapping / review required');
   const c={...conversion,...(disputed?{state:'Disputed mapping / review required',disputeRef:disputed.id}:{}),id:randomUUID(),version:1,reviewId:review.id,reviewInputDigest:inputDigest,createdAt:at,ruleVersion:RULE_VERSION,confirmationHistory:[],committed:false};s.conversions.push(c);
   return{review,conversion:c};
  });},
  confirm(id,b){return mutate(id,b,'OUTCOME_MAPPING_REVIEWED',['conversionId','operatorId','choice','reason'],(s,at)=>{
   guard(typeof b.operatorId==='string'&&b.operatorId.trim(),'OPERATOR_REQUIRED',400);guard(['confirm','dispute'].includes(b.choice),'INVALID_CONFIRMATION_CHOICE',400);
   const c=s.conversions.find(x=>x.id===b.conversionId);guard(c,'CONVERSION_NOT_FOUND',404);guard(!c.committed,'CONVERSION_ALREADY_COMMITTED');
   guard(c.ruleVersion===RULE_VERSION&&c.reviewInputDigest===digest({executions:s.executions,observations:s.observations,binding:s.binding}),'STALE_CONVERSION_INPUT');
   guard(c.state==='Admissible — awaiting confirmation','MAPPING_NOT_ADMISSIBLE');
   if(b.choice==='dispute'){guard(b.reason?.trim(),'DISPUTE_REASON_REQUIRED',400);c.confirmationHistory.push({at,operatorId:b.operatorId,choice:'dispute',reason:b.reason});c.state='Disputed mapping / review required';return clone(c);}
   const again=planOutcomeConversion({plan:current(s),observations:s.observations,asOf:at});guard(again.fingerprint===c.fingerprint&&again.state==='Admissible — awaiting confirmation','MAPPING_NO_LONGER_ADMISSIBLE');
   guard(!s.conversions.some(x=>x.committed&&x.fingerprint===c.fingerprint),'EVIDENCE_ALREADY_APPLIED');
   const updated=reassess(s.plan,c,at,randomUUID());
   c.confirmationHistory.push({at,operatorId:b.operatorId,choice:'confirm',meaning:'Acknowledgement and mapping-correctness review; no favourable-outcome choice'});c.committed=true;c.state='Committed';c.snapshotId=updated.snapshot.id;
   s.snapshots.push(updated.snapshot);s.reassessments.push({...updated,id:randomUUID(),conversionId:c.id,createdAt:at});
   return{conversion:clone(c),...updated};
  });}
 });
}
