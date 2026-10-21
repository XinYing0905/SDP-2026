import { diagnosisCases } from './diagnosis-cases.mjs';
const clone = x => structuredClone(x);
const from = (letter, id, title) => {
  const c = clone(diagnosisCases.find(c => c.canonicalCase === letter));
  c.amenity.id = id; c.amenity.name = title;
  c.amenity.description = 'Checkpoint 4 — simulated decision-aware evidence case';
  c.evidence.snapshotId = `${id}:approved-input`;
  return { amenity: c.amenity, evidence: c.evidence };
};
const availability = { maintenance: true, inspection: true, cohorts: true, observation: true, residents: true, dependencyRecords: true, substitutes: true, pilot: false };
const cohorts = clone(diagnosisCases.find(c => c.canonicalCase === 'C').evidence.residentMix);
const context = () => ({ availability: clone(availability), availableCohortRecords: clone(cohorts.cohorts), cohortPopulationAfter: cohorts.populationAfter, cohortNewResidents: cohorts.newResidents,
  cohortRecordSource: { sourceId: 'simulated:available-cohort-records', availableAt: '2026-07-26' },
  dependencyUsageRecord: { activeUsers: 30, repeatUsers: 20, stablePeriods: 6 },
  dependencyUsageSource: { sourceId: 'simulated:repeat-use-records', availableAt: '2026-07-26' } });

export const nextEvidenceCases = [
  { case: 'A', ...from('E', 'NB-A', 'Operational uncertainty — inspect first'), decisionContext: context(), expectedTop: ['inspection'], expectedExplanation: 'Insufficient Evidence', expectedProtection: 'Insufficient Evidence' },
  { case: 'B', ...from('F', 'NB-B', 'Resident-mix gap — compare cohorts'), decisionContext: context(), expectedTop: ['cohorts'], expectedExplanation: 'Insufficient Evidence', expectedProtection: 'Sufficient Evidence' },
  { case: 'C', ...from('C', 'NB-C', 'Programme evidence — resident input can matter'), decisionContext: context(), expectedTop: ['residents'], expectedExplanation: 'Insufficient Evidence', expectedProtection: 'Sufficient Evidence' },
  { case: 'D', ...from('A', 'NB-D', 'Supported explanation — protection gaps remain'), decisionContext: context(), expectedTop: ['dependencyResidents'], expectedExplanation: 'Sufficient Evidence', expectedProtection: 'Insufficient Evidence' },
  { case: 'E', ...from('D', 'NB-E', 'Protection understood — explanation remains unresolved'), decisionContext: context(), expectedTop: [], expectedExplanation: 'Insufficient Evidence', expectedProtection: 'Sufficient Evidence' },
  { case: 'F', ...from('G', 'NB-F', 'Both assessments sufficient — no forced collection'), decisionContext: context(), expectedTop: [], expectedExplanation: 'Sufficient Evidence', expectedProtection: 'Sufficient Evidence' },
  { case: 'G', ...from('E', 'NB-G', 'Missing evidence sources — retain unknowns'), decisionContext: { availability: Object.fromEntries(Object.keys(availability).map(k => [k, false])) }, expectedTop: [], expectedExplanation: 'Insufficient Evidence', expectedProtection: 'Insufficient Evidence' },
  { case: 'H', ...from('C', 'NB-H', 'Temporary pilot — an intervention generating evidence'), decisionContext: { ...context(), programmeResponseUnresolved: true, availability: { ...availability, pilot: true }, pilotDesign: { purpose: 'Test a revised accessible programme', scope: 'One programme slot; current amenity function retained', durationDays: 42, protectedFunction: 'Maintain current protected-cohort access and function' } }, expectedTop: ['pilot'], expectedExplanation: 'Sufficient Evidence', expectedProtection: 'Sufficient Evidence' },
  { case: 'I', ...from('C', 'NB-I', 'Observation gap — wait for comparable history'), decisionContext: context(), expectedTop: ['observation'], expectedExplanation: 'Insufficient Evidence', expectedProtection: 'Sufficient Evidence' },
  { case: 'J', ...from('A', 'NB-J', 'Maintenance review — inspection unavailable'), decisionContext: { ...context(), availability: { ...availability, inspection: false } }, expectedTop: ['maintenance'], expectedExplanation: 'Insufficient Evidence', expectedProtection: 'Sufficient Evidence' }
];
// Separate fixtures: original CP2/CP3 evidence bytes and expected outputs remain untouched.
nextEvidenceCases[2].evidence.feedback = null;
nextEvidenceCases[2].evidence.programme = null;
// Known operational/temporal/cohort context, with programme participation and feedback absent.
nextEvidenceCases[3].evidence.dependency = null;
// E intentionally has no extra contextual source availability: new inspection can still be considered.
nextEvidenceCases[4].decisionContext.availability.inspection = false;
nextEvidenceCases[4].decisionContext.availability.maintenance = false;
nextEvidenceCases[4].decisionContext.availability.residents = false;
nextEvidenceCases[4].decisionContext.availability.cohorts = false;
nextEvidenceCases[4].decisionContext.availability.observation = false;
// Five actual independent history points; the recent window is not yet sufficiently observed.
nextEvidenceCases[8].evidence.temporal.observations = nextEvidenceCases[8].evidence.temporal.observations.slice(0, 5).map(row => ({ ...row, periodStart: new Date(Date.parse(row.periodStart) + 28 * 86400000).toISOString().slice(0, 10) }));
// Existing partial register/downtime evidence supports reviewing records before any conclusion.
nextEvidenceCases[9].evidence.operations = { ...nextEvidenceCases[9].evidence.operations, recordCoverage: 0.4, issueRegisterReviewed: false, issues: null, inspectionHealthy: null };
