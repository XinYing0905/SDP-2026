import { nextEvidenceParameters } from '../config/next-best-evidence.mjs';
import { diagnosisParameters } from '../config/diagnosis.mjs';
import { diagnoseCompeting } from '../diagnosis/competing-diagnosis.mjs';
import { prepareEvidence } from '../diagnosis/evidence-utils.mjs';
import { identifyDecisionGaps, gapResolved, decisionSignature } from './gaps.mjs';
import { designCandidates } from './candidate-scenarios.mjs';

const signatureChanged = (before, after, targets) => {
  const b = decisionSignature(before), a = decisionSignature(after);
  const explanation = targets.some(g => g.dimension === 'Explanation') && JSON.stringify([b.explanationSufficiency, b.primaryExplanation, b.plausibleExplanations]) !== JSON.stringify([a.explanationSufficiency, a.primaryExplanation, a.plausibleExplanations]);
  const protection = targets.some(g => g.dimension === 'Protection context') && JSON.stringify([b.protectionContextSufficiency, b.highDependency]) !== JSON.stringify([a.protectionContextSufficiency, a.highDependency]);
  return explanation || protection;
};

// Pure read-only planning. Counterfactual records never replace the source snapshot.
export function identifyNextBestEvidence({ changeResult, evidence, decisionContext = {} }, p = nextEvidenceParameters, dp = diagnosisParameters) {
  for (const key of ['gapReductionWeight', 'pathwayChangeWeight', 'burdenPenalty', 'tieTolerance']) if (!Number.isFinite(p[key]) || p[key] < 0) throw new Error(`Invalid provisional evidence parameter: ${key}`);
  if (p.gapReductionWeight + p.pathwayChangeWeight <= 0 || !Number.isInteger(p.minimumFeedbackResponses) || p.minimumFeedbackResponses < 1 || !Number.isInteger(p.projectedObservationPeriods) || p.projectedObservationPeriods < 1) throw new Error('Invalid provisional evidence parameters');
  if (Object.values(p.burden).some(x => !Number.isFinite(x) || x < 0)) throw new Error('Invalid provisional burden parameter');
  const before = diagnoseCompeting({ changeResult, evidence }, dp);
  const common = { parameterVersion: p.version, provisionalParameters: p, evidenceSnapshotId: evidence.snapshotId ?? null,
    dataProvenance: 'Simulated inputs; counterfactual findings are hypothetical, not collected evidence',
    collectionTriggered: false, interventionSelected: false, aiImplemented: false,
    method: p.method, caveat: 'Evidence collection priority only. Values are not causal probabilities, generic confidence, learned expected utility or intervention approval.' };
  if (before.executionState !== 'Assessed') return { ...common, executionState: 'Not Assessed', reason: before.reason, gaps: [], candidates: [], nextBestCandidateIds: [], residentInputEligibleForLaterSelection: false };
  const gaps = identifyDecisionGaps(before, decisionContext);
  // Use only evidence available at the assessment time, including for scenario construction.
  const available = { ...prepareEvidence(evidence), snapshotId: evidence.snapshotId ?? null };
  const designs = designCandidates({ evidence: available, context: decisionContext, parameters: p, diagnosisParameters: dp });
  if (designs.some(d => !Number.isFinite(d.burden) || d.burden < 0)) throw new Error('Invalid provisional burden parameter');
  const candidates = designs.map(design => {
    const targets = gaps.filter(g => design.targetGapIds.includes(g.id));
    const blockedReasons = [...design.blockedReasons];
    if (!targets.length) blockedReasons.push('No relevant unresolved decision/evidence gap is targeted.');
    if (design.id === 'pilot') {
      if (before.features.operationalHealthy.value !== true) blockedReasons.push('Healthy operational condition is not established; investigate it before a programme pilot.');
      if (before.checks.temporal.persistent !== true || before.checks.residentMix.mixControlled !== true) blockedReasons.push('Persistence and resident-mix context are not established for this proposed programme pilot.');
      if (before.evidenceSufficiency.protectionContextSufficiency.state !== 'Sufficient Evidence') blockedReasons.push('Protection context is unresolved; a pilot affecting amenity use cannot bypass this gap.');
    }
    const scenarios = [...design.scenarios];
    if (design.id !== 'pilot') scenarios.push({ label: 'Collection is inconclusive or unavailable', kind: 'Inconclusive' });
    const outcomes = scenarios.map(scenario => {
      if (scenario.kind === 'Inconclusive') return { label: scenario.label, kind: scenario.kind, resolvedGapIds: [], pathwayChanged: false, implication: scenario.implication ?? 'Relevant evidence remains unknown; reassess the evidence plan.' };
      if (scenario.kind === 'Hypothetical pilot outcome') return { ...scenario, resolvedGapIds: scenario.resolves.filter(id => targets.some(g => g.id === id)), pathwayChanged: targets.length > 0, reassessmentRequired: true };
      const projectedEvidence = { ...structuredClone(available), ...structuredClone(scenario.patch), snapshotId: `hypothetical:${design.id}` };
      const after = diagnoseCompeting({ changeResult, evidence: projectedEvidence }, dp);
      return { label: scenario.label, kind: scenario.kind, hypotheticalPatch: scenario.patch,
        resolvedGapIds: targets.filter(g => gapResolved(g, before, after)).map(g => g.id),
        pathwayChanged: signatureChanged(before, after, targets),
        projectedAssessment: decisionSignature(after),
        implication: 'Illustrative reassessment using the unchanged CP3 engine; no finding is assumed to be true.' };
    });
    const gapReduction = outcomes.length ? outcomes.reduce((sum, o) => sum + o.resolvedGapIds.length, 0) / outcomes.length : 0;
    const pathwayChange = outcomes.length ? outcomes.filter(o => o.pathwayChanged).length / outcomes.length : 0;
    const material = outcomes.some(o => o.resolvedGapIds.length > 0 || o.pathwayChanged);
    if (!material && targets.length) blockedReasons.push('Contrasting scenarios do not materially reduce the targeted gap or change the relevant pathway assessment.');
    const potentialValue = (p.gapReductionWeight * gapReduction + p.pathwayChangeWeight * pathwayChange) / (1 + p.burdenPenalty * design.burden);
    if (material && potentialValue <= 0) blockedReasons.push('Configured value weights assign no decision value to the demonstrated effects.');
    const eligible = !blockedReasons.length && material && potentialValue > 0;
    const value = eligible ? potentialValue : 0;
    return { id: design.id, title: design.title, evidenceRole: design.evidenceRole,
      targetGaps: targets, eligible, blockedReasons, material,
      score: value, scoreLabel: 'Scenario decision value — provisional heuristic',
      valueComponents: { meanTargetGapReductions: gapReduction, scenarioPathwayChangeFraction: pathwayChange, burden: design.burden },
      outcomes, approvalRequired: design.approvalRequired ?? false,
      ...(design.id === 'pilot' ? { outcomeDefinition: design.outcomeDefinition, proposedDesign: decisionContext.pilotDesign ?? null, executionImplemented: false } : {}),
      rationale: eligible ? `Possible findings can resolve ${targets.map(g => g.id).join(', ')} or change the corresponding later decision pathway; inconclusive findings retain the gaps.` : blockedReasons.join(' ')
    };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const eligible = candidates.filter(c => c.eligible);
  const top = eligible.length ? eligible.filter(c => eligible[0].score - c.score <= p.tieTolerance) : [];
  // A tie is visible, not silently converted into a resident-question trigger.
  const residentInputEligibleForLaterSelection = top.length === 1 && ['residents', 'dependencyResidents'].includes(top[0].id);
  return { ...common, executionState: 'Assessed',
    sufficiency: { explanationSufficiency: before.evidenceSufficiency.explanationSufficiency, protectionContextSufficiency: before.evidenceSufficiency.protectionContextSufficiency },
    gaps, candidates, sourceWarnings: before.warnings, nextBestCandidateIds: top.map(c => c.id), residentInputEligibleForLaterSelection,
    residentInputNote: residentInputEligibleForLaterSelection ? 'Resident input has the highest modeled decision value for an explicit unresolved gap. Best Question × Best Cohort selection is deferred; nothing is sent.' : 'Resident questioning is not triggered by insufficient evidence. Collecting resident input is not the unique highest-value evidence choice here.',
    state: !gaps.length ? 'No unresolved gap identified' : !top.length ? 'No actionable evidence candidate' : top.length > 1 ? 'Evidence priority tie — operator review' : 'Next-Best Evidence identified',
    nextStep: !gaps.length ? 'No additional evidence requested by this checkpoint. Later intervention-specific review still applies.' : !top.length ? 'Keep gaps unresolved and review evidence availability; do not invent evidence or default to a survey.' : 'Operator reviews the evidence plan. No collection or intervention is executed.'
  };
}
