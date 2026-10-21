import { createCp5DemoClient } from '../src/composition/cp5-demo-client.mjs';
import { startChangeApplication } from './application.mjs';

await startChangeApplication({ client: await createCp5DemoClient(), document, window, location });
