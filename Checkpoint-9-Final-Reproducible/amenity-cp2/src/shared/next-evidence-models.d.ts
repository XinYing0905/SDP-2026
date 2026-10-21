import type { ExplanationSufficiency, ProtectionContextSufficiency } from './diagnosis-models';
export type GapDimension = 'Explanation' | 'Protection context' | 'Decision pathway';
export interface EvidencePlanningContext {
  availability?: Partial<Record<'maintenance' | 'inspection' | 'cohorts' | 'observation' | 'residents' | 'dependencyRecords' | 'substitutes' | 'pilot', boolean>>;
  availableCohortRecords?: NonNullable<import('./diagnosis-models').DiagnosisEvidenceInput['residentMix']>['cohorts'];
  cohortRecordSource?: { sourceId: string; availableAt: string };
  cohortPopulationAfter?: number | null; cohortNewResidents?: number | null;
  dependencyUsageRecord?: { activeUsers: number | null; repeatUsers: number | null; stablePeriods: number | null };
  dependencyUsageSource?: { sourceId: string; availableAt: string };
  programmeResponseUnresolved?: boolean;
  pilotDesign?: { purpose: string; scope: string; durationDays: number; protectedFunction: string };
}
export interface DecisionGap { id: string; dimension: GapDimension; question: string; decisionRelevance: string; featureKeys: string[] }
export interface EvidenceOutcome {
  label: string; kind: 'Hypothetical evidence' | 'Hypothetical pilot outcome' | 'Inconclusive';
  resolvedGapIds: string[]; pathwayChanged: boolean; implication: string;
  hypotheticalPatch?: Record<string, unknown>; projectedAssessment?: Record<string, unknown>;
  reassessmentRequired?: boolean;
}
export interface EvidenceCandidate {
  id: string; title: string; evidenceRole: 'Evidence collection' | 'Intervention that generates evidence';
  targetGaps: DecisionGap[]; eligible: boolean; blockedReasons: string[]; material: boolean;
  score: number; scoreLabel: string; valueComponents: { meanTargetGapReductions: number; scenarioPathwayChangeFraction: number; burden: number };
  outcomes: EvidenceOutcome[]; rationale: string; approvalRequired: boolean; executionImplemented?: false;
  outcomeDefinition?: { purpose: string; measures: string[]; interpretation: string; lifecycle: string };
}
export interface NextEvidenceResult {
  executionState: 'Assessed' | 'Not Assessed'; evidenceSnapshotId: string | null;
  gaps: DecisionGap[]; candidates: EvidenceCandidate[]; nextBestCandidateIds: string[];
  sufficiency?: { explanationSufficiency: ExplanationSufficiency; protectionContextSufficiency: ProtectionContextSufficiency };
  collectionTriggered: false; interventionSelected: false; aiImplemented: false;
  residentInputEligibleForLaterSelection: boolean; residentInputNote?: string;
  state?: string; nextStep?: string; method: string; caveat: string;
}
export interface NextEvidenceEnvelope { contractVersion: 'next-best-evidence.v1'; amenityId: string; result: NextEvidenceResult }
