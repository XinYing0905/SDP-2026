import { randomBytes, randomUUID } from 'node:crypto';
import { diagnoseCompeting } from '../diagnosis/competing-diagnosis.mjs';
import { selectQuestionCohort } from '../resident-evidence/pair-selection.mjs';
import { responseParameters } from './parameters.mjs';
import { digest, clone, requireThat, assertResponseRequest, publicCollection, RESPONSE_CONTRACT } from './contract.mjs';
import { aggregateResponses } from './aggregation.mjs';
import { convertResponseEvidence } from './conversion.mjs';

export function createResidentResponseService({repository,fixtures,clock=()=>new Date().toISOString(),parameters=responseParameters}) {
  requireThat(parameters.minimumSubstantiveResponses>=5 && parameters.minimumSubstantiveCoverage>=.6 && parameters.programmeDirectionalShare>=.8 && parameters.minimumMembershipValidationCoverage===1 && parameters.minimumRosterReach===1 && parameters.allowedAcceptedResponsesPerRecipient===1 && parameters.automaticProtectionBooleanConversion===false && parameters.acceptedLateResponses===0 && parameters.collectionWindowDays>0,'INVALID_POLICY');
  const fixture=key=>{const f=fixtures.get(key);requireThat(f,'UNKNOWN_CASE',404);return f;};
  const binding=f=>digest({planInput:f.planInput,plan:f.plan,roster:f.intendedRoster,change:f.changeResult,evidence:f.evidence});
  const stale=c=>binding(fixture(c.fixtureKey))!==c.bindingDigest;
  const event=(kind,at,extra={})=>({kind,at,...extra});
  function staleResult(c,at) {c.state='Stale / revalidation required';return {events:[event('STALE_INPUT',at)],value:{accepted:false,code:'STALE_INPUT',state:c.state}};}
  return Object.freeze({
    list:()=>repository.list().map(publicCollection),
    get:id=>publicCollection(repository.get(id)),
    history:id=>({events:repository.events(id),revisions:repository.history(id).map(publicCollection)}),
    open({fixtureKey,operatorApproved=false,intendedRoster=null}) {
      requireThat(operatorApproved===true,'EXPLICIT_OPERATOR_APPROVAL_REQUIRED',403);
      const f=clone(fixture(fixtureKey));
      const checked=selectQuestionCohort(f.planInput);
      requireThat(checked.state==='Draft pair selected'&&checked.selectedPair,'PLAN_BLOCKED');
      requireThat(digest(checked)===digest(f.plan),'PLAN_CHANGED');
      const roster=intendedRoster??f.intendedRoster;
      requireThat(Array.isArray(roster)&&roster.length>0&&new Set(roster.map(r=>r.recipientRef)).size===roster.length,'INVALID_ROSTER',400);
      const pair=checked.selectedPair;
      requireThat(roster.every(r=>f.intendedRoster.some(x=>x.recipientRef===r.recipientRef&&x.eligible&&x.cohortId===pair.cohortId&&x.cohortVersion===pair.cohortVersion)),'INELIGIBLE_RECIPIENT',403);
      requireThat(roster.length<=pair.cohort.knownRelevantMembers,'ROSTER_EXCEEDS_KNOWN_MEMBERS',400);
      const id=randomUUID(),at=clock(),access=[];
      const recipients=roster.map(r=>{const token=randomBytes(24).toString('hex');access.push({recipientRef:r.recipientRef,token});return {...r,currentEligible:true,accessDigest:digest(token),issuedAt:at};});
      const c={contractVersion:RESPONSE_CONTRACT,id,revision:0,fixtureKey,fixture:f,bindingDigest:binding(f),planDigest:digest(f.plan),catalogueVersion:f.plan.catalogueVersion,sourceWinner:f.plan.sourceWinnerId,
        amenityId:f.id,amenityName:'Community Hall',pair:clone(pair),rosterDigest:digest(roster),intendedRosterSize:roster.length,
        knownEligibleCohortSize:pair.cohort.knownRelevantMembers,recipients,openedAt:at,closesAt:new Date(Date.parse(at)+parameters.collectionWindowDays*86400000).toISOString(),
        state:'Open',policy:clone(parameters),responses:[],attempts:[],receipts:{},aggregation:null,conversion:null,evidenceHistory:[clone(f.evidence)],assessmentHistory:[clone(f.before)],
        operatorAuthorisation:{explicit:true,at},simulated:true};
      repository.create(c,event('COLLECTION_OPENED',at,{operatorApproved:true,rosterDigest:c.rosterDigest,intendedRosterSize:roster.length}));
      // Plain simulated access references are returned once; only digests are persisted.
      return {collection:publicCollection(c),access};
    },
    residentPreview(id,token) {
      const c=repository.get(id),r=c.recipients.find(r=>r.accessDigest===digest(token));requireThat(r,'INVALID_ACCESS',403);
      return {collectionId:id,amenityName:c.amenityName,pair:{wording:c.pair.wording,options:c.pair.options,nonSubstantive:c.pair.nonSubstantive},
        questionVersion:c.pair.questionVersion,cohortVersion:c.pair.cohortVersion,planDigest:c.planDigest,
        state:stale(c)?'Stale / revalidation required':c.state==='Open'&&Date.parse(clock())>=Date.parse(c.closesAt)?'Expired':c.state,
        completed:c.responses.some(x=>x.recipientRef===r.recipientRef)};
    },
    submit(id,token,request) {
      assertResponseRequest(request);
      const at=clock();
      return repository.transact(id,null,c=>{
        const r=c.recipients.find(r=>r.accessDigest===digest(token));requireThat(r,'INVALID_ACCESS',403);
        const fingerprint=digest({optionId:request.optionId,questionVersion:request.questionVersion,cohortVersion:request.cohortVersion,planDigest:request.planDigest,submittedAt:request.submittedAt??null});
        const receiptKey=`${r.recipientRef}:${request.idempotencyKey}`;
        const retry=c.receipts[receiptKey];
        if(retry&&retry.fingerprint===fingerprint)return {noWrite:true,value:{...retry.receipt,idempotent:true}};
        const reject=code=>{const attempt={id:randomUUID(),recipientRef:r.recipientRef,receivedAt:at,requestedOptionId:request.optionId,accepted:false,code};c.attempts.push(attempt);return {events:[event('RESPONSE_REJECTED',at,{...attempt,rawRequest:clone(request)})],value:{accepted:false,code}};};
        if(retry)return reject('IDEMPOTENCY_CONFLICT');
        if(stale(c)) {const rejected=reject('STALE_INPUT');c.state='Stale / revalidation required';return rejected;}
        if(c.state!=='Open')return reject('COLLECTION_CLOSED');
        if(Date.parse(at)>=Date.parse(c.closesAt))return reject('WINDOW_EXPIRED');
        const member=fixture(c.fixtureKey).intendedRoster.find(x=>x.recipientRef===r.recipientRef);
        if(!member?.eligible||member.cohortId!==c.pair.cohortId||member.cohortVersion!==c.pair.cohortVersion)return reject('MEMBERSHIP_INVALID');
        if(request.questionVersion!==c.pair.questionVersion||request.cohortVersion!==c.pair.cohortVersion||request.planDigest!==c.planDigest)return reject('VERSION_MISMATCH');
        if(request.submittedAt && (!Number.isFinite(Date.parse(request.submittedAt))||Date.parse(request.submittedAt)<Date.parse(c.openedAt)||Date.parse(request.submittedAt)>Date.parse(at)))return reject('INVALID_TIMESTAMP');
        const substantive=c.pair.options.find(o=>o.id===request.optionId),non=c.pair.nonSubstantive.find(o=>o.id===request.optionId);
        if(!substantive&&!non)return reject('INVALID_OPTION');
        if(c.responses.some(x=>x.recipientRef===r.recipientRef))return reject('SECOND_FINAL_RESPONSE');
        const response={id:randomUUID(),collectionId:id,recipientRef:r.recipientRef,optionId:request.optionId,semanticState:substantive?'SUBSTANTIVE':request.optionId,
          questionId:c.pair.questionId,questionVersion:c.pair.questionVersion,cohortId:c.pair.cohortId,cohortVersion:c.pair.cohortVersion,planDigest:c.planDigest,
          analysisSnapshotId:c.fixture.evidence.snapshotId,idempotencyKey:request.idempotencyKey,submittedAt:request.submittedAt??at,receivedAt:at,
          validation:{state:'Accepted',validatorVersion:parameters.version,rosterDigest:c.rosterDigest,eligibleAtReceipt:true,validatedAt:at}};
        c.responses.push(response);c.attempts.push({id:response.id,accepted:true,receivedAt:at});
        const receipt={accepted:true,responseId:response.id,receivedAt:at,semanticState:response.semanticState};
        c.receipts[receiptKey]={fingerprint,receipt};
        return {events:[event('RESPONSE_ACCEPTED',at,{recipientRef:r.recipientRef,response})],value:receipt};
      });
    },
    close(id,expectedRevision) {
      requireThat(Number.isInteger(expectedRevision),'EXPECTED_VERSION_REQUIRED',400);
      const at=clock();return repository.transact(id,expectedRevision,c=>{
        requireThat(c.state==='Open','COLLECTION_NOT_OPEN');
        if(stale(c))return staleResult(c,at);
        c.closedAt=at;c.actualWindow={start:c.openedAt,end:at};
        c.aggregation=aggregateResponses(c,c.policy,at);c.conversion=convertResponseEvidence(c,c.aggregation,c.policy,at);c.state=c.conversion.state;
        if(c.conversion.assertion)c.evidenceLedger=[c.conversion.assertion];
        return {events:[event('COLLECTION_CLOSED',at,{aggregation:c.aggregation}),event('EVIDENCE_QUALIFIED',at,{conversion:c.conversion})],value:{state:c.state,aggregation:c.aggregation,conversion:c.conversion}};
      });
    },
    reassess(id,expectedRevision) {
      requireThat(Number.isInteger(expectedRevision),'EXPECTED_VERSION_REQUIRED',400);
      const other=repository.list().filter(x=>x.id!==id&&x.amenityId===repository.get(id).amenityId&&x.conversion?.projection);
      const at=clock();return repository.transact(id,expectedRevision,c=>{
        requireThat(c.aggregation,'COLLECTION_NOT_CLOSED');
        if(c.reassessment)return {noWrite:true,value:c.reassessment};
        if(stale(c))return staleResult(c,at);
        if(c.state==='Stale / revalidation required')return {noWrite:true,value:{state:c.state}};
        const projection=c.conversion.projection;
        if(!projection){c.reassessment={state:'No CP3 input change',before:c.fixture.before,after:c.fixture.before,reason:c.conversion.reasons,assertion:c.conversion.assertion};return {events:[event('NO_INPUT_CHANGE',at)],value:c.reassessment};}
        if(other.length||c.fixture.evidence.feedback){c.state='Evidence conflict / review required';return {events:[event('EVIDENCE_CONFLICT',at,{otherCollectionIds:other.map(x=>x.id),priorFeedback:Boolean(c.fixture.evidence.feedback)})],value:{state:c.state,reason:'No pooling, latest-wins or preferred-batch selection.'}};}
        const evidence={...clone(c.fixture.evidence),snapshotId:`${c.id}:evidence-2`,parentSnapshotId:c.fixture.evidence.snapshotId,asOf:at.slice(0,10),feedback:clone(projection)};
        const after=diagnoseCompeting({changeResult:c.fixture.changeResult,evidence});
        c.evidenceHistory.push(evidence);c.assessmentHistory.push(after);
        c.reassessment={state:'Reassessed',availableAt:at,parentSnapshotId:evidence.parentSnapshotId,newSnapshotId:evidence.snapshotId,
          before:c.fixture.before,after,changedInputFields:['feedback','asOf','snapshotId'],unchangedEvidenceFields:['temporal','operations','residentMix','usage','programme','dependency'],
          sourceAssertionId:c.conversion.assertion.id,engine:'Existing diagnoseCompeting()',parameterVersion:after.parameterVersion,
          explanation:'New resident evidence changed evidence support for the Programme / Configuration Mismatch hypothesis. It is not causal proof.'};
        c.state='Reassessed';return {events:[event('REASSESSMENT_SAVED',at,{evidence,result:c.reassessment})],value:c.reassessment};
      });
    }
  });
}
