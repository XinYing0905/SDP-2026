import { digest, clone } from '../cp6/contract.mjs';
import { outcomeReviewPolicy } from '../config/outcome-review.mjs';
export { digest, clone };
export const OUTCOME_VERSION='outcome-review.v1';
export const RULE_VERSION=outcomeReviewPolicy.version;
export class OutcomeError extends Error{constructor(code,status=409){super(code);this.code=code;this.status=status;}}
export function guard(ok,code,status=409){if(!ok)throw new OutcomeError(code,status);}
export function fields(body,allowed){guard(body&&typeof body==='object'&&!Array.isArray(body),'INVALID_BODY',400);guard(Object.keys(body).every(k=>allowed.includes(k)),'UNKNOWN_OR_FORBIDDEN_FIELD',400);}
export const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export const isoDay=x=>x.slice(0,10);
export const eligibleAt=(x,asOf)=>validTime(x.availableAt)&&validTime(x.receivedAt)&&Date.parse(x.availableAt)<=Date.parse(asOf)&&Date.parse(x.receivedAt)<=Date.parse(asOf)&&(!x.recordedAt||validTime(x.recordedAt)&&Date.parse(x.recordedAt)<=Date.parse(asOf));
