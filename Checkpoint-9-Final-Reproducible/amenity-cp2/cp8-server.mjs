import path from 'node:path';import { createInterventionDecisionRepository } from './src/data/repositories/intervention-decision-repository.mjs';
import { seedOutcomePlans } from './src/data/synthetic/outcome-review-cases.mjs';import { createOutcomeReviewServer } from './src/api/outcome-review-http.mjs';
const demo=process.argv.includes('--demo'),root=import.meta.dirname;
const cp7Filename=(demo?process.env.CP8_DEMO_CP7_DATABASE:process.env.CP7_DATABASE)??path.join(root,'data',demo?'cp8-synthetic-approved-plans.sqlite':'cp7-demo.sqlite');let demoPlans=null;
if(demo){const r=createInterventionDecisionRepository(cp7Filename);try{demoPlans=seedOutcomePlans(r);}finally{r.close();}}
const app=createOutcomeReviewServer({filename:process.env.CP8_DATABASE??path.join(root,'data',demo?'cp8-synthetic-outcomes.sqlite':'cp8-outcomes.sqlite'),cp7Filename,demoPlans});
app.server.listen(Number(process.env.CP8_PORT??4178),'127.0.0.1',()=>console.log(`Outcome Review: http://127.0.0.1:${app.server.address().port} • ${demo?'Simulated records/time; separate synthetic CP7 approvals':'Read-only actual saved CP7 decisions'} • No execution`));
