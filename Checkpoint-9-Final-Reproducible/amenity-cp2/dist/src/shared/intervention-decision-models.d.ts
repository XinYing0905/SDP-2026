export type InterventionCode='monitor'|'validate'|'repair'|'reprogramme'|'pilot'|'shared'|'preserve';
export type GateStatus='Pass'|'Fail'|'Unknown'|'Not applicable';
export type ActionReadiness='Ready'|'Stale / conflict review'|'Blocked by safeguard'|'Blocked by protection gap'|'Needs scope details'|'Insufficient action evidence';
export interface ActionGate{id:string;status:GateStatus;reason:string;type:string;evidenceRefs:string[];cp4GapId:string|null}
export interface ActionGap{actionRequirementId:string;reason:string;cp4GapId:string|null;evidencePlanningRequired:true}
export interface Reversibility{disruption:'none'|'limited'|'substantial'|'unknown';functionLoss:'none'|'temporary'|'partial'|'unknown';rollback:'immediate'|'simple'|'complex'|'unknown';evidenceRefs:string[]}
export interface OutcomeContractDraft{id:string;version:string;purpose:string;primaryMeasure:string;protectionMeasure:string;reviewWindow:{start:string;end:string};criteria:string}
export interface InterventionCandidate{id:InterventionCode;pathway:string;ladderPosition:number|null;actionReadiness:ActionReadiness;eligible:boolean;gates:ActionGate[];actionGaps:ActionGap[];interventionId:string|null;executionStarted:false;causalClaim:false}
export interface OperatorPlanDecision{choice:'approve'|'decline'|'defer';candidateId?:InterventionCode;expectedRevision:number;inputDigest:string;operatorId:string;rationale?:string}
export interface PlanDecisionRecord{choice:'approve'|'decline'|'defer';candidateId:InterventionCode|null;operatorId:string;rationale:string;at:string;inputDigest:string;candidateDigest:string|null;nonPreferredChoice:boolean;message:string;executionStarted:false;outcomeIngested:false;aiImplemented:false}
