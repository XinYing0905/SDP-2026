import path from 'node:path';import { createInterventionDecisionServer } from './src/api/intervention-decision-http.mjs';
const app=createInterventionDecisionServer({filename:process.env.CP7_DATABASE??path.join(import.meta.dirname,'data','cp7-demo.sqlite')});
const port=Number(process.env.CP7_PORT??4177);app.server.listen(port,'127.0.0.1',()=>console.log(`Intervention decision demo: http://127.0.0.1:${port}\nLocal SQLite plan records only. No intervention execution, outcome ingestion or AI/ML.`));
process.on('SIGINT',()=>app.close().then(()=>process.exit(0)));
