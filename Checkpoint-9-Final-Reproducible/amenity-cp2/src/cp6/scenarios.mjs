import { makeCp6Fixture } from './fixtures.mjs';
import { createResponseRepository } from './repository.mjs';
import { createResidentResponseService } from './service.mjs';
const distributions={
  A:['PF-MOSTLY',...Array(8).fill('PF-NOT-REALLY')],
  B:[...Array(7).fill('PF-YES'),'PF-MOSTLY','PF-MOSTLY'],
  C:['PF-YES','PF-YES','PF-YES','PF-MOSTLY',...Array(4).fill('PF-NOT-REALLY'),'VOLUNTARY_SKIP'],
  D:['PF-NOT-REALLY','PF-NOT-REALLY',...Array(3).fill('UNABLE_TO_ASSESS'),'VOLUNTARY_SKIP','VOLUNTARY_SKIP'],
  E:[...Array(8).fill('PF-NO-LONGER-NEED'),'UNABLE_TO_ASSESS'],
  G:[...Array(3).fill('UNABLE_TO_ASSESS'),'VOLUNTARY_SKIP','VOLUNTARY_SKIP'],
  H:[...Array(8).fill('DN-ESSENTIAL'),'DN-IMPORTANT']
};
export function runResponseScenario(letter) {
  const key=letter==='I'?'insufficient':letter==='H'?'protection-incomplete':'resolving';
  const f=makeCp6Fixture(key),fixtures=new Map([[key,f]]),repo=createResponseRepository(':memory:');
  const service=createResidentResponseService({repository:repo,fixtures,clock:()=> '2026-07-28T12:00:00.000Z'});
  try{
    const initialFixture=structuredClone(f);
    const opened=service.open({fixtureKey:key,operatorApproved:true}),c=opened.collection;
    const options=distributions[letter]??distributions.A,requests=[];
    for(let i=0;i<options.length;i++) {
      const request={optionId:options[i],idempotencyKey:`${letter}-${i}`,questionVersion:c.pair.questionVersion,cohortVersion:c.pair.cohortVersion,planDigest:c.planDigest};
      const receipt=service.submit(c.id,opened.access[i].token,request);requests.push({recipientRef:opened.access[i].recipientRef,request,receipt});
    }
    if(letter==='F')f.intendedRoster[0].eligible=false;
    const closed=service.close(c.id,service.get(c.id).revision);
    const result=letter==='F'?closed:service.reassess(c.id,service.get(c.id).revision);
    return {case:letter,fixture:key,input:{fixture:initialFixture,currentFixture:f,responseOptions:options,policy:c.policy,intendedRoster:10},requests,closed,result,collection:service.get(c.id),events:repo.events(c.id)};
  }finally{repo.close();}
}
