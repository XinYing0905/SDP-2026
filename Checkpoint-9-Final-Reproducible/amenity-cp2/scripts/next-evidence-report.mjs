import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { nextEvidenceCases } from '../src/data/synthetic/next-evidence-cases.mjs';
import { diagnosisCases } from '../src/data/synthetic/diagnosis-cases.mjs';
import { detectChange } from '../src/statistics/change-detection/detector.mjs';
import { diagnoseCompeting } from '../src/diagnosis/competing-diagnosis.mjs';
import { createDemoChangeClient } from '../src/composition/demo-client.mjs';
import { nextEvidenceParameters } from '../src/config/next-best-evidence.mjs';
import { createChangeViews } from '../frontend/views/change-views.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(root, '../checkpoint-4-review');
await fs.mkdir(path.join(out, 'previews'), { recursive: true });
const client = createDemoChangeClient();
const css = await fs.readFile(path.join(root, 'frontend/styles.css'), 'utf8') + '\n' + await fs.readFile(path.join(root, 'frontend/next-evidence.css'), 'utf8');
const cases = [];
for (const input of nextEvidenceCases) {
  const result = (await client.getNextBestEvidence(input.amenity.id)).result;
  const diagnosis = (await client.getCompetingDiagnosis(input.amenity.id)).result;
  const actual = { top: result.nextBestCandidateIds, explanation: result.sufficiency.explanationSufficiency.state, protection: result.sufficiency.protectionContextSufficiency.state };
  const expected = { top: input.expectedTop, explanation: input.expectedExplanation, protection: input.expectedProtection };
  cases.push({ case: input.case, provenance: 'Synthetic case and operator feasibility inputs; all possible findings are hypothetical', input, upstream: detectChange(input.amenity), diagnosis, expected, actual, pass: JSON.stringify(actual) === JSON.stringify(expected), output: result });
  const evidence = await client.getChangeEvidence(input.amenity.id);
  const html = createChangeViews({ results: [evidence.entry], parameters: evidence.parameters, metricDefinitions: evidence.metricDefinitions, simulationNotice: evidence.simulationNotice,
    diagnosisEvidence: await client.getCompetingDiagnosis(input.amenity.id), nextEvidence: await client.getNextBestEvidence(input.amenity.id) }).evidence(input.amenity.id);
  await fs.writeFile(path.join(out, 'previews', `${input.amenity.id}.html`), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CP4 review snapshot ${input.case}</title><style>${css}</style><body>${html}</body></html>`);
}
await fs.writeFile(path.join(out, 'Evidence-Cases-A-J.json'), JSON.stringify({ label: 'SIMULATED — exact inputs, expected/actual results and hypothetical outcome branches. No real-world accuracy claim.', cases }, null, 2));
await fs.writeFile(path.join(out, 'Provisional-Parameters.json'), JSON.stringify(nextEvidenceParameters, null, 2));
const approved = JSON.parse(await fs.readFile(path.join(root, 'tests/baseline/approved-cp3-clarification.json'), 'utf8'));
const files = await Promise.all(Object.entries(approved.hashes).map(async ([file, expected]) => { const actual = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex'); return { file, expected, actual, unchanged: expected === actual }; }));
const outputs = diagnosisCases.map(c => ({ id: c.amenity.id, unchanged: JSON.stringify(diagnoseCompeting({ changeResult: detectChange(c.amenity), evidence: c.evidence })) === JSON.stringify(approved.cases.find(g => g.id === c.amenity.id).result) }));
await fs.writeFile(path.join(out, 'Approved-Logic-Preservation.json'), JSON.stringify({ files, outputs }, null, 2));
await fs.writeFile(path.join(out, 'Operator-Preview.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkpoint 4 review snapshots</title><style>body{font:16px/1.7 system-ui;max-width:900px;margin:40px auto;padding:20px;color:#233b45}li{margin:15px 0}a{color:#256d74}</style><h1>Checkpoint 4 — operator review snapshots</h1><p>Static renderings from the actual modular presentation/service pipeline. These are review artifacts, with no embedded detector or ranking engine. They are not browser screenshots or the architectural source of truth.</p><p>All data and possible findings are simulated. Live modular application: run <code>npm start</code> in the source folder and open a case URL listed in the review.</p><ul>${nextEvidenceCases.map(c => `<li><a href="previews/${c.amenity.id}.html#next-evidence">Case ${c.case}: ${c.amenity.name}</a></li>`).join('')}</ul><p>Checkpoint 5 has not begun.</p></html>`);
console.log(JSON.stringify(cases.map(c => ({ case: c.case, expected: c.expected, actual: c.actual, pass: c.pass })), null, 2));
if (cases.some(c => !c.pass) || files.some(f => !f.unchanged) || outputs.some(o => !o.unchanged)) process.exitCode = 1;
