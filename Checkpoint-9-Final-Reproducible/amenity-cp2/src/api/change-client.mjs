import { OVERVIEW_PATH, evidencePath, assertChangeEnvelope } from '../shared/change-contract.mjs';
import { diagnosisPath, assertDiagnosisEnvelope } from '../shared/diagnosis-contract.mjs';
import { nextEvidencePath, assertNextEvidenceEnvelope } from '../shared/next-evidence-contract.mjs';

/** @returns {import('../shared/change-models').ChangeClient} */
export function createChangeClient(transport) {
  return Object.freeze({
    async getOverview() { return assertChangeEnvelope(await transport.request({ method: 'GET', path: OVERVIEW_PATH }), 'overview'); },
    async getChangeEvidence(id) { return assertChangeEnvelope(await transport.request({ method: 'GET', path: evidencePath(id) }), 'evidence'); },
    async getCompetingDiagnosis(id) { return assertDiagnosisEnvelope(await transport.request({ method: 'GET', path: diagnosisPath(id) })); },
    async getNextBestEvidence(id) { return assertNextEvidenceEnvelope(await transport.request({ method: 'GET', path: nextEvidencePath(id) })); }
  });
}
