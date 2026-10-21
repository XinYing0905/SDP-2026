import fs from 'node:fs/promises';
import path from 'node:path';
import { fixtures } from '../src/data/synthetic/amenities.mjs';
import { parameters } from '../src/config/change-detection.mjs';
import { detectChange } from '../src/statistics/change-detection/detector.mjs';
const directory = path.resolve(import.meta.dirname, '../../checkpoint-3-clarification');
await fs.mkdir(directory, { recursive: true });
const results = fixtures.map(input => {
  const actual = detectChange(input);
  return { case: input.id, expectedStatus: input.expectedStatus, actualStatus: actual.status, pass: input.expectedStatus === actual.status, input, output: actual };
});
await fs.writeFile(path.join(directory, 'Cases-A-F-and-Stable.json'), JSON.stringify({ label: 'Simulated input data and computed results', parameters, results }, null, 2));
await fs.writeFile(path.join(directory, 'Provisional-MVP-Parameters.json'), JSON.stringify(parameters, null, 2));
console.log(JSON.stringify(results.map(r => ({ case: r.case, expected: r.expectedStatus, actual: r.actualStatus, pass: r.pass })), null, 2));
