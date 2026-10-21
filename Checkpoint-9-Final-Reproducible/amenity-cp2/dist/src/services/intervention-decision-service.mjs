import { randomUUID } from 'node:crypto';
import { digest, clone } from '../cp6/contract.mjs';
import { assertDecision, assertDecisionRequest } from '../shared/intervention-decision-contract.mjs';
import { proposeInterventionDecision } from '../intervention/decision-proposal.mjs';
const APPROVAL_MESSAGE='Plan approval recorded. Execution has not started.';
export function createInterventionDecisionService({repository,fixtures,clock=()=>new Date().toISOString(),clockBasis='system'}){
 const current=key=>{const input=fixtures.get(key);assertDecision(input,'UNKNOWN_CASE',404);return input;};
 const view=s=>{
  const f=current(s.fixtureKey),same=digest(f)===s.inputDigest&&digest(proposeInterventionDecision(f))===digest(s.proposal);
  const replacement=repository.list().find(r=>r.supersedes===s.id);
  return {...clone(s),supersededBy:replacement?.id??null,currentValidity:replacement?'Superseded / review required':same&&!f.stale&&!f.conflictingInput?'Current':'Stale / conflict review',approvalAppliesToCurrentInput:!replacement&&!!s.decision&&s.decision.choice==='approve'&&same&&!f.stale&&!f.conflictingInput};
 };
 return Object.freeze({
  cases:()=>[...fixtures].map(([key,f])=>({key,title:f.title,amenityName:f.amenityName,case:f.case,proposal:proposeInterventionDecision(f)})),
  list:()=>repository.list().map(view),get:id=>view(repository.get(id)),history:id=>({events:repository.events(id),revisions:repository.history(id)}),
  prepare({fixtureKey,supersedes=null,...rest}){
   assertDecision(!Object.keys(rest).length,'UNKNOWN_OR_FORBIDDEN_FIELD',400);
   const input=clone(current(fixtureKey));if(supersedes){assertDecision(repository.get(supersedes).fixtureKey===fixtureKey,'SUPERSESSION_CASE_MISMATCH');assertDecision(!repository.list().some(r=>r.supersedes===supersedes),'ALREADY_SUPERSEDED');}
   const at=clock(),state={id:randomUUID(),revision:0,fixtureKey,contractVersion:'intervention-decision.v1',createdAt:at,clockBasis,inputSnapshot:input,inputDigest:digest(input),proposal:proposeInterventionDecision(input),decision:null,supersedes,executionStarted:false,outcomeIngested:false,aiImplemented:false};
   repository.create(state,{kind:'PROPOSAL_PREPARED',at,inputDigest:state.inputDigest,analysisSnapshotId:input.assessment.evidenceSnapshotId,policyVersion:state.proposal.policyVersion,supersedes});return view(state);
  },
  record(id,request){assertDecisionRequest(request);const at=clock();return repository.transact(id,request.expectedRevision,s=>{
   assertDecision(!s.decision,'DECISION_ALREADY_RECORDED');
   const f=current(s.fixtureKey),same=digest(f)===s.inputDigest;
   assertDecision(request.inputDigest===s.inputDigest,'INPUT_VERSION_MISMATCH');
   // Decline/defer may record a hold; neither authorises a blocked or stale action.
   let selected=null,nonPreferred=false;
   if(request.choice==='approve'){
    assertDecision(!repository.list().some(r=>r.supersedes===s.id),'SUPERSEDED_PROPOSAL');
    assertDecision(same&&!f.stale&&!f.conflictingInput,'STALE_OR_CONFLICTING_INPUT');
    const now=proposeInterventionDecision(f);assertDecision(digest(now)===digest(s.proposal),'PROPOSAL_CHANGED');
    selected=now.candidates.find(c=>c.id===request.candidateId);assertDecision(selected?.eligible&&selected.actionReadiness==='Ready','CANDIDATE_NOT_READY');
    assertDecision(!f.requestedPermanentChange,'PERMANENT_SCOPE_FORBIDDEN');
    nonPreferred=now.comparison.preferredIds.length>0&&!now.comparison.preferredIds.includes(selected.id);
    assertDecision(!nonPreferred||Boolean(request.rationale?.trim()),'NON_PREFERRED_RATIONALE_REQUIRED',400);
   }else if(request.candidateId){selected=s.proposal.candidates.find(c=>c.id===request.candidateId);assertDecision(selected,'UNKNOWN_CANDIDATE',400);}
   s.decision={id:randomUUID(),choice:request.choice,candidateId:selected?.id??null,operatorId:request.operatorId.trim(),rationale:request.rationale?.trim()??'',at,clockBasis,inputDigest:s.inputDigest,candidateDigest:selected?digest(selected):null,
    approvedScope:request.choice==='approve'?clone(selected.scope):null,interventionId:request.choice==='approve'?selected.interventionId:null,
    nonPreferredChoice:nonPreferred,knownStaleAtDecision:!same||!!f.stale||!!f.conflictingInput,
    message:request.choice==='approve'?APPROVAL_MESSAGE:request.choice==='decline'?'Plan declined. Execution has not started.':'Plan deferred. Execution has not started.',
    executionStarted:false,outcomeIngested:false,aiImplemented:false};
   return {events:[{kind:'OPERATOR_PLAN_DECISION',at,decision:clone(s.decision),evaluatedAlternatives:clone(s.proposal.comparison)}],value:{decision:clone(s.decision),revision:s.revision+1}};
  })}
 });
}
