import { OVERVIEW_PATH, ChangeServiceError } from '../shared/change-contract.mjs';

// In-process stand-in for the documented HTTP endpoints. Not a running backend.
export function createLocalChangeTransport(service, diagnosisService = null, nextEvidenceService = null) {
  return Object.freeze({
    async request({ method, path }) {
      if (method !== 'GET') throw new ChangeServiceError('METHOD_NOT_ALLOWED', 'Only read-only GET is supported', 405);
      if (path === OVERVIEW_PATH) return service.getOverview();
      const nextMatch = path.match(/^\/api\/v1\/amenities\/([^/]+)\/next-best-evidence$/);
      if (nextMatch && nextEvidenceService) {
        let id;
        try { id = decodeURIComponent(nextMatch[1]); } catch { throw new ChangeServiceError('INVALID_ID', 'Invalid amenity identifier', 400); }
        return nextEvidenceService.getNextBestEvidence(id);
      }
      const diagnosisMatch = path.match(/^\/api\/v1\/amenities\/([^/]+)\/competing-diagnosis$/);
      if (diagnosisMatch && diagnosisService) {
        let id;
        try { id = decodeURIComponent(diagnosisMatch[1]); } catch { throw new ChangeServiceError('INVALID_ID', 'Invalid amenity identifier', 400); }
        return diagnosisService.getCompetingDiagnosis(id);
      }
      const match = path.match(/^\/api\/v1\/amenities\/([^/]+)\/change-evidence$/);
      if (!match) throw new ChangeServiceError('ROUTE_NOT_FOUND', 'Unknown service route', 404);
      let id;
      try { id = decodeURIComponent(match[1]); } catch { throw new ChangeServiceError('INVALID_ID', 'Invalid amenity identifier', 400); }
      return service.getChangeEvidence(id);
    }
  });
}
