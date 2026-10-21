import { diagnoseCompeting } from '../diagnosis/competing-diagnosis.mjs';
import { clone,digest } from '../shared/outcome-review-contract.mjs';
export function reassessOutcomeEvidence(plan,conversion,at,id){
 const evidence=clone(plan.originalInput.evidence);evidence.snapshotId=id;evidence.asOf=at.slice(0,10);
 evidence[conversion.mapping.section]=clone(conversion.mapping.value);
 const result=diagnoseCompeting({changeResult:clone(plan.originalInput.changeResult),evidence});
 const prior=plan.originalInput.assessment,target=prior.evidenceSufficiency.explanationSufficiency.primaryExplanation??'Operational Problem',before=prior.diagnoses.find(d=>d.name===target),after=result.diagnoses?.find(d=>d.name===target),reopened=prior.evidenceSufficiency.explanationSufficiency.state==='Sufficient Evidence'&&result.evidenceSufficiency?.explanationSufficiency.state==='Insufficient Evidence';
 return{snapshot:{id,parentSnapshotId:plan.originalInput.evidence.snapshotId,evidence,conversionFingerprint:conversion.fingerprint,createdAt:at,availableAt:at,inputDigest:digest(evidence)},assessment:result,engine:'Unchanged CP3',originalAssessment:clone(prior),diagnosisFinding:{target,state:reopened?'Reopened / Insufficient Evidence':after?.rawEvidenceSupport>before?.rawEvidenceSupport?'Strengthened':after?.rawEvidenceSupport<before?.rawEvidenceSupport?'Weakened':'No diagnostic change',before:before?.rawEvidenceSupport,after:after?.rawEvidenceSupport,causalClaim:false}};
}
