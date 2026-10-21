import { guard,validTime,eligibleAt,digest } from '../shared/outcome-review-contract.mjs';
export function validateSource(record,at){
 guard([record.source?.id,record.source?.type,record.source?.responsible].every(x=>typeof x==='string'&&x.trim())&&Array.isArray(record.source.evidenceRefs)&&record.source.evidenceRefs.length&&record.source.evidenceRefs.every(x=>typeof x==='string'&&x.trim()),'PROVENANCE_REQUIRED',400);
 for(const k of ['availableAt','receivedAt'])guard(validTime(record[k]),`INVALID_${k}`,400);
 guard(Date.parse(record.receivedAt)<=Date.parse(at)&&Date.parse(record.availableAt)<=Date.parse(record.receivedAt),'INVALID_SOURCE_TIMELINE',400);
}
export function validateObservation(o,plan,at){
 validateSource(o,at);guard(o.decisionId===plan.decisionId&&o.approvedVersion===plan.approvedVersion&&o.interventionId===plan.interventionId&&o.contractDigest===plan.contractDigest,'OBSERVATION_PLAN_MISMATCH');
 guard(typeof o.metric==='string'&&typeof o.unit==='string'&&o.cohort&&o.function,'METRIC_SCOPE_REQUIRED',400);
 guard(validTime(o.window?.start)&&validTime(o.window?.end)&&Date.parse(o.window.end)>=Date.parse(o.window.start),'INVALID_OBSERVATION_WINDOW',400);
 guard(Date.parse(o.window.end)<=Date.parse(o.availableAt),'OBSERVATION_NOT_YET_OCCURRED',400);
 guard(o.value===null||typeof o.value==='boolean'||typeof o.value==='string'||(typeof o.value==='number'&&Number.isFinite(o.value)),'INVALID_OBSERVED_VALUE',400);
 guard(o.value!==null||typeof o.missingReason==='string','MISSINGNESS_REASON_REQUIRED',400);
 guard(['original-investigation','post-intervention'].includes(o.referenceFrame),'REFERENCE_FRAME_REQUIRED',400);
 guard(Array.isArray(o.context)&&Array.isArray(o.executionDeviations),'CONTEXT_REQUIRED',400);
 if(o.correction){guard(o.correction.replacesId&&o.correction.reason&&o.correction.authoritative===true&&o.correction.evidenceRefs?.length,'AUTHORITATIVE_CORRECTION_REQUIRED');}
 return o;
}
export function activeObservations(observations,asOf){
 const available=observations.filter(o=>eligibleAt(o,asOf));const superseded=new Set(available.filter(o=>o.correction).map(o=>o.correction.replacesId));return available.filter(o=>!superseded.has(o.id));
}
export function qualifiedFor(o,c,review){
 const q=o.qualification;
 const reasons=[];
 if(!eligibleAt(o,review.asOf))reasons.push('Not available at this review time');
 if(o.value===null)reasons.push(o.missingReason||'Unknown observation');
 if(o.unit!==c.unit||typeof o.value!==typeof c.target||(typeof o.value==='number'&&o.value<0))reasons.push('Metric unit/type is incompatible with the approved criterion');
 if(o.source.type!==c.sourceType||q?.reviewed!==true||q?.policyId!==c.sourceType||!q?.evidenceRefs?.length)reasons.push('Source-specific qualification not established');
 if(o.cohort!==c.cohort||o.function!==c.function)reasons.push('Cohort/function differs from the approved contract');
 if(o.window.start!==c.window.start||o.window.end!==c.window.end||Date.parse(review.asOf)<Date.parse(c.window.end+'T23:59:59.999Z'))reasons.push('Required review/recurrence window is incomplete or different');
 if(!o.coverage||!Number.isFinite(o.coverage.expected)||!Number.isFinite(o.coverage.observed)||o.coverage.expected<1||o.coverage.observed!==o.coverage.expected||q?.completeForDeclaredMetric!==true)reasons.push('Declared metric/source completeness not established');
 if(o.referenceFrame!=='post-intervention')reasons.push('Original-period record is not a post-intervention outcome');
 if(o.context.some(x=>x.material===true&&x.resolved!==true))reasons.push('Material comparability/context issue unresolved');
 return {qualified:reasons.length===0,reasons};
}
export function observationConflict(records){
 return new Set(records.map(o=>digest({value:o.value,baseline:o.baseline,window:o.window,cohort:o.cohort,function:o.function}))).size>1;
}
