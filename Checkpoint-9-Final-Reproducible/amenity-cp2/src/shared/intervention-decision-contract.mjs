export const INTERVENTION_DECISION_CONTRACT='intervention-decision.v1';
export class InterventionDecisionError extends Error{constructor(code,status=409){super(code);this.code=code;this.status=status;}}
export const assertDecision=(condition,code,status=409)=>{if(!condition)throw new InterventionDecisionError(code,status);};
export function assertDecisionRequest(b){
 assertDecision(b&&typeof b==='object','INVALID_REQUEST',400);
 const keys=['choice','candidateId','expectedRevision','inputDigest','operatorId','rationale'];
 assertDecision(Object.keys(b).every(k=>keys.includes(k)),'UNKNOWN_OR_FORBIDDEN_FIELD',400);
 assertDecision(['approve','decline','defer'].includes(b.choice),'INVALID_DECISION_CHOICE',400);
 assertDecision(Number.isInteger(b.expectedRevision)&&typeof b.inputDigest==='string','EXPECTED_VERSION_REQUIRED',400);
 assertDecision(typeof b.operatorId==='string'&&b.operatorId.trim().length>0&&b.operatorId.length<=256,'OPERATOR_REQUIRED',400);
 assertDecision(b.rationale===undefined||(typeof b.rationale==='string'&&b.rationale.length<=8000),'INVALID_RATIONALE',400);return b;
}
