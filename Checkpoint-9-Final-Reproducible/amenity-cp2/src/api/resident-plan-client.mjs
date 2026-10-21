import { residentPlanPath, assertResidentPlanEnvelope } from '../shared/resident-evidence-plan-contract.mjs';
import { ChangeServiceError } from '../shared/change-contract.mjs';
export function createResidentPlanClient({ upstreamClient, transport }) {
  return Object.freeze({ ...upstreamClient, async getResidentEvidencePlan(id) { return assertResidentPlanEnvelope(await transport.request({ method: 'GET', path: residentPlanPath(id) })); } });
}
export function createLocalResidentPlanTransport(service) {
  return Object.freeze({ async request({ method, path }) {
    if (method !== 'GET') throw new ChangeServiceError('METHOD_NOT_ALLOWED', 'Preview plans support read-only GET only', 405);
    const match = path.match(/^\/api\/v1\/amenities\/([^/]+)\/resident-evidence-plan$/);
    if (!match) throw new ChangeServiceError('ROUTE_NOT_FOUND', 'Unknown resident-plan route', 404);
    let id;
    try { id = decodeURIComponent(match[1]); } catch { throw new ChangeServiceError('INVALID_ID', 'Invalid amenity identifier', 400); }
    return service.getResidentEvidencePlan(id);
  } });
}
