import { ChangeServiceError } from './change-contract.mjs';
export const NEXT_EVIDENCE_CONTRACT_VERSION = 'next-best-evidence.v1';
export const nextEvidencePath = id => `/api/v1/amenities/${encodeURIComponent(id)}/next-best-evidence`;
export function assertNextEvidenceEnvelope(value) {
  const r = value?.result;
  const fail = () => { throw new ChangeServiceError('INVALID_RESPONSE', 'Invalid next-best-evidence response; explicit gaps and separate sufficiency dimensions are required', 502); };
  if (value?.contractVersion !== NEXT_EVIDENCE_CONTRACT_VERSION || !value.amenityId || !['Assessed', 'Not Assessed'].includes(r?.executionState) || !Array.isArray(r.gaps) || !Array.isArray(r.candidates) || !Array.isArray(r.nextBestCandidateIds)) fail();
  if (r.executionState === 'Assessed') {
    const states = ['Sufficient Evidence', 'Insufficient Evidence'];
    if (!states.includes(r.sufficiency?.explanationSufficiency?.state) || !states.includes(r.sufficiency?.protectionContextSufficiency?.state) || 'state' in r.sufficiency || 'confidence' in r) fail();
    const gapIds = new Set(r.gaps.map(g => g.id));
    for (const c of r.candidates) {
      if (!Number.isFinite(c.score) || c.score < 0 || !Array.isArray(c.targetGaps) || !Array.isArray(c.outcomes) || c.targetGaps.some(g => !gapIds.has(g.id))) fail();
      if (c.eligible && (!c.material || !c.targetGaps.length || c.score <= 0)) fail();
    }
    if (r.nextBestCandidateIds.some(id => !r.candidates.some(c => c.id === id && c.eligible))) fail();
  }
  if (r.collectionTriggered !== false || r.interventionSelected !== false) fail();
  return value;
}
