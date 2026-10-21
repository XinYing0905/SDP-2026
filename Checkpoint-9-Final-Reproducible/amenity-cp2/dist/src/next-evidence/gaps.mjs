const EXPLANATION = 'Explanation';
const PROTECTION = 'Protection context';
const known = (r, keys) => keys.every(k => typeof r.features[k]?.value === 'boolean');

// Structured unresolved gaps, not a combined case confidence score.
export function identifyDecisionGaps(r, context = {}) {
  if (r.executionState !== 'Assessed') return [];
  const s = r.evidenceSufficiency, gaps = [];
  const add = (id, dimension, question, relevance, featureKeys = []) => gaps.push({ id, dimension, question, decisionRelevance: relevance, featureKeys });
  if (s.explanationSufficiency.state === 'Insufficient Evidence') {
    if (!known(r, ['operationalIssue', 'operationalHealthy'])) add('operational-condition', EXPLANATION,
      'Is there a confirmed unresolved operational problem, or adequately reviewed healthy operation?',
      'Can distinguish the later Repair / Restore pathway from programme or temporal pathways.', ['operationalIssue', 'operationalHealthy']);
    if (r.checks.temporal.persistent === null || (s.decisionHorizon === 'long-term' && r.checks.temporal.persistent !== true)) add('temporal-stability', EXPLANATION,
      'Does comparable history support persistence, recovery or an exceptional-period pattern?',
      'Can change whether the later pathway remains Monitor / Validate or warrants programme investigation.', ['persistentPattern', 'temporaryPattern']);
    if (!known(r, ['stableCohortDecline', 'mixControlled', 'turnoverHigh'])) add('resident-mix', EXPLANATION,
      'Does decline remain across retained cohorts after accounting for turnover?',
      'Can distinguish Temporary / Resident-Mix Shift from persistent programme mismatch.', ['stableCohortDecline', 'mixControlled', 'turnoverHigh']);
    if (r.features.operationalIssue.value !== true && (r.features.programmeDecline.value === true || (r.checks.temporal.persistent === true && r.checks.residentMix.mixControlled === true)) && r.features.programmeMismatchFeedback.value === null) add('programme-fit', EXPLANATION,
      'Do relevant residents report programme mismatch or continuing fit?',
      'Can change support for the later Reprogramme / Temporary Pilot pathway.', ['programmeMismatchFeedback']);
    // Retain a decision-level gap even when all available fields are populated but inconclusive.
    add('explanation-discrimination', EXPLANATION,
      'Which plausible explanation, if any, can pass the existing sufficiency gates?',
      'Prevents treating a populated record or a leading support score as a resolved explanation.');
  }
  if (s.protectionContextSufficiency.state === 'Insufficient Evidence') {
    for (const [id, key, question] of [
      ['repeat-dependency', 'stableRepeatCohort', 'Is repeated use by a stable cohort adequately observed?'],
      ['dependent-needs', 'documentedDependency', 'Are dependent-user needs documented?'],
      ['realistic-substitutes', 'limitedSubstitutes', 'Are alternative capacity, distance and accessibility understood?'],
      ['protected-impact', 'disproportionateImpact', 'Would changing the function disproportionately affect dependent users?']
    ]) if (r.features[key].value === null) add(id, PROTECTION, question,
      'May change later protection constraints on Preserve / Shared Use or other changes affecting the amenity; it does not invalidate an established explanation.', [key]);
  }
  if (context.programmeResponseUnresolved === true) add('programme-response', 'Decision pathway',
    'Would a bounded programme change achieve its stated purpose while retaining protected access?',
    'A temporary intervention can generate evidence supporting or weakening a later programme pathway; action-specific approval remains separate.');
  return gaps;
}

export function gapResolved(gap, before, after) {
  if (gap.id === 'explanation-discrimination') {
    const b = before.evidenceSufficiency.explanationSufficiency, a = after.evidenceSufficiency.explanationSufficiency;
    return a.state === 'Sufficient Evidence' || (b.ambiguous && !a.ambiguous && a.comparisonCandidates.length > 0);
  }
  if (gap.id === 'temporal-stability') return after.checks.temporal.persistent === true || after.evidenceSufficiency.explanationSufficiency.state === 'Sufficient Evidence';
  return gap.featureKeys.length > 0 && known(after, gap.featureKeys);
}

export function decisionSignature(r) {
  const s = r.evidenceSufficiency;
  return {
    explanationSufficiency: s.explanationSufficiency.state,
    primaryExplanation: s.explanationSufficiency.primaryExplanation,
    plausibleExplanations: [...s.explanationSufficiency.plausibleExplanations].sort(),
    protectionContextSufficiency: s.protectionContextSufficiency.state,
    highDependency: s.protectionContextSufficiency.highDependency
  };
}
