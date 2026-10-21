import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { detectChange } from '../src/statistics/change-detection/detector.mjs';
import { parameters, metricDefinitions } from '../src/config/change-detection.mjs';
import { fixtures, simulationNotice } from '../src/data/synthetic/amenities.mjs';
import { createDemoChangeClient } from '../src/composition/demo-client.mjs';
import { createSyntheticAmenityRepository } from '../src/data/repositories/synthetic-amenity-repository.mjs';
import { createChangeEvidenceService } from '../src/services/change-evidence-service.mjs';
import { createLocalChangeTransport } from '../src/api/local-change-transport.mjs';
import { createHttpChangeTransport } from '../src/api/http-change-transport.mjs';
import { createChangeClient } from '../src/api/change-client.mjs';
import { OVERVIEW_PATH, evidencePath } from '../src/shared/change-contract.mjs';
import { createChangeViews } from '../frontend/views/change-views.mjs';
import { startChangeApplication } from '../frontend/application.mjs';
const read = file => fs.readFile(new URL(file, import.meta.url), 'utf8');
const golden = JSON.parse(await read('./baseline/approved-results.json'));
const markup = JSON.parse(await read('./baseline/approved-markup.json'));
const hashes = JSON.parse(await read('./baseline/approved-hashes.json'));
const client = createDemoChangeClient();
const expectedMarkup = value => value.replace('Defined in <code>dist/config.mjs</code>', 'Defined in <code>src/config/change-detection.mjs</code>').replace('</footer>', ' Change Detection ≠ Diagnosis.</footer>');

