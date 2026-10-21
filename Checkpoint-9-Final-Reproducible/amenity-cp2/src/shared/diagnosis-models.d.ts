import type { ChangeResult } from './change-models';
export type DiagnosisName = 'Operational Problem' | 'Temporary / Resident-Mix Shift' | 'Persistent Programme / Configuration Mismatch' | 'Low Utilisation, High Dependency';
export type KnownBoolean = boolean | null;
export type ResidenceDurationGroup = '<6 months' | '6–24 months' | '2–5 years' | '5+ years';
export interface EvidenceFeature { key: string; label: string; value: KnownBoolean; domain: string; sourceRefs: string[] }
export interface ScoredEvidence extends EvidenceFeature { points: number | null; finding?: string; reason?: string }
export interface DiagnosisAssessment {
  name: DiagnosisName; rawEvidenceSupport: number; supportLabel: string;
  configuredPositiveSupportScale: number; relativeEvidenceSupport: number | null; relativeSupportInterpretation: string;
  supportingEvidence: ScoredEvidence[]; contradictingEvidence: ScoredEvidence[];
  missingEvidence: ScoredEvidence[]; neutralEvidence: ScoredEvidence[];
  coverage: number; observedWeight: number; totalWeight: number;
  positivePoints: number; contradictionPoints: number; supportingDomains: string[];
}
export interface CheckResult { state: string; reasons: string[]; sourceRefs: string[] }
export interface TemporalCheck extends CheckResult {
  persistent: KnownBoolean; temporary: KnownBoolean; exceptional: KnownBoolean;
  trailingPeriods: number; trailingDays: number; direction?: 'decline' | 'increase' | 'stable';
  baselineValue?: number; recentValues?: number[];
}
export interface ResidentMixCheck extends CheckResult {
  recentConcentration: KnownBoolean; longCohortsStable: KnownBoolean; stableCohortDecline: KnownBoolean;
  turnoverHigh: KnownBoolean; turnoverFraction?: number | null; mixControlled: KnownBoolean;
  cohorts: Array<{ cohortId: string; residenceDuration: ResidenceDurationGroup | string; ruleRole: string; valid: boolean; stablePopulation: boolean; beforeRate: number | null; afterRate: number | null; changeFraction: number | null; declined: KnownBoolean; stableUsage: KnownBoolean }>;
}
export interface DependencyCheck extends CheckResult {
  complete: boolean; highDependency: boolean; protectionRelevant: boolean;
  stableRepeatCohort: KnownBoolean; repeatFraction: number | null; documentedDependency: KnownBoolean;
  limitedSubstitutes: KnownBoolean; disproportionateImpact: KnownBoolean;
  cohortSize: number | null; populationShare: number | null; accessibilityNeeds: string | null;
  alternatives: Array<{ id: string; distanceKm: number | null; accessible: boolean | null; capacity: number | null; availableCapacity: number | null; realistic: KnownBoolean }> | null;
}
export interface EvidenceSource { sourceId: string; availableAt: string }
export interface DiagnosisEvidenceInput {
  snapshotId?: string | null; asOf: string; decisionHorizon: 'short-term' | 'long-term';
  temporal?: (EvidenceSource & { periodDays: number; timeSlot?: string | null; observations: Array<{ periodStart: string; usage: number | null; exceptional?: boolean | null }> }) | null;
  operations?: (EvidenceSource & { recordCoverage?: number | null; issueRegisterReviewed?: boolean | null; inspectionHealthy?: boolean | null; downtimeHours?: number | null; complaintCount?: number | null; issues?: Array<{ kind: string; confirmed: boolean | null; resolved: boolean | null; description?: string }> | null }) | null;
  residentMix?: (EvidenceSource & { populationAfter: number | null; newResidents: number | null; cohorts: Array<{ cohortId: string; residenceDuration: string; occupancyStatus?: string; populationBefore: number | null; populationAfter: number | null; usersBefore: number | null; usersAfter: number | null; observedPeriods: number | null; retainedFraction: number | null }> }) | null;
  usage?: (EvidenceSource & { utilisationRate: number | null }) | null;
  programme?: (EvidenceSource & { participationBefore: number | null; participationAfter: number | null }) | null;
  feedback?: (EvidenceSource & { relevantToProgramme: boolean | null; responses: number | null; mismatchResponses: number | null }) | null;
  dependency?: (EvidenceSource & { cohortSize?: number | null; residentPopulation?: number | null; activeUsers?: number | null; repeatUsers?: number | null; stablePeriods?: number | null; needsDocumented?: boolean | null; disproportionateImpact?: boolean | null; accessibilityNeeds?: string | null; alternativesReviewed?: boolean | null; alternatives?: Array<{ id: string; distanceKm: number | null; accessible: boolean | null; capacity: number | null; availableCapacity: number | null }> | null }) | null;
}
export interface ExplanationSufficiency {
  state: 'Sufficient Evidence' | 'Insufficient Evidence'; decisionHorizon: 'short-term' | 'long-term';
  reasons: string[]; primaryExplanation: DiagnosisName | null;
  ambiguous: boolean; plausibleExplanations: DiagnosisName[]; sufficientStates: DiagnosisName[];
  comparisonMeasure: string; comparisonCandidates: Array<{ name: DiagnosisName; relativeEvidenceSupport: number; evidenceSufficiency: string }>;
  ambiguityMarginPercentagePoints: number; minimumComparableSupport: number;
}
export interface ProtectionContextSufficiency {
  state: 'Sufficient Evidence' | 'Insufficient Evidence'; reasons: string[];
  highDependency: boolean; protectionRelevant: boolean; unresolvedProtectionGap: boolean;
  requiresLaterActionSpecificReview: true; caveat: string;
}
export interface DiagnosisSufficiency {
  decisionHorizon: 'short-term' | 'long-term';
  explanationSufficiency: ExplanationSufficiency;
  protectionContextSufficiency: ProtectionContextSufficiency;
  supportedStates: DiagnosisName[];
  perDiagnosis: Array<{ name: DiagnosisName; assessmentScope: string; state: string; reasons: string[]; coverage: number; requiredCoverage: number; contradictionFraction: number; maximumContradictionFraction: number }>;
  caveat: string;
}
export interface DiagnosisEnvelope {
  contractVersion: 'competing-diagnosis.v2'; amenityId: string; dataProvenance: 'Simulated diagnosis evidence';
  result: { executionState: 'Not Assessed'; reason: string; upstreamStatus: ChangeResult['status'] } | {
    executionState: 'Assessed'; upstreamStatus: 'Needs Attention'; evidenceSnapshotId: string | null;
    dataProvenance: string; parameterVersion: string; scoringInterpretation: string;
    checks: { temporal: TemporalCheck; residentMix: ResidentMixCheck; dependency: DependencyCheck };
    features: Record<string, EvidenceFeature>; diagnoses: DiagnosisAssessment[];
    evidenceSufficiency: DiagnosisSufficiency; warnings: string[]; provisionalParameters: object;
    protection: { relevant: boolean; highDependency: boolean; note: string };
  };
}
