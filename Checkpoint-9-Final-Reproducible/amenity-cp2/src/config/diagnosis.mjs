// Provisional MVP Parameters — explainable demonstration policy, not calibrated science.
export const diagnosisStates = Object.freeze([
  'Operational Problem',
  'Temporary / Resident-Mix Shift',
  'Persistent Programme / Configuration Mismatch',
  'Low Utilisation, High Dependency'
]);
export const diagnosisParameters = Object.freeze({
  label: 'Provisional MVP Parameters', version: 'diagnosis-cp3-1.1',
  temporalBaselinePeriods: 3, temporalRecentPeriods: 3, minimumTemporalPoints: 6,
  minimumPersistentDays: 84, temporalDeviation: 0.20,
  cohortDeviation: 0.20, cohortStableTolerance: 0.10, minimumStableCohorts: 2,
  minimumCohortPeriods: 3, minimumRetainedFraction: 0.80, highTurnoverFraction: 0.20,
  stableDurationGroups: ['2–5 years', '5+ years'], recentDurationGroups: ['<6 months'],
  residenceDurationGroups: ['<6 months', '6–24 months', '2–5 years', '5+ years'],
  lowUtilisation: 0.15, minimumRepeatFraction: 0.60, minimumDependentStablePeriods: 3,
  maximumAlternativeDistanceKm: 3, minimumRecordCoverage: 0.75,
  elevatedDowntimeHours: 4, minimumOperationalComplaints: 2,
  programmeDeviation: 0.20, minimumFeedbackResponses: 5, mismatchFeedbackFraction: 0.60,
  strongSupportPoints: 6, plausibleSupportPoints: 3,
  // Percentage-point units on independent own-scale support, not raw points.
  plausibleRelativeSupportThreshold: 25, ambiguityMarginRelativeSupport: 20,
  minimumEvidenceDomains: 2,
  coverageByHorizon: { 'short-term': 0.65, 'long-term': 0.85 },
  maximumContradictionFraction: { 'short-term': 0.35, 'long-term': 0.20 },
  longTermRequiresPersistent: true, longTermRequiresResidentMix: true,
  // Each feature has independent signed contribution for an observed true/false result.
  // Null means unknown and contributes no points, never a contradiction.
  weights: {
    'Operational Problem': {
      operationalIssue: [4, -4], downtimeElevated: [2, -1], operationalComplaints: [2, -1],
      timeSpecificDeterioration: [1, 0], operationalHealthy: [-3, 0]
    },
    'Temporary / Resident-Mix Shift': {
      recentConcentration: [4, -2], turnoverHigh: [3, -1], longCohortsStable: [3, -2],
      temporaryPattern: [2, -1], exceptionalContext: [1, 0]
    },
    'Persistent Programme / Configuration Mismatch': {
      persistentPattern: [2, -3], operationalHealthy: [2, -3], stableCohortDecline: [3, -2],
      mixControlled: [2, -2], programmeDecline: [2, -1], programmeMismatchFeedback: [3, -2]
    },
    'Low Utilisation, High Dependency': {
      lowUtilisation: [1, -1], stableRepeatCohort: [3, -2], documentedDependency: [4, -3],
      limitedSubstitutes: [3, -2], disproportionateImpact: [2, -2]
    }
  }
});
