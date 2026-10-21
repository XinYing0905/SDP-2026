import { ChangeServiceError } from '../shared/change-contract.mjs';

// Future backend adapter. No endpoint is deployed and no Python capability is assumed.
export function createHttpChangeTransport({ baseUrl = '', fetchImpl = globalThis.fetch } = {}) {
  return Object.freeze({
    async request({ method, path }) {
      let response;
      try { response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, { method, headers: { Accept: 'application/json' } }); }
      catch { throw new ChangeServiceError('TRANSPORT_UNAVAILABLE', 'Change service is unavailable', 503); }
      if (!response.ok) throw new ChangeServiceError(`HTTP_${response.status}`, 'Change service request failed', response.status);
      try { return await response.json(); }
      catch { throw new ChangeServiceError('INVALID_RESPONSE', 'Change service returned invalid JSON', 502); }
    }
  });
}
