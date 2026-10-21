import { number, fraction, refs } from './evidence-utils.mjs';

export function checkDependency(e, p) {
  const d = e.dependency;
  const bool = value => typeof value === 'boolean' ? value : null;
  const repeatFraction = d && number(d.repeatUsers) && number(d.activeUsers) && d.activeUsers > 0 && d.repeatUsers <= d.activeUsers ? d.repeatUsers / d.activeUsers : null;
  const stableRepeatCohort = repeatFraction !== null && number(d.stablePeriods) ? repeatFraction >= p.minimumRepeatFraction && d.stablePeriods >= p.minimumDependentStablePeriods : null;
  const documentedDependency = bool(d?.needsDocumented);
  const disproportionateImpact = bool(d?.disproportionateImpact);
  const alternatives = d?.alternativesReviewed === true && Array.isArray(d.alternatives) ? d.alternatives.map(a => {
    const complete = number(a.distanceKm) && typeof a.accessible === 'boolean' && number(a.capacity) && number(a.availableCapacity) && a.availableCapacity <= a.capacity && number(d.activeUsers);
    return { ...a, realistic: complete ? a.accessible && a.distanceKm <= p.maximumAlternativeDistanceKm && a.availableCapacity >= d.activeUsers : null };
  }) : null;
  const limitedSubstitutes = alternatives === null ? null : alternatives.some(a => a.realistic === true) ? false : alternatives.some(a => a.realistic === null) ? null : true;
  const complete = [stableRepeatCohort, documentedDependency, limitedSubstitutes, disproportionateImpact].every(x => x !== null);
  const protectionRelevant = documentedDependency === true && disproportionateImpact === true;
  const highDependency = stableRepeatCohort === true && documentedDependency === true && limitedSubstitutes === true && disproportionateImpact === true;
  return { state: !complete ? 'Unknown / Incomplete Dependency Evidence' : highDependency ? 'High Dependency / Limited Substitutes' : 'High Dependency Not Indicated by Recorded Assessment', complete, highDependency, protectionRelevant, stableRepeatCohort, repeatFraction, documentedDependency, limitedSubstitutes, disproportionateImpact, cohortSize: d?.cohortSize ?? null, populationShare: d && number(d.cohortSize) && number(d.residentPopulation) && d.residentPopulation > 0 ? d.cohortSize / d.residentPopulation : null, accessibilityNeeds: d?.accessibilityNeeds ?? null, alternatives, reasons: [!complete ? 'Missing dependency or substitute evidence remains unknown; low utilisation does not establish low value.' : highDependency ? 'Repeat use, documented need, limited realistic alternatives and disproportionate impact jointly support dependent-cohort protection.' : 'Recorded assessment does not establish this high-dependency pattern; this is not evidence of low community value.'], sourceRefs: refs(d) };
}
