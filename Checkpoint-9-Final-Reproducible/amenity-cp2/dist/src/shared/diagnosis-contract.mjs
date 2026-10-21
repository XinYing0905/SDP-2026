import { ChangeServiceError } from './change-contract.mjs';
export const DIAGNOSIS_CONTRACT_VERSION = 'competing-diagnosis.v2';
export const diagnosisPath = id => `/api/v1/amenities/${encodeURIComponent(id)}/competing-diagnosis`;
export function assertDiagnosisEnvelope(value) {
  if (value?.contractVersion !== DIAGNOSIS_CONTRACT_VERSION || !value.amenityId || !['Assessed', 'Not Assessed'].includes(value.result?.executionState)) throw new ChangeServiceError('INVALID_RESPONSE', 'Invalid competing-diagnosis response', 502);
  if (value.result.executionState === 'Assessed') {
    const suff = value.result.evidenceSufficiency;
    const states = ['Sufficient Evidence', 'Insufficient Evidence'];
    if (!suff || 'state' in suff || !states.includes(suff.explanationSufficiency?.state) || !states.includes(suff.protectionContextSufficiency?.state)) throw new ChangeServiceError('INVALID_RESPONSE', 'Separate explanation and protection sufficiency are required', 502);
  }
  return value;
}
