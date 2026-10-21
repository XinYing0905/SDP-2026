import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createResidentPlanAcceptanceCases, bindPlanInput, makeResidentPlanInput } from '../src/data/synthetic/resident-evidence-plan-cases.mjs';
import { questionCatalogue, missingResponseSemantics, validateScenarioBinding } from '../src/resident-evidence/question-catalogue.mjs';
import { selectQuestionCohort } from '../src/resident-evidence/pair-selection.mjs';
import { createDemoChangeClient } from '../src/composition/demo-client.mjs';
import { createCp5DemoClient } from '../src/composition/cp5-demo-client.mjs';
import { createResidentPlanRepository } from '../src/data/repositories/resident-plan-repository.mjs';
import { createResidentEvidencePlanService } from '../src/services/resident-evidence-plan-service.mjs';
import { createResidentPlanClient, createLocalResidentPlanTransport } from '../src/api/resident-plan-client.mjs';
import { createHttpChangeTransport } from '../src/api/http-change-transport.mjs';
import { assertResidentPlanEnvelope, residentPlanPath } from '../src/shared/resident-evidence-plan-contract.mjs';
import { renderResidentEvidencePlan, renderResidentQuestionPreview } from '../frontend/views/resident-evidence-plan.mjs';
import { startChangeApplication } from '../frontend/application.mjs';
const cases = await createResidentPlanAcceptanceCases();
const input = letter => structuredClone(cases.find(c => c.case === letter).input);
const run = letter => selectQuestionCohort(input(letter));
const eligible = r => r.pairs.filter(p => p.eligible);
const envelope = (result, id = result.amenityId) => ({ contractVersion: 'resident-evidence-plan.v1', amenityId: id, result });

test('All approved CP1–CP4 source, contracts, parameters, fixture and prior test files remain byte-identical', async () => {
  const baseline = JSON.parse(await fs.readFile(new URL('./baseline/approved-cp4.json', import.meta.url)));
  for (const [file, expected] of Object.entries(baseline.hashes)) assert.equal(crypto.createHash('sha256').update(await fs.readFile(new URL('../' + file, import.meta.url))).digest('hex'), expected, file);
});
test('The additive CP5 client preserves full approved overview, diagnosis and CP4 wire results', async () => {
  const baseline = JSON.parse(await fs.readFile(new URL('./baseline/approved-cp4.json', import.meta.url)));
  const client = await createCp5DemoClient();
  assert.deepEqual(await client.getOverview(), baseline.overview);
  for (const c of baseline.cases) {
    assert.deepEqual(await client.getCompetingDiagnosis(c.id), c.diagnosis, c.id);
    assert.deepEqual(await client.getNextBestEvidence(c.id), c.nextEvidence, c.id);
  }
  await client.getResidentEvidencePlan('NB-C'); await client.getResidentEvidencePlan('NB-D');
  for (const c of baseline.cases) assert.deepEqual(await client.getNextBestEvidence(c.id), c.nextEvidence, c.id + ' after selection');
});
for (const c of cases) test(`Acceptance ${c.case}: ${c.description}`, () => {
  const original = structuredClone(c.input), r = selectQuestionCohort(c.input);
  assert.equal(r.state, c.expectedState);
  assert.deepEqual(c.input, original, 'Planning does not mutate evidence, snapshot, CP4 ranking or cohorts');
  assert.deepEqual(r.upstreamSourcePriority, c.input.nextEvidenceEnvelope.result.nextBestCandidateIds);
  assert.deepEqual(r.sufficiency, c.input.nextEvidenceEnvelope.result.sufficiency ?? null);
  assert.deepEqual(r.remainingGaps, c.input.nextEvidenceEnvelope.result.gaps);
  assert.ok(r.selectedPair === null || r.state === 'Draft pair selected');
  for (const key of ['dispatchTriggered', 'responsesCollected', 'responseWrites', 'evidenceWrites', 'reassessmentTriggered', 'interventionSelected', 'aiImplemented']) assert.equal(r[key], false, key);
  const payload = envelope(r); assert.equal(assertResidentPlanEnvelope(payload), payload);
});

