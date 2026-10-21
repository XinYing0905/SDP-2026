import { diagnosisParameters } from '../config/diagnosis.mjs';
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? Date.parse(value + 'T00:00:00Z') : NaN;
export const validSource = (source, asOf) => Boolean(source?.sourceId && source.version && Number.isFinite(date(source.availableAt)) && date(source.availableAt) <= date(asOf));

export function checkCohortEligibility(question, cohort, { asOf, decisionHorizon }) {
  const reasons = [];
  if (!cohort.id || !cohort.version || !cohort.membershipDefinition) reasons.push('Versioned cohort membership is unknown.');
  if (!validSource(cohort.source, asOf)) reasons.push('Cohort source/date/version is missing or unavailable at analysis time.');
  if (cohort.currentResidencyDocumented !== true) reasons.push('Current residency is not documented.');
  if (!Number.isInteger(cohort.knownRelevantMembers) || cohort.knownRelevantMembers < 1) reasons.push('Relevant membership count is unknown or empty; no cohort is fabricated.');
  if (cohort[question.exposureRequirement] !== true) reasons.push(`Required relevant exposure is not documented: ${question.exposureRequirement}.`);
  if (!validSource(cohort.exposureSource, asOf)) reasons.push('Relevant exposure source is unavailable.');
  if (!cohort.referencePeriod?.start || !cohort.referencePeriod?.end || !Number.isFinite(date(cohort.referencePeriod.start)) || !Number.isFinite(date(cohort.referencePeriod.end)) || date(cohort.referencePeriod.start) > date(cohort.referencePeriod.end) || date(cohort.referencePeriod.end) > date(asOf)) reasons.push('The question reference period is missing, invalid or future-dated.');
  if (!validSource(cohort.planningCoverageSource, asOf)) reasons.push('A dated cohort-bounded planning coverage basis is unavailable; turnout is not assumed.');
  const tenureRole = diagnosisParameters.recentDurationGroups.includes(cohort.residenceDuration) ? 'Recent cohort' : diagnosisParameters.stableDurationGroups.includes(cohort.residenceDuration) ? 'Long-term cohort candidate' : cohort.residenceDuration === '6–24 months' ? 'Intermediate cohort — visible, neither CP3 recent nor long-term' : 'Unknown duration — visible';
  if (question.id === 'Q-PROGRAMME-FIT' && decisionHorizon === 'long-term') {
    if (!diagnosisParameters.stableDurationGroups.includes(cohort.residenceDuration) || !Number.isFinite(cohort.observedPeriods) || cohort.observedPeriods < diagnosisParameters.minimumCohortPeriods || !Number.isFinite(cohort.retainedFraction) || cohort.retainedFraction < diagnosisParameters.minimumRetainedFraction || cohort.retainedFraction > 1) reasons.push('This historical-fit pair lacks approved long-term tenure/observation/retention eligibility.');
  }
  // Ownership, raw cohort size and assumed dependence supply no priority weight.
  return { eligible: !reasons.length, reasons, tenureRole, scope: 'Cohort-bounded planning only; not township-wide prevalence', coverageCaveat: 'Recorded eligible membership is not a forecast of completed responses or representativeness.' };
}
