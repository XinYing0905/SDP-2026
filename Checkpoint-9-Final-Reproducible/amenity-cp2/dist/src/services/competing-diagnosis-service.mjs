import { DIAGNOSIS_CONTRACT_VERSION } from '../shared/diagnosis-contract.mjs';
import { ChangeServiceError, wireClone } from '../shared/change-contract.mjs';
export function createCompetingDiagnosisService({ amenityRepository, diagnosisRepository, detectChange, changeParameters, diagnoseCompeting, diagnosisParameters }) {
  return Object.freeze({
    async getCompetingDiagnosis(id) {
      const amenity = await amenityRepository.getById(id);
      if (!amenity) throw new ChangeServiceError('AMENITY_NOT_FOUND', 'Amenity not found', 404);
      const record = await diagnosisRepository.getByAmenityId(id);
      // No evidence record does not imply healthy operations, stable cohorts or no dependency.
      const evidence = record?.evidence ?? { asOf: amenity.analysisPeriodStart, decisionHorizon: 'long-term', snapshotId: null };
      const result = diagnoseCompeting({ changeResult: detectChange(amenity, changeParameters), evidence }, diagnosisParameters);
      return wireClone({ contractVersion: DIAGNOSIS_CONTRACT_VERSION, amenityId: id, dataProvenance: 'Simulated diagnosis evidence', result });
    }
  });
}
