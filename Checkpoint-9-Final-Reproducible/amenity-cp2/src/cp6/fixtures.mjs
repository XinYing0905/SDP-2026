import { diagnosisCases } from '../data/synthetic/diagnosis-cases.mjs';
import { nextEvidenceCases } from '../data/synthetic/next-evidence-cases.mjs';
import { detectChange } from '../statistics/change-detection/detector.mjs';
import { diagnoseCompeting } from '../diagnosis/competing-diagnosis.mjs';
import { identifyNextBestEvidence } from '../next-evidence/next-best-evidence.mjs';
import { selectQuestionCohort } from '../resident-evidence/pair-selection.mjs';
import { makeCohortSnapshot, bindPlanInput } from '../data/synthetic/resident-evidence-plan-cases.mjs';

export function makeCp6Fixture(kind = 'resolving') {
  const original = diagnosisCases.find(x => x.canonicalCase === 'C');
  const amenity = structuredClone(original.amenity), evidence = structuredClone(original.evidence);
  const id = `CP6-${kind}`;
  amenity.id = id; evidence.snapshotId = `${id}:before`; evidence.feedback = null;
  if (kind === 'insufficient') evidence.residentMix = null;
  if (kind === 'protection' || kind === 'impact' || kind === 'protection-incomplete') {
    evidence.feedback = structuredClone(original.evidence.feedback);
    if(kind!=='impact') evidence.dependency.needsDocumented = null;
    else evidence.dependency.disproportionateImpact = null;
    if(kind==='protection-incomplete')Object.assign(evidence.dependency,{activeUsers:null,repeatUsers:null,stablePeriods:null,alternativesReviewed:false,alternatives:null});
  }
  const changeResult = detectChange(amenity);
  const before = diagnoseCompeting({ changeResult, evidence });
  const decisionContext = structuredClone(nextEvidenceCases.find(x => x.case === 'C').decisionContext);
  if(kind==='insufficient') {
    decisionContext.availability.cohorts=false;
    decisionContext.availableCohortRecords=null;
    decisionContext.cohortRecordSource=null;
  }
  if(kind==='protection-incomplete') {
    decisionContext.availability.dependencyRecords=false;decisionContext.availability.substitutes=false;
    decisionContext.dependencyUsageRecord=null;decisionContext.dependencyUsageSource=null;
  }
  const next = identifyNextBestEvidence({ changeResult, evidence, decisionContext });
  const cohortSnapshot = makeCohortSnapshot(id, evidence.snapshotId);
  // Protection fixtures expose one direct unresolved question gap; no pair tie is overridden.
  const input = bindPlanInput({ amenityId: id, amenityName: 'Community Hall', currentFunction: 'Community Hall in its current function', analysisAsOf: evidence.asOf,
    diagnosisEnvelope: { contractVersion: 'competing-diagnosis.v2', amenityId: id, result: before },
    nextEvidenceEnvelope: { contractVersion: 'next-best-evidence.v1', amenityId: id, result: next }, cohortSnapshot });
  const plan = selectQuestionCohort(input);
  return { id, name: kind === 'insufficient' ? 'Community Hall · missing historical resident-mix evidence' : 'Community Hall', kind, evidence, changeResult, before, planInput: input, plan,
    intendedRoster: Array.from({ length: 10 }, (_,i) => ({ recipientRef: `resident-${i+1}`, cohortId: plan.selectedPair?.cohortId, cohortVersion: '1', eligible: true, programmeFamiliarity: true })) };
}
