// Separate CP3 evidence; approved CP2 fixtures are never edited or reused as diagnosis truth.
const iso = time => new Date(time).toISOString().slice(0, 10);
const source = (id, fields) => ({ sourceId: id, availableAt: '2026-07-26', ...fields });
function amenity(letter, name, stableRepeat = false) {
  return { id: `DX-${letter}`, name, tier: 'A', description: `Checkpoint 3 canonical case ${letter} · simulated evidence`, analysisPeriodStart: '2026-07-20', applicableSignals: ['bookings', 'uniqueUsers', 'repeatUsers'], observations: Array.from({ length: 12 }, (_, i) => ({ periodStart: iso(Date.UTC(2026, 4, 4) + i * 7 * 86400000), values: { bookings: i < 8 ? 100 : [65, 62, 60, 58][i - 8], uniqueUsers: i < 8 ? 80 : [55, 53, 51, 50][i - 8], repeatUsers: i < 8 || stableRepeat ? 40 : [28, 27, 26, 25][i - 8] }, context: { type: 'normal' }, maintenance: null })) };
}
function temporal(id, periodDays = 28, timeSlot = null) {
  const initial = periodDays === 28 ? Date.UTC(2026, 1, 9) : Date.UTC(2026, 5, 15);
  return source(`${id}:temporal`, { periodDays, timeSlot, observations: [100, 100, 100, 70, 68, 65].map((usage, i) => ({ periodStart: iso(initial + i * periodDays * 86400000), usage, exceptional: false })) });
}
const operations = (id, issue = false) => source(`${id}:operations`, { recordCoverage: 1, issueRegisterReviewed: true, inspectionHealthy: !issue, downtimeHours: issue ? 14 : 0, complaintCount: issue ? 6 : 0, issues: issue ? [{ kind: 'lighting', confirmed: true, resolved: false, description: 'Evening lighting failure recorded in maintenance register.' }] : [] });
function residentMix(id, kind = 'decline') {
  const recent = kind === 'shift';
  const stable = kind === 'stable' || recent;
  return source(`${id}:residentMix`, { populationAfter: recent ? 300 : 250, newResidents: recent ? 90 : 5, cohorts: [
    { cohortId: 'recent', residenceDuration: '<6 months', occupancyStatus: 'Tenant', populationBefore: 50, populationAfter: recent ? 100 : 50, usersBefore: 40, usersAfter: recent ? 10 : kind === 'stable' ? 40 : 30, observedPeriods: 6, retainedFraction: recent ? 0.3 : 0.95 },
    { cohortId: 'long-1', residenceDuration: '2–5 years', occupancyStatus: 'Tenant', populationBefore: 100, populationAfter: 100, usersBefore: 20, usersAfter: stable ? 20 : 10, observedPeriods: 6, retainedFraction: 0.95 },
    { cohortId: 'long-2', residenceDuration: '5+ years', occupancyStatus: 'Owner-occupier', populationBefore: 100, populationAfter: 100, usersBefore: 20, usersAfter: stable ? 20 : 10, observedPeriods: 6, retainedFraction: 0.95 }
  ] });
}
const dependency = (id, high = false) => source(`${id}:dependency`, { cohortSize: high ? 12 : 30, residentPopulation: 300, activeUsers: high ? 12 : 30, repeatUsers: high ? 10 : 12, stablePeriods: 6, needsDocumented: high, disproportionateImpact: high, accessibilityNeeds: high ? 'Accessible nearby function needed by the recorded dependent cohort.' : 'No special access need recorded in the completed assessment.', alternativesReviewed: true, alternatives: [{ id: 'alternative-1', distanceKm: high ? 6 : 1, accessible: !high, capacity: 60, availableCapacity: high ? 0 : 50 }] });
function evidence(id, options = {}) {
  return { snapshotId: `${id}:snapshot-1`, asOf: '2026-07-26', decisionHorizon: options.horizon ?? 'short-term', temporal: temporal(id, options.periodDays ?? 28, options.operational ? 'evening' : null), operations: operations(id, options.operational), residentMix: residentMix(id, options.mix ?? 'decline'), usage: source(`${id}:usage`, { utilisationRate: options.highDependency ? 0.08 : 0.45 }), programme: source(`${id}:programme`, { participationBefore: 60, participationAfter: options.mismatch ? 32 : 60 }), feedback: source(`${id}:feedback`, { relevantToProgramme: true, responses: 20, mismatchResponses: options.mismatch ? 16 : 2 }), dependency: dependency(id, options.highDependency) };
}
export const diagnosisCases = [
  { canonicalCase: 'A', amenity: amenity('A', 'Sports Court'), evidence: evidence('DX-A', { operational: true }), expectedStrong: ['Operational Problem'], expectedSufficiency: 'Sufficient Evidence' },
  { canonicalCase: 'B', amenity: amenity('B', 'Function Room'), evidence: evidence('DX-B', { mix: 'shift', periodDays: 7 }), expectedStrong: ['Temporary / Resident-Mix Shift'], expectedSufficiency: 'Sufficient Evidence' },
  { canonicalCase: 'C', amenity: amenity('C', 'Community Hall'), evidence: evidence('DX-C', { mismatch: true, horizon: 'long-term' }), expectedStrong: ['Persistent Programme / Configuration Mismatch'], expectedSufficiency: 'Sufficient Evidence' },
  { canonicalCase: 'D', amenity: amenity('D', 'Senior Activity Room', true), evidence: evidence('DX-D', { highDependency: true, mix: 'stable', horizon: 'long-term' }), expectedStrong: ['Low Utilisation, High Dependency'], expectedSufficiency: 'Sufficient Evidence' },
  { canonicalCase: 'E', amenity: amenity('E', 'Multipurpose Room'), evidence: evidence('DX-E', { mismatch: true, horizon: 'long-term' }), expectedStrong: [], expectedSufficiency: 'Insufficient Evidence' },
  { canonicalCase: 'F', amenity: amenity('F', 'Meeting Room'), evidence: evidence('DX-F', { mismatch: true, horizon: 'long-term' }), expectedStrong: ['Persistent Programme / Configuration Mismatch'], expectedSufficiency: 'Insufficient Evidence' },
  { canonicalCase: 'G', amenity: amenity('G', 'Accessible Activity Room', true), evidence: evidence('DX-G', { operational: true, highDependency: true }), expectedStrong: ['Operational Problem', 'Low Utilisation, High Dependency'], expectedSufficiency: 'Sufficient Evidence' }
];
// A has no programme-specific evidence; do not invent it merely to reject other diagnoses.
diagnosisCases[0].evidence.programme = null;
diagnosisCases[0].evidence.feedback = null;
// E retains two plausible explanations but lacks inspection/register, cohort and dependency evidence.
const ambiguous = diagnosisCases[4].evidence;
ambiguous.operations = source('DX-E:operations', { recordCoverage: 0.4, issueRegisterReviewed: false, issues: null, inspectionHealthy: null, downtimeHours: 8, complaintCount: 4 });
ambiguous.residentMix = null; ambiguous.dependency = null; ambiguous.feedback = null;
// F deliberately lacks cohort information despite a strong raw mismatch score.
diagnosisCases[5].evidence.residentMix = null;