test('Catalogue is reviewed/versioned and contains only the three approved question types', () => {
  assert.equal(questionCatalogue.reviewed, true);
  assert.deepEqual(questionCatalogue.questions.map(q => q.id), ['Q-PROGRAMME-FIT', 'Q-DEPENDENT-NEEDS', 'Q-PROTECTED-IMPACT']);
  assert.ok(questionCatalogue.questions.every(q => q.version));
  assert.throws(() => { questionCatalogue.questions[0].wording = 'Why did usage fall?'; });
});
test('Dependency question and cohort assume documented current use only, never prior reliance', () => {
  const q = questionCatalogue.questions.find(q => q.id === 'Q-DEPENDENT-NEEDS');
  assert.equal(q.wording, "How important is access to [amenity's current function] for the activities you currently use it for?");
  const r = run('S');
  assert.ok(eligible(r).some(p => p.questionId === q.id));
  assert.ok(eligible(r).every(p => !/dependent cohort/i.test(p.cohort.membershipDefinition)));
});
test('Every material pair has a genuine target and complete option-to-assertion trace with limits', () => {
  for (const c of cases) for (const pair of selectQuestionCohort(c.input).pairs) {
    const q = questionCatalogue.questions.find(q => q.id === pair.questionId);
    assert.equal(pair.optionPlanningAssertions.length, q.options.length);
    for (const o of pair.optionPlanningAssertions) {
      assert.ok(q.options.some(x => x.id === o.optionId && x.assertionId === o.assertionId && x.assertion === o.assertion));
      assert.ok(o.requiredAssumptionsAndCorroboration.length && o.cannotEstablish.length);
      assert.equal(o.productionConversion, false); assert.equal(o.collectedEvidence, false);
      assert.deepEqual(o.fullyResolvedGapIds, []); assert.equal(o.pathwayChanged, false);
      if (pair.eligible) assert.deepEqual(o.potentialGapReductionIds, [pair.targetGapId]);
    }
    if (pair.eligible) assert.ok(pair.score > 0 && pair.material);
  }
});
test('Unsupported scenario assertions/options are rejected, not awarded inherited source credit', () => {
  const q = questionCatalogue.questions[0];
  assert.equal(validateScenarioBinding(q, { optionIds: ['NOT-AN-OPTION'], assertionIds: ['healthy-operations'], targetGapId: 'programme-fit' }), false);
  assert.equal(validateScenarioBinding(q, { optionIds: ['PF-YES'], assertionIds: ['programme-caused-decline'], targetGapId: 'programme-fit' }), false);
  assert.deepEqual(run('T').pairs.map(p => p.score), run('C').pairs.map(p => p.score));
  assert.ok(!JSON.stringify(run('T')).includes('healthy-operations'));
});
test('No-longer-need option supports a distinct personal need assertion, never mismatch conversion', () => {
  const r = run('U'), o = r.selectedPair.optionPlanningAssertions.find(o => o.optionId === 'PF-NO-LONGER-NEED');
  assert.equal(o.assertionId, 'reported-ceased-personal-need');
  assert.ok(o.cannotEstablish.includes('Programme mismatch') && o.cannotEstablish.includes('Programme dissatisfaction'));
  assert.equal('mismatchResponses' in o, false); assert.equal(o.productionConversion, false);
});
test('Essential and important, optional benefit and no reliance remain distinct bounded assertions', () => {
  const p = eligible(run('S')).find(p => p.questionId === 'Q-DEPENDENT-NEEDS');
  assert.equal(new Set(p.optionPlanningAssertions.map(o => o.assertionId)).size, 4);
  assert.ok(p.optionPlanningAssertions.find(o => o.optionId === 'DN-OPTIONAL').assertion.includes('useful'));
  assert.ok(p.optionPlanningAssertions.find(o => o.optionId === 'DN-IMPORTANT').cannotEstablish.includes('Essential dependency'));
});
test('Impact without comparative evidence never establishes disproportionality or protection sufficiency', () => {
  const r = run('V'), p = eligible(r).find(p => p.questionId === 'Q-PROTECTED-IMPACT');
  assert.ok(p.optionPlanningAssertions.every(o => o.corroborationLimits.some(t => t.includes('Comparative impact evidence is missing'))));
  assert.equal(r.sufficiency.protectionContextSufficiency.state, 'Insufficient Evidence');
  assert.ok(p.scenarioGroups.every(g => !g.fullyResolvedGapIds.length && g.pathwayChangeUnits === 0));
});
test('A needs or impact answer cannot claim substitute, repeat-use, operations or temporal evidence', () => {
  const r = run('M');
  for (const p of eligible(r)) for (const o of p.optionPlanningAssertions) assert.deepEqual(o.potentialGapReductionIds, [p.targetGapId]);
  for (const id of ['realistic-substitutes', 'repeat-dependency']) assert.ok(r.remainingGaps.some(g => g.id === id));
});
test('Unable, voluntary skip and no received response are semantically distinct and unscored', () => {
  const r = run('W');
  assert.deepEqual(r.nonSubstantiveOutcomes.map(o => o.id), ['UNABLE_TO_ASSESS', 'VOLUNTARY_SKIP', 'NO_RESPONSE']);
  assert.equal(new Set(r.nonSubstantiveOutcomes.map(o => o.meaning)).size, 3);
  assert.ok(r.nonSubstantiveOutcomes.every(o => o.credit === 0 && o.substantive === false));
  const p = r.selectedPair;
  assert.equal(p.nonSubstantive.length, 2); assert.equal(p.options.length, 4);
  const g = p.scenarioGroups.find(g => g.id === 'inconclusive');
  assert.equal(g.potentialBoundedReductionUnits, 0); assert.equal(g.pathwayChangeUnits, 0);
  assert.equal(missingResponseSemantics.id, 'NO_RESPONSE');
});
test('Canonical scenario grouping cannot be inflated by added labels or arbitrary supplied groups', () => {
  const base = run('C'), split = run('X');
  assert.deepEqual(split.pairs.map(p => [p.id, p.score, p.scenarioGroups]), base.pairs.map(p => [p.id, p.score, p.scenarioGroups]));
  assert.equal(base.selectedPair.scenarioGroups.length, 3);
  assert.ok(base.selectedPair.score < input('C').nextEvidenceEnvelope.result.candidates.find(c => c.id === 'residents').score);
});
test('Valid 5+ and 2–5-year cohorts tie without a tenure, size or ownership preference', () => {
  const c = input('D'); c.cohortSnapshot.cohorts[2].knownRelevantMembers = 100; c.cohortSnapshot.cohorts[3].knownRelevantMembers = 2; bindPlanInput(c);
  const r = selectQuestionCohort(c); assert.equal(r.state, 'Pair tie'); assert.equal(r.selectedPair, null);
  assert.equal(new Set(eligible(r).map(p => p.score)).size, 1);
  assert.deepEqual(run('J').pairs.map(p => [p.id, p.score]), run('C').pairs.map(p => [p.id, p.score]));
});
test('All four duration groups remain visible; intermediate current-use knowledge does not become a long-term comparison', () => {
  const r = run('K');
  assert.deepEqual(r.cohorts.map(c => c.residenceDuration), ['<6 months', '6–24 months', '2–5 years', '5+ years']);
  assert.ok(eligible(r).every(p => p.cohort.residenceDuration === '6–24 months'));
  assert.ok(eligible(r).every(p => p.cohort.tenureRole.includes('Intermediate')));
  assert.equal(run('L').state, 'No valid pair');
});
test('Unknown exposure/count/coverage and future cohort sources do not become an informative pair', () => {
  for (const edit of [
    c => { c.cohortSnapshot.cohorts[2].source.availableAt = '2099-01-01'; },
    c => { c.cohortSnapshot.cohorts[2].knownRelevantMembers = null; },
    c => { c.cohortSnapshot.cohorts[2].planningCoverageSource = null; },
    c => { c.cohortSnapshot.cohorts[2].referencePeriod.end = '2099-01-01'; }
  ]) { const c = input('C'); edit(c); bindPlanInput(c); assert.equal(selectQuestionCohort(c).state, 'No valid pair'); }
});
test('Existing observation and retention gates reject unsupported long-term pairs without changing approved thresholds', () => {
  for (const edit of [c => { c.cohortSnapshot.cohorts[2].observedPeriods = 2; }, c => { c.cohortSnapshot.cohorts[2].retainedFraction = 0.5; }]) {
    const c = input('C'); edit(c); bindPlanInput(c); assert.equal(selectQuestionCohort(c).state, 'No valid pair');
  }
});
test('A small dependent-user inquiry is not subject to a universal five-programme-response quota', () => {
  const c = input('E'); c.cohortSnapshot.cohorts[2].knownRelevantMembers = 3; bindPlanInput(c);
  assert.ok(eligible(selectQuestionCohort(c)).length > 0);
  assert.equal(selectQuestionCohort(c).sufficiency.protectionContextSufficiency.state, 'Insufficient Evidence');
});
test('Snapshot, parameters, cohort content and function changes invalidate prepared input', () => {
  for (const edit of [
    c => { c.nextEvidenceEnvelope.result.parameterVersion = 'changed'; },
    c => { c.cohortSnapshot.cohorts[2].programmeFamiliarity = null; },
    c => { c.currentFunction = 'another function'; },
    c => { c.diagnosisEnvelope.result.evidenceSnapshotId = 'another-snapshot'; },
    c => { c.nextEvidenceEnvelope.result.sufficiency.explanationSufficiency.state = 'Sufficient Evidence'; }
  ]) { const c = input('C'); edit(c); assert.equal(selectQuestionCohort(c).state, 'Stale input'); }
});
test('Rebound future as-of and duplicate cohort identities are not silently accepted', () => {
  const c = input('C'); c.cohortSnapshot.asOf = '2099-01-01'; bindPlanInput(c);
  assert.equal(selectQuestionCohort(c).state, 'Stale input');
  const d = input('C'); d.cohortSnapshot.cohorts[3].id = d.cohortSnapshot.cohorts[2].id; bindPlanInput(d);
  assert.equal(selectQuestionCohort(d).state, 'No valid pair');
});
test('Response objects supplied by a caller are ignored and never converted to evidence', () => {
  const c = input('C'), before = selectQuestionCohort(c);
  c.responses = [{ optionId: 'PF-NOT-REALLY', residentId: 'not-collected' }];
  assert.deepEqual(selectQuestionCohort(c), before);
});
test('Pure selection results and repository responses do not expose mutable input references', async () => {
  const c = input('C'), original = structuredClone(c), r = selectQuestionCohort(c);
  r.selectedPair.cohort.referencePeriod.start = '2000-01-01';
  assert.deepEqual(c, original);
  const repo = createResidentPlanRepository([c]); const record = await repo.getByAmenityId(c.amenityId); record.currentFunction = 'changed';
  assert.equal((await repo.getByAmenityId(c.amenityId)).currentFunction, original.currentFunction);
});
test('Read-only service/client add no reranking and preserve response isolation and explicit missing context', async () => {
  const client = await createCp5DemoClient(), r = await client.getResidentEvidencePlan('NB-C');
  assert.equal(r.result.state, 'Draft pair selected'); r.result.selectedPair.wording = 'changed';
  assert.notEqual((await client.getResidentEvidencePlan('NB-C')).result.selectedPair.wording, 'changed');
  await assert.rejects(client.getResidentEvidencePlan('missing'), e => e.status === 404);
  await assert.rejects(client.getResidentEvidencePlan('DX-C'), e => e.code === 'PLAN_CONTEXT_UNAVAILABLE');
});
test('HTTP-ready plan client consumes identical JSON without claiming a deployed backend', async () => {
  const expected = await (await createCp5DemoClient()).getResidentEvidencePlan('NB-C'), requests = [];
  const remote = createResidentPlanClient({ upstreamClient: createDemoChangeClient(), transport: createHttpChangeTransport({ baseUrl: 'https://example.invalid', fetchImpl: async (url, options) => { requests.push([url, options.method]); return { ok: true, json: async () => structuredClone(expected) }; } }) });
  assert.deepEqual(await remote.getResidentEvidencePlan('NB-C'), expected);
  assert.deepEqual(requests, [['https://example.invalid' + residentPlanPath('NB-C'), 'GET']]);
});
test('Transport rejects dispatch/response writes and invalid paths/IDs', async () => {
  const transport = createLocalResidentPlanTransport({ getResidentEvidencePlan: async id => ({ id }) });
  await assert.rejects(transport.request({ method: 'POST', path: residentPlanPath('NB-C') }), e => e.status === 405);
  await assert.rejects(transport.request({ method: 'GET', path: '/responses' }), e => e.status === 404);
  await assert.rejects(transport.request({ method: 'GET', path: '/api/v1/amenities/%GG/resident-evidence-plan' }), e => e.status === 400);
  assert.deepEqual(await transport.request({ method: 'GET', path: residentPlanPath('Hall / 1') }), { id: 'Hall / 1' });
});
test('Service detects changes made after the planning repository snapshot', async () => {
  const original = await makeResidentPlanInput('NB-C');
  const upstream = createDemoChangeClient();
  const service = createResidentEvidencePlanService({ upstreamClient: { ...upstream, getNextBestEvidence: async id => { const e = await upstream.getNextBestEvidence(id); e.result.parameterVersion = 'new'; return e; } }, planningRepository: createResidentPlanRepository([original]) });
  assert.equal((await service.getResidentEvidencePlan('NB-C')).result.state, 'Stale input');
});
test('Runtime contract rejects invented assertions, response writes and combined sufficiency', () => {
  for (const edit of [
    e => { e.result.dispatchTriggered = true; },
    e => { e.result.sufficiency.state = 'Sufficient Evidence'; },
    e => { e.result.pairs[0].optionPlanningAssertions[0].assertion = 'Usage decline is caused by mismatch'; },
    e => { e.result.pairs[0].optionPlanningAssertions[0].optionId = 'FAKE'; },
    e => { e.result.pairs[0].scenarioGroups.push(e.result.pairs[0].scenarioGroups[0]); },
    e => { e.result.nonSubstantiveOutcomes[0].credit = -1; },
    e => { e.result.pairs[0].scenarioGroups[0].fullyResolvedGapIds = ['programme-fit']; }
  ]) { const e = envelope(run('C')); edit(e); assert.throws(() => assertResidentPlanEnvelope(e), /Invalid resident evidence plan/); }
});
test('Selected-pair wire payload cannot diverge from the validated catalogue-based comparison', () => {
  const e = JSON.parse(JSON.stringify(envelope(run('C'))));
  e.result.selectedPair.wording = 'An unsupported question';
  assert.throws(() => assertResidentPlanEnvelope(e), /Invalid resident evidence plan/);
});
test('Operator preview shows separate sufficiency, exact gaps and option assertions without collecting answers', () => {
  const html = renderResidentEvidencePlan(envelope(run('C')));
  for (const text of ['Best Question × Best Cohort', 'Explanation Sufficiency', 'Protection Context Sufficiency', 'programme-fit', 'PF-NO-LONGER-NEED', 'planning assertions', 'UNABLE_TO_ASSESS', 'VOLUNTARY_SKIP', 'NO_RESPONSE']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<form|<input|<button|Submit response/);
});
test('Resident preview contains exactly one question, four substantive and two distinct unscored choices', () => {
  const html = renderResidentQuestionPreview(envelope(run('C')));
  assert.equal((html.match(/<h2>/g) ?? []).length, 1); assert.equal((html.match(/<li>/g) ?? []).length, 6);
  assert.ok(html.includes('Unable to assess / not familiar enough') && html.includes('Skip / prefer not to answer'));
  assert.ok(!html.includes('NO_RESPONSE')); assert.doesNotMatch(html, /<form|<input|<button|Explanation Sufficiency|PF-YES/);
  assert.ok(html.includes('Responses cannot be submitted'));
});
test('Tied, stale and non-eligible plans cannot expose an arbitrarily selected resident question', () => {
  for (const letter of ['D', 'N', 'Q', 'I']) {
    const html = renderResidentQuestionPreview(envelope(run(letter)));
    assert.ok(html.includes('Resident preview unavailable')); assert.equal((html.match(/<h2>/g) ?? []).length, 0);
  }
});
test('Preview text is escaped and exposes no contact/member identities', () => {
  const r = run('C'); r.selectedPair.wording = '<script>bad</script>';
  assert.ok(renderResidentQuestionPreview(envelope(r)).includes('&lt;script&gt;'));
  assert.ok(!JSON.stringify(r).includes('residentId'));
});
test('Application routes operator and resident previews, retaining upstream views on plan failure', async () => {
  const client = await createCp5DemoClient(), root = { innerHTML: '', textContent: '' }, location = { hash: '#case/NB-C' };
  const window = { addEventListener() {}, removeEventListener() {}, scrollTo() {} }, document = { querySelector: () => root };
  const app = await startChangeApplication({ client, document, window, location });
  assert.ok(root.innerHTML.includes('Best Question × Best Cohort') && root.innerHTML.includes('Decision-Aware Next-Best Evidence'));
  location.hash = '#resident-preview/NB-C'; await app.render(); assert.ok(root.innerHTML.includes('RESIDENT PREVIEW'));
  app.dispose();
  const failed = await startChangeApplication({ client: { ...client, getResidentEvidencePlan: async () => { throw new Error('offline'); } }, document, window, location: { hash: '#case/NB-C' } });
  assert.ok(root.innerHTML.includes('Resident evidence plan unavailable') && root.innerHTML.includes('Evidence-Based Competing Diagnosis')); failed.dispose();
});
