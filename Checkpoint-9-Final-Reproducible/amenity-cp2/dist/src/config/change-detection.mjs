export const parameters = Object.freeze({
  label: 'Provisional MVP Parameters',
  version: 'cp2-1.0',
  periodDays: 7,
  baselinePeriods: 8,
  currentPeriods: 4,
  minimumBaselineCoverage: 0.75,
  minimumCurrentCoverage: 0.75,
  minimumPersistence: 3,
  relativeDeviationThreshold: 0.20,
  minimumConsistentSignals: 2,
  contextualInterpretation: 'exclude-exceptional-period-and-break-persistence',
  absoluteDeviationFloors: {
    bookings: 10, uniqueUsers: 10, repeatUsers: 5,
    utilisationRate: 0.10, cancellationRate: 0.05, accessCount: 20
  }
});

export const metricDefinitions = Object.freeze({
  bookings: { label: 'Bookings', unit: 'count', deteriorationSign: -1 },
  uniqueUsers: { label: 'Unique users', unit: 'count', deteriorationSign: -1 },
  repeatUsers: { label: 'Repeat users', unit: 'count', deteriorationSign: -1 },
  utilisationRate: { label: 'Utilisation rate', unit: 'rate', deteriorationSign: -1 },
  cancellationRate: { label: 'Cancellation rate', unit: 'rate', deteriorationSign: 1 },
  accessCount: { label: 'Access count', unit: 'count', deteriorationSign: -1 }
});
