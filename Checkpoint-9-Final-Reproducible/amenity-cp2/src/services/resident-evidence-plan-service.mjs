import { RESIDENT_PLAN_CONTRACT_VERSION, assertResidentPlanEnvelope } from '../shared/resident-evidence-plan-contract.mjs';
import { assertDiagnosisEnvelope } from '../shared/diagnosis-contract.mjs';
import { assertNextEvidenceEnvelope } from '../shared/next-evidence-contract.mjs';
import { wireClone, ChangeServiceError } from '../shared/change-contract.mjs';
import { selectQuestionCohort } from '../resident-evidence/pair-selection.mjs';
export function createResidentEvidencePlanService({ upstreamClient, planningRepository }) {
  return Object.freeze({ async getResidentEvidencePlan(id) {
    const [diagnosisEnvelope, nextEvidenceEnvelope, record] = await Promise.all([upstreamClient.getCompetingDiagnosis(id), upstreamClient.getNextBestEvidence(id), planningRepository.getByAmenityId(id)]);
    assertDiagnosisEnvelope(diagnosisEnvelope); assertNextEvidenceEnvelope(nextEvidenceEnvelope);
    if (!record) throw new ChangeServiceError('PLAN_CONTEXT_UNAVAILABLE', 'No prepared cohort/planning context is available; no fallback source is inferred.', 404);
    const result = selectQuestionCohort({ ...record, amenityId: id, diagnosisEnvelope, nextEvidenceEnvelope });
    return assertResidentPlanEnvelope(wireClone({ contractVersion: RESIDENT_PLAN_CONTRACT_VERSION, amenityId: id, result }));
  } });
}