test('Approved detector, thresholds, fixtures, tests, CSS and portable HTML preserve original SHA-256', async () => {
  const files = { detector: '../src/statistics/change-detection/detector.mjs', configuration: '../src/config/change-detection.mjs', fixtures: '../src/data/synthetic/amenities.mjs', existingTests: './detector.test.mjs', css: '../frontend/styles.css', offlineHtml: '../artifacts/checkpoint-2/Amenity-Change-Evidence.html' };
  for (const [name, file] of Object.entries(files)) assert.equal(crypto.createHash('sha256').update(await fs.readFile(new URL(file, import.meta.url))).digest('hex'), hashes[name], name);
});
for (const { id, result } of golden) {
  test(`Exact pre-refactor output parity: ${id}`, () => assert.deepEqual(detectChange(fixtures.find(f => f.id === id)), result));
  test(`Service/wire contract preserves full evidence and missing data: ${id}`, async () => {
    const envelope = await client.getChangeEvidence(id);
    assert.deepEqual(envelope.entry.result, result);
    assert.equal('expectedStatus' in envelope.entry.input, false);
    assert.deepEqual(JSON.parse(JSON.stringify(envelope)), envelope);
  });
}
for (const route of Object.keys(markup)) {
  test(`Presentation template parity: ${route}`, async () => {
    const payload = route === '#/' ? await client.getOverview() : await client.getChangeEvidence(route.split('/')[1]);
    const views = createChangeViews({ results: payload.entries ?? [payload.entry], parameters: payload.parameters, metricDefinitions: payload.metricDefinitions, simulationNotice: payload.simulationNotice });
    assert.equal(route === '#/' ? views.overview() : views.evidence(route.split('/')[1]), expectedMarkup(markup[route]));
  });
}
test('Repository and response isolation prevent caller mutation of seed/config/evidence', async () => {
  const repository = createSyntheticAmenityRepository(fixtures);
  const first = await repository.list(); first[0].observations[0].values.bookings = 999;
  assert.equal((await repository.getById('A')).observations[0].values.bookings, 100);
  const payload = await client.getOverview(); payload.parameters.minimumPersistence = 99; payload.entries[0].result.status = 'Changed';
  const next = await client.getOverview();
  assert.equal(next.parameters.minimumPersistence, 3); assert.equal(next.entries[0].result.status, 'Stable');
});
test('HTTP adapter and local adapter expose identical JSON contract (mocked network)', async () => {
  const service = createChangeEvidenceService({ repository: createSyntheticAmenityRepository(fixtures), detectChange, parameters, metricDefinitions, simulationNotice });
  const local = createLocalChangeTransport(service); const requests = [];
  const http = createHttpChangeTransport({ baseUrl: 'https://example.invalid', fetchImpl: async (url, options) => {
    requests.push({ url, method: options.method });
    const body = await local.request({ method: options.method, path: new URL(url).pathname });
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
  } });
  const remoteClient = createChangeClient(http);
  assert.deepEqual(await remoteClient.getOverview(), await client.getOverview());
  assert.deepEqual(await remoteClient.getChangeEvidence('E'), await client.getChangeEvidence('E'));
  assert.deepEqual(requests.map(x => x.method), ['GET', 'GET']);
  assert.equal(requests[1].url, 'https://example.invalid' + evidencePath('E'));
});
test('Local boundary returns explicit errors and preserves encoded IDs', async () => {
  await assert.rejects(client.getChangeEvidence('unknown'), error => error.status === 404 && error.code === 'AMENITY_NOT_FOUND');
  const record = structuredClone(fixtures[0]); record.id = 'Hall / 1';
  const service = createChangeEvidenceService({ repository: createSyntheticAmenityRepository([record]), detectChange, parameters, metricDefinitions, simulationNotice });
  const transport = createLocalChangeTransport(service); const customClient = createChangeClient(transport);
  assert.equal((await customClient.getChangeEvidence('Hall / 1')).entry.result.amenityId, 'Hall / 1');
  await assert.rejects(transport.request({ method: 'POST', path: OVERVIEW_PATH }), error => error.status === 405);
  await assert.rejects(transport.request({ method: 'GET', path: '/unknown' }), error => error.status === 404);
});
test('Transport failure / malformed response is never converted to an amenity status', async () => {
  const failed = createChangeClient(createHttpChangeTransport({ fetchImpl: async () => { throw new Error('offline'); } }));
  await assert.rejects(failed.getOverview(), error => error.status === 503);
  const incompatible = createChangeClient({ request: async () => ({ contractVersion: 'wrong', kind: 'overview' }) });
  await assert.rejects(incompatible.getOverview(), error => error.code === 'INVALID_RESPONSE');
  const serverError = createChangeClient(createHttpChangeTransport({ fetchImpl: async () => ({ ok: false, status: 500 }) }));
  await assert.rejects(serverError.getOverview(), error => error.status === 500);
});
test('Application controller uses injected client and preserves screen markup', async () => {
  const root = { innerHTML: '', textContent: '' }; const location = { hash: '#/' }; const calls = [];
  const fakeWindow = { addEventListener() {}, removeEventListener() {}, scrollTo() {} };
  const application = await startChangeApplication({ client: { async getOverview() { calls.push('overview'); return client.getOverview(); }, async getChangeEvidence(id) { calls.push(id); return client.getChangeEvidence(id); } }, document: { querySelector: () => root }, window: fakeWindow, location });
  assert.equal(root.innerHTML, expectedMarkup(markup['#/']));
  location.hash = '#case/E'; await application.render();
  assert.deepEqual(calls, ['overview', 'E']); assert.equal(root.innerHTML, expectedMarkup(markup['#case/E']));
  application.dispose();
});
test('Application loading failure states no inferred status', async () => {
  const root = { textContent: '', innerHTML: '' };
  const application = await startChangeApplication({ client: { getOverview: async () => { throw new Error('unavailable'); } }, document: { querySelector: () => root }, window: { addEventListener() {}, removeEventListener() {} }, location: { hash: '#/' } });
  assert.equal(root.textContent, 'Change evidence could not be loaded. No amenity status has been inferred.'); application.dispose();
});
test('Presentation/controller do not import detector, fixture or threshold modules', async () => {
  for (const file of ['../frontend/application.mjs', '../frontend/views/change-views.mjs']) {
    const imports = (await read(file)).split('\n').filter(line => line.startsWith('import ')).join('\n');
    assert.doesNotMatch(imports, /detector|fixtures|synthetic|change-detection/);
  }
});
