import { interventionDecisionPolicy } from '../config/intervention-decision.mjs';
// Explicit categorical relations, never a numeric score or weighted ranking.
function relation(value,other,order){if(value===other&&order.includes(value))return'equal';const betterThan=order.flatMap((v,i)=>order.slice(i+1).map(w=>[v,w]));return betterThan.some(([v,w])=>value===v&&other===w)?'better':betterThan.some(([v,w])=>value===w&&other===v)?'worse':'unknown';}
export function compareReversibleCandidates(candidates,input) {
 const ready=candidates.filter(c=>c.eligible),comparisons=[];
 const dominates=(a,b)=>{
  if(!a.scope?.purposeId||a.scope.purposeId!==b.scope?.purposeId||!a.scope.purpose||a.scope.purpose!==b.scope.purpose)return false;
  const ar=a.scope.reversibility,br=b.scope.reversibility;
  if(!ar?.evidenceRefs?.length||!br?.evidenceRefs?.length)return false;
  const evidenced=c=>c.scope.reversibility.evidenceRefs.some(ref=>(input?.actionEvidence??[]).some(r=>r.sourceId===ref&&r.scopeId===c.scope.id&&r.scopeVersion===c.scope.version&&r.field==='reversibilityProfile'&&Date.parse(r.availableAt)<=Date.parse(input.asOf)&&['disruption','functionLoss','rollback'].every(k=>r.value?.[k]===c.scope.reversibility[k])));
  if(!evidenced(a)||!evidenced(b))return false;
  const r=Object.fromEntries(Object.entries(interventionDecisionPolicy.qualitativeOrders).map(([k,order])=>[k,relation(ar[k],br[k],order)]));
  return Object.values(r).every(v=>v==='equal'||v==='better')&&(r.disruption==='better'||r.functionLoss==='better')&&r.rollback==='better';
 };
 for(const a of ready)for(const b of ready)if(a.id!==b.id&&dominates(a,b))comparisons.push({preferred:a.id,over:b.id,purposeId:a.scope.purposeId,label:'Preferred lower-impact pathway',reason:'Same stated purpose; documented lower avoidable disruption/function loss and easier credible rollback. This is not predicted success.',evidenceRefs:[...a.scope.reversibility.evidenceRefs,...b.scope.reversibility.evidenceRefs]});
 const preferredIds=[...new Set(comparisons.map(c=>c.preferred))].filter(id=>!comparisons.some(c=>c.over===id));
 const maximal=ready.filter(c=>!comparisons.some(r=>r.over===c.id));
 return {state:!ready.length?'No supported pathway identified':maximal.length>1?'Multiple supported pathways — operator choice required':preferredIds.length?'Preferred lower-impact pathway':'Supported pathway for review',preferredIds,supportedIds:ready.map(c=>c.id),comparisons,method:'Non-numeric, evidence-constrained partial order; no ladder/support/population/ownership tie break'};
}
