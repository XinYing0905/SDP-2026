import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createResidentPlanAcceptanceCases } from '../src/data/synthetic/resident-evidence-plan-cases.mjs';
import { selectQuestionCohort } from '../src/resident-evidence/pair-selection.mjs';
import { questionCatalogue, missingResponseSemantics } from '../src/resident-evidence/question-catalogue.mjs';
import { createCp5DemoClient } from '../src/composition/cp5-demo-client.mjs';
import { renderResidentEvidencePlan, renderResidentQuestionPreview } from '../frontend/views/resident-evidence-plan.mjs';
import { createChangeViews } from '../frontend/views/change-views.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../checkpoint-5-review');
await fs.mkdir(path.join(out, 'previews'), { recursive: true });
const inputs = await createResidentPlanAcceptanceCases();
const cases = inputs.map(c => { const output = selectQuestionCohort(c.input); return { ...c, actualState: output.state, pass: c.expectedState === output.state, output }; });
await fs.writeFile(path.join(out, 'Acceptance-Cases-A-X.json'), JSON.stringify({ label: 'SIMULATED — exact inputs, expected/actual states and computed plans. Hypothetical option assertions are not collected evidence.', cases }, null, 2));
await fs.writeFile(path.join(out, 'Question-Catalogue.json'), JSON.stringify({ ...questionCatalogue, missingResponseSemantics }, null, 2));
const client = await createCp5DemoClient();
const css = (await Promise.all(['styles.css', 'next-evidence.css', 'resident-evidence-plan.css'].map(f => fs.readFile(path.join(root, 'frontend', f), 'utf8')))).join('\n');
const page = (title, body) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style><body>${body}</body></html>`;
for (const c of cases) {
  const id = c.input.amenityId, plan = { contractVersion: 'resident-evidence-plan.v1', amenityId: id, result: c.output };
  const change = await client.getChangeEvidence(id);
  // Variant acceptance inputs are explicitly labelled and rendered with their own bound upstream context.
  const html = createChangeViews({ results: [change.entry], parameters: change.parameters, metricDefinitions: change.metricDefinitions, simulationNotice: change.simulationNotice,
    diagnosisEvidence: c.input.diagnosisEnvelope, nextEvidence: c.input.nextEvidenceEnvelope, residentEvidencePlan: plan }).evidence(id);
  await fs.writeFile(path.join(out, 'previews', `Case-${c.case}-operator.html`), page(`CP5 acceptance ${c.case} — operator`, html.replaceAll(`href="#resident-preview/${id}"`, `href="Case-${c.case}-resident.html"`)));
  await fs.writeFile(path.join(out, 'previews', `Case-${c.case}-resident.html`), page(`CP5 acceptance ${c.case} — resident preview`, renderResidentQuestionPreview(plan).replaceAll(`href="#case/${id}"`, `href="Case-${c.case}-operator.html#resident-evidence-plan"`)));
}
const golden = JSON.parse(await fs.readFile(path.join(root, 'tests/baseline/approved-cp4.json'), 'utf8'));
const files = [];
for (const [file, expected] of Object.entries(golden.hashes)) { const actual = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex'); files.push({ file, expected, actual, unchanged: expected === actual }); }
const outputs = [];
for (const c of golden.cases) outputs.push({ id: c.id, diagnosisUnchanged: JSON.stringify(await client.getCompetingDiagnosis(c.id)) === JSON.stringify(c.diagnosis), cp4Unchanged: JSON.stringify(await client.getNextBestEvidence(c.id)) === JSON.stringify(c.nextEvidence) });
const overviewUnchanged = JSON.stringify(await client.getOverview()) === JSON.stringify(golden.overview);
await fs.writeFile(path.join(out, 'Approved-Logic-Preservation.json'), JSON.stringify({ files, outputs, overviewUnchanged }, null, 2));
await fs.writeFile(path.join(out, 'Acceptance-Summary.json'), JSON.stringify(cases.map(c => ({ case: c.case, description: c.description, expected: c.expectedState, actual: c.actualState, selectedPair: c.output.selectedPair?.id ?? null, tiedPairs: c.output.tiedPairIds, pass: c.pass })), null, 2));
await fs.writeFile(path.join(out, 'Operator-Resident-Previews.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkpoint 5 review previews</title><style>body{font:15px/1.7 system-ui;max-width:1000px;margin:40px auto;padding:20px;color:#233b45}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;text-align:left;padding:12px}a{color:#256d74}</style><h1>Checkpoint 5 — review previews</h1><p>Actual module-generated static snapshots, not browser screenshots or the application architecture. All inputs and option findings are simulated. Variant acceptance cases are labelled below; the live application uses the unchanged CP4 NB-A through NB-J cases.</p><p>No dispatch, invitations, submission, storage, aggregation, evidence conversion or reassessment exists. Resident previews are unavailable for tied, stale, not-eligible and no-valid-pair plans.</p><table><thead><tr><th>Case / condition</th><th>Computed state</th><th>Previews</th></tr></thead><tbody>${cases.map(c => `<tr><td>${c.case} — ${c.description}</td><td>${c.actualState}</td><td><a href="previews/Case-${c.case}-operator.html#resident-evidence-plan">Operator</a> · <a href="previews/Case-${c.case}-resident.html">Resident / blocked state</a></td></tr>`).join('')}</tbody></table><p>Stop after CP5. No subsequent stage has begun.</p></html>`);
await fs.copyFile(path.resolve(root, '../checkpoint-5-design/Checkpoint-5-Scope-Design-Review.md'), path.join(out, 'Approved-CP5-Scope-Design.md'));
console.log(JSON.stringify({ cases: cases.length, pass: cases.filter(c => c.pass).length, states: [...new Set(cases.map(c => c.actualState))], sourceFilesUnchanged: files.every(f => f.unchanged), outputsUnchanged: outputs.every(c => c.diagnosisUnchanged && c.cp4Unchanged), overviewUnchanged }, null, 2));
if (cases.some(c => !c.pass) || files.some(f => !f.unchanged) || outputs.some(c => !c.diagnosisUnchanged || !c.cp4Unchanged) || !overviewUnchanged) process.exitCode = 1;
