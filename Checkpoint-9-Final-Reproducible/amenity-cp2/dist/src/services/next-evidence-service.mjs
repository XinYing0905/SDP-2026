import { NEXT_EVIDENCE_CONTRACT_VERSION } from '../shared/next-evidence-contract.mjs';
import { ChangeServiceError, wireClone } from '../shared/change-contract.mjs';
export function createNextEvidenceService({ amenityRepository, diagnosisRepository, detectChange, changeParameters, identifyNextBestEvidence, nextEvidenceParameters, diagnosisParameters }) {
  return Object.freeze({
    async getNextBestEvidence(id) {
      const amenity = await amenityRepository.getById(id);
      if (!amenity) throw new ChangeServiceError('AMENITY_NOT_FOUND', 'Amenity not found', 404);
      const record = await diagnosisRepository.getByAmenityId(id);
      const evidence = record?.evidence ?? { asOf: amenity.analysisPeriodStart, decisionHorizon: 'long-term', snapshotId: null };
      return wireClone({ contractVersion: NEXT_EVIDENCE_CONTRACT_VERSION, amenityId: id,
        result: identifyNextBestEvidence({ changeResult: detectChange(amenity, changeParameters), evidence, decisionContext: record?.decisionContext ?? {} }, nextEvidenceParameters, diagnosisParameters) });
    }
  });
}
