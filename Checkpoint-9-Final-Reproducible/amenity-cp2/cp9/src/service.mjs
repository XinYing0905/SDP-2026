import {retrieve} from './retrieval.mjs';import {hash,check} from './core.mjs';
export function createSuitabilityService({repository,encoder,currentQueryProvider}){
 return Object.freeze({async inspect({candidateId,queryId,releaseId,indexId,expectedQueryDigest,queryAsOf,technical=false}){
  const query=currentQueryProvider.get(queryId,candidateId,queryAsOf?{asOf:queryAsOf}:{});check(hash(query)===expectedQueryDigest,'STALE_QUERY_INPUT');const release=repository.get('corpus',releaseId);let index=repository.get('index',indexId);
  if(index.semanticAvailable&&!encoder.available){const{digest,...body}=index;body.semanticAvailable=false;body.reason=encoder.reason??'Semantic model unavailable';index={...body,digest:hash(body)};repository.put('index',index.digest,index);}
  if(index.semanticAvailable)check(encoder.version.digest===index.model.digest,'SEMANTIC_MODEL_OR_VERSION_UNAVAILABLE');
  const queryVector=encoder.available&&index.semanticAvailable?(await encoder.embed([query.features.text]))[0]:null;
  // Re-read after asynchronous model inference: do not publish stale input evidence.
  check(hash(currentQueryProvider.get(queryId,candidateId,{asOf:query.asOf}))===expectedQueryDigest,'QUERY_CHANGED_DURING_RETRIEVAL');
  const result=retrieve({query,release,index,queryVector,mode:technical?'technical':'product'}),id=hash(result);repository.put('retrieval',id,result);return{id,...result};
 },get:id=>repository.get('retrieval',id)});
}
