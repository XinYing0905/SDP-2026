import { interventionCatalogue, INTERVENTION_CATALOGUE_VERSION } from './catalogue.mjs';
import { interventionDecisionPolicy } from '../config/intervention-decision.mjs';
import { evaluateCandidate } from './evidence-gates.mjs';
import { compareReversibleCandidates } from './reversibility.mjs';
export function proposeInterventionDecision(input){
 const candidates=interventionCatalogue.map(d=>evaluateCandidate(input,d)),comparison=compareReversibleCandidates(candidates,input);
 return {contractVersion:'intervention-decision.v1',catalogueVersion:INTERVENTION_CATALOGUE_VERSION,policyVersion:interventionDecisionPolicy.version,amenityId:input.amenityId,amenityName:input.amenityName,analysisSnapshotId:input.assessment.evidenceSnapshotId,
  explanationSufficiency:structuredClone(input.assessment.evidenceSufficiency.explanationSufficiency),protectionContextSufficiency:structuredClone(input.assessment.evidenceSufficiency.protectionContextSufficiency),diagnoses:structuredClone(input.assessment.diagnoses),
  candidates,comparison,state:input.stale||input.conflictingInput?'Stale / conflict review':input.requestedPermanentChange?'Blocked by safeguard':comparison.state,
  protectionHold:input.assessment.evidenceSufficiency.protectionContextSufficiency.state!=='Sufficient Evidence',
  existingNextEvidence:structuredClone(input.cp4??null),automaticEvidencePlanning:false,cp4Reranked:false,cp5Reselected:false,cp6Mutated:false,executionStarted:false,outcomeIngested:false,aiImplemented:false};
}
