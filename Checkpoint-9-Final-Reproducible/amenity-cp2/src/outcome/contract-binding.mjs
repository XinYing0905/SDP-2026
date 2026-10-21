import { digest,RULE_VERSION } from '../shared/outcome-review-contract.mjs';
// Deliberately narrow, reviewed literal clauses. No outcome input is accepted here.
// Qualification is part of each pre-approved clause, not a universal coverage policy.
export const criterionTemplates=Object.freeze([
 {key:'functionRestored',dimension:'goal',metric:'functionRestored',op:'eq',target:true,sourceType:'reviewed-function-test',text:'Specified existing function restored equals true; qualified by a reviewed function test.'},
 {key:'downtime',dimension:'goal',metric:'downtimeHours',op:'lte',target:0,sourceType:'complete-downtime-log',text:'Downtime hours equals zero during the approved review window; qualified by a complete downtime log.'},
 {key:'recurrence',dimension:'goal',metric:'recurrenceCount',op:'lte',target:0,sourceType:'complete-recurrence-log',text:'Fault recurrence count equals zero throughout the approved review window; qualified by a complete recurrence log.'},
 {key:'participation',dimension:'goal',metric:'relevantParticipation',op:'gte',target:12,sourceType:'reviewed-attendance-register',text:'Relevant-cohort participation is at least 12 residents; qualified by a reviewed attendance register covering the approved review window.'},
 {key:'benefit',dimension:'goal',metric:'pilotBenefit',op:'eq',target:true,sourceType:'reviewed-pilot-measures',text:'Declared pilot benefit achieved equals true; qualified by reviewed pilot measures for the approved review window.'},
 {key:'evidence',dimension:'evidencePurpose',metric:'decisionQuestionAnswered',op:'eq',target:true,sourceType:'reviewed-validation-report',text:'Declared decision question reliably answered equals true; qualified by a reviewed validation report with comparable source evidence.'},
 {key:'stopRollback',dimension:'executionSafeguard',metric:'stopRollbackComplied',op:'eq',target:true,sourceType:'reviewed-stop-rollback-record',text:'Declared stop and rollback requirements complied with equals true; qualified by a reviewed stop/rollback record for the approved review window.'},
 {key:'sharedBenefit',dimension:'goal',metric:'additionalUseAchieved',op:'eq',target:true,sourceType:'reviewed-shared-use-register',text:'Documented additional-use purpose achieved equals true; qualified by a reviewed shared-use register.'},
 {key:'preserve',dimension:'goal',metric:'meaningfulFunctionContinues',op:'eq',target:true,sourceType:'reviewed-dependent-function-record',text:'Meaningful protected current function continues equals true; qualified by a reviewed dependent-function record.'},
 {key:'observe',dimension:'goal',metric:'comparableObservationComplete',op:'eq',target:true,sourceType:'reviewed-comparable-series',text:'Approved comparable observation completed equals true; qualified by a reviewed comparable observation series.'},
 {key:'validate',dimension:'goal',metric:'decisionQuestionAnswered',op:'eq',target:true,sourceType:'reviewed-validation-report',text:'Named decision gap reliably addressed equals true; qualified by a reviewed validation report with comparable source evidence.'},
 {key:'protection',dimension:'protection',metric:'protectedAccessMaintained',op:'eq',target:true,sourceType:'reviewed-protected-access-record',text:'Protected access and function maintained equals true throughout the approved review window; qualified by a reviewed protected-access record.'}
]);
export function bindOutcomeContract(plan,at){
 const c=plan.scope.outcomeContract,clauses=c.criteria.split('\n').map(s=>s.trim()).filter(Boolean),criteria=[],ambiguities=[];
 for(const clause of clauses){const t=criterionTemplates.find(t=>t.text===clause);if(t)criteria.push({...t,unit:typeof t.target==='boolean'?'boolean':t.metric==='downtimeHours'?'hours':'count',criterionId:`${c.id}:${t.key}`,literal:clause,window:structuredClone(c.reviewWindow),cohort:plan.scope.reviewCohort??null,function:plan.scope.affectedFunction});else ambiguities.push(clause);}
 if(!criteria.some(c=>c.dimension==='goal')||!criteria.some(c=>c.dimension==='protection')||!plan.scope.reviewCohort)ambiguities.push('Goal/protection criteria or an approved cohort reference are unspecified.');
 return{version:1,ruleVersion:RULE_VERSION,contractDigest:digest(c),scopeDigest:plan.scopeDigest,contract:structuredClone(c),criteria,ambiguities,frozenAt:at,interpretationBasis:'Literal reviewed clauses only; independent of outcomes',digest:digest({contract:c,criteria,ambiguities,ruleVersion:RULE_VERSION})};
}
