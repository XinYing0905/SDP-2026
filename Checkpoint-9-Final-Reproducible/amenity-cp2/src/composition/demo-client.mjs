// Composition root only: the UI does not own fixtures, thresholds or detection.
import { fixtures, simulationNotice } from '../data/synthetic/amenities.mjs';
import { createSyntheticAmenityRepository } from '../data/repositories/synthetic-amenity-repository.mjs';
import { detectChange } from '../statistics/change-detection/detector.mjs';
import { parameters, metricDefinitions } from '../config/change-detection.mjs';
import { createChangeEvidenceService } from '../services/change-evidence-service.mjs';
import { createLocalChangeTransport } from '../api/local-change-transport.mjs';
import { createChangeClient } from '../api/change-client.mjs';
import { diagnosisCases } from '../data/synthetic/diagnosis-cases.mjs';
import { createDiagnosisRepository, withInvestigationRecords } from '../data/repositories/diagnosis-repository.mjs';
import { createCompetingDiagnosisService } from '../services/competing-diagnosis-service.mjs';
import { diagnoseCompeting } from '../diagnosis/competing-diagnosis.mjs';
import { diagnosisParameters } from '../config/diagnosis.mjs';
import { nextEvidenceCases } from '../data/synthetic/next-evidence-cases.mjs';
import { createNextEvidenceService } from '../services/next-evidence-service.mjs';
import { identifyNextBestEvidence } from '../next-evidence/next-best-evidence.mjs';
import { nextEvidenceParameters } from '../config/next-best-evidence.mjs';

export function createDemoChangeClient() {
  const diagnosisRepository = createDiagnosisRepository([...diagnosisCases, ...nextEvidenceCases]);
  const repository = withInvestigationRecords(createSyntheticAmenityRepository(fixtures), diagnosisRepository);
  const service = createChangeEvidenceService({ repository, detectChange, parameters, metricDefinitions, simulationNotice });
  const diagnosisService = createCompetingDiagnosisService({ amenityRepository: repository, diagnosisRepository, detectChange, changeParameters: parameters, diagnoseCompeting, diagnosisParameters });
  const nextEvidenceService = createNextEvidenceService({ amenityRepository: repository, diagnosisRepository, detectChange, changeParameters: parameters, identifyNextBestEvidence, nextEvidenceParameters, diagnosisParameters });
  return createChangeClient(createLocalChangeTransport(service, diagnosisService, nextEvidenceService));
}
