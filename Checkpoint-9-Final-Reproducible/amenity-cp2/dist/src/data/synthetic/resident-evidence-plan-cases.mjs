import { createDemoChangeClient } from '../../composition/demo-client.mjs';
import { makePlanBinding } from '../../resident-evidence/snapshot-binding.mjs';
import { questionCatalogue } from '../../resident-evidence/question-catalogue.mjs';
const clone = x => structuredClone(x);
const source = id => ({ sourceId: `synthetic:${id}`, version: '1', availableAt: '2026-07-26' });
export function makeCohortSnapshot(amenityId, evidenceSnapshotId) {
  const durations = ['<6 months', '6–24 months', '2–5 years', '5+ years'];
  return { amenityId, evidenceSnapshotId, version: 'cohorts-1', asOf: '2026-07-26', source: source(`${amenityId}:cohorts`),
    cohorts: durations.map((residenceDuration, i) => ({ id: `cohort-${i}`, version: '1', residenceDuration,
      membershipDefinition: `Recorded current residents in ${residenceDuration}; programme/current-use exposure is assessed separately`,
      source: source(`membership:${i}`), exposureSource: source(`exposure:${i}`), planningCoverageSource: source(`planning-coverage:${i}`),
      currentResidencyDocumented: true, documentedCurrentUse: i === 2 ? true : null, programmeFamiliarity: i === 2 ? true : null,
      knownRelevantMembers: 12, observedPeriods: 6, retainedFraction: 0.95, occupancyStatus: i % 2 ? 'Owner-occupier' : 'Tenant',
      referencePeriod: { start: '2026-02-09', end: '2026-07-26' }, comparativeImpactSource: null })),
    unrepresentedGroups: ['Groups without documented question-specific exposure remain unrepresented; no township-wide claim.'] };
}
export function bindPlanInput(input) {
  input.expectedBinding = makePlanBinding({ ...input, catalogueVersion: questionCatalogue.version });
  return input;
}
export async function makeResidentPlanInput(id, client = createDemoChangeClient()) {
  const [diagnosisEnvelope, nextEvidenceEnvelope, change] = await Promise.all([client.getCompetingDiagnosis(id), client.getNextBestEvidence(id), client.getChangeEvidence(id)]);
  const names = { 'NB-C': 'Community Hall', 'NB-D': 'Sports Court' };
  const amenityName = names[id] ?? change.entry.input.name;
  return bindPlanInput({ amenityId: id, amenityName, currentFunction: `${amenityName} in its current function`, analysisAsOf: '2026-07-26',
    diagnosisEnvelope, nextEvidenceEnvelope, cohortSnapshot: makeCohortSnapshot(id, nextEvidenceEnvelope.result.evidenceSnapshotId) });
}
export async function createResidentPlanAcceptanceCases() {
  const client = createDemoChangeClient(), seeds = {};
  for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'H']) seeds[letter] = await makeResidentPlanInput('NB-' + letter, client);
  const row = (letter, seed, expectedState, description, edit = () => {}) => { const input = clone(seeds[seed]); edit(input); bindPlanInput(input); return { case: letter, description, expectedState, input }; };
  const rows = [
    row('A', 'A', 'Not eligible', 'Inspection winner: insufficient evidence does not trigger residents'),
    row('B', 'B', 'Not eligible', 'Cohort comparison winner is preserved'),
    row('C', 'C', 'Draft pair selected', 'Relevant observed 2–5-year programme pair'),
    row('D', 'C', 'Pair tie', 'Equally informative 2–5-year and 5+-year programme cohorts', c => { c.cohortSnapshot.cohorts[3].programmeFamiliarity = true; }),
    row('E', 'D', 'Pair tie', 'Protection questions retain sufficient operational explanation'),
    row('F', 'D', 'Pair tie', 'Needs and impact remain separate one-gap alternatives'),
    row('G', 'E', 'Not eligible', 'Known high dependency does not explain change or force residents'),
    row('H', 'F', 'Not eligible', 'Both dimensions sufficient; no forced question'),
    row('I', 'C', 'No valid pair', 'Unavailable cohort membership', c => { c.cohortSnapshot.cohorts = []; }),
    row('J', 'C', 'Draft pair selected', 'Ownership label permutation supplies no selection weight', c => { c.cohortSnapshot.cohorts.forEach(x => { x.occupancyStatus = x.occupancyStatus === 'Tenant' ? 'Owner-occupier' : 'Tenant'; }); }),
    row('K', 'D', 'Pair tie', 'Intermediate cohort remains visible and eligible for current-use knowledge', c => { c.cohortSnapshot.cohorts[2].documentedCurrentUse = null; c.cohortSnapshot.cohorts[1].documentedCurrentUse = true; }),
    row('L', 'C', 'No valid pair', 'Recent-only familiarity does not establish long-term programme relevance', c => { c.cohortSnapshot.cohorts.forEach((x, i) => { x.programmeFamiliarity = i === 0; }); }),
    row('M', 'D', 'Pair tie', 'Dependency answers cannot establish alternatives/repeat-use history'),
    row('N', 'C', 'Not eligible', 'Upstream source tie never resolves to a resident fallback', c => { c.nextEvidenceEnvelope.result.nextBestCandidateIds = ['residents', 'inspection']; c.nextEvidenceEnvelope.result.residentInputEligibleForLaterSelection = false; }),
    row('O', 'C', 'No valid pair', 'No relevant programme knowledge: generic replacement question forbidden', c => { c.cohortSnapshot.cohorts.forEach(x => { x.programmeFamiliarity = false; }); c.cohortSnapshot.suggestedQuestion = 'Why did usage fall?'; }),
    row('P', 'C', 'Draft pair selected', 'All inconclusive outcomes retain zero credit'),
    row('Q', 'C', 'Stale input', 'Cohort version changed after plan preparation'),
    row('R', 'H', 'Not eligible', 'Pilot winner remains an intervention generating evidence'),
    row('S', 'D', 'Pair tie', 'Unknown dependency: neutral documented-current-use cohort'),
    row('T', 'C', 'Draft pair selected', 'Unsupported supplied assertion cannot enter reviewed planning scenarios', c => { c.cohortSnapshot.requestedScenario = { optionIds: ['NOT-AN-OPTION'], assertionIds: ['healthy-operations'], targetGapId: 'programme-fit' }; }),
    row('U', 'C', 'Draft pair selected', 'Ceased personal need is not mismatch or dissatisfaction'),
    row('V', 'D', 'Pair tie', 'Severe anticipated impact lacks comparative corroboration'),
    row('W', 'C', 'Draft pair selected', 'Unable, voluntary skip and missing are distinct'),
    row('X', 'C', 'Draft pair selected', 'Extra scenario labels cannot increase pair value', c => { c.cohortSnapshot.requestedScenarioGroups = Array.from({ length: 20 }, (_, i) => ({ id: `extra-${i}`, optionIds: ['PF-YES'] })); })
  ];
  rows.find(c => c.case === 'Q').input.cohortSnapshot.version = 'cohorts-2';
  return rows;
}
