import { createCp6Server } from './src/cp6/http-server.mjs';
import path from 'node:path';
const app=createCp6Server({filename:process.env.CP6_DATABASE??path.join(import.meta.dirname,'data','cp6-demo.sqlite')});
const port=Number(process.env.CP6_PORT??4176);
app.server.listen(port,'127.0.0.1',()=>console.log(`CP6 simulated local application: http://127.0.0.1:${port}\nOn-disk SQLite; no production notifications or authentication.`));
process.on('SIGINT',()=>app.close().then(()=>process.exit(0)));
