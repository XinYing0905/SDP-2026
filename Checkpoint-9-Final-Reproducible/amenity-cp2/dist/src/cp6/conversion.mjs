import { clone, RESPONSE_CONTRACT } from './contract.mjs';
export function convertResponseEvidence(c, aggregation, policy, at) {
  if(!aggregation.qualified)return {state:'No conversion',assertion:null,projection:null,reasons:aggregation.reasons};
  const a=aggregation;
  const assertion={contractVersion:RESPONSE_CONTRACT,id:`${c.id}:assertion-1`,version:1,collectionId:c.id,aggregationId:a.id,
    questionId:c.pair.questionId,questionVersion:c.pair.questionVersion,cohortId:c.pair.cohortId,cohortVersion:c.pair.cohortVersion,
    targetGapId:c.pair.targetGapId,dimension:c.pair.dimension,planDigest:c.planDigest,sourceWinner:c.sourceWinner,
    originalEvidenceSnapshotId:c.fixture.evidence.snapshotId,rosterDigest:c.rosterDigest,knownEligiblePopulation:a.knownEligibleCohortSize,
    window:a.window,counts:{substantive:a.substantive,unable:a.unableToAssess,skip:a.voluntarySkip,noResponse:a.noResponse},optionCounts:a.optionCounts,optionShares:a.optionShares,
    coverage:a.substantiveCoverage,conversionRuleVersion:policy.version,policy:clone(policy),availableAt:at,createdAt:at,
    provenance:{responseIds:a.responseIds,responseDigest:a.responseDigest,aggregationId:a.id,catalogueVersion:c.catalogueVersion},
    assertions:c.pair.optionPlanningAssertions.filter(x=>a.optionCounts[x.optionId]>0).map(x=>({optionId:x.optionId,count:a.optionCounts[x.optionId],assertion:x.assertion,required:x.requiredAssumptionsAndCorroboration,cannotEstablish:x.cannotEstablish})),
    limitations:a.limitations,protectionBooleanProjection:false};
  if(c.pair.questionId!=='Q-PROGRAMME-FIT')return {state:'Bounded protection assertion only',assertion,projection:null,reasons:['No protection boolean projection or attestation in CP6. Repeat-use, substitutes and comparative impact remain independent requirements.']};
  const poor=a.optionShares['PF-NOT-REALLY'], fit=a.optionShares['PF-YES']+a.optionShares['PF-MOSTLY'];
  assertion.pattern=poor>=policy.programmeDirectionalShare?'Poor current fit':fit>=policy.programmeDirectionalShare?'Continuing qualified fit':a.optionShares['PF-NO-LONGER-NEED']>=policy.programmeDirectionalShare?'Cessation of personal need':'Mixed responses';
  if(poor<policy.programmeDirectionalShare&&fit<policy.programmeDirectionalShare)return {state:'Mixed / no directional conversion',assertion,projection:null,reasons:['No directional admission; cessation is not dissatisfaction and mixed reports are not negative evidence.']};
  // Construct only the existing CP3 feedback input; do not set a feature or diagnosis.
  const projection={sourceId:assertion.id,availableAt:at.slice(0,10),relevantToProgramme:true,responses:a.substantive,mismatchResponses:a.optionCounts['PF-NOT-REALLY']};
  return {state:'Eligible CP3 input projection',assertion,projection,reasons:[]};
}
