import {POLICY,hash,check,before,cleanText} from './core.mjs';
// Outcome-free input: only the immutable saved decision-time plan enters here.
export function featuresFromPlan(plan){
 const i=plan.originalInput,s=plan.scope,e=i.evidence,at=plan.approvedAt;
 check(before(i.asOf,at)&&before(e.asOf,at),'FUTURE_DECISION_SNAPSHOT');
 const provenance=[];
 for(const k of ['temporal','operations','residentMix','usage','programme','feedback','dependency'])if(e[k]){check(before(e[k].availableAt,at),'FUTURE_FEATURE_SOURCE:'+k);provenance.push({field:k,sourceId:e[k].sourceId,availableAt:e[k].availableAt});}
 const d=e.dependency,contract=s.outcomeContract;
 const structured={amenityType:i.amenityType??i.amenityName,tier:i.changeResult.tier,pathway:plan.pathway,purpose:s.purpose,purposeId:s.purposeId,contractSemantics:contract.criteria,function:s.affectedFunction,extent:s.scopeBounds?.extent,protectedAccess:s.scopeBounds?.protectedAccess,retainsFunction:s.retainsExistingFunction,horizonDays:(Date.parse(contract.reviewWindow.end)-Date.parse(contract.reviewWindow.start))/86400000,decisionHorizon:e.decisionHorizon,
 protection:d?{needsDocumented:d.needsDocumented,disproportionateImpact:d.disproportionateImpact,alternativesReviewed:d.alternativesReviewed,accessibilityNeeds:d.accessibilityNeeds,alternatives:d.alternatives?.map(a=>({distanceKm:a.distanceKm,accessible:a.accessible,availableCapacity:a.availableCapacity}))}:null,
 cohort:s.reviewCohort??null,reversibility:s.reversibility?{disruption:s.reversibility.disruption,functionLoss:s.reversibility.functionLoss,rollback:s.reversibility.rollback}:null,
 change:{status:i.changeResult.status,signals:i.changeResult.metrics?.map(m=>({key:m.key,baseline:m.baselineValue,current:m.currentValue,percentageChange:m.percentageChange,sustained:m.persistence?.sustained,periods:m.persistence?.trailingPeriods,coverage:m.coverage?.current}))??[]},
 temporal:e.temporal?{periodDays:e.temporal.periodDays,observations:e.temporal.observations.map(o=>({periodStart:o.periodStart,usage:o.usage,exceptional:o.exceptional}))}:null,
 operational:e.operations?{inspectionHealthy:e.operations.inspectionHealthy,issueRegisterReviewed:e.operations.issueRegisterReviewed,downtimeHours:e.operations.downtimeHours}:null,
 programme:e.programme?{participationBefore:e.programme.participationBefore,participationAfter:e.programme.participationAfter}:null,
 residentMix:e.residentMix?{cohorts:e.residentMix.cohorts.map(c=>({residenceDuration:c.residenceDuration,retainedFraction:c.retainedFraction,observedPeriods:c.observedPeriods})),newResidents:e.residentMix.newResidents}:null,
 explanationSufficiency:i.assessment.evidenceSufficiency.explanationSufficiency.state,protectionSufficiency:i.assessment.evidenceSufficiency.protectionContextSufficiency.state};
 const f={version:POLICY.featureVersion,decisionAt:at,snapshotId:e.snapshotId,structured,text:cleanText(s.description),provenance:[...provenance,{field:'description',sourceId:plan.decisionId,availableAt:at,scopeDigest:plan.scopeDigest}],missing:Object.entries(structured).filter(([,v])=>v==null).map(([k])=>k)};
 return{...f,digest:hash(f)};
}
export const HARD_FIELDS=['amenityType','tier','pathway','purpose','purposeId','contractSemantics','function','extent','protectedAccess','retainsFunction','horizonDays','decisionHorizon','protection','cohort','reversibility'];
const schema={amenityType:1,tier:1,pathway:1,purpose:1,purposeId:1,contractSemantics:1,function:1,extent:1,protectedAccess:1,retainsFunction:1,horizonDays:1,decisionHorizon:1,protection:{needsDocumented:1,disproportionateImpact:1,alternativesReviewed:1,accessibilityNeeds:1,alternatives:[{distanceKm:1,accessible:1,availableCapacity:1}]},cohort:1,reversibility:{disruption:1,functionLoss:1,rollback:1},change:{status:1,signals:[{key:1,baseline:1,current:1,percentageChange:1,sustained:1,periods:1,coverage:1}]},temporal:{periodDays:1,observations:[{periodStart:1,usage:1,exceptional:1}]},operational:{inspectionHealthy:1,issueRegisterReviewed:1,downtimeHours:1},programme:{participationBefore:1,participationAfter:1},residentMix:{cohorts:[{residenceDuration:1,retainedFraction:1,observedPeriods:1}],newResidents:1},explanationSufficiency:1,protectionSufficiency:1};
function validateShape(value,shape){if(value==null)return;if(shape===1){check(typeof value!=='object','FORBIDDEN_NESTED_FEATURE');return;}if(Array.isArray(shape)){check(Array.isArray(value),'INVALID_FEATURE_ARRAY');for(const v of value)validateShape(v,shape[0]);return;}check(typeof value==='object'&&!Array.isArray(value),'INVALID_FEATURE_OBJECT');for(const[k,v]of Object.entries(value)){check(Object.hasOwn(shape,k),'FORBIDDEN_FEATURE:'+k);validateShape(v,shape[k]);}}
export function validateFeatures(f){
 check(f&&Object.keys(f).every(k=>['version','decisionAt','snapshotId','structured','text','provenance','missing','digest'].includes(k)),'FORBIDDEN_FEATURE');
 const{digest,...body}=f;check(hash(body)===digest,'FEATURE_DIGEST_MISMATCH');check(f.version===POLICY.featureVersion,'UNKNOWN_FEATURE_POLICY');validateShape(f.structured,schema);
 check(f.provenance.every(p=>before(p.availableAt,f.decisionAt)),'FUTURE_FEATURE_SOURCE');cleanText(f.text);return true;
}
const known=x=>x!==null&&x!==undefined&&x!==''&&!(typeof x==='number'&&!Number.isFinite(x))&&(typeof x!=='object'||Object.values(x).every(known));
export function compareFeatures(q,h){validateFeatures(q);validateFeatures(h);const reasons=[];for(const k of HARD_FIELDS){if(!known(q.structured[k])||!known(h.structured[k]))reasons.push('Unknown compatibility: '+k);else if(hash(q.structured[k])!==hash(h.structured[k]))reasons.push('Material comparison difference: '+k);}
 for(const k of ['temporal','operational','residentMix'])if(!known(q.structured[k])||!known(h.structured[k]))reasons.push('Critical evidence unavailable: '+k);
 if(['Reprogramme','Temporary Alternative-Use Pilot'].includes(q.structured.pathway)&&(!known(q.structured.programme)||!known(h.structured.programme)))reasons.push('Critical evidence unavailable: programme');
 const differences=['change','temporal','operational','programme','residentMix','explanationSufficiency','protectionSufficiency'].filter(k=>hash(q.structured[k])!==hash(h.structured[k]));
 return{comparable:!reasons.length,reasons,differences,matchedFields:HARD_FIELDS.filter(k=>!reasons.some(r=>r.endsWith(': '+k)))};
}
