import { eligibleAt,digest } from '../shared/outcome-review-contract.mjs';
export function executionFinding(records,plan,asOf){
 const available=records.filter(x=>eligibleAt(x,asOf)),removed=new Set(available.filter(x=>x.correction).map(x=>x.correction.replacesId)),active=available.filter(x=>!removed.has(x.id));
 const base={recordRefs:active.map(x=>x.id),attributionAllowed:false};
 if(!active.length)return{...base,state:'Not established',reason:'Approval does not establish execution.'};
 if(new Set(active.map(x=>digest({state:x.reportedState,start:x.actualStart,end:x.actualEnd,scope:x.executedScope,deviations:x.deviations}))).size>1)return{...base,state:'Stale/conflicting execution evidence',reason:'Independent accounts disagree; no latest-wins.'};
 const x=active[0];
 if(x.reportedState==='Not executed')return{...base,state:'Not executed',reason:'Explicit non-execution recorded.'};
 if(x.reportedState==='Unable to establish'||x.verification?.reviewed!==true||!x.verification?.evidenceRefs?.length)return{...base,state:'Not established',reason:'Execution corroboration is unknown.'};
 const approvalValid=Date.parse(x.actualStart)>=Date.parse(plan.approvedAt)&&!plan.superseding.some(s=>Date.parse(s.at)<=Date.parse(x.actualStart));
 const outsideBounds=Date.parse(x.actualStart)<Date.parse(plan.scope.startBoundary)||x.actualEnd&&Date.parse(x.actualEnd)>Date.parse(plan.scope.endBoundary+'T23:59:59.999Z');
 const material=outsideBounds||x.deviations.some(d=>d.material!==false||!d.reviewReason||!d.evidenceRefs?.length);
 if(!approvalValid||x.scopeDigest!==plan.scopeDigest||digest(x.executedScope)!==digest(plan.scope)||material)return{...base,state:'Materially deviated',reason:'Approved scope, authority or material mechanism/cohort/access/window requirement differs.'};
 if(['Partial','In progress'].includes(x.reportedState))return{...base,state:'Partial / in progress',reason:'Final approved-scope execution not yet established.'};
 if(x.reportedState!=='Completed'||!x.actualEnd||Date.parse(x.actualEnd)>Date.parse(asOf))return{...base,state:'Not established',reason:'Completed execution is not established at this review time.'};
 return{...base,state:x.deviations.length?'Established with non-material deviations':'Established as specified',attributionAllowed:true,reason:'Source-backed actual execution compared with the exact approved scope.'};
}
