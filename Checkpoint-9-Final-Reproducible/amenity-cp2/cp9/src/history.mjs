import {DatabaseSync} from 'node:sqlite';
import {createApprovedPlanProvider} from '../../src/data/providers/approved-plan-provider.mjs';
import {featuresFromPlan,validateFeatures} from './features.mjs';
import {copy,hash,check,CLASS,before} from './core.mjs';
export function readHistoricalCases(cp7file,cp8file,metadata){
 const plans=createApprovedPlanProvider(cp7file),db=new DatabaseSync(cp8file,{readOnly:true});
 try{return db.prepare('SELECT body FROM collections').all().flatMap(row=>{
  const s=JSON.parse(row.body),p=plans.get(s.plan.planId),m=metadata[p.planId];check(m,'SOURCE_METADATA_REQUIRED');check(p.approvalPayloadDigest===s.plan.approvalPayloadDigest,'APPROVAL_SOURCE_CHANGED');
  return s.reviews.map((r,n)=>{const body={id:m.episodeId+':review-'+r.version,episodeId:m.episodeId,amenityId:p.originalInput.amenityId,family:m.family,version:r.version,supersedes:n?s.reviews[n-1].id:null,sourceReviewId:r.id,simulated:p.originalInput.isSynthetic===true,disclosure:p.originalInput.isSynthetic?'Simulated historical case':'Historical case',label:m.label,features:featuresFromPlan(p),
   decisionAssessment:{evidenceSnapshotId:p.originalInput.evidence.snapshotId,diagnoses:copy(p.originalInput.assessment.diagnoses),explanationSufficiency:copy(p.originalInput.assessment.evidenceSufficiency.explanationSufficiency),protectionContextSufficiency:copy(p.originalInput.assessment.evidenceSufficiency.protectionContextSufficiency)},
   source:{planId:p.planId,decisionId:p.decisionId,approvalVersion:p.approvedVersion,approvalDigest:p.approvalPayloadDigest,evidenceSnapshotDigest:hash(p.originalInput.evidence),interventionId:p.interventionId,scopeVersion:p.scope.version,contractVersion:p.scope.outcomeContract.version,contractDigest:p.contractDigest,bindingDigest:s.binding.digest,reviewId:r.id,reviewVersion:r.version,reviewDigest:hash(r),observationIds:r.manifest.observationIds,executionIds:r.manifest.executionIds},
   availableAt:r.createdAt,observationWindow:p.scope.outcomeContract.reviewWindow,outcome:{execution:copy(r.executionFinding),goal:copy(r.goalFinding),protection:copy(r.protectionFinding),diagnosis:copy(r.diagnosisFinding),mappingStatus:s.conversions.find(c=>c.reviewId===r.id)?.state??'Unavailable',evidenceGeneration:r.goalFinding.evidencePurpose??null,causalClaim:false},
   observations:s.observations.filter(o=>r.manifest.observationIds.includes(o.id)).map(o=>({id:o.id,version:o.version,metric:o.metric,value:o.value,unit:o.unit,window:o.window,coverage:o.coverage,qualification:o.qualification,missingness:o.missingness,context:o.context,sourceRef:o.source.id,availableAt:o.availableAt,recordedAt:o.recordedAt,correction:o.correction??null})),executionRecordRefs:r.manifest.executionIds};return{...body,digest:hash(body)};});
 });}finally{plans.close();db.close();}
}
export function admit(c,asOf){
 const reasons=[];try{const{digest,...b}=c;check(digest===hash(b),'HISTORY_DIGEST_MISMATCH');validateFeatures(c.features);check(c.source?.approvalDigest&&c.source?.bindingDigest&&c.source?.reviewDigest&&c.source?.decisionId&&c.episodeId&&c.amenityId,'MISSING_PROVENANCE');}catch(e){return{class:CLASS.rejected,reasons:[e.message]};}
 if(!before(c.availableAt,asOf))reasons.push('Outcome unavailable at requested as-of time');
 if(c.outcome.execution.state!=='Established as specified')reasons.push('Execution not established as approved');
 if(!['Met','Not met','Mixed'].includes(c.outcome.goal.state))reasons.push('Goal outcome insufficient or conflicting');
 if(!['Maintained','Protection breach'].includes(c.outcome.protection.state))reasons.push('Protection outcome insufficient or conflicting');
 if(c.outcome.protection.conflicts?.length||/conflict/i.test(c.outcome.goal.state))reasons.push('Unresolved outcome source conflict');
 return{class:reasons.length?CLASS.limited:CLASS.evaluable,reasons};
}
export function makeRelease(cases,{id='corpus-1',asOf,createdAt=asOf}={}){
 check(before(asOf,createdAt),'INVALID_RELEASE_TIME');const rows=cases.map(c=>({case:copy(c),admission:admit(c,asOf)})),by=new Map();
 for(const r of rows){if(r.admission.class===CLASS.rejected||!before(r.case.availableAt,asOf))continue;const old=by.get(r.case.episodeId);if(old&&old.case.version===r.case.version&&old.case.digest!==r.case.digest)throw Error('CONFLICTING_EPISODE_VERSION');if(!old||r.case.version>old.case.version)by.set(r.case.episodeId,r);}
 const seen=new Set();for(const r of rows){r.active=by.get(r.case.episodeId)===r&&!seen.has(r.case.episodeId);if(r.active)seen.add(r.case.episodeId);r.countingUnit=r.case.episodeId;if(!r.active)r.exclusion='Duplicate, superseded, rejected or unavailable version';}
 const body={id,asOf,createdAt,rows};return{...body,digest:hash(body)};
}
