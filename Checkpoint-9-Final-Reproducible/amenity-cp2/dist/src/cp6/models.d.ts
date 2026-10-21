/** CP6 DTOs. Earlier checkpoint contracts are unchanged. */
export type SubmittedSemanticState = 'SUBSTANTIVE' | 'UNABLE_TO_ASSESS' | 'VOLUNTARY_SKIP';
export type MissingResponseState = 'NO_RESPONSE'; // derived only after closure, never submitted
export interface ResponseRequest {
  optionId: string; idempotencyKey: string; questionVersion: string; cohortVersion: string;
  planDigest: string; submittedAt?: string;
}
export interface ResidentResponse {
  id: string; collectionId: string; recipientRef: string; optionId: string;
  semanticState: SubmittedSemanticState; questionId: string; questionVersion: string;
  cohortId: string; cohortVersion: string; planDigest: string; analysisSnapshotId: string;
  idempotencyKey: string; submittedAt: string; receivedAt: string;
  validation: { state: 'Accepted'; validatorVersion: string; rosterDigest: string; eligibleAtReceipt: true; validatedAt: string };
}
export interface ResponseAggregation {
  id: string; version: number; collectionId: string; window: {start:string;end:string};
  intendedRosterSize: number; knownEligibleCohortSize: number; issued: number;
  substantive: number; unableToAssess: number; voluntarySkip: number; noResponse: number;
  substantiveCoverage: number|null; submissionCompleteness: number|null; rosterReach:number|null;
  membershipValidationCoverage:number|null; optionCounts:Record<string,number>;
  optionShares:Record<string,number|null>; qualified:boolean; reasons:string[]; state:string;
  responseIds:string[]; responseDigest:string; rosterDigest:string; policyVersion:string;
  createdAt:string; availableAt:string; limitations:string[]; invalidAttempts:number;
}
export interface ResponseReceipt { accepted:boolean; responseId?:string; receivedAt?:string; semanticState?:SubmittedSemanticState; idempotent?:boolean; code?:string }
export interface FeedbackProjection { sourceId:string; availableAt:string; relevantToProgramme:true; responses:number; mismatchResponses:number }
export interface EvidenceConversion { state:string; assertion:Record<string,unknown>|null; projection:FeedbackProjection|null; reasons:string[] }
export interface CollectionOperation { expectedRevision:number }
export interface CollectionOpenRequest {fixtureKey:string;operatorApproved:true;intendedRoster?:{recipientRef:string;cohortId:string;cohortVersion:string;eligible:boolean}[]}
