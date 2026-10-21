import { diagnosisCases } from './diagnosis-cases.mjs';
import { nextEvidenceCases } from './next-evidence-cases.mjs';
import { cp6AssessmentSeeds } from './intervention-assessment-seeds.mjs';
import { detectChange } from '../../statistics/change-detection/detector.mjs';
import { diagnoseCompeting } from '../../diagnosis/competing-diagnosis.mjs';
import { identifyNextBestEvidence } from '../../next-evidence/next-best-evidence.mjs';
import { interventionCatalogue } from '../../intervention/catalogue.mjs';
const clone=x=>structuredClone(x),asOf='2026-07-28T12:00:00.000Z';
function fromDiagnosis(letter,edit=()=>{}){const r=clone(diagnosisCases.find(x=>x.canonicalCase===letter));edit(r.evidence);return{evidence:r.evidence,changeResult:detectChange(r.amenity),assessment:diagnoseCompeting({changeResult:detectChange(r.amenity),evidence:r.evidence})};}
function cp6(letter){return clone(cp6AssessmentSeeds[letter]);}
const commonFacts=['purposeSupported','feasible','affectedUsersUnderstood','accessSafeguardsPass','accessNeutralProven','scopeBounded','rollbackCredible'];
const specificFacts={monitor:['observationPurposeAffirmative','comparableObservationFeasible'],validate:['couldMateriallyChangeDecision','evidenceSourceFeasible'],repair:['faultScopeIndependentlyEvidenced','restorationOnly'],reprogramme:['programmeScopeSupported'],pilot:['testHypothesisSupported','decisionQuestionExplicit','baselineAndMeasuresFeasible','stopTriggersDefined','protectedFunctionRetained'],shared:['additionalUsePurposeSupported','genuineSpareSlots','sufficientCapacity','accessibilityMaintained','protectedAccessContinues','noUnsupportedDisplacement','protectionMonitoringDefined','protectedFunctionRetained'],preserve:['protectedFunctionKnown','protectedAccessRequirementKnown','maintainFunctionSafely']};
const purpose={monitor:'understand-pattern',validate:'distinguish-action',repair:'restore-lighting',reprogramme:'programme-fit',pilot:'programme-fit',shared:'additional-compatible-use',preserve:'protected-function-continuity'};
const goals={monitor:'Obtain comparable observations of persistence or recovery',validate:'Resolve the named uncertainty before choosing an action',repair:'Restore the existing lighting function; usage recovery is not required',reprogramme:'Improve the specified existing programme fit while retaining access',pilot:'Test the declared programme question within a bounded temporary scope',shared:'Enable documented additional use while preserving protected access',preserve:'Maintain meaningful current-function access for the dependent cohort; no usage-growth requirement'};
export function addSyntheticScope(input,code,edit=()=>{}){
 const def=interventionCatalogue.find(d=>d.code===code),id=`${input.case}:${code}`;
 const scope={id,version:'1',interventionId:`planned:${id}`,intent:def.intent,purposeId:purpose[code],purpose:goals[code],description:goals[code],affectedFunction:'Current amenity activity and access',retainsExistingFunction:true,changesProgrammeOrAllocation:false,affectsAccessOrFunction:!['monitor','validate'].includes(code),startBoundary:'2026-08-01',endBoundary:'2026-09-12',
   operatorResponsibility:'Simulated township amenity operator',
   scopeBounds:{extent:code==='repair'?'Restore only the recorded lighting fault in one access-controlled maintenance window':code==='reprogramme'?'Adjust one existing weekly programme slot while retaining the hall function':code==='pilot'?'Test one compatible programme use in one weekly slot within the stated temporary boundaries':code==='shared'?'Offer only documented spare slots; retain protected current-function slots and capacity':code==='preserve'?'Maintain the existing dependent function and required access; the review date does not end preservation':'Review or observe the named gap without displacing current users',protectedAccess:'Retain recorded protected slots, capacity and accessibility; no unsupported displacement'},
   rollbackPlan:{owner:'Simulated township amenity operator',steps:code==='repair'?'Stop unsafe work and restore safe existing-function access; do not broaden works':code==='preserve'?'If function/access deteriorates, pause any associated change and review a safe restoration plan':'Stop the scoped change, restore the prior supported arrangement and retain protected access',trigger:'Any breach of the declared protected-access or safe-scope condition requires stopping and operator review'},
   outcomeContract:{id:`contract:${id}`,version:'1',purpose:goals[code],primaryMeasure:code==='preserve'?'Protected function/access continuity':code==='repair'?'Specified fault resolution and functional availability':'Purpose-aligned programme or evidence measure',protectionMeasure:'Protected access and function maintained',reviewWindow:{start:'2026-08-01',end:'2026-09-12'},criteria:'Case-specific agreed purpose and protection criteria; no universal usage-growth target'},
   reversibility:{disruption:'limited',functionLoss:'none',rollback:'simple',evidenceRefs:[`synthetic:scope-review:${id}`]}};
 edit(scope);input.scopes[code]=scope;
 for(const field of [...commonFacts,...specificFacts[code]])input.actionEvidence.push({field,value:true,scopeId:scope.id,scopeVersion:scope.version,sourceId:`synthetic:review:${id}:${field}`,availableAt:asOf,isSynthetic:true});
 input.actionEvidence.push({field:'reversibilityProfile',value:clone(scope.reversibility),scopeId:scope.id,scopeVersion:scope.version,sourceId:scope.reversibility.evidenceRefs[0],availableAt:asOf,isSynthetic:true});
 return scope;
}
export function setActionFact(input,code,field,value){const scope=input.scopes[code];input.actionEvidence=input.actionEvidence.filter(r=>!(r.scopeId===scope.id&&r.field===field));if(value!==null)input.actionEvidence.push({field,value,scopeId:scope.id,scopeVersion:scope.version,sourceId:`synthetic:review:${scope.id}:${field}:changed`,availableAt:asOf,isSynthetic:true});}
export function createInterventionDecisionCases(){
 const resolved=cp6('A'),insufficient=cp6('I'),protectionOnly=cp6('H');
 const make=(letter,source,title)=>{
  const r=clone(source);const context=clone(nextEvidenceCases.find(x=>x.case==='C').decisionContext);
  const cp4=identifyNextBestEvidence({changeResult:r.changeResult,evidence:r.evidence,decisionContext:context});
  return {case:letter,amenityId:r.changeResult.amenityId,amenityName:letter==='F'?'Senior Activity Room':letter==='C'||letter==='D'||letter==='P'?'Sports Court':'Community Hall',title,asOf,analysisVersion:'1',...r,cp4,scopes:{},actionEvidence:[],knownUnsafeCondition:false,confirmedUrgentFault:false,stale:false,conflictingInput:false,requestedPermanentChange:false,isSynthetic:true};
 };
 const rows=[];const push=(letter,source,title,configure=()=>{})=>{const r=make(letter,source,title);configure(r);rows.push(r);return r;};
 push('A',resolved,'Scoped programme change after qualified resident evidence',r=>addSyntheticScope(r,'reprogramme'));
 push('B',insufficient,'Feedback arrived; historical resident-mix evidence is still missing',r=>{addSyntheticScope(r,'reprogramme');addSyntheticScope(r,'pilot');addSyntheticScope(r,'monitor');});
 push('C',fromDiagnosis('A'),'Restore a confirmed operational fault',r=>addSyntheticScope(r,'repair'));
 push('D',fromDiagnosis('A',e=>{e.residentMix=null;e.decisionHorizon='long-term';}),'Narrow restoration without claiming the cause of declining usage',r=>addSyntheticScope(r,'repair'));
 push('E',fromDiagnosis('B'),'Observe a supported temporary / resident-mix pattern',r=>addSyntheticScope(r,'monitor'));
 push('F',fromDiagnosis('D'),'Preserve the established dependent function',r=>addSyntheticScope(r,'preserve'));
 push('G',fromDiagnosis('C',e=>{e.dependency=null;}),'Explanation is understood; protection remains unresolved',r=>addSyntheticScope(r,'reprogramme'));
 push('H',protectionOnly,'Resident reliance reports are not a formal Preserve assessment',r=>addSyntheticScope(r,'preserve'));
 push('I',resolved,'Shared use with evidenced capacity and protected access',r=>addSyntheticScope(r,'shared'));
 push('J',resolved,'More use cannot compensate for displaced protected access',r=>{addSyntheticScope(r,'shared');setActionFact(r,'shared','noUnsupportedDisplacement',false);});
 push('K',resolved,'One bounded evidence-generating pilot',r=>{
  const h=nextEvidenceCases.find(x=>x.case==='H');r.cp4=identifyNextBestEvidence({changeResult:r.changeResult,evidence:r.evidence,decisionContext:h.decisionContext});
  r.cp4Pilot={interventionId:'existing-pilot-plan-42',evidenceRequestId:'existing-programme-response-request',provenance:'Synthetic existing plan linkage for the unchanged CP4 pilot winner'};
  addSyntheticScope(r,'pilot',s=>{s.interventionId=r.cp4Pilot.interventionId;s.evidenceRequestId=r.cp4Pilot.evidenceRequestId;});
 });
 push('L',resolved,'Temporary wording without a credible rollback is insufficient',r=>{addSyntheticScope(r,'pilot',s=>{s.endBoundary=null;});setActionFact(r,'pilot','rollbackCredible',null);});
 push('M',fromDiagnosis('E'),'Distinguish competing actions before choosing one',r=>{addSyntheticScope(r,'repair');addSyntheticScope(r,'reprogramme');addSyntheticScope(r,'validate',s=>{s.validationGapId='operational-condition';});});
 push('N',resolved,'Equally supported reversible scopes need operator choice',r=>{addSyntheticScope(r,'reprogramme');addSyntheticScope(r,'pilot');for(const code of ['reprogramme','pilot']){r.scopes[code].purpose='Address the evidenced programme-fit decision while retaining the current function and protected access.';r.scopes[code].outcomeContract.purpose=r.scopes[code].purpose;}});
 push('O',resolved,'Changed or conflicting source snapshot blocks approval',r=>{addSyntheticScope(r,'reprogramme');r.stale=true;r.conflictingInput=true;});
 push('P',fromDiagnosis('G'),'Protecting the function does not mean leaving broken equipment unsafe',r=>{addSyntheticScope(r,'preserve');addSyntheticScope(r,'repair');r.knownUnsafeCondition=true;r.confirmedUrgentFault=true;});
 push('Q',resolved,'No new change-led intervention when the current detector is Stable',r=>{addSyntheticScope(r,'reprogramme');r.changeResult={...r.changeResult,status:'Stable'};});
 push('R',resolved,'Permanent repurposing is not a candidate',r=>{addSyntheticScope(r,'reprogramme');r.requestedPermanentChange=true;});
 push('S',resolved,'A new intervention-specific impact remains unassessed',r=>{addSyntheticScope(r,'reprogramme');setActionFact(r,'reprogramme','affectedUsersUnderstood',null);});
 push('T',resolved,'100% evidence support does not supply an intervention scope');
 return rows;
}
