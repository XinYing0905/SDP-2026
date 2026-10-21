import { questionCatalogue, missingResponseSemantics, validateScenarioBinding } from './question-catalogue.mjs';
import { checkCohortEligibility, validSource } from './cohort-eligibility.mjs';
import { makePlanBinding, canonicalContent } from './snapshot-binding.mjs';
import { nextEvidenceParameters } from '../config/next-best-evidence.mjs';

// Collection-plan comparison only. No response -> feature adapter, evidence writes or diagnosis calls.
export function selectQuestionCohort({ amenityId, amenityName, currentFunction, analysisAsOf, diagnosisEnvelope, nextEvidenceEnvelope, cohortSnapshot, expectedBinding }) {
  const cp4 = nextEvidenceEnvelope.result, diagnosis = diagnosisEnvelope.result;
  const base = {
    amenityId, amenityName, currentFunction, catalogueVersion: questionCatalogue.version,
    dataProvenance: 'Synthetic cohort inputs; option assertions are hypothetical planning semantics only',
    upstreamSourcePriority: [...cp4.nextBestCandidateIds],
    sourceWinnerId: cp4.nextBestCandidateIds.length === 1 ? cp4.nextBestCandidateIds[0] : null,
    evidenceSnapshotId: cp4.evidenceSnapshotId ?? null,
    sufficiency: cp4.sufficiency ? structuredClone(cp4.sufficiency) : null,
    upstreamGaps: structuredClone(cp4.gaps), remainingGaps: structuredClone(cp4.gaps),
    dispatchTriggered: false, responsesCollected: false, responseWrites: false, evidenceWrites: false,
    reassessmentTriggered: false, interventionSelected: false, aiImplemented: false,
    pairs: [], selectedPair: null, tiedPairIds: [], cohorts: [],
    nonSubstantiveOutcomes: structuredClone([...questionCatalogue.questions[0].nonSubstantive, missingResponseSemantics]),
    method: 'Approved CP4 scenario-value parameters within its fixed resident source; bounded gap-reduction credit only, no response probabilities',
    comparisonParameters: { gapReductionWeight: nextEvidenceParameters.gapReductionWeight, pathwayChangeWeight: nextEvidenceParameters.pathwayChangeWeight, burdenPenalty: nextEvidenceParameters.burdenPenalty, tieTolerance: nextEvidenceParameters.tieTolerance },
    caveat: 'Draft plan / previews only. No actual gap closes, response is stored, evidence is converted or sufficiency state changes.'
  };
  const result = (state, reasons, extra = {}) => ({ ...base, state, reasons, ...extra });
  if (nextEvidenceEnvelope.amenityId !== amenityId || diagnosisEnvelope.amenityId !== amenityId) return result('Stale input', ['Case identities do not match.']);
  if (cp4.executionState !== 'Assessed' || diagnosis.executionState !== 'Assessed') return result('Not eligible', ['Upstream diagnosis/evidence planning is not assessed.']);
  const sameSufficiency = canonicalContent(cp4.sufficiency) === canonicalContent({ explanationSufficiency: diagnosis.evidenceSufficiency.explanationSufficiency, protectionContextSufficiency: diagnosis.evidenceSufficiency.protectionContextSufficiency });
  if (!sameSufficiency || cp4.evidenceSnapshotId !== diagnosis.evidenceSnapshotId) return result('Stale input', ['Diagnosis and CP4 snapshot/sufficiency references are inconsistent.']);
  const currentBinding = makePlanBinding({ diagnosisEnvelope, nextEvidenceEnvelope, cohortSnapshot, catalogueVersion: questionCatalogue.version, analysisAsOf, currentFunction });
  if (!expectedBinding || expectedBinding !== currentBinding) return result('Stale input', ['The prepared plan references different evidence, parameters, catalogue or cohort content. Reprepare against a consistent snapshot.']);
  const winner = cp4.candidates.find(c => c.id === base.sourceWinnerId);
  if (!cp4.residentInputEligibleForLaterSelection || !['residents', 'dependencyResidents'].includes(base.sourceWinnerId) || !winner?.eligible || !winner.material || winner.score <= 0) return result('Not eligible', ['CP4 did not uniquely select an eligible resident evidence source. No reranking or fallback is permitted.']);
  const asOf = cohortSnapshot?.asOf;
  if (!asOf || !cohortSnapshot.version || !currentFunction || !validSource(cohortSnapshot.source, asOf) || !Array.isArray(cohortSnapshot.cohorts) || !cohortSnapshot.cohorts.length) return result('No valid pair', ['A dated, versioned cohort snapshot or current function is unavailable. Preserve the CP4 winner and review feasibility.']);
  // A snapshot's date must match the upstream analysis context explicitly bound by the repository.
  if (cohortSnapshot.evidenceSnapshotId !== cp4.evidenceSnapshotId || cohortSnapshot.amenityId !== amenityId || asOf !== analysisAsOf) return result('Stale input', ['Cohort snapshot belongs to another amenity/evidence version or analysis date.']);
  if (new Set(cohortSnapshot.cohorts.map(c => c.id)).size !== cohortSnapshot.cohorts.length) return result('No valid pair', ['Cohort identifiers are duplicated; pair membership is ambiguous.']);
  const questions = questionCatalogue.questions.filter(q => q.sourceCandidateId === winner.id);
  const pairs = [];
  const cohorts = cohortSnapshot.cohorts.map(c => ({ id: c.id, version: c.version, membershipDefinition: c.membershipDefinition, residenceDuration: c.residenceDuration, knownRelevantMembers: c.knownRelevantMembers ?? null, exposure: { documentedCurrentUse: c.documentedCurrentUse ?? null, programmeFamiliarity: c.programmeFamiliarity ?? null }, evaluations: [] }));
  for (const q of questions) for (const c of cohortSnapshot.cohorts) {
    const eligibility = checkCohortEligibility(q, c, { asOf, decisionHorizon: cp4.sufficiency.explanationSufficiency.decisionHorizon });
    const target = winner.targetGaps.find(g => g.id === q.targetGapId && cp4.gaps.some(x => x.id === g.id));
    const reasons = [...eligibility.reasons];
    if (!target) reasons.push('This question has no direct unresolved gap in the approved CP4 resident candidate.');
    cohorts.find(x => x.id === c.id).evaluations.push({ questionId: q.id, ...eligibility });
    const outcomes = q.options.map(o => ({
      questionId: q.id, questionVersion: q.version, optionId: o.id, optionLabel: o.label,
      assertionId: o.assertionId, assertion: o.assertion,
      requiredAssumptionsAndCorroboration: structuredClone(o.required), targetGapId: q.targetGapId,
      cannotEstablish: structuredClone(o.cannotEstablish),
      hypothetical: true, collectedEvidence: false, productionConversion: false,
      potentialGapReductionIds: eligibility.eligible && target ? [target.id] : [],
      gapEffect: eligibility.eligible && target ? 'Potential bounded reduction in the named uncertainty; not full closure' : 'Not demonstrated under these prerequisites',
      fullyResolvedGapIds: [], pathwayChanged: false,
      corroborationLimits: q.id === 'Q-PROTECTED-IMPACT' && !validSource(c.comparativeImpactSource, asOf) ? ['Comparative impact evidence is missing; disproportionate group impact cannot be established.'] : ['Any later feature/sufficiency conclusion still requires its complete corroboration and coverage.']
    }));
    const groups = q.scenarioGroups.map(group => {
      const assertions = outcomes.filter(o => group.optionIds.includes(o.optionId));
      const binding = { optionIds: [...group.optionIds], assertionIds: assertions.map(o => o.assertionId), targetGapId: q.targetGapId };
      const traceable = validateScenarioBinding(q, binding);
      // Each option keeps its own bounded assertion. Grouping never asserts a stronger common fact.
      const credit = traceable && assertions.length === group.optionIds.length && assertions.every(o => o.potentialGapReductionIds.length > 0) ? 1 : 0;
      return { id: group.id, ...binding, traceable, potentialBoundedReductionUnits: credit, pathwayChangeUnits: 0, fullyResolvedGapIds: [], caveat: 'One unit means potential bounded information contribution, not a closed gap, probability or observed answer.' };
    });
    groups.push({ id: 'inconclusive', optionIds: [], assertionIds: [], targetGapId: q.targetGapId, traceable: true, potentialBoundedReductionUnits: 0, pathwayChangeUnits: 0, fullyResolvedGapIds: [], outcomeIds: ['UNABLE_TO_ASSESS', 'VOLUNTARY_SKIP', 'NO_RESPONSE'] });
    const meanReduction = groups.reduce((sum, g) => sum + g.potentialBoundedReductionUnits, 0) / groups.length;
    const material = meanReduction > 0;
    if (!material) reasons.push('Option-traceable scenarios demonstrate no material reduction for this pair.');
    const eligible = !reasons.length && material;
    const burden = nextEvidenceParameters.burden[winner.id];
    const score = eligible ? nextEvidenceParameters.gapReductionWeight * meanReduction / (1 + nextEvidenceParameters.burdenPenalty * burden) : 0;
    const wording = q.wording.replaceAll("[amenity's current function]", currentFunction ?? 'the recorded current function').replaceAll('[amenity]', amenityName ?? amenityId);
    pairs.push({ id: `${q.id}:${c.id}`, questionId: q.id, questionVersion: q.version, cohortId: c.id, cohortVersion: c.version, dimension: q.dimension,
      targetGapId: q.targetGapId, secondaryGapIds: q.secondaryGapIds.filter(id => winner.targetGaps.some(g => g.id === id)),
      eligible, reasons, material, score, scoreComponents: { meanPotentialBoundedGapReductions: meanReduction, pathwayChangeCredit: 0, burden },
      wording, options: structuredClone(q.options.map(o => ({ id: o.id, label: o.label }))), nonSubstantive: structuredClone(q.nonSubstantive),
      cohort: { id: c.id, membershipDefinition: c.membershipDefinition, residenceDuration: c.residenceDuration, tenureRole: eligibility.tenureRole, knownRelevantMembers: c.knownRelevantMembers ?? null, referencePeriod: structuredClone(c.referencePeriod), scope: eligibility.scope, coverageCaveat: eligibility.coverageCaveat },
      optionPlanningAssertions: outcomes, scenarioGroups: groups,
      rationale: eligible ? `This question can elicit bounded evidence for ${target.id} from documented relevant users; other gaps and all current sufficiency states remain unchanged.` : reasons.join(' '),
      protectionLabel: 'Current users / recorded relevant cohort; dependency is not assumed',
      comparisonCaveat: 'No pathway-change credit is awarded without a supported gate trace. This implementation conservatively awards bounded gap-reduction credit only.' });
  }
  const eligible = pairs.filter(p => p.eligible).sort((a, b) => b.score - a.score);
  const tied = eligible.length ? eligible.filter(p => eligible[0].score - p.score <= nextEvidenceParameters.tieTolerance) : [];
  const shared = { pairs, cohorts, sourceBinding: { catalogueVersion: questionCatalogue.version, cohortSnapshotVersion: cohortSnapshot.version, cohortSourceId: cohortSnapshot.source.sourceId, asOf }, unrepresentedGroups: cohortSnapshot.unrepresentedGroups ?? [] };
  if (!tied.length) return result('No valid pair', ['No feasible, option-traceable question/cohort pair demonstrates value within the fixed CP4 source. Review feasibility without fallback.'], shared);
  if (tied.length > 1) return result('Pair tie', ['Multiple question/cohort pairs have equal modeled value. No alphabetical, ownership, tenure or population-size tiebreaker is applied.'], { ...shared, tiedPairIds: tied.map(p => p.id) });
  return result('Draft pair selected', ['One eligible pair has the highest demonstrated value within the CP4 resident source. It is a preview, not a collection instruction.'], { ...shared, selectedPair: tied[0] });
}
