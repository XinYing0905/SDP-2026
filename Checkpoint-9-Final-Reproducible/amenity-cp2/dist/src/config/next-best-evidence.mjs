// Explicit demonstration policy. These are not learned probabilities or universal thresholds.
export const nextEvidenceParameters = Object.freeze({
  label: 'Provisional MVP Parameters', version: 'next-evidence-cp4-1.0',
  gapReductionWeight: 1, pathwayChangeWeight: 1,
  burdenPenalty: 0.1, tieTolerance: 1e-9,
  // Ordinal combined operator effort / resident burden / delay, not money or accuracy.
  burden: { maintenance: 1, inspection: 2, cohorts: 2, observation: 3, residents: 3, dependencyResidents: 3, dependencyRecords: 1, substitutes: 2, pilot: 5 },
  minimumFeedbackResponses: 5, projectedObservationPeriods: 3,
  method: 'Unweighted contrasting-scenario decision-value heuristic; no estimated outcome probabilities',
  noAutomaticCollection: true
});
