import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { diagnosisCases } from '../src/data/synthetic/diagnosis-cases.mjs';
import { diagnosisParameters, diagnosisStates } from '../src/config/diagnosis.mjs';
import { detectChange } from '../src/statistics/change-detection/detector.mjs';
import { diagnoseCompeting } from '../src/diagnosis/competing-diagnosis.mjs';
import { scoreDiagnoses } from '../src/diagnosis/scoring.mjs';
import { evaluateSufficiency } from '../src/diagnosis/evidence-sufficiency.mjs';
import { renderDiagnosisEvidence } from '../frontend/views/diagnosis-evidence.mjs';
import { assertDiagnosisEnvelope } from '../src/shared/diagnosis-contract.mjs';
const copy = letter => structuredClone(diagnosisCases.find(c => c.canonicalCase === letter));
const run = (input, p = diagnosisParameters) => diagnoseCompeting({ changeResult: detectChange(input.amenity), evidence: input.evidence }, p);
const golden = JSON.parse(await fs.readFile(new URL('./baseline/approved-cp3-raw-evidence.json', import.meta.url), 'utf8'));
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));
const envelope = (r, id = 'test') => ({ contractVersion: 'competing-diagnosis.v2', amenityId: id, result: r });

test('Raw rule weights and all original CP3 input fixtures remain unchanged', async () => {
  assert.deepEqual(diagnosisParameters.weights, golden.weights);
  const bytes = await fs.readFile(new URL('../src/data/synthetic/diagnosis-cases.mjs', import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), golden.fixtureHash);
});
for (const before of golden.cases) test(`Original raw support, contributions, missing evidence and coverage preserved: ${before.case}`, () => {
  const result = run(copy(before.case));
  before.diagnoses.forEach((expected, i) => assert.deepEqual(pick(result.diagnoses[i], Object.keys(expected)), expected));
});
test('Own-scale support uses configured positive scales 9/13/14/13, not the four-state sum', () => {
  const r = run(copy('G'));
  assert.deepEqual(r.diagnoses.map(d => d.configuredPositiveSupportScale), [9, 13, 14, 13]);
  assert.equal(r.diagnoses[0].relativeEvidenceSupport, 100);
  assert.equal(r.diagnoses[3].relativeEvidenceSupport, 100);
  assert.ok(r.diagnoses.reduce((sum, d) => sum + d.relativeEvidenceSupport, 0) > 100);
});
test('Unknown support remains null; signed contradictions remain auditable at zero relative support', () => {
  const input = copy('C'); input.evidence = { asOf: '2026-07-26', decisionHorizon: 'long-term' };
  assert.ok(run(input).diagnoses.every(d => d.relativeEvidenceSupport === null && d.rawEvidenceSupport === 0));
  const contradicted = run(copy('C')).diagnoses[0];
  assert.equal(contradicted.relativeEvidenceSupport, 0);
  assert.equal(contradicted.rawEvidenceSupport, -9);
  assert.ok(contradicted.contradictingEvidence.length > 0);
});
test('Missing observations never shrink the configured support denominator', () => {
  const input = copy('C'); input.evidence.feedback = null;
  const d = run(input).diagnoses[2];
  assert.equal(d.configuredPositiveSupportScale, 14);
  assert.equal(d.rawEvidenceSupport, 11);
  assert.ok(Math.abs(d.relativeEvidenceSupport - 100 * 11 / 14) < 1e-10);
  assert.ok(d.coverage < 1 && d.missingEvidence.length > 0);
});
test('Uniformly rescaling one state weights changes its raw scale, not its relative support', () => {
  const input = copy('A'), before = run(input), p = structuredClone(diagnosisParameters);
  for (const weights of Object.values(p.weights[diagnosisStates[0]])) { weights[0] *= 10; weights[1] *= 10; }
  const after = run(input, p);
  assert.equal(after.diagnoses[0].rawEvidenceSupport, before.diagnoses[0].rawEvidenceSupport * 10);
  assert.equal(after.diagnoses[0].relativeEvidenceSupport, before.diagnoses[0].relativeEvidenceSupport);
  assert.equal(after.evidenceSufficiency.explanationSufficiency.primaryExplanation, before.evidenceSufficiency.explanationSufficiency.primaryExplanation);
});
test('Cross-state sorting uses comparable support even when raw ordering is opposite', () => {
  // Isolated selection inputs: 7/9 > 9/14 even though 7 raw points < 9 raw points.
  const r = run(copy('G')), scores = structuredClone(r.diagnoses);
  scores[0].rawEvidenceSupport = 7; scores[0].relativeEvidenceSupport = 100 * 7 / 9;
  scores[2].rawEvidenceSupport = 9; scores[2].relativeEvidenceSupport = 100 * 9 / 14;
  const p = { ...diagnosisParameters, ambiguityMarginRelativeSupport: 5 };
  const assessment = evaluateSufficiency(scores, r.features, r.checks, 'short-term', p).explanationSufficiency;
  assert.equal(assessment.comparisonCandidates[0].name, diagnosisStates[0]);
  assert.equal(assessment.primaryExplanation, diagnosisStates[0]);
});
test('Comparable ambiguity uses unrounded percentage-point margin, not a raw-point margin', () => {
  const r = run(copy('E'));
  const e = r.evidenceSufficiency.explanationSufficiency;
  assert.equal(e.ambiguous, true);
  assert.ok(Math.abs(e.comparisonCandidates[0].relativeEvidenceSupport - 100 * 4 / 9) < 1e-10);
  assert.ok(Math.abs(e.comparisonCandidates[1].relativeEvidenceSupport - 100 * 4 / 14) < 1e-10);
  assert.equal(e.primaryExplanation, null);
  assert.equal('ambiguityMarginPoints' in diagnosisParameters, false);
});
for (const letter of ['A', 'C']) test(`Missing dependency does not invalidate a supported ${letter === 'A' ? 'Operational Problem' : 'Programme Mismatch'} explanation`, () => {
  const input = copy(letter); input.evidence.dependency = null; input.evidence.decisionHorizon = 'long-term';
  const r = run(input), s = r.evidenceSufficiency;
  assert.equal(s.explanationSufficiency.state, 'Sufficient Evidence');
  assert.equal(s.explanationSufficiency.primaryExplanation, letter === 'A' ? diagnosisStates[0] : diagnosisStates[2]);
  assert.equal(s.protectionContextSufficiency.state, 'Insufficient Evidence');
  assert.equal(s.protectionContextSufficiency.unresolvedProtectionGap, true);
  assert.equal('state' in s, false);
});
test('D: sufficient protection never masquerades as a resolved explanation', () => {
  const s = run(copy('D')).evidenceSufficiency;
  assert.equal(s.explanationSufficiency.state, 'Insufficient Evidence');
  assert.equal(s.explanationSufficiency.primaryExplanation, null);
  assert.equal(s.protectionContextSufficiency.state, 'Sufficient Evidence');
  assert.equal(s.protectionContextSufficiency.highDependency, true);
});
test('Protection context does not require diagnosis of the aggregate usage change', () => {
  const input = copy('D'); input.evidence.temporal = null; input.evidence.residentMix = null;
  const s = run(input).evidenceSufficiency;
  assert.equal(s.explanationSufficiency.state, 'Insufficient Evidence');
  assert.equal(s.protectionContextSufficiency.state, 'Sufficient Evidence');
});
test('E: both contexts insufficient; F: explanation insufficient while protection is understood', () => {
  const e = run(copy('E')).evidenceSufficiency, f = run(copy('F')).evidenceSufficiency;
  assert.equal(e.explanationSufficiency.state, 'Insufficient Evidence');
  assert.equal(e.protectionContextSufficiency.state, 'Insufficient Evidence');
  assert.equal(f.explanationSufficiency.state, 'Insufficient Evidence');
  assert.equal(f.protectionContextSufficiency.state, 'Sufficient Evidence');
  assert.ok(run(copy('F')).diagnoses[2].relativeEvidenceSupport > 60);
  assert.equal(f.explanationSufficiency.primaryExplanation, null);
});
test('G: explanation and protection are sufficient simultaneously and independently', () => {
  const r = run(copy('G')), s = r.evidenceSufficiency;
  assert.equal(s.explanationSufficiency.primaryExplanation, diagnosisStates[0]);
  assert.equal(s.explanationSufficiency.state, 'Sufficient Evidence');
  assert.equal(s.protectionContextSufficiency.state, 'Sufficient Evidence');
  assert.equal(s.protectionContextSufficiency.highDependency, true);
});
test('Explicitly understood low dependency is sufficient context, not a high-dependency finding', () => {
  const s = run(copy('C')).evidenceSufficiency.protectionContextSufficiency;
  assert.equal(s.state, 'Sufficient Evidence');
  assert.equal(s.highDependency, false);
  assert.equal(s.requiresLaterActionSpecificReview, true);
});
test('All four duration groups remain representable; 6–24 months stays visible and neutral to current cohort comparisons', () => {
  assert.deepEqual(diagnosisParameters.residenceDurationGroups, ['<6 months', '6–24 months', '2–5 years', '5+ years']);
  const input = copy('C'), before = run(input);
  input.evidence.residentMix.cohorts.push({ cohortId: 'intermediate-1', residenceDuration: '6–24 months', occupancyStatus: 'Tenant', populationBefore: 50, populationAfter: 50, usersBefore: 15, usersAfter: 5, observedPeriods: 6, retainedFraction: 0.95 });
  input.evidence.residentMix.populationAfter += 50;
  const r = run(input), middle = r.checks.residentMix.cohorts.find(c => c.cohortId === 'intermediate-1');
  assert.equal(middle.residenceDuration, '6–24 months');
  assert.match(middle.ruleRole, /^Intermediate cohort/);
  assert.equal(r.checks.residentMix.recentConcentration, before.checks.residentMix.recentConcentration);
  assert.equal(r.checks.residentMix.stableCohortDecline, before.checks.residentMix.stableCohortDecline);
  assert.deepEqual(r.diagnoses.map(d => d.rawEvidenceSupport), before.diagnoses.map(d => d.rawEvidenceSupport));
  const html = renderDiagnosisEvidence(envelope(r));
  assert.ok(html.includes('intermediate-1') && html.includes('6–24 months') && html.includes('Intermediate cohort'));
});
test('UI and v2 API expose two sufficiency results and both support measures, with no combined boolean', () => {
  const r = run(copy('G')), payload = envelope(r);
  assert.equal(assertDiagnosisEnvelope(payload), payload);
  const html = renderDiagnosisEvidence(payload);
  for (const label of ['EXPLANATION SUFFICIENCY', 'PROTECTION CONTEXT SUFFICIENCY', 'Relative Evidence Support', 'Raw Evidence Support', 'not causal probability']) assert.ok(html.includes(label));
  const broken = structuredClone(payload); broken.result.evidenceSufficiency.state = 'Sufficient Evidence';
  assert.throws(() => assertDiagnosisEnvelope(broken), /Separate explanation and protection/);
});
