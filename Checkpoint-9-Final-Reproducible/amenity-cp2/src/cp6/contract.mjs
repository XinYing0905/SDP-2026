import { createHash } from 'node:crypto';
import { canonicalContent } from '../resident-evidence/snapshot-binding.mjs';
export const RESPONSE_CONTRACT = 'resident-response-evidence.v1';
export const digest = x => createHash('sha256').update(canonicalContent(x)).digest('hex');
export const clone = x => structuredClone(x);
export class ResponseError extends Error { constructor(code, message=code, status=409) { super(message); this.code=code; this.status=status; } }
export const requireThat = (ok, code, status=409) => { if(!ok) throw new ResponseError(code, code, status); };
export function assertResponseRequest(body) {
  requireThat(body && typeof body === 'object', 'INVALID_REQUEST',400);
  for(const k of ['optionId','idempotencyKey','questionVersion','cohortVersion','planDigest']) requireThat(typeof body[k]==='string' && body[k].length>0 && body[k].length<=256,`INVALID_${k}`,400);
  return body;
}
export function publicCollection(c) {
  const {fixture,recipients,receipts,...view}=clone(c);
  return {...view, baselineAssessment:fixture.before, changeEvidence:fixture.changeResult, recipients:recipients.map(({accessDigest,...r})=>r)};
}
