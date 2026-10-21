import test from 'node:test';
import assert from 'node:assert/strict';
import { detectChange } from '../dist/detector.mjs';
import { fixtures } from '../dist/fixtures.mjs';
import { parameters } from '../dist/config.mjs';
const copy = id => structuredClone(fixtures.find(f => f.id === id));

for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'S']) {
  test(`Case ${id}: expected status and no downstream outputs`, () => {
    const data = copy(id), result = detectChange(data);
    assert.equal(result.status, data.expectedStatus);
    assert.equal(result.metrics.length, data.applicableSignals.length);
    for (const forbidden of ['diagnosis', 'diagnoses', 'intervention', 'recommendation', 'evidenceSupport', 'modelSuitability']) assert.equal(forbidden in result, false);
    assert.ok(result.explanation);
    assert.equal(result.baselineWindow.periods, 8);
    assert.equal(result.currentWindow.periods, 4);
  });
}
test('A: transient sharp dip retains evidence but has no trailing persistence', () => {
  const r = detectChange(copy('A'));
  assert.equal(r.detectedChangeSignals.length, 3);
  assert.ok(r.metrics.every(m => m.persistence.trailingPeriods === 0));
});
test('B: three aligned persistent declines qualify, without assigning a cause', () => {
  const r = detectChange(copy('B'));
  assert.equal(r.signalConsistency.observed, 3);
  assert.ok(r.metrics.every(m => m.persistence.trailingPeriods === 4));
});
test('C: one sustained metric is not enough for multi-signal attention', () => {
  const r = detectChange(copy('C'));
  assert.equal(r.signalConsistency.observed, 1);
});
test('D: raw closure observations remain visible but excluded and break streaks', () => {
  const r = detectChange(copy('D'));
  assert.equal(r.contextualCaveats.filter(c => c.type === 'closure').length, 3);
  assert.equal(r.metrics[0].currentValue, 100);
  assert.equal(r.metrics[0].coverage.current, 0.25);
  assert.equal(r.metrics[0].points.at(-1).value, 5);
  assert.equal(r.metrics[0].points.at(-1).eligible, false);
});
test('E: missing row/signal/maintenance stay unknown, never zero-filled', () => {
  const r = detectChange(copy('E'));
  assert.equal(r.missingPeriods.length, 1);
  const unique = r.metrics.find(m => m.key === 'uniqueUsers');
  assert.equal(unique.points.at(-1).value, null);
  assert.equal(unique.points.at(-2).value, null);
  assert.equal(unique.currentValue, 80);
  assert.equal(unique.coverage.current, 0.5);
  assert.equal(unique.assessable, false);
  assert.ok(r.missingDataWarnings.some(s => s.includes('maintenance/downtime') && s.includes('unknown')));
});
test('F: only accessCount and uniqueUsers analyzed; booking measures absent', () => {
  const r = detectChange(copy('F'));
  assert.deepEqual(r.metrics.map(m => m.key), ['accessCount', 'uniqueUsers']);
  assert.equal(r.metrics.some(m => m.key === 'utilisationRate'), false);
});
test('Config change actually changes gate; consistency is not fixture-hardcoded', () => {
  assert.equal(detectChange(copy('C'), { ...parameters, minimumConsistentSignals: 1 }).status, 'Needs Attention');
  assert.equal(detectChange(copy('B'), { ...parameters, relativeDeviationThreshold: 0.6 }).status, 'Stable');
});
test('Complete missing input is Monitoring and null, not Stable or zero', () => {
  const data = copy('B'); data.observations = [];
  const r = detectChange(data);
  assert.equal(r.status, 'Monitoring');
  assert.ok(r.metrics.every(m => m.currentValue === null && m.baselineValue === null && m.percentageChange === null));
});
test('Missing period breaks persistence rather than joining observations over a gap', () => {
  const data = copy('B'); data.observations = data.observations.filter((_, i) => i !== 10);
  const r = detectChange(data);
  assert.equal(r.status, 'Monitoring');
  assert.ok(r.metrics.every(m => m.persistence.trailingPeriods === 1));
});
test('Zero baseline returns meaningful absolute magnitude, never infinite percent', () => {
  const data = copy('B');
  data.observations.slice(0, 8).forEach(row => Object.keys(row.values).forEach(k => row.values[k] = 0));
  const r = detectChange(data);
  assert.equal(r.status, 'Needs Attention');
  assert.ok(r.metrics.every(m => m.percentageChange === null && m.magnitude > 0));
  assert.equal(r.signalConsistency.direction, 'increase-or-improvement');
});
test('Rates report percentage points; cancellation direction reverses for consistency', () => {
  const data = copy('B'); data.applicableSignals.push('cancellationRate', 'utilisationRate');
  data.observations.forEach((row, i) => { row.values.cancellationRate = i < 8 ? 0.1 : 0.25; row.values.utilisationRate = i < 8 ? 0.8 : 0.5; });
  const r = detectChange(data);
  assert.equal(r.signalConsistency.observed, 5);
  assert.ok(Math.abs(r.metrics.find(m => m.key === 'cancellationRate').percentagePointChange - 15) < 1e-8);
});
test('Opposing persistent directions are not counted as aligned change', () => {
  const data = copy('B'); data.applicableSignals = ['bookings', 'uniqueUsers'];
  data.observations.slice(8).forEach(row => row.values.uniqueUsers = 120);
  const r = detectChange(data);
  assert.equal(r.status, 'Monitoring');
  assert.equal(r.signalConsistency.observed, 1);
});
test('Absent context must not infer operational health', () => {
  const data = copy('S'); data.observations.forEach(row => delete row.maintenance);
  const r = detectChange(data);
  assert.equal(r.status, 'Stable');
  assert.equal(r.missingDataWarnings.length, 12);
  assert.ok(r.missingDataWarnings.every(x => x.includes('unknown')));
});
test('Historical context excluded from own baseline', () => {
  const data = copy('S'); data.observations[0].values.bookings = 0; data.observations[0].context = { type: 'holiday', note: 'Exceptional holiday week' };
  const r = detectChange(data);
  assert.equal(r.metrics[0].baselineValue, 100);
  assert.equal(r.metrics[0].coverage.validBaseline, 7);
});
test('Missing context metadata and incomplete maintenance remain explicitly unknown', () => {
  const data = copy('S'); delete data.observations.at(-1).context;
  data.observations.at(-1).maintenance = { ticketCount: null };
  const r = detectChange(data);
  assert.equal(r.metrics[0].points.at(-1).context, 'context-unknown');
  assert.ok(r.missingDataWarnings.some(w => w.includes('context metadata unavailable')));
  assert.ok(r.missingDataWarnings.some(w => w.includes('maintenance context incomplete')));
});
test('Future observations do not leak into analysis', () => {
  const data = copy('B'); const before = detectChange(data);
  data.observations.push({ periodStart: '2026-07-27', values: { bookings: 100000 } });
  const after = detectChange(data);
  assert.equal(after.status, before.status);
  assert.deepEqual(after.metrics, before.metrics);
});
test('Invalid parameters, duplicate periods, invalid values fail explicitly', () => {
  assert.throws(() => detectChange(copy('B'), { ...parameters, minimumPersistence: 9 }), /Persistence/);
  const duplicate = copy('B'); duplicate.observations.push(duplicate.observations[0]);
  assert.throws(() => detectChange(duplicate), /Duplicate/);
  const bad = copy('B'); bad.observations[0].values.bookings = -1;
  assert.throws(() => detectChange(bad), /Invalid bookings/);
  const offGrid = copy('B'); offGrid.observations[0].periodStart = '2026-05-05';
  assert.throws(() => detectChange(offGrid), /grid/);
});
