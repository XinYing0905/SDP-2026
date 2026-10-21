import { number, fraction, change, refs } from './evidence-utils.mjs';

export function checkResidentMix(e, p) {
  const section = e.residentMix;
  const unknown = reasons => ({ state: 'Unknown', recentConcentration: null, longCohortsStable: null, stableCohortDecline: null, turnoverHigh: null, mixControlled: null, cohorts: [], reasons, sourceRefs: refs(section) });
  if (!section || !Array.isArray(section.cohorts) || !section.cohorts.length) return unknown(['Resident cohort information is unavailable; absence does not mean stable resident mix.']);
  const cohorts = section.cohorts.map(c => {
    const valid = number(c.populationBefore) && c.populationBefore > 0 && number(c.populationAfter) && c.populationAfter > 0 && number(c.usersBefore) && c.usersBefore <= c.populationBefore && number(c.usersAfter) && c.usersAfter <= c.populationAfter && number(c.observedPeriods) && c.observedPeriods >= p.minimumCohortPeriods && fraction(c.retainedFraction);
    const beforeRate = valid ? c.usersBefore / c.populationBefore : null;
    const afterRate = valid ? c.usersAfter / c.populationAfter : null;
    const delta = valid ? change(beforeRate, afterRate) : null;
    const ruleRole = p.recentDurationGroups.includes(c.residenceDuration) ? 'Recent cohort' : p.stableDurationGroups.includes(c.residenceDuration) ? 'Long-term cohort candidate' : c.residenceDuration === '6–24 months' ? 'Intermediate cohort — visible, not used in recent/long-term comparison' : 'Unrecognized duration — visible, not used in recent/long-term comparison';
    return { cohortId: c.cohortId, residenceDuration: c.residenceDuration, ruleRole, valid: valid && delta !== null, stablePopulation: valid && c.retainedFraction >= p.minimumRetainedFraction, beforeRate, afterRate, changeFraction: delta, declined: delta === null ? null : delta <= -p.cohortDeviation, stableUsage: delta === null ? null : Math.abs(delta) <= p.cohortStableTolerance };
  });
  const long = cohorts.filter(c => p.stableDurationGroups.includes(c.residenceDuration) && c.valid && c.stablePopulation);
  const recent = cohorts.filter(c => p.recentDurationGroups.includes(c.residenceDuration) && c.valid);
  const longKnown = long.length >= p.minimumStableCohorts;
  const longCohortsStable = longKnown ? long.every(c => c.stableUsage) : null;
  const stableCohortDecline = longKnown ? long.filter(c => c.declined).length >= p.minimumStableCohorts : null;
  const recentConcentration = longKnown && recent.length ? recent.some(c => c.declined) && longCohortsStable : null;
  const turnoverFraction = number(section.newResidents) && number(section.populationAfter) && section.populationAfter > 0 && section.newResidents <= section.populationAfter ? section.newResidents / section.populationAfter : null;
  const turnoverHigh = turnoverFraction === null ? null : turnoverFraction >= p.highTurnoverFraction;
  const mixControlled = stableCohortDecline === null || turnoverHigh === null ? null : stableCohortDecline && !turnoverHigh;
  const state = !longKnown ? 'Unknown' : recentConcentration ? 'Concentrated Among Recent Residents' : stableCohortDecline ? 'Decline Across Stable Cohorts' : longCohortsStable ? 'Stable Long-Term Cohorts' : 'Mixed Cohort Pattern';
  const reasons = [longKnown ? 'Compared observed usage rates with cohort population denominators and retention; ownership status is not used as a weight.' : 'Insufficient valid retained long-term cohorts; resident-mix stability remains unknown.'];
  if (turnoverHigh) reasons.push('Recorded resident turnover materially affects interpretation.');
  if (cohorts.some(c => !c.valid)) reasons.push('Some cohort observations/denominators are missing or invalid; they were not treated as stable.');
  return { state, recentConcentration, longCohortsStable, stableCohortDecline, turnoverHigh, turnoverFraction, mixControlled, cohorts, reasons, sourceRefs: refs(section) };
}
