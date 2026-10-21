import {POLICY,CLASS,hash,check,before,copy,TENSION} from './core.mjs';
import {compareFeatures,validateFeatures} from './features.mjs';
export function describe(rows){
 const n=rows.length,amenities=new Set(rows.map(r=>r.amenityId)).size,counts={Met:0,'Not met':0,Mixed:0};for(const c of rows)counts[c.outcome.goal.state]++;
 const breaches=rows.filter(c=>c.outcome.protection.state==='Protection breach').map(c=>c.id),floor=n>=POLICY.minimumEpisodes&&amenities>=POLICY.minimumAmenities;
 const descriptor=!floor?'Insufficient comparable historical evidence':breaches.length?'Historical concern':counts.Met>n/2?'Historically supportive pattern':counts['Not met']>n/2?'Historical concern':'Mixed historical evidence';
 return{descriptor,qualifyingEpisodes:n,distinctAmenities:amenities,goalCounts:counts,protectionCounts:{Maintained:n-breaches.length,'Protection breach':breaches.length},adverseCaseIds:breaches,protectionConcern:breaches.length?'Historical concern — substantiated protection breach':null,floorMet:floor,denominatorMeaning:'All qualifying comparable evaluable episodes in this bound release; Mixed remains in denominator; not a success probability'};
}
export function cosine(a,b){check(a?.length&&a.length===b?.length,'INVALID_VECTOR_DIMENSIONS');check(a.every(Number.isFinite)&&b.every(Number.isFinite),'INVALID_VECTOR_VALUE');return a.reduce((s,v,i)=>s+v*b[i],0);}
export function retrieve({query,release,index,queryVector=null,mode='product',baseline=false}){
 validateFeatures(query.features);check(before(query.features.decisionAt,query.asOf),'QUERY_FEATURES_UNAVAILABLE_AS_OF');check(before(release.asOf,query.asOf)&&before(release.createdAt,query.asOf),'FUTURE_CORPUS_RELEASE');
 const{digest:rd,...rb}=release;check(hash(rb)===rd,'CORPUS_DIGEST_MISMATCH');const{digest:ix,...ib}=index;check(index.corpusDigest===rd&&hash(ib)===ix,'STALE_OR_TAMPERED_INDEX');
 const authority={actionReadiness:query.candidate.actionReadiness,eligible:query.candidate.eligible,preferredIds:copy(query.comparison.preferredIds),gates:copy(query.candidate.gates),proposalDigest:query.proposalDigest};
 const common={querySnapshot:query.features.snapshotId,queryDigest:hash(query),candidateId:query.candidate.id,asOf:query.asOf,corpusVersion:release.id,corpusDigest:rd,indexDigest:ix,featurePolicy:POLICY.featureVersion,policyDigest:hash(POLICY),model:index.model,authority,simulated:release.rows.some(r=>r.case.simulated),upstreamMutation:false};
 if(query.stale||query.conflictingInput)return{...common,state:'Stale/conflicting current input — historical interpretation withheld',cases:[],related:[],limited:[]};
 if(mode!=='technical'&&(query.candidate.actionReadiness!=='Ready'||!query.candidate.eligible))return{...common,state:'CP7 candidate not Ready — historical interpretation withheld',cases:[],related:[],limited:[]};
 const related=[],limited=[],qualified=[],excluded=[];
 for(const row of release.rows){const c=row.case;if(!row.active){excluded.push({id:c.id,reason:row.exclusion});continue;}
  if(c.episodeId===query.episodeId||c.amenityId===query.amenityId||c.source.interventionId===query.interventionId||(query.excludeFamilies??[]).includes(c.family)){excluded.push({id:c.id,reason:'Query amenity / episode / intervention lineage / evaluation family excluded'});continue;}
  if(!before(c.availableAt,query.asOf)){excluded.push({id:c.id,reason:'Outcome unavailable as of query'});continue;}
  const comp=compareFeatures(query.features,c.features);if(!comp.comparable){related.push({id:c.id,label:c.label,reasons:comp.reasons,protection:c.outcome.protection.state});continue;}
  if(row.admission.class!==CLASS.evaluable){limited.push({id:c.id,label:c.label,reasons:row.admission.reasons,outcome:c.outcome,source:c.source});continue;}qualified.push({c,comp});
 }
 // Membership and ranking inputs are fixed before outcomes are attached.
 const membership=qualified.map(r=>({id:r.c.id,featureDigest:r.c.features.digest})).sort((a,b)=>a.id.localeCompare(b.id)),semantic=!baseline&&index.semanticAvailable&&queryVector!==null;
 const ordered=qualified.map(({c,comp})=>{const entry=index.entries.find(e=>e.id===c.id);check(entry?.featureDigest===c.features.digest,'INDEX_FEATURE_MISMATCH');return{c,comp,score:semantic?cosine(queryVector,entry.vector):-comp.differences.length};}).sort((a,b)=>b.score-a.score||a.c.id.localeCompare(b.c.id));
 const cases=ordered.map(({c,comp,score})=>({id:c.id,label:c.label,amenityId:c.amenityId,disclosure:c.disclosure,score,whySimilar:comp.matchedFields,differences:comp.differences,protectedFunction:c.features.structured.function,protectionContext:c.features.structured.protection,cohort:c.features.structured.cohort,queryExcerpt:query.features.text,historicalExcerpt:c.features.text,source:c.source,decisionAssessment:c.decisionAssessment,featureSources:c.features.provenance,outcome:c.outcome,observations:c.observations,cannotConclude:'Observed historical associations do not establish causality, current eligibility or success probability.'}));
 const pattern=describe(qualified.map(r=>r.c));if(!qualified.length&&related.length)pattern.descriptor='Not comparable enough to infer suitability';
 return{...common,state:mode==='technical'&&authority.actionReadiness!=='Ready'?'Technical QA only — CP7 block retained':'Historical evidence available',retrievalMode:baseline?'Structured-only baseline':semantic?'Structured constraints + semantic retrieval':'Structured comparison only — semantic retrieval unavailable',membershipDigest:hash(membership),...pattern,cases,related,limited,excluded,adverseCases:cases.filter(c=>pattern.adverseCaseIds.includes(c.id)),tension:null};
}
export function addTension(result,preferredResult){return{...result,tension:result.authority.eligible&&result.authority.actionReadiness==='Ready'&&result.authority.preferredIds.length>0&&!result.authority.preferredIds.includes(result.candidateId)&&result.descriptor==='Historically supportive pattern'&&preferredResult.descriptor!=='Historically supportive pattern'?TENSION:null};}
