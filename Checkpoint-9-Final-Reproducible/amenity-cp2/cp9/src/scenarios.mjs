import {makeQuery,AS_OF} from './demo-corpus.mjs';import {makeRelease} from './history.mjs';import {buildIndex} from './semantic.mjs';import {retrieve,addTension} from './retrieval.mjs';import {copy,hash} from './core.mjs';import {validateFeatures} from './features.mjs';
// Closed, predeclared scenario worlds for Technical QA. The Product view uses
// the complete governed corpus, not an operator-selected favourable subset.
export const SCENARIOS={
 A:{title:'Supportive Reprogramme history',code:'reprogramme',ids:['reprogramme-0','reprogramme-1','reprogramme-2','programme-not-1']},
 B:{title:'Mixed Reprogramme history',code:'reprogramme',ids:['reprogramme-0','reprogramme-1','programme-not-1','programme-not-2']},
 C:{title:'Protection concern despite benefit',code:'reprogramme',ids:['reprogramme-0','reprogramme-1','reprogramme-2','programme-breach']},
 D:{title:'CP7 block remains authoritative',code:'reprogramme',blocked:true},
 E:{title:'Too little comparable history',code:'reprogramme',ids:['reprogramme-0','reprogramme-1']},
 F:{title:'Material protection-context difference',code:'reprogramme',ids:['programme-different-protection']},
 G:{title:'Repair without usage recovery',code:'repair',ids:['repair-0','repair-1','repair-2']},
 H:{title:'Preserve with low utilisation',code:'preserve',ids:['preserve-0','preserve-1','preserve-2']},
 I:{title:'Pilot benefit and evidence value differ',code:'pilot',ids:['pilot-0','pilot-1','pilot-2']},
 J:{title:'Materially deviated historical intervention',code:'reprogramme',ids:['reprogramme-0','reprogramme-1','reprogramme-2','deviated']},
 K:{title:'Missing and conflicting outcome evidence',code:'repair',ids:['repair-0','repair-1','repair-2','missing','conflict','unexecuted']},
 L:{title:'Outcome-feature leakage rejected',code:'reprogramme'},
 M:{title:'Repeated reviews, correction and duplicate',code:'repair',ids:['repair-0','repair-1','repair-2'],duplicate:true},
 N:{title:'Stronger alternative history; lower-impact preference retained',code:'pilot',comparison:true,ids:['comparison-pilot-0','comparison-pilot-1','comparison-pilot-2','comparison-reprogramme-0','comparison-reprogramme-1','comparison-reprogramme-2']},
 O:{title:'No comparable history',code:'reprogramme',ids:[]}
};
export async function scenario(key,cases,encoder){const def=SCENARIOS[key],q=makeQuery(def.code,{blocked:!!def.blocked,sourceKey:def.comparison?'comparison':null});
 if(key==='L'){const f=copy(q.features);f.outcomeFindings={goal:'Met'};try{validateFeatures(f);return{key,title:def.title,error:'LEAKAGE_WAS_NOT_REJECTED'};}catch(e){return{key,title:def.title,error:e.message,accepted:false,upstreamMutation:false};}}
 let rows=def.ids?cases.filter(c=>def.ids.some(id=>c.episodeId==='episode:'+id)):cases;if(def.duplicate)rows=[...rows,copy(rows[0])];
 const release=makeRelease(rows,{id:'qa-'+key,asOf:AS_OF}),index=await buildIndex(release,encoder),vector=encoder.available?(await encoder.embed([q.features.text]))[0]:null;
 let result=retrieve({query:q,release,index,queryVector:vector});
 if(def.comparison){const p=makeQuery('reprogramme',{sourceKey:'comparison'}),v=encoder.available?(await encoder.embed([p.features.text]))[0]:null,preferredResult=retrieve({query:p,release,index,queryVector:v});result=addTension(result,preferredResult);result.preferredAlternative={candidateId:p.candidate.id,descriptor:preferredResult.descriptor,goalCounts:preferredResult.goalCounts,authority:preferredResult.authority};}
 return{key,title:def.title,query:q,releaseDigest:release.digest,result};
}
export async function buildProduct(cases,encoder){const q=makeQuery(),release=makeRelease(cases,{id:'simulated-corpus-full-2',asOf:AS_OF}),index=await buildIndex(release,encoder),vector=encoder.available?(await encoder.embed([q.features.text]))[0]:null;return{query:q,release,index,result:retrieve({query:q,release,index,queryVector:vector})};}
