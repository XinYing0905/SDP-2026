import { DatabaseSync } from 'node:sqlite';
import { guard,digest,clone } from '../../shared/outcome-review-contract.mjs';
// Read-only connection. CP8 cannot write approval, execute activity, or alter CP7 history.
export function createApprovedPlanProvider(filename){
 const db=new DatabaseSync(filename,{readOnly:true});
 function adapt(state){
  const decision=state.decision;guard(decision?.choice==='approve','SAVED_APPROVAL_REQUIRED');
  const candidate=state.proposal.candidates.find(c=>c.id===decision.candidateId);
  guard(candidate&&decision.candidateDigest===digest(candidate),'APPROVED_CANDIDATE_TAMPERED');
  guard(digest(candidate.scope)===digest(decision.approvedScope),'APPROVED_SCOPE_TAMPERED');
  const revision=db.prepare('SELECT body FROM history WHERE collection_id=? ORDER BY revision').all(state.id).map(r=>JSON.parse(r.body)).find(r=>r.decision?.id===decision.id);
  guard(revision,'APPROVAL_HISTORY_REQUIRED');
  guard(digest(revision.decision)===digest(decision)&&digest(revision.proposal)===digest(state.proposal)&&digest(state.inputSnapshot)===state.inputDigest&&digest(state.inputSnapshot)===digest(revision.inputSnapshot)&&!decision.knownStaleAtDecision,'APPROVAL_HISTORY_MISMATCH');
  const superseding=db.prepare('SELECT body FROM collections').all().map(r=>JSON.parse(r.body)).filter(r=>r.supersedes===state.id);
  return {planId:state.id,decisionId:decision.id,approvedVersion:revision.revision,approvedAt:decision.at,pathway: candidate.pathway,candidateId:candidate.id,
   candidateDigest:decision.candidateDigest,scopeDigest:digest(candidate.scope),contractDigest:digest(candidate.scope.outcomeContract),scope:clone(candidate.scope),
   interventionId:decision.interventionId??candidate.scope.interventionId,amenityName:state.inputSnapshot.amenityName,
   originalInput:clone(state.inputSnapshot),superseding:superseding.map(r=>({id:r.id,at:r.createdAt})),provider:'Read-only saved CP7 decision',approvalPayloadDigest:digest(decision)};
 }
 return{get(id){const row=db.prepare('SELECT body FROM collections WHERE id=?').get(id);guard(row,'APPROVED_PLAN_NOT_FOUND',404);return adapt(JSON.parse(row.body));},
 list(){return db.prepare('SELECT body FROM collections').all().map(r=>JSON.parse(r.body)).filter(s=>s.decision?.choice==='approve').map(adapt);},close:()=>db.close()};
}
