import { digest,RULE_VERSION } from '../shared/outcome-review-contract.mjs';
import { activeObservations,qualifiedFor,observationConflict } from './observation-admission.mjs';
import { executionFinding } from './execution-finding.mjs';
const aggregate=rows=>!rows.length||rows.some(r=>r.state==='Insufficient outcome evidence')?'Insufficient outcome evidence':rows.some(r=>r.state==='Stale/conflicting outcome evidence')?'Stale/conflicting outcome evidence':rows.every(r=>r.state==='Met')?'Met':rows.every(r=>r.state==='Not met')?'Not met':'Mixed';
export function evaluateOutcome({plan,binding,executions,observations,asOf}){
 const execution=executionFinding(executions,plan,asOf),active=activeObservations(observations,asOf);
 const stale=binding.ruleVersion!==RULE_VERSION||binding.contractDigest!==digest(plan.scope.outcomeContract)||binding.scopeDigest!==plan.scopeDigest;
 const rows=binding.criteria.map(c=>{
  const records=active.filter(o=>o.metric===c.metric&&o.referenceFrame==='post-intervention'),checks=records.map(o=>({id:o.id,...qualifiedFor(o,c,{asOf})}));
  let state='Insufficient outcome evidence';
  if(stale||observationConflict(records))state='Stale/conflicting outcome evidence';
  else if(records.length&&checks.every(x=>x.qualified)){
   const value=records[0].value,pass=c.op==='eq'?value===c.target:typeof value==='number'&&(c.op==='lte'?value<=c.target:value>=c.target);state=pass?'Met':'Not met';
  }
  return{criterionId:c.criterionId,key:c.key,dimension:c.dimension,metric:c.metric,required:c.target,op:c.op,state,observed:records.map(o=>({id:o.id,value:o.value})),qualification:checks,literal:c.literal};
 });
 const goalRows=rows.filter(x=>x.dimension==='goal'),evidenceRows=rows.filter(x=>x.dimension==='evidencePurpose'),protectionRows=rows.filter(x=>x.dimension==='protection');
 const safeguardRows=rows.filter(x=>x.dimension==='executionSafeguard');execution.stopRollbackCriteria=safeguardRows;
 if(execution.attributionAllowed&&safeguardRows.some(x=>x.state!=='Met')){execution.attributionAllowed=false;execution.state=safeguardRows.some(x=>x.state==='Not met')?'Materially deviated':'Not established';execution.reason='Declared stop/rollback compliance failed or is not sufficiently evidenced; no stop or rollback is executed by CP8.';}
 let goal=aggregate([...goalRows,...evidenceRows]);
 if(binding.ambiguities.length)goal='Insufficient outcome evidence';
 if(stale)goal='Stale/conflicting outcome evidence';
 if(!execution.attributionAllowed)goal=execution.state==='Materially deviated'?'Not evaluable due to execution deviation':`Not evaluable — ${execution.state.toLowerCase()}`;
 const breach=protectionRows.some(x=>x.state==='Not met')||binding.criteria.filter(c=>c.dimension==='protection').some(c=>active.some(o=>o.metric===c.metric&&o.value===false&&qualifiedFor(o,c,{asOf}).qualified)),protection=breach?'Protection breach':protectionRows.some(x=>x.state==='Stale/conflicting outcome evidence')?'Stale/conflicting protection evidence':protectionRows.length&&protectionRows.every(x=>x.state==='Met')&&!binding.ambiguities.length?'Maintained':'Insufficient protection observations';
 const benefit=aggregate(goalRows),useful=evidenceRows.length&&aggregate(evidenceRows)==='Met';
 const informative=execution.attributionAllowed&&['Met','Not met'].includes(benefit)&&['repair','reprogramme'].includes(plan.candidateId);
 const recoveryKnown=active.some(o=>o.metric==='usageRecovered'&&o.value===true&&o.source.type==='reviewed-comparable-series'&&o.qualification?.policyId===o.source.type&&o.qualification.reviewed===true&&o.qualification.completeForDeclaredMetric===true&&o.cohort===plan.scope.reviewCohort&&o.window.start===plan.scope.outcomeContract.reviewWindow.start&&o.window.end===plan.scope.outcomeContract.reviewWindow.end&&!o.context.some(x=>x.material&&!x.resolved));
 const relation=informative&&plan.candidateId==='reprogramme'?(benefit==='Met'?'Consistent with':'Inconsistent with'):execution.attributionAllowed&&plan.candidateId==='repair'&&benefit==='Met'&&recoveryKnown?'Consistent with':'Non-informative';
 return{executionFinding:execution,goalFinding:{state:goal,interventionBenefit:aggregate(goalRows),evidencePurpose:evidenceRows.length?aggregate(evidenceRows):'Not separately declared',criteria:rows.filter(x=>x.dimension!=='protection')},
  protectionFinding:{state:protection,criteria:protectionRows,offsetByBenefit:false,stopOrRollbackReviewRequired:breach,executionCommandIssued:false},
  diagnosisFinding:{state:relation,inference:useful?'The declared decision question produced useful evidence, independently of intervention benefit.':relation==='Consistent with'?'Observed response is consistent with the prior hypothesis; alternative explanations remain possible.':relation==='Inconsistent with'?'Goal failure is a bounded inconsistency to review; it does not establish another diagnosis.':'No automatic causal inference from intervention success or failure.',cannotEstablish:'Outcome benefit/failure does not prove or disprove the original cause.',sourceRefs:active.map(o=>o.id)},
  criteria:rows,ambiguities:binding.ambiguities,ruleVersion:RULE_VERSION,asOf,causalClaim:false};
}
