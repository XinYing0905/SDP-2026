import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { diagnosisCases } from '../src/data/synthetic/diagnosis-cases.mjs';
import { fixtures } from '../src/data/synthetic/amenities.mjs';
import { parameters } from '../src/config/change-detection.mjs';
import { diagnosisParameters, diagnosisStates } from '../src/config/diagnosis.mjs';
import { detectChange } from '../src/statistics/change-detection/detector.mjs';
import { diagnoseCompeting } from '../src/diagnosis/competing-diagnosis.mjs';
import { createDemoChangeClient } from '../src/composition/demo-client.mjs';
import { renderDiagnosisEvidence } from '../frontend/views/diagnosis-evidence.mjs';
import { startChangeApplication } from '../frontend/application.mjs';
const copy = letter => structuredClone(diagnosisCases.find(c => c.canonicalCase === letter));
const run = (input, p = diagnosisParameters) => diagnoseCompeting({ changeResult: detectChange(input.amenity, parameters), evidence: input.evidence }, p);
const state = (result, name) => result.diagnoses.find(d => d.name === name);

for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
  test(`Canonical diagnosis ${letter}: upstream qualification, fixed states and expected support/sufficiency`, () => {
    const input = copy(letter), result = run(input);
    assert.equal(detectChange(input.amenity).status, 'Needs Attention');
    assert.equal(result.executionState, 'Assessed');
    assert.deepEqual(result.diagnoses.map(d => d.name), diagnosisStates);
    for (const name of input.expectedStrong) assert.equal(state(result, name).supportLabel, 'Strong Support');
    assert.equal(result.evidenceSufficiency.explanationSufficiency.state, letter === 'D' ? 'Insufficient Evidence' : input.expectedSufficiency);
    assert.equal(result.evidenceSufficiency.protectionContextSufficiency.state, letter === 'E' ? 'Insufficient Evidence' : 'Sufficient Evidence');
    for (const d of result.diagnoses) {
      assert.ok(Array.isArray(d.supportingEvidence) && Array.isArray(d.contradictingEvidence) && Array.isArray(d.missingEvidence));
      assert.equal(typeof d.rawEvidenceSupport, 'number');
      for (const key of ['probability', 'causalProbability', 'recommendation']) assert.equal(key in d, false);
    }
    for (const key of ['nextBestEvidence', 'question', 'intervention', 'interventionRecommendation', 'modelPrediction']) assert.equal(key in result, false);
  });
}
test('B: aggregate decline alone does not strongly support persistent mismatch', () => {
  const r = run(copy('B'));
  assert.equal(r.checks.residentMix.state, 'Concentrated Among Recent Residents');
  assert.notEqual(state(r, diagnosisStates[2]).supportLabel, 'Strong Support');
});
test('D: low usage high dependency is value context, not an invented explanation for decline', () => {
  const r = run(copy('D'));
  assert.equal(r.protection.highDependency, true);
  assert.equal(r.evidenceSufficiency.explanationSufficiency.primaryExplanation, null);
  assert.ok(r.evidenceSufficiency.supportedStates.includes(diagnosisStates[3]));
});
test('E: close plausible explanations remain visible with no fabricated winner', () => {
  const r = run(copy('E'));
  assert.deepEqual(r.evidenceSufficiency.explanationSufficiency.plausibleExplanations, [diagnosisStates[0], diagnosisStates[2]]);
  assert.equal(r.evidenceSufficiency.explanationSufficiency.primaryExplanation, null);
  assert.ok(state(r, diagnosisStates[0]).missingEvidence.length > 0);
});
test('F: strong support cannot bypass unknown resident-mix and horizon gates', () => {
  const r = run(copy('F'));
  assert.equal(state(r, diagnosisStates[2]).supportLabel, 'Strong Support');
  assert.equal(r.checks.residentMix.state, 'Unknown');
  assert.equal(r.features.mixControlled.value, null);
  assert.equal(r.evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('G: operational and high dependency support coexist without sum-to-100 normalization', () => {
  const r = run(copy('G'));
  assert.equal(state(r, diagnosisStates[0]).rawEvidenceSupport, 9);
  assert.equal(state(r, diagnosisStates[3]).rawEvidenceSupport, 13);
  assert.equal(r.protection.relevant, true);
  assert.equal(r.protection.highDependency, true);
  assert.equal(r.diagnoses.some(d => 'percentage' in d), false);
});
test('Temporal check does not reuse Needs Attention as persistence proof', () => {
  const input = copy('A'); input.evidence.temporal = null;
  const r = run(input);
  assert.equal(r.upstreamStatus, 'Needs Attention');
  assert.equal(r.checks.temporal.persistent, null);
  assert.equal(r.evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('Known temporal context prevents an ordinary persistent diagnosis pattern', () => {
  const input = copy('C'); input.evidence.temporal.observations.at(-1).exceptional = true;
  const r = run(input);
  assert.equal(r.checks.temporal.state, 'Affected by Known Exceptional Context');
  assert.equal(r.features.persistentPattern.value, null);
  assert.equal(r.evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('Missing temporal period/context stays insufficiently observed', () => {
  const input = copy('C'); input.evidence.temporal.observations.splice(3, 1);
  assert.equal(run(input).checks.temporal.state, 'Insufficiently Observed');
  const another = copy('C'); delete another.evidence.temporal.observations.at(-1).exceptional;
  assert.equal(run(another).checks.temporal.state, 'Insufficiently Observed');
});
test('Ownership status swaps have no scoring/check effect', () => {
  const input = copy('C'), baseline = run(input);
  input.evidence.residentMix.cohorts.forEach(c => c.occupancyStatus = c.occupancyStatus === 'Tenant' ? 'Owner-occupier' : 'Tenant');
  const swapped = run(input);
  assert.deepEqual(swapped, baseline);
});
test('Residence duration alone is not cohort stability; missing denominators remain unknown', () => {
  const input = copy('C'); input.evidence.residentMix.cohorts.forEach(c => { c.populationAfter = null; });
  const r = run(input);
  assert.equal(r.checks.residentMix.state, 'Unknown');
  assert.equal(r.features.stableCohortDecline.value, null);
});
test('Poor retention prevents treating long-tenure groups as stable cohorts', () => {
  const input = copy('C'); input.evidence.residentMix.cohorts.forEach(c => c.retainedFraction = 0.2);
  assert.equal(run(input).checks.residentMix.state, 'Unknown');
});
test('Missing dependency stays unknown and contributes no dependency-feature contradiction', () => {
  const input = copy('D'); input.evidence.dependency = null;
  const r = run(input), d = state(r, diagnosisStates[3]);
  assert.equal(r.checks.dependency.complete, false);
  assert.equal(r.features.documentedDependency.value, null);
  assert.equal(d.rawEvidenceSupport, 1); // only observed low utilisation; no missing-feature penalty
  assert.equal(d.contradictingEvidence.length, 0);
  assert.equal(d.supportLabel, 'Limited / Contradicted Support');
  assert.equal(r.evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('Realistic alternative capacity/accessibility changes dependency finding, not operational evidence', () => {
  const input = copy('G'), before = run(input);
  Object.assign(input.evidence.dependency.alternatives[0], { distanceKm: 1, accessible: true, availableCapacity: 50 });
  const after = run(input);
  assert.equal(after.checks.dependency.limitedSubstitutes, false);
  assert.equal(after.protection.highDependency, false);
  assert.equal(after.protection.relevant, true);
  assert.equal(state(after, diagnosisStates[0]).rawEvidenceSupport, state(before, diagnosisStates[0]).rawEvidenceSupport);
});
test('Unknown alternatives cannot be represented as no substitutes', () => {
  const input = copy('D'); input.evidence.dependency.alternatives = null;
  const r = run(input);
  assert.equal(r.checks.dependency.limitedSubstitutes, null);
  assert.equal(state(r, diagnosisStates[3]).supportLabel, 'Strong Support');
  assert.equal(r.evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('One known realistic alternative remains evidence even if another alternative is unknown', () => {
  const input = copy('D');
  input.evidence.dependency.alternatives.push({ id: 'known-accessible', distanceKm: 1, accessible: true, capacity: 50, availableCapacity: 50 });
  input.evidence.dependency.alternatives[0].availableCapacity = null;
  assert.equal(run(input).checks.dependency.limitedSubstitutes, false);
});
test('Missing operational records never become healthy maintenance', () => {
  const input = copy('C'); input.evidence.operations = null;
  const r = run(input);
  assert.equal(r.features.operationalHealthy.value, null);
  assert.equal(r.features.operationalIssue.value, null);
});
test('Entirely missing diagnosis evidence yields unknowns, no winner and no fabricated support', () => {
  const input = copy('C'); input.evidence = { asOf: '2026-07-26', decisionHorizon: 'long-term' };
  const r = run(input);
  assert.ok(r.diagnoses.every(d => d.rawEvidenceSupport === 0 && d.supportLabel === 'Unassessed'));
  assert.equal(r.evidenceSufficiency.explanationSufficiency.primaryExplanation, null);
  assert.equal(r.evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('Future evidence cannot leak into current diagnosis', () => {
  const input = copy('C'); input.evidence.residentMix.availableAt = '2026-08-01';
  assert.equal(run(input).checks.residentMix.state, 'Unknown');
});
test('Longer decision horizon requires stronger evidence without privileging ownership', () => {
  const input = copy('A'); input.evidence.residentMix = null; input.evidence.dependency = null;
  assert.equal(run(input).evidenceSufficiency.explanationSufficiency.state, 'Sufficient Evidence');
  input.evidence.decisionHorizon = 'long-term';
  assert.equal(run(input).evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('Provisional weights are live configuration, not per-scenario hardcoded answers', () => {
  const input = copy('A'), p = structuredClone(diagnosisParameters);
  p.weights[diagnosisStates[0]].operationalIssue[0] = 0;
  assert.equal(state(run(input, p), diagnosisStates[0]).rawEvidenceSupport, state(run(input), diagnosisStates[0]).rawEvidenceSupport - 4);
});
test('Increasing temporal usage does not become evidence of persistent decline', () => {
  const input = copy('C'); input.evidence.temporal.observations.slice(-3).forEach(row => row.usage = 150);
  const r = run(input);
  assert.equal(r.checks.temporal.direction, 'increase');
  assert.equal(r.features.persistentPattern.value, false);
  assert.equal(r.evidenceSufficiency.explanationSufficiency.state, 'Insufficient Evidence');
});
test('Unqualified upstream Stable / Monitoring cases do not execute diagnosis', () => {
  for (const id of ['A', 'C', 'S']) {
    const r = diagnoseCompeting({ changeResult: detectChange(fixtures.find(f => f.id === id)), evidence: copy('C').evidence });
    assert.equal(r.executionState, 'Not Assessed'); assert.equal('diagnoses' in r, false);
  }
});
test('Contract/UI: canonical records are separate; original overview remains exactly seven records', async () => {
  const client = createDemoChangeClient();
  assert.deepEqual((await client.getOverview()).entries.map(e => e.input.id), ['A', 'B', 'C', 'D', 'E', 'F', 'S']);
  const envelope = await client.getCompetingDiagnosis('DX-G');
  const html = renderDiagnosisEvidence(envelope);
  for (const name of diagnosisStates) assert.ok(html.includes(name));
  assert.ok(html.includes('Dependent-cohort protection remains visible'));
  assert.ok(html.includes('not causal probability'));
  assert.doesNotMatch(html, /<button|Ask residents|Run a pilot|Recommend repair/);
  const change = await client.getChangeEvidence('DX-G');
  assert.equal(change.entry.result.status, 'Needs Attention');
});
test('Controller renders diagnosis only in case evidence and retains change evidence on diagnosis transport failure', async () => {
  const client = createDemoChangeClient(), root = { innerHTML: '', textContent: '' }, location = { hash: '#case/DX-E' };
  const app = await startChangeApplication({ client, document: { querySelector: () => root }, window: { addEventListener() {}, removeEventListener() {}, scrollTo() {} }, location });
  assert.ok(root.innerHTML.includes('Evidence-Based Competing Diagnosis'));
  assert.ok(root.innerHTML.includes('Insufficient Evidence'));
  app.dispose();
  const broken = await startChangeApplication({ client: { getOverview: () => client.getOverview(), getChangeEvidence: id => client.getChangeEvidence(id), getCompetingDiagnosis: async () => { throw new Error('offline'); } }, document: { querySelector: () => root }, window: { addEventListener() {}, removeEventListener() {}, scrollTo() {} }, location });
  assert.ok(root.innerHTML.includes('Change evidence'));
  assert.ok(root.innerHTML.includes('Diagnosis evidence unavailable'));
  broken.dispose();
});
test('Diagnosis UI imports no scoring/features/check/service implementations', async () => {
  const source = await fs.readFile(new URL('../frontend/views/diagnosis-evidence.mjs', import.meta.url), 'utf8');
  assert.equal(source.split('\n').filter(line => line.startsWith('import ')).length, 0);
});
