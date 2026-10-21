import { digest } from './contract.mjs';
export function aggregateResponses(c,policy,at) {
  const responses=c.responses, I=c.recipients.length;
  const count=state=>responses.filter(r=>r.semanticState===state).length;
  const S=count('SUBSTANTIVE'),U=count('UNABLE_TO_ASSESS'),K=count('VOLUNTARY_SKIP'),N=I-S-U-K;
  const optionCounts=Object.fromEntries([...c.pair.options,...c.pair.nonSubstantive].map(o=>[o.id,responses.filter(r=>r.optionId===o.id).length]));
  const coverage=I?S/I:null,reach=c.intendedRosterSize?I/c.intendedRosterSize:null;
  const membershipCoverage=I?c.recipients.filter(r=>r.currentEligible&&r.cohortVersion===c.pair.cohortVersion).length/I:null;
  const qualified=I>0&&S>=policy.minimumSubstantiveResponses&&coverage>=policy.minimumSubstantiveCoverage&&reach>=policy.minimumRosterReach&&membershipCoverage>=policy.minimumMembershipValidationCoverage;
  const reasons=[];
  if(!I)reasons.push('Unknown or empty intended issued denominator');
  if(S<policy.minimumSubstantiveResponses)reasons.push('Too few substantive responses');
  if(coverage===null||coverage<policy.minimumSubstantiveCoverage)reasons.push('Insufficient substantive coverage');
  if(membershipCoverage!==1)reasons.push('Membership validation incomplete');
  if(reach!==1)reasons.push('Frozen intended roster not fully issued');
  return {id:`${c.id}:aggregation-1`,version:1,collectionId:c.id,window:{start:c.openedAt,end:at},createdAt:at,availableAt:at,
    intendedRosterSize:c.intendedRosterSize,knownEligibleCohortSize:c.pair.cohort.knownRelevantMembers,issued:I,substantive:S,unableToAssess:U,voluntarySkip:K,noResponse:N,
    substantiveCoverage:coverage,submissionCompleteness:I?(S+U+K)/I:null,rosterReach:reach,membershipValidationCoverage:membershipCoverage,
    optionCounts,optionShares:Object.fromEntries(c.pair.options.map(o=>[o.id,S?optionCounts[o.id]/S:null])),
    invalidAttempts:c.attempts.filter(x=>!x.accepted).length,qualified,reasons,state:qualified?'Qualified bounded evidence':S?'Insufficient coverage':'No substantive evidence',
    responseIds:responses.map(r=>r.id),responseDigest:digest(responses),rosterDigest:c.rosterDigest,policyVersion:policy.version,
    limitations:['Simulated collection; coverage is not a representativeness guarantee.','Selected-cohort reports only; no causal inference.','Unable, voluntary skip and no response contribute zero substantive evidence.']};
}
