export const CONTRACT_VERSION = 'change-detection.v1';
export const OVERVIEW_PATH = '/api/v1/amenities/change-overview';
export const evidencePath = id => `/api/v1/amenities/${encodeURIComponent(id)}/change-evidence`;

export class ChangeServiceError extends Error {
  constructor(code, message, status) { super(message); this.name = 'ChangeServiceError'; this.code = code; this.status = status; }
}

// JSON serialization is the same boundary used by the future HTTP transport.
export const wireClone = value => JSON.parse(JSON.stringify(value));
export function assertChangeEnvelope(payload, kind) {
  if (payload?.contractVersion !== CONTRACT_VERSION || payload.kind !== kind || !payload.parameters || !payload.metricDefinitions || typeof payload.simulationNotice !== 'string') throw new ChangeServiceError('INVALID_RESPONSE', 'Unsupported or malformed change-evidence response', 502);
  const entries = kind === 'overview' ? payload.entries : [payload.entry];
  if (!Array.isArray(entries) || entries.some(entry => !entry?.input?.id || !['Stable', 'Monitoring', 'Needs Attention'].includes(entry.result?.status) || !Array.isArray(entry.result?.metrics))) throw new ChangeServiceError('INVALID_RESPONSE', 'Missing change-evidence records', 502);
  return payload;
}
