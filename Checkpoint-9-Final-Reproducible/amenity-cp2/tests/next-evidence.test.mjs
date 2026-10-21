import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { nextEvidenceCases } from '../src/data/synthetic/next-evidence-cases.mjs';
import { diagnosisCases } from '../src/data/synthetic/diagnosis-cases.mjs';
import { fixtures } from '../src/data/synthetic/amenities.mjs';
import { nextEvidenceParameters } from '../src/config/next-best-evidence.mjs';
import { identifyNextBestEvidence } from '../src/next-evidence/next-best-evidence.mjs';
import { detectChange } from '../src/statistics/change-detection/detector.mjs';
import { diagnoseCompeting } from '../src/diagnosis/competing-diagnosis.mjs';
import { createDemoChangeClient } from '../src/composition/demo-client.mjs';
import { createHttpChangeTransport } from '../src/api/http-change-transport.mjs';
import { createChangeClient } from '../src/api/change-client.mjs';
import { nextEvidencePath, assertNextEvidenceEnvelope } from '../src/shared/next-evidence-contract.mjs';
import { renderNextEvidence } from '../frontend/views/next-evidence.mjs';
import { startChangeApplication } from '../frontend/application.mjs';
const input = letter => structuredClone(nextEvidenceCases.find(c => c.case === letter));
const run = (c, p) => identifyNextBestEvidence({ changeResult: detectChange(c.amenity), evidence: c.evidence, decisionContext: c.decisionContext }, p);
const candidate = (r, id) => r.candidates.find(c => c.id === id);

