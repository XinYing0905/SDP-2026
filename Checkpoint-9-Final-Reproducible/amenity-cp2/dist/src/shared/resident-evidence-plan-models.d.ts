import type { DiagnosisEnvelope } from './diagnosis-models';
import type { NextEvidenceEnvelope, DecisionGap } from './next-evidence-models';
export type PlanState = 'Draft pair selected' | 'Not eligible' | 'No valid pair' | 'Pair tie' | 'Stale input';
export interface PlanSource { sourceId: string; version: string; availableAt: string }
export interface PlanningCohort {
  id: string; version: string; membershipDefinition: string; residenceDuration: string;
  source: PlanSource | null; exposureSource: PlanSource | null; planningCoverageSource: PlanSource | null;
  comparativeImpactSource?: PlanSource | null; currentResidencyDocumented: boolean | null;
  documentedCurrentUse: boolean | null; programmeFamiliarity: boolean | null;
  knownRelevantMembers: number | null; observedPeriods: number | null; retainedFraction: number | null;
  referencePeriod: { start: string; end: string } | null; occupancyStatus?: string;
}
export interface CohortSnapshot { amenityId: string; evidenceSnapshotId: string; version: string; asOf: string; source: PlanSource; cohorts: PlanningCohort[]; unrepresentedGroups?: string[] }
export interface OptionPlanningAssertion {
  questionId: string; questionVersion: string; optionId: string; optionLabel: string; assertionId: string; assertion: string;
  requiredAssumptionsAndCorroboration: string[]; targetGapId: string; cannotEstablish: string[];
  potentialGapReductionIds: string[]; fullyResolvedGapIds: []; pathwayChanged: false;
  hypothetical: true; collectedEvidence: false; productionConversion: false; corroborationLimits: string[];
}
export interface PlanPair {
  id: string; questionId: string; questionVersion: string; cohortId: string; cohortVersion: string;
  targetGapId: string; dimension: string; eligible: boolean; reasons: string[]; material: boolean; score: number;
  wording: string; options: { id: string; label: string }[];
  nonSubstantive: { id: 'UNABLE_TO_ASSESS' | 'VOLUNTARY_SKIP'; label: string; credit: 0 }[];
  optionPlanningAssertions: OptionPlanningAssertion[]; rationale: string;
}
export interface ResidentPlanEnvelope {
  contractVersion: 'resident-evidence-plan.v1'; amenityId: string;
  result: { state: PlanState; sourceWinnerId: string | null; upstreamSourcePriority: string[];
    sufficiency: NextEvidenceEnvelope['result']['sufficiency'] | null; upstreamGaps: DecisionGap[]; remainingGaps: DecisionGap[];
    pairs: PlanPair[]; selectedPair: PlanPair | null; tiedPairIds: string[]; reasons: string[];
    dispatchTriggered: false; responsesCollected: false; responseWrites: false; evidenceWrites: false; reassessmentTriggered: false;
  };
}
export interface ResidentPlanInput {
  amenityId: string; amenityName: string; currentFunction: string; analysisAsOf: string;
  diagnosisEnvelope: DiagnosisEnvelope; nextEvidenceEnvelope: NextEvidenceEnvelope; cohortSnapshot: CohortSnapshot; expectedBinding: string;
}
export type ResidentPlanClient = import('./change-models').ChangeClient & { getResidentEvidencePlan(id: string): Promise<ResidentPlanEnvelope> };
