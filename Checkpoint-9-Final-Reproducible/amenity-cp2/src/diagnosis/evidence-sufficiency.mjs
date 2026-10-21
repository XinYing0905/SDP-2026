const DEPENDENCY_STATE = 'Low Utilisation, High Dependency';

export function evaluateSufficiency(diagnoses, features, checks, horizon, p) {
  const requiredCoverage = p.coverageByHorizon[horizon];
  const maxContradiction = p.maximumContradictionFraction[horizon];
  const reasonsByName = diagnosis => {
    const reasons = [];
    const isProtectionState = diagnosis.name === DEPENDENCY_STATE;
    const requireTrue = key => { if (features[key].value !== true) reasons.push(`${features[key].label} is ${features[key].value === null ? 'unknown' : 'not established'}.`); };
    // These are unchanged within-state evidence gates, not cross-diagnosis ranking.
    if (diagnosis.rawEvidenceSupport < p.strongSupportPoints) reasons.push('Raw support does not reach the provisional strong-support threshold.');
    if (diagnosis.coverage < requiredCoverage) reasons.push('Evidence coverage is below the requirement for this decision horizon.');
    if (diagnosis.supportingDomains.length < p.minimumEvidenceDomains) reasons.push('Too few supporting evidence domains; correlated features are not independent proof.');
    const contradictionFraction = diagnosis.positivePoints + diagnosis.contradictionPoints ? diagnosis.contradictionPoints / (diagnosis.positivePoints + diagnosis.contradictionPoints) : 0;
    if (contradictionFraction > maxContradiction) reasons.push('Material contradicting evidence remains unresolved.');
    if (!isProtectionState) {
      if (checks.temporal.state === 'Insufficiently Observed') reasons.push('Temporal stability is insufficiently observed.');
      if (horizon === 'long-term') {
        if (p.longTermRequiresPersistent && checks.temporal.persistent !== true) reasons.push('Long-term explanation assessment requires independently persistent evidence.');
        if (p.longTermRequiresResidentMix && (checks.residentMix.state === 'Unknown' || checks.residentMix.turnoverHigh === null)) reasons.push('Resident-mix stability/turnover is unknown for a long-term explanation assessment.');
      }
      // Dependency completeness deliberately does not gate explanation sufficiency.
    }
    if (diagnosis.name === 'Operational Problem') requireTrue('operationalIssue');
    if (diagnosis.name === 'Temporary / Resident-Mix Shift' && !(features.recentConcentration.value === true && features.longCohortsStable.value === true) && features.temporaryPattern.value !== true && features.exceptionalContext.value !== true) reasons.push('Neither the resident-shift nor the temporal/contextual explanation is established.');
    if (diagnosis.name === 'Persistent Programme / Configuration Mismatch') for (const key of ['persistentPattern', 'operationalHealthy', 'stableCohortDecline', 'mixControlled']) requireTrue(key);
    if (isProtectionState) for (const key of ['lowUtilisation', 'stableRepeatCohort', 'documentedDependency', 'limitedSubstitutes', 'disproportionateImpact']) requireTrue(key);
    return { name: diagnosis.name, assessmentScope: isProtectionState ? 'Dependency-state support' : 'Explanation support', state: reasons.length ? 'Insufficient Evidence' : 'Sufficient Evidence', reasons, decisionHorizon: horizon, coverage: diagnosis.coverage, requiredCoverage, contradictionFraction, maximumContradictionFraction: maxContradiction };
  };
  const perDiagnosis = diagnoses.map(reasonsByName);
  // All cross-state comparisons use unrounded own-scale Relative Evidence Support.
  // High dependency remains coexisting protection context, not an exclusive cause.
  const candidates = diagnoses.filter(d => d.name !== DEPENDENCY_STATE && d.relativeEvidenceSupport !== null && d.relativeEvidenceSupport >= p.plausibleRelativeSupportThreshold).sort((a, b) => b.relativeEvidenceSupport - a.relativeEvidenceSupport);
  const nearLeaders = candidates.length ? candidates.filter(d => candidates[0].relativeEvidenceSupport - d.relativeEvidenceSupport <= p.ambiguityMarginRelativeSupport) : [];
  const ambiguous = nearLeaders.length > 1;
  const leader = nearLeaders.length === 1 ? nearLeaders[0] : null;
  const leaderAssessment = leader ? perDiagnosis.find(d => d.name === leader.name) : null;
  const explanationSufficient = Boolean(leader && leaderAssessment.state === 'Sufficient Evidence');
  const explanationReasons = [];
  if (!candidates.length) explanationReasons.push('No explanatory state reaches the provisional comparable-support threshold. High dependency alone does not explain the observed change.');
  if (ambiguous) explanationReasons.push('Plausible explanations are within the provisional Relative Evidence Support margin; current evidence does not distinguish a unique explanation.');
  if (leaderAssessment?.state === 'Insufficient Evidence') explanationReasons.push(...leaderAssessment.reasons);
  if (ambiguous) explanationReasons.push('Evidence sufficiency is retained for every candidate; normalization does not resolve missing evidence or contradictions.');
  const explanationSufficiency = {
    state: explanationSufficient ? 'Sufficient Evidence' : 'Insufficient Evidence',
    decisionHorizon: horizon, reasons: explanationReasons,
    primaryExplanation: explanationSufficient ? leader.name : null,
    ambiguous, plausibleExplanations: nearLeaders.map(d => d.name),
    sufficientStates: perDiagnosis.filter(d => d.name !== DEPENDENCY_STATE && d.state === 'Sufficient Evidence').map(d => d.name),
    comparisonMeasure: 'Relative Evidence Support — own configured scale, not causal probability',
    comparisonCandidates: candidates.map(d => ({ name: d.name, relativeEvidenceSupport: d.relativeEvidenceSupport, evidenceSufficiency: perDiagnosis.find(x => x.name === d.name).state })),
    ambiguityMarginPercentagePoints: p.ambiguityMarginRelativeSupport,
    minimumComparableSupport: p.plausibleRelativeSupportThreshold
  };
  const protectionGaps = ['stableRepeatCohort', 'documentedDependency', 'limitedSubstitutes', 'disproportionateImpact'].filter(key => features[key].value === null).map(key => `${features[key].label} is unknown.`);
  const protectionSufficient = checks.dependency.complete;
  const protectionContextSufficiency = {
    state: protectionSufficient ? 'Sufficient Evidence' : 'Insufficient Evidence',
    reasons: protectionSufficient ? ['Recorded dependency, repeat-use, substitute and protected-user impact evidence is adequately understood for this assessment. This can include explicit evidence that high dependency is not indicated.'] : protectionGaps,
    highDependency: checks.dependency.highDependency,
    protectionRelevant: checks.dependency.protectionRelevant,
    unresolvedProtectionGap: !protectionSufficient,
    requiresLaterActionSpecificReview: true,
    caveat: 'An unresolved protection gap is separate from explanatory evidence and may constrain later interventions affecting the amenity or protected users. No intervention is selected or approved here.'
  };
  return { decisionHorizon: horizon, explanationSufficiency, protectionContextSufficiency, perDiagnosis, supportedStates: diagnoses.filter(d => d.rawEvidenceSupport >= p.strongSupportPoints).map(d => d.name), caveat: 'Explanation Sufficiency and Protection Context Sufficiency are independent assessments. Neither is causal probability or action-specific/intervention approval.' };
}