test('All approved CP3 engine/config/fixture and existing test files retain exact bytes', async () => {
  const golden = JSON.parse(await fs.readFile(new URL('./baseline/approved-cp3-clarification.json', import.meta.url)));
  for (const [file, hash] of Object.entries(golden.hashes)) assert.equal(crypto.createHash('sha256').update(await fs.readFile(new URL('../' + file, import.meta.url))).digest('hex'), hash, file);
});
for (const c of diagnosisCases) test(`Full approved CP3 output is preserved: ${c.amenity.id}`, async () => {
  const golden = JSON.parse(await fs.readFile(new URL('./baseline/approved-cp3-clarification.json', import.meta.url)));
  const expected = golden.cases.find(g => g.id === c.amenity.id).result;
  const before = diagnoseCompeting({ changeResult: detectChange(c.amenity), evidence: c.evidence });
  assert.deepEqual(before, expected);
  identifyNextBestEvidence({ changeResult: detectChange(c.amenity), evidence: c.evidence });
  assert.deepEqual(diagnoseCompeting({ changeResult: detectChange(c.amenity), evidence: c.evidence }), expected);
});
for (const c of nextEvidenceCases) test(`CP4 Case ${c.case}: expected evidence priority and separated sufficiency`, () => {
  const r = run(c);
  assert.deepEqual(r.nextBestCandidateIds, c.expectedTop);
  assert.equal(r.sufficiency.explanationSufficiency.state, c.expectedExplanation);
  assert.equal(r.sufficiency.protectionContextSufficiency.state, c.expectedProtection);
  assert.equal(r.collectionTriggered, false); assert.equal(r.interventionSelected, false);
});
test('Low sufficiency does not automatically select resident input', () => {
  for (const letter of ['A', 'B', 'E', 'G']) assert.equal(run(input(letter)).residentInputEligibleForLaterSelection, false);
  assert.equal(run(input('C')).residentInputEligibleForLaterSelection, true);
});
test('Every valuable candidate targets an explicit unresolved gap and demonstrates material effect', () => {
  for (const c of nextEvidenceCases) for (const x of run(c).candidates) {
    if (!x.eligible) { assert.equal(x.score, 0); continue; }
    assert.ok(x.targetGaps.length && x.score > 0);
    assert.ok(x.outcomes.some(o => o.resolvedGapIds.length || o.pathwayChanged));
    assert.ok(x.targetGaps.every(g => g.dimension && g.decisionRelevance && g.question));
  }
});
test('A missing unused programme feature does not request more evidence when explanation and protection suffice', () => {
  const c = input('F'); c.evidence.feedback = null; c.evidence.programme = null;
  const r = run(c); assert.equal(r.gaps.length, 0); assert.deepEqual(r.nextBestCandidateIds, []);
});
test('Counterfactual planning never mutates actual evidence, source dates, context or approved outputs', () => {
  for (const c of nextEvidenceCases) { const original = structuredClone(c); run(c); assert.deepEqual(c, original); }
});
test('Resident dependency reports cannot establish alternatives or repeat-use history', () => {
  const r = run(input('D')), x = candidate(r, 'dependencyResidents');
  assert.ok(x.outcomes.every(o => !o.resolvedGapIds.includes('repeat-dependency') && !o.resolvedGapIds.includes('realistic-substitutes')));
  assert.ok(x.outcomes.filter(o => o.projectedAssessment).every(o => o.projectedAssessment.protectionContextSufficiency === 'Insufficient Evidence'));
  assert.equal(r.sufficiency.explanationSufficiency.state, 'Sufficient Evidence');
});
test('Dependency and substitutes each have a valid record/inspection evidence route without replacing explanation', () => {
  const r = run(input('D'));
  assert.ok(candidate(r, 'dependencyRecords').eligible);
  assert.ok(candidate(r, 'substitutes').eligible);
  assert.ok(candidate(r, 'dependencyRecords').outcomes.some(o => o.resolvedGapIds.includes('repeat-dependency')));
  assert.ok(candidate(r, 'substitutes').outcomes.some(o => o.resolvedGapIds.includes('realistic-substitutes')));
});
test('Known high dependency does not resolve the explanation of change', () => {
  const r = run(input('E'));
  assert.equal(r.sufficiency.protectionContextSufficiency.highDependency, true);
  assert.equal(r.sufficiency.protectionContextSufficiency.state, 'Sufficient Evidence');
  assert.equal(r.sufficiency.explanationSufficiency.state, 'Insufficient Evidence');
  assert.ok(r.gaps.every(g => g.dimension === 'Explanation'));
});
test('All sources unavailable retains unknown gaps and never defaults to a survey', () => {
  const r = run(input('G'));
  assert.equal(r.state, 'No actionable evidence candidate'); assert.deepEqual(r.nextBestCandidateIds, []);
  assert.equal(r.residentInputEligibleForLaterSelection, false);
  assert.ok(r.candidates.every(c => c.score === 0 && c.blockedReasons.length));
});
test('Unspecified feasibility is unknown, not an assumed available evidence source', () => {
  const c = input('A'); c.decisionContext = {};
  assert.deepEqual(run(c).nextBestCandidateIds, []);
});
test('Missing and future cohort/usage sources are not fabricated into valid records', () => {
  const c = input('B'); c.decisionContext.cohortRecordSource.availableAt = '2099-01-01';
  assert.equal(candidate(run(c), 'cohorts').eligible, false);
  const d = input('D'); d.decisionContext.dependencyUsageSource.availableAt = '2099-01-01';
  assert.equal(candidate(run(d), 'dependencyRecords').eligible, false);
  assert.equal(candidate(run(d), 'substitutes').eligible, false);
});
test('No future-dated actual source is used to design a counterfactual', () => {
  const c = input('A'); c.evidence.temporal.availableAt = '2099-01-01';
  const r = run(c); assert.equal(candidate(r, 'observation').eligible, false);
  assert.ok(r.sourceWarnings.some(w => w.includes('temporal') && w.includes('not used')));
});
test('Temporal missing or malformed grid cannot crash the planner or become zero usage', () => {
  const c = input('A'); c.evidence.temporal.observations[0].periodStart = 'invalid';
  assert.equal(candidate(run(c), 'observation').eligible, false);
  c.evidence.temporal = null; assert.equal(candidate(run(c), 'observation').eligible, false);
});
test('Contrasting and inconclusive findings are shown; no favourable answer is assumed', () => {
  const r = run(input('A'));
  for (const c of r.candidates) {
    assert.ok(c.outcomes.some(o => o.kind === 'Inconclusive'));
    if (c.eligible && c.id !== 'dependencyRecords') assert.ok(c.outcomes.length >= 3);
  }
  const x = candidate(r, 'residents');
  assert.ok(x.outcomes.some(o => o.label.includes('continuing programme fit')));
  assert.equal(x.outcomes.at(-1).resolvedGapIds.length, 0);
});
test('Maintenance review does not invent a physical inspection or erase downtime', () => {
  const r = run(input('A'));
  for (const o of candidate(r, 'maintenance').outcomes.filter(o => o.hypotheticalPatch)) {
    assert.equal(o.hypotheticalPatch.operations.inspectionHealthy, null);
    assert.equal(o.hypotheticalPatch.operations.downtimeHours, 8);
  }
});
test('All four residence-duration groups are preserved by cohort planning, with no ownership weighting', () => {
  const c = input('B'); c.decisionContext.availableCohortRecords.push({ ...c.decisionContext.availableCohortRecords[0], cohortId: 'intermediate', residenceDuration: '6–24 months' });
  const first = run(c);
  for (const row of c.decisionContext.availableCohortRecords) row.occupancyStatus = 'Owner-occupier';
  assert.deepEqual(run(c).nextBestCandidateIds, first.nextBestCandidateIds);
  for (const o of candidate(first, 'cohorts').outcomes.filter(o => o.hypotheticalPatch)) assert.ok(o.hypotheticalPatch.residentMix.cohorts.some(c => c.residenceDuration === '6–24 months'));
});
test('A temporary pilot is one intervention generating evidence, never a separate fake feedback record', () => {
  const r = run(input('H')), p = candidate(r, 'pilot');
  assert.equal(p.evidenceRole, 'Intervention that generates evidence'); assert.equal(p.approvalRequired, true); assert.equal(p.executionImplemented, false);
  assert.ok(p.outcomes.every(o => !o.hypotheticalPatch));
  assert.ok(p.outcomes.some(o => o.label.includes('do not improve')));
  assert.ok(p.outcomeDefinition.measures.some(m => m.includes('Protected cohort')));
  assert.match(p.outcomeDefinition.lifecycle, /measured outcome enters evidence and triggers reassessment/);
});
test('Pilot cannot bypass an unknown protection assessment or unestablished operational condition', () => {
  for (const domain of ['dependency', 'operations', 'residentMix', 'temporal']) {
    const c = input('H'); c.evidence[domain] = null;
    assert.equal(candidate(run(c), 'pilot').eligible, false, domain);
  }
});
test('Pilot needs an explicit relevant decision question and bounded design', () => {
  const c = input('H'); delete c.decisionContext.pilotDesign;
  assert.equal(candidate(run(c), 'pilot').eligible, false);
  const d = input('H'); d.decisionContext.programmeResponseUnresolved = false;
  assert.equal(candidate(run(d), 'pilot').eligible, false);
});
test('Configurable burden can change evidence priority without altering diagnosis or sufficiency', () => {
  const c = input('A'), before = run(c), p = structuredClone(nextEvidenceParameters); p.burden.inspection = 100;
  const after = run(c, p);
  assert.notDeepEqual(before.nextBestCandidateIds, after.nextBestCandidateIds);
  assert.deepEqual(after.sufficiency, before.sufficiency);
});
test('A ranking tie is explicit and cannot trigger resident question/cohort selection', () => {
  const c = input('A'), p = { ...nextEvidenceParameters, tieTolerance: 100 };
  const r = run(c, p); assert.ok(r.nextBestCandidateIds.length > 1);
  assert.equal(r.state, 'Evidence priority tie — operator review'); assert.equal(r.residentInputEligibleForLaterSelection, false);
});
test('Invalid parameter values fail explicitly, not silently become evidence scores', () => {
  assert.throws(() => run(input('A'), { ...nextEvidenceParameters, burdenPenalty: -1 }), /Invalid provisional/);
});
test('Stable/Monitoring upstream cases do not enter diagnosis or evidence planning', () => {
  for (const f of fixtures.filter(f => detectChange(f).status !== 'Needs Attention')) {
    const r = identifyNextBestEvidence({ changeResult: detectChange(f), evidence: { asOf: '2026-07-26', decisionHorizon: 'long-term' } });
    assert.equal(r.executionState, 'Not Assessed'); assert.deepEqual(r.nextBestCandidateIds, []);
  }
});
test('Local API provides isolated JSON results and errors without executing collection', async () => {
  const client = createDemoChangeClient(), r = await client.getNextBestEvidence('NB-A');
  assert.equal(assertNextEvidenceEnvelope(r), r);
  r.result.candidates[0].score = 999;
  assert.notEqual((await client.getNextBestEvidence('NB-A')).result.candidates[0].score, 999);
  await assert.rejects(client.getNextBestEvidence('missing'), e => e.status === 404);
});
test('HTTP-ready client carries the same evidence contract without pretending a backend exists', async () => {
  const expected = await createDemoChangeClient().getNextBestEvidence('NB-B');
  const requests = [];
  const remote = createChangeClient(createHttpChangeTransport({ baseUrl: 'https://example.invalid', fetchImpl: async (url, options) => { requests.push([url, options.method]); return { ok: true, json: async () => structuredClone(expected) }; } }));
  assert.deepEqual(await remote.getNextBestEvidence('NB-B'), expected);
  assert.deepEqual(requests[0], ['https://example.invalid' + nextEvidencePath('NB-B'), 'GET']);
});
test('Malformed API cannot replace separate sufficiency with combined confidence or ungrounded recommendation', async () => {
  const r = await createDemoChangeClient().getNextBestEvidence('NB-A');
  const broken = structuredClone(r); broken.result.sufficiency.state = 'Sufficient Evidence';
  assert.throws(() => assertNextEvidenceEnvelope(broken), /separate sufficiency/);
  const unsupported = structuredClone(r); unsupported.result.nextBestCandidateIds = ['fake'];
  assert.throws(() => assertNextEvidenceEnvelope(unsupported), /Invalid next-best/);
});
test('Operator UI shows gaps, contrasting outcomes and separate sufficiency, with no questionnaire or execution controls', async () => {
  const html = renderNextEvidence(await createDemoChangeClient().getNextBestEvidence('NB-A'));
  for (const text of ['Decision-Aware Next-Best Evidence', 'Explanation Sufficiency', 'Protection Context Sufficiency', 'operational-condition', 'possible findings', 'inconclusive', 'not probabilities']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<form|<input|<button/);
  const escaped = await createDemoChangeClient().getNextBestEvidence('NB-A'); escaped.result.gaps[0].question = '<script>bad</script>';
  assert.ok(renderNextEvidence(escaped).includes('&lt;script&gt;'));
});
test('Evidence-planning failure keeps upstream diagnosis visible instead of inventing a priority', async () => {
  const base = createDemoChangeClient(), root = { innerHTML: '', textContent: '' };
  const app = await startChangeApplication({ client: { ...base, getNextBestEvidence: async () => { throw new Error('unavailable'); } }, document: { querySelector: () => root }, window: { addEventListener() {}, removeEventListener() {}, scrollTo() {} }, location: { hash: '#case/NB-A' } });
  assert.ok(root.innerHTML.includes('Next-Best Evidence unavailable'));
  assert.ok(root.innerHTML.includes('Evidence-Based Competing Diagnosis'));
  app.dispose();
});
