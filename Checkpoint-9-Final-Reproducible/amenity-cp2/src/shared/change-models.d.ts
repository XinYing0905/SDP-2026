/** Checkpoint 2-only contracts. Declarations, not a claim of a compiled TypeScript frontend. */
export type ChangeStatus = 'Stable' | 'Monitoring' | 'Needs Attention';
export type SignalKey = 'bookings' | 'uniqueUsers' | 'repeatUsers' | 'utilisationRate' | 'cancellationRate' | 'accessCount';
export type Direction = 'deterioration' | 'increase-or-improvement';
export type ContextType = 'normal' | 'closure' | 'holiday' | 'exceptional-event' | 'unavailable-data';
export interface Observation {
  periodStart: string;
  values: Partial<Record<SignalKey, number | null>>;
  context?: { type: ContextType; note?: string };
  maintenance?: { ticketCount?: number | null; downtimeHours?: number | null } | null;
}
export interface AmenityRecord {
  id: string; name: string; tier: 'A' | 'B' | 'C'; description: string;
  analysisPeriodStart: string; applicableSignals: SignalKey[]; observations: Observation[];
}
export interface ChangeParameters {
  label: string; version: string; periodDays: number; baselinePeriods: number; currentPeriods: number;
  minimumBaselineCoverage: number; minimumCurrentCoverage: number; minimumPersistence: number;
  relativeDeviationThreshold: number; minimumConsistentSignals: number;
  contextualInterpretation: 'exclude-exceptional-period-and-break-persistence';
  absoluteDeviationFloors: Record<SignalKey, number>;
}
export type MetricDefinitions = Record<SignalKey, { label: string; unit: 'count' | 'rate'; deteriorationSign: -1 | 1 }>;
export interface Point {
  periodStart: string; window: 'baseline' | 'current'; value: number | null;
  eligible: boolean; context: ContextType | 'missing-period' | 'context-unknown';
}
export interface Persistence {
  trailingPeriods: number; requiredPeriods: number; sustained: boolean; missingOrExceptionalBreaksStreak: boolean;
}
export interface Excursion { periodStart: string; value: number; direction: Direction }
export interface MetricEvidence {
  key: SignalKey; label: string; unit: 'count' | 'rate';
  baselineValue: number | null; currentValue: number | null; magnitude: number | null;
  percentageChange: number | null; percentagePointChange: number | null;
  coverage: { baseline: number; current: number; validBaseline: number; validCurrent: number; expectedBaseline: number; expectedCurrent: number };
  assessable: boolean; currentDirection: Direction | null; latestDirection: Direction | null;
  persistence: Persistence; excursions: Excursion[]; points: Point[];
}
export interface ChangeResult {
  amenityId: string; amenityName: string; tier: string; status: ChangeStatus; explanation: string;
  parameterVersion: string; dataProvenance: 'Simulated input data';
  baselineWindow: { start: string; end: string; periods: number };
  currentWindow: { start: string; end: string; periods: number };
  metrics: MetricEvidence[];
  detectedChangeSignals: Array<{ signal: SignalKey; direction: Direction | 'returned-or-unknown'; sustained: boolean; periods: Excursion[] }>;
  persistence: { requiredPeriods: number; result: string; perSignal: Array<Persistence & { signal: SignalKey }> };
  signalConsistency: { required: number; observed: number; direction: Direction | null; signals: SignalKey[]; assessableSignals: number; meetsRequirement: boolean };
  contextualCaveats: Array<{ periodStart: string; type: ContextType | 'maintenance-context'; note: string; interpretation: string }>;
  missingDataWarnings: string[]; missingPeriods: string[]; ignoredOutOfWindowPeriods: string[];
  provisionalParameters: ChangeParameters;
}
export interface ChangeEntry {
  input: Pick<AmenityRecord, 'id' | 'name' | 'tier' | 'description'>;
  result: ChangeResult;
}
export interface CommonEnvelope {
  contractVersion: 'change-detection.v1'; dataProvenance: 'Simulated input data';
  parameters: ChangeParameters; metricDefinitions: MetricDefinitions; simulationNotice: string;
}
export interface OverviewEnvelope extends CommonEnvelope { kind: 'overview'; entries: ChangeEntry[] }
export interface EvidenceEnvelope extends CommonEnvelope { kind: 'evidence'; entry: ChangeEntry }
export interface AmenityRepository {
  list(): Promise<AmenityRecord[]>;
  getById(id: string): Promise<AmenityRecord | null>;
}
export interface ChangeClient {
  getOverview(): Promise<OverviewEnvelope>;
  getChangeEvidence(id: string): Promise<EvidenceEnvelope>;
  getCompetingDiagnosis(id: string): Promise<import('./diagnosis-models').DiagnosisEnvelope>;
  getNextBestEvidence(id: string): Promise<import('./next-evidence-models').NextEvidenceEnvelope>;
}
export interface ChangeTransport {
  request(request: { method: 'GET'; path: string }): Promise<OverviewEnvelope | EvidenceEnvelope | import('./diagnosis-models').DiagnosisEnvelope | import('./next-evidence-models').NextEvidenceEnvelope>;
}
export type Detector = (amenity: AmenityRecord, parameters?: ChangeParameters) => ChangeResult;
