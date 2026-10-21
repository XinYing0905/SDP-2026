import { digest,clone,eligibleAt } from '../shared/outcome-review-contract.mjs';
import { activeObservations } from './observation-admission.mjs';
// CP8 v1 intentionally admits only verified original-period operations records.
// No intervention response feature, dependency projection, or inferred feedback count.
const keys=['sourceId','availableAt','recordCoverage','issueRegisterReviewed','inspectionHealthy','downtimeHours','complaintCount','issues'];
export function planOutcomeConversion({plan,observations,asOf}){
 const active=activeObservations(observations,asOf),records=active.filter(o=>o.metric==='originalOperationsRecord');
 const result={state:'Bounded evidence only',mapping:null,sourceRefs:records.map(o=>o.id),inference:'No faithful existing CP3 input mapping admitted.',cannotEstablish:'No causal proof; post-treatment conditions cannot replace original-period evidence.',protectionBooleanProjection:false,reasons:[]};
 if(!records.length)return result;
 const target=plan.originalInput.evidence.operations;
 for(const o of records){
  const m=o.diagnosticRecord,q=o.qualification;
  if(!eligibleAt(o,asOf)||o.referenceFrame!=='original-investigation'||o.referenceEvidenceSnapshotId!==plan.originalInput.evidence.snapshotId||o.baseline?.frame==='post-intervention'||o.source.type!=='reviewed-original-register'||q?.policyId!=='reviewed-original-register'||q.reviewed!==true||q.completeForDeclaredMetric!==true||!q.evidenceRefs?.length||o.coverage?.expected<1||o.coverage?.observed!==o.coverage?.expected||!o.coverage||o.context.some(x=>x.material&&x.resolved!==true))result.reasons.push('Original reference period / source qualification is not established.');
  const withdrawn=m===null&&o.originalSourceCorrection?.withdrawn===true;
  if(!withdrawn&&(!m||Object.keys(m).some(k=>!keys.includes(k))||m.issueRegisterReviewed!==true||!Array.isArray(m.issues)||typeof m.inspectionHealthy!=='boolean'||!Number.isFinite(m.recordCoverage)||m.recordCoverage<0||m.recordCoverage>1||!Number.isFinite(m.downtimeHours)||m.downtimeHours<0||!Number.isFinite(m.complaintCount)||m.complaintCount<0||m.issues.some(i=>typeof i.confirmed!=='boolean'||typeof i.resolved!=='boolean')))result.reasons.push('Incomplete or forbidden existing operations fields.');
  const originalWindow=plan.originalInput.originalReferenceWindow;
  if(!originalWindow||digest(o.window)!==digest(originalWindow))result.reasons.push('Original investigation window differs or is not documented.');
  if(target){const c=o.originalSourceCorrection;if(!c||c.replacesSourceId!==target.sourceId||c.authoritative!==true||!c.reason||!c.evidenceRefs?.length||c.authoritySourceId!==o.source.id)result.reasons.push('Existing source can only be replaced by an explicit authoritative correction.');}
 }
 if(new Set(records.map(o=>digest(o.diagnosticRecord))).size>1){result.state='Stale / conflicting evidence';result.reasons.push('Independent original-period sources conflict.');return result;}
 if(result.reasons.length){result.state='Admission blocked';return result;}
 const o=records[0],projection=clone(o.diagnosticRecord);if(projection){projection.sourceId=o.id;projection.availableAt=asOf.slice(0,10);}
 return{...result,state:'Admissible — awaiting confirmation',mapping:{section:'operations',value:projection,referenceFrame:'original-investigation',supersedesSourceId:target?.sourceId??null},inference:'Verified original-period operational records may change support under existing CP3 rules.',fingerprint:digest({decisionId:plan.decisionId,record:records.map(o=>o.id),projection}),reasons:[]};
}
