const SUFFICIENT='Sufficient Evidence';
const CP4_GAPS=new Set(['operational-condition','temporal-stability','resident-mix','repeat-dependency','dependent-needs','realistic-substitutes','protected-impact','programme-fit','explanation-discrimination','programme-response']);
// Gate checks are pure: never write into an upstream assessment or derive new diagnosis features.
export function evaluateCandidate(input,definition) {
  const a=input.assessment,s=input.scopes?.[definition.code],gates=[];
  const add=(id,value,reason,type='evidence',refs=[],cp4GapId=null)=>gates.push({id,status:value===true?'Pass':value===false?'Fail':'Unknown',reason,type,evidenceRefs:refs,cp4GapId:cp4GapId&&CP4_GAPS.has(cp4GapId)&&input.cp4?.gaps?.some(g=>g.id===cp4GapId)?cp4GapId:null});
  const fact=(key,type='evidence')=>{
    const records=(input.actionEvidence??[]).filter(r=>r.scopeId===s?.id&&r.scopeVersion===s?.version&&r.field===key&&r.sourceId&&Number.isFinite(Date.parse(r.availableAt))&&Date.parse(r.availableAt)<=Date.parse(input.asOf));
    const values=new Set(records.map(r=>r.value));const value=values.size===1&&typeof records[0]?.value==='boolean'?records[0].value:null;
    add(`action:${definition.code}:${key}`,value,values.size>1?`Conflicting evidence for ${key}`:`${key}: ${value===true?'documented':value===false?'not met':'unknown or unavailable'}`,type,records.map(r=>r.sourceId));return value;
  };
  const perState=name=>a?.evidenceSufficiency?.perDiagnosis?.find(x=>x.name===name)?.state===SUFFICIENT;
  const E=a?.evidenceSufficiency?.explanationSufficiency,P=a?.evidenceSufficiency?.protectionContextSufficiency;
  add('input:current',input.stale===true||input.conflictingInput===true?false:input.stale===false&&input.conflictingInput===false?true:null,'Current consistent input required; absent freshness/conflict checks remain unknown','stale');
  add('input:identity',input.amenityId===input.changeResult?.amenityId,'Amenity identity must match the approved change evidence','stale');
  add('input:snapshot',Boolean(a?.evidenceSnapshotId&&input.evidence?.snapshotId===a.evidenceSnapshotId&&(!input.cp4||input.cp4.evidenceSnapshotId===a.evidenceSnapshotId)),'Diagnosis, evidence and CP4 snapshot references must agree','stale');
  add('input:assessment',a?.executionState==='Assessed'&&input.changeResult?.status==='Needs Attention','Current approved investigation and assessed diagnosis required');
  add('scope:permitted',input.requestedPermanentChange!==true&&(!s||s.permanentRepurposing!==true)&&(!s||s.intent===definition.intent),'Permanent repurposing/removal is forbidden; scope must match the fixed pathway purpose','safeguard');
  add('scope:defined',Boolean(s?.id&&s.version&&s.purposeId&&s.purpose&&s.description&&s.affectedFunction),'Concrete purpose, function and scope required','scope');
  if(s){
    fact('purposeSupported');fact('feasible','scope');
    add('scope:bounds-and-owner',Boolean(s.scopeBounds?.extent&&s.scopeBounds?.protectedAccess&&s.operatorResponsibility),'Document concrete extent, protected access and accountable operator','scope');
    add('scope:rollback-plan',Boolean(s.rollbackPlan?.owner&&s.rollbackPlan.steps&&s.rollbackPlan.trigger),'Document credible rollback/stop owner, steps and triggers','scope');
    const contract=s.outcomeContract;
    add('scope:prospective-contract',Boolean(contract?.id&&contract.version&&contract.purpose&&contract.primaryMeasure&&contract.protectionMeasure&&Number.isFinite(Date.parse(contract.reviewWindow?.start))&&Date.parse(contract.reviewWindow.end)>Date.parse(contract.reviewWindow.start)&&contract.criteria&&contract.observedValue===undefined&&contract.outcome===undefined),'Prospective purpose-specific Outcome Contract with a valid review window; no observed outcome','scope');
    fact('affectedUsersUnderstood','protection');fact('accessSafeguardsPass','protection');
    if(s.affectsAccessOrFunction!==false)add('protection:context',P?.state===SUFFICIENT,'Affecting action needs sufficient protection context','protection',[], 'protected-impact');
    else fact('accessNeutralProven','protection');
    fact('scopeBounded','scope');fact('rollbackCredible','safeguard');
  }
  switch(definition.code){
    case'monitor':
      fact('observationPurposeAffirmative');fact('comparableObservationFeasible');
      add('monitor:not-urgent-deferral',input.confirmedUrgentFault===false?true:input.confirmedUrgentFault===true?false:null,'Monitor cannot hide a confirmed urgent operational fault; unknown urgency is not safe deferral','safeguard');break;
    case'validate':{
      const gap=input.cp4?.gaps?.find(g=>g.id===s?.validationGapId);
      add('validate:named-gap',Boolean(gap),'Validate requires the exact currently unresolved evidence question', 'evidence',[],gap?.id);
      fact('couldMateriallyChangeDecision');fact('evidenceSourceFeasible');
      add('validate:no-disguised-action',s?.retainsExistingFunction===true,'Validation must not disguise a change in current function','safeguard');break;}
    case'repair':
      add('repair:confirmed-fault',a?.features?.operationalIssue?.value===true,'An independently confirmed fault is required; no claim that it caused aggregate decline','evidence',a?.features?.operationalIssue?.sourceRefs??[],'operational-condition');
      fact('faultScopeIndependentlyEvidenced');
      add('repair:existing-function-only',s?.retainsExistingFunction===true&&s?.changesProgrammeOrAllocation===false,'Exception permits only restoration, not programme/configuration/allocation change','safeguard');
      fact('restorationOnly');break;
    case'reprogramme':
      add('explanation:sufficient',E?.state===SUFFICIENT,'Programme change requires sufficient explanation, not highest support');
      add('programme:protection',P?.state===SUFFICIENT,'Programme scope changes require sufficient protection context','protection');
      add('programme:state',perState('Persistent Programme / Configuration Mismatch'),'Existing per-diagnosis sufficiency must support the programme rationale');
      add('programme:healthy',a?.features?.operationalHealthy?.value===true,'Operational prerequisites remain authoritative', 'evidence',[],'operational-condition');
      add('programme:persistent',a?.checks?.temporal?.persistent===true,'Persistent context required', 'evidence',[],'temporal-stability');
      add('programme:mix',a?.features?.mixControlled?.value===true&&a?.features?.stableCohortDecline?.value===true,'Resident-mix prerequisites required','evidence',[],'resident-mix');
      fact('programmeScopeSupported');add('programme:retain-function',s?.retainsExistingFunction===true,'Programme mismatch does not justify removing the amenity function','safeguard');break;
    case'pilot':
      add('pilot:healthy',a?.features?.operationalHealthy?.value===true,'Pilot operational prerequisites must pass','evidence',[],'operational-condition');
      add('pilot:persistent',a?.checks?.temporal?.persistent===true,'Pilot hypothesis requires established persistence','evidence',[],'temporal-stability');
      add('pilot:mix',a?.features?.mixControlled?.value===true&&a?.features?.stableCohortDecline?.value===true,'Pilot resident-mix prerequisites must pass','evidence',[],'resident-mix');
      add('pilot:protection',P?.state===SUFFICIENT,'Pilot protection prerequisites must pass','protection',[],'protected-impact');
      fact('testHypothesisSupported');fact('decisionQuestionExplicit');fact('baselineAndMeasuresFeasible');fact('stopTriggersDefined','safeguard');fact('protectedFunctionRetained','protection');
      add('pilot:time-bounded',Boolean(s?.startBoundary&&s.endBoundary&&Date.parse(s.endBoundary)>Date.parse(s.startBoundary)),'Explicit start/end bounds; temporary naming alone is insufficient','scope');
      {const selected=input.cp4?.nextBestCandidateIds?.length===1&&input.cp4.nextBestCandidateIds[0]==='pilot';
      add('pilot:single-lifecycle',!selected&&!input.cp4Pilot?true:input.cp4Pilot?Boolean(input.cp4Pilot.interventionId&&input.cp4Pilot.evidenceRequestId&&s?.interventionId===input.cp4Pilot.interventionId&&s?.evidenceRequestId===input.cp4Pilot.evidenceRequestId):null,'Reuse CP4 pilot Intervention ID and evidence-purpose request; missing linkage cannot create a second pilot','safeguard');}break;
    case'shared':
      add('shared:explanation',E?.state===SUFFICIENT,'Sharing is not Ready while Explanation Sufficiency is insufficient');
      add('shared:protection',P?.state===SUFFICIENT,'Sharing needs sufficient protection context','protection');
      for(const k of ['additionalUsePurposeSupported','genuineSpareSlots','sufficientCapacity','accessibilityMaintained','protectedAccessContinues','noUnsupportedDisplacement','protectionMonitoringDefined'])fact(k,['protectedAccessContinues','noUnsupportedDisplacement','accessibilityMaintained','protectionMonitoringDefined','sufficientCapacity'].includes(k)?'protection':'evidence');
      fact('protectedFunctionRetained','protection');break;
    case'preserve':
      add('preserve:state',perState('Low Utilisation, High Dependency'),'Formal Preserve requires existing per-diagnosis sufficient High Dependency, not primary explanation or resident counts');
      add('preserve:protection',P?.state===SUFFICIENT,'Formal Preserve requires sufficient protection context','protection');
      fact('protectedFunctionKnown','protection');fact('protectedAccessRequirementKnown','protection');fact('maintainFunctionSafely','safeguard');
      add('preserve:no-unsafe-continuation',input.knownUnsafeCondition===false?true:input.knownUnsafeCondition===true?false:null,'Preserve cannot perpetuate an unsafe condition; unknown safety remains unknown','safeguard');
      add('preserve:retain-function',s?.retainsExistingFunction===true,'Maintain current function for the protected dependent cohort','safeguard');break;
  }
  const failures=gates.filter(g=>g.status!=='Pass'&&g.status!=='Not applicable');
  const readiness=!failures.length?'Ready':failures.some(g=>g.type==='stale')?'Stale / conflict review':failures.some(g=>g.type==='safeguard'&&g.status==='Fail')?'Blocked by safeguard':failures.some(g=>g.type==='protection')?'Blocked by protection gap':failures.some(g=>g.type==='scope')?'Needs scope details':'Insufficient action evidence';
  return {id:definition.code,pathway:definition.name,ladderPosition:definition.ladderPosition,scope:s?structuredClone(s):null,
    interventionId:definition.code==='pilot'&&input.cp4Pilot?input.cp4Pilot.interventionId:s?.interventionId??null,
    actionReadiness:readiness,eligible:readiness==='Ready',gates,actionGaps:failures.map(g=>({actionRequirementId:g.id,reason:g.reason,cp4GapId:g.cp4GapId,evidencePlanningRequired:true})),
    explanationSufficiency:structuredClone(E??null),protectionContextSufficiency:structuredClone(P??null),perDiagnosis:structuredClone(a?.evidenceSufficiency?.perDiagnosis??[]),
    independentPurposeRepair:definition.code==='repair'&&E?.state!=='Sufficient Evidence',causalClaim:false,executionStarted:false};
}
