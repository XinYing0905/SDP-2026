import { ChangeServiceError } from './change-contract.mjs';
import { questionCatalogue, missingResponseSemantics, validateScenarioBinding } from '../resident-evidence/question-catalogue.mjs';
import { canonicalContent } from '../resident-evidence/snapshot-binding.mjs';
export const RESIDENT_PLAN_CONTRACT_VERSION = 'resident-evidence-plan.v1';
export const residentPlanPath = id => `/api/v1/amenities/${encodeURIComponent(id)}/resident-evidence-plan`;
export const planStates = Object.freeze(['Draft pair selected', 'Not eligible', 'No valid pair', 'Pair tie', 'Stale input']);
export function assertResidentPlanEnvelope(value) {
  const r = value?.result;
  const fail = () => { throw new ChangeServiceError('INVALID_RESPONSE', 'Invalid resident evidence plan: preview-only contract and option traceability are required', 502); };
  if (value?.contractVersion !== RESIDENT_PLAN_CONTRACT_VERSION || !value.amenityId || !planStates.includes(r?.state) || !Array.isArray(r.pairs) || !Array.isArray(r.remainingGaps)) fail();
  for (const field of ['dispatchTriggered', 'responsesCollected', 'responseWrites', 'evidenceWrites', 'reassessmentTriggered', 'interventionSelected', 'aiImplemented']) if (r[field] !== false) fail();
  if (r.sufficiency && ('state' in r.sufficiency || !r.sufficiency.explanationSufficiency || !r.sufficiency.protectionContextSufficiency)) fail();
  if ('confidence' in r || canonicalContent(r.nonSubstantiveOutcomes) !== canonicalContent([...questionCatalogue.questions[0].nonSubstantive, missingResponseSemantics])) fail();
  if (r.state === 'Draft pair selected' && (!r.selectedPair?.eligible || !r.pairs.some(p => p.id === r.selectedPair.id) || r.tiedPairIds.length)) fail();
  if (r.selectedPair && canonicalContent(r.selectedPair) !== canonicalContent(r.pairs.find(p => p.id === r.selectedPair.id))) fail();
  if (r.state !== 'Draft pair selected' && r.selectedPair !== null) fail();
  if (r.state === 'Pair tie' && r.tiedPairIds.length < 2) fail();
  const validGaps = new Set(r.upstreamGaps.map(g => g.id));
  for (const pair of r.pairs) {
    const q = questionCatalogue.questions.find(q => q.id === pair.questionId && q.version === pair.questionVersion && q.sourceCandidateId === r.sourceWinnerId);
    if (!q || pair.targetGapId !== q.targetGapId || JSON.stringify(pair.options) !== JSON.stringify(q.options.map(o => ({ id: o.id, label: o.label }))) || pair.optionPlanningAssertions.length !== q.options.length) fail();
    if (!Number.isFinite(pair.score) || pair.score < 0 || !pair.options?.length || !Array.isArray(pair.optionPlanningAssertions)) fail();
    if (pair.eligible && (!validGaps.has(pair.targetGapId) || !pair.material || pair.score <= 0)) fail();
    for (const outcome of pair.optionPlanningAssertions) {
      const reviewed = q.options.find(o => o.id === outcome.optionId);
      if (!reviewed || reviewed.assertionId !== outcome.assertionId || reviewed.assertion !== outcome.assertion || JSON.stringify(reviewed.cannotEstablish) !== JSON.stringify(outcome.cannotEstablish) || JSON.stringify(reviewed.required) !== JSON.stringify(outcome.requiredAssumptionsAndCorroboration) || outcome.targetGapId !== pair.targetGapId || outcome.productionConversion !== false || outcome.collectedEvidence !== false || outcome.pathwayChanged !== false || outcome.fullyResolvedGapIds.length) fail();
    }
    const groups = pair.scenarioGroups.filter(g => g.id !== 'inconclusive');
    if (groups.length !== q.scenarioGroups.length || groups.some((g, i) => g.id !== q.scenarioGroups[i].id || JSON.stringify(g.optionIds) !== JSON.stringify(q.scenarioGroups[i].optionIds) || !validateScenarioBinding(q, g))) fail();
    if (pair.scenarioGroups.some(g => g.pathwayChangeUnits !== 0 || g.fullyResolvedGapIds.length)) fail();
    if (canonicalContent(pair.nonSubstantive) !== canonicalContent(q.nonSubstantive)) fail();
  }
  return value;
}
