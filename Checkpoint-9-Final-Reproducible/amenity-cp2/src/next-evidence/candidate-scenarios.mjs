// Scenario designs describe possible future findings. They are NEVER observed evidence.
// Existing records supply shape/denominators only; unknown facts are not filled into the live case.
const clone = x => structuredClone(x);
const source = (e, kind, fields) => ({ ...fields, sourceId: `hypothetical:${kind}`, availableAt: e.asOf });
const operations = (e, issue, physical) => source(e, physical ? 'inspection' : 'maintenance', {
  ...(e.operations ?? {}), recordCoverage: 1, issueRegisterReviewed: true,
  issues: issue ? [{ kind: 'condition', confirmed: true, resolved: false }] : [],
  // A register review cannot invent a physical inspection or erase measured downtime/complaints.
  inspectionHealthy: physical ? !issue : e.operations?.inspectionHealthy ?? null,
  downtimeHours: e.operations?.downtimeHours ?? null, complaintCount: e.operations?.complaintCount ?? null
});
const branch = (label, patch) => ({ label, kind: 'Hypothetical evidence', patch });

function cohortBranches(e) {
  const rows = e.residentMix?.cohorts;
  // A valid cohort comparison needs real denominators, retained users and tenure groups.
  // Where not held in the evidence snapshot, availability must be explicitly supplied as input.
  return rows?.length ? rows : null;
}

export function designCandidates({ evidence: e, context = {}, parameters: p, diagnosisParameters: dp }) {
  const sourceValid = s => s?.sourceId && Number.isFinite(Date.parse(s.availableAt)) && Date.parse(s.availableAt) <= Date.parse(e.asOf);
  const rows = cohortBranches(e) ?? (sourceValid(context.cohortRecordSource) ? context.availableCohortRecords : null) ?? null;
  const record = context.availability ?? {};
  const candidates = [];
  const add = (id, title, targetGapIds, scenarios, blockedReasons = []) => candidates.push({ id, title, targetGapIds, scenarios, blockedReasons, burden: p.burden[id], evidenceRole: 'Evidence collection' });
  add('maintenance', 'Review maintenance records', ['operational-condition', 'explanation-discrimination'], [
    branch('Reviewed register confirms an unresolved issue', { operations: operations(e, true, false) }),
    branch('Reviewed register has no confirmed unresolved issue; physical condition may remain unknown', { operations: operations(e, false, false) })
  ], record.maintenance !== true ? ['Maintenance record availability is unconfirmed or unavailable.'] : []);
  add('inspection', 'Perform physical inspection', ['operational-condition', 'explanation-discrimination'], [
    branch('Inspection and register cross-check confirm an unresolved issue', { operations: operations(e, true, true) }),
    branch('Inspection finds healthy condition; recorded downtime and complaints are retained', { operations: operations(e, false, true) })
  ], record.inspection !== true ? ['Physical inspection feasibility is unconfirmed or unavailable.'] : []);
  add('cohorts', 'Compare resident cohorts', ['resident-mix', 'explanation-discrimination'], rows ? [false, true].map(shift => branch(shift ? 'Decline is recent-resident concentrated; retained long-term cohorts are stable' : 'Decline remains across retained long-term cohorts', { residentMix: source(e, 'cohorts', {
    populationAfter: e.residentMix?.populationAfter ?? context.cohortPopulationAfter ?? null,
    newResidents: e.residentMix?.newResidents ?? context.cohortNewResidents ?? null,
    cohorts: rows.map(c => ({ ...clone(c), usersAfter: ['2–5 years', '5+ years'].includes(c.residenceDuration) && shift ? c.usersBefore / c.populationBefore * c.populationAfter : c.usersAfter }))
  }) })) : [], !rows || record.cohorts !== true ? ['Comparable retained cohort records/denominators are unavailable or feasibility is unconfirmed; do not fabricate them.'] : []);
  const history = e.temporal;
  const hasHistory = history?.observations?.length >= dp.temporalBaselinePeriods && Number.isFinite(history.periodDays) && history.periodDays > 0 && history.observations.every((x, i) => {
    const start = Date.parse(x.periodStart + 'T00:00:00Z');
    return Number.isFinite(start) && start + (history.periodDays - 1) * 86400000 <= Date.parse(e.asOf + 'T23:59:59Z') && (!i || start - Date.parse(history.observations[i - 1].periodStart + 'T00:00:00Z') === history.periodDays * 86400000);
  });
  const observationBranches = hasHistory ? [false, true].map(recovery => {
    const patch = clone(history), baseline = history.observations.slice(0, dp.temporalBaselinePeriods).map(x => x.usage);
    const baselineMean = baseline.every(x => typeof x === 'number' && Number.isFinite(x)) ? baseline.reduce((a, b) => a + b, 0) / baseline.length : null;
    const last = Date.parse(history.observations.at(-1).periodStart + 'T00:00:00Z');
    const lastUsage = history.observations.at(-1).usage;
    for (let i = 1; i <= p.projectedObservationPeriods; i++) patch.observations.push({ periodStart: new Date(last + i * history.periodDays * 86400000).toISOString().slice(0, 10), usage: recovery ? baselineMean : lastUsage, exceptional: false });
    const futureAsOf = new Date(last + ((p.projectedObservationPeriods + 1) * history.periodDays - 1) * 86400000).toISOString().slice(0, 10);
    patch.sourceId = 'hypothetical:future-observation'; patch.availableAt = futureAsOf;
    return branch(recovery ? 'Comparable future periods recover near baseline' : 'Comparable future periods continue the decline', { temporal: patch, asOf: futureAsOf });
  }) : [];
  add('observation', 'Observe another comparable period', ['temporal-stability', 'explanation-discrimination'], observationBranches,
    !hasHistory || record.observation !== true ? ['A comparable dated observation plan/baseline is unavailable or unconfirmed.'] : []);
  add('residents', 'Collect targeted resident evidence about programme fit', ['programme-fit', 'explanation-discrimination'], [false, true].map(mismatch => branch(mismatch ? 'Relevant responses support programme mismatch' : 'Relevant responses support continuing programme fit', { feedback: source(e, 'resident-programme', { relevantToProgramme: true, responses: p.minimumFeedbackResponses, mismatchResponses: mismatch ? p.minimumFeedbackResponses : 0 }) })),
    record.residents !== true ? ['Relevant resident input feasibility is unconfirmed or unavailable.'] : []);
  // Resident reports can document need and impact, but cannot establish substitute capacity or repeated-use history.
  add('dependencyResidents', 'Collect targeted resident evidence about dependency', ['dependent-needs', 'protected-impact'], [false, true].map(high => branch(high ? 'Relevant users document dependency and disproportionate impact' : 'Relevant users report no documented dependency or disproportionate impact', { dependency: source(e, 'resident-dependency', { ...(e.dependency ?? {}), needsDocumented: high, disproportionateImpact: high }) })),
    record.residents !== true ? ['Relevant resident input feasibility is unconfirmed or unavailable.'] : []);
  const usageRecord = sourceValid(context.dependencyUsageSource) ? context.dependencyUsageRecord : null;
  add('dependencyRecords', 'Review existing repeat-use records', ['repeat-dependency'], usageRecord ? [
    branch('Dated records establish the observed repeat-use pattern, including any recorded absence', { dependency: source(e, 'repeat-use-records', { ...(e.dependency ?? {}), ...usageRecord }) })
  ] : [], !usageRecord || record.dependencyRecords !== true ? ['Dated repeat-use records are unavailable or their review is unconfirmed.'] : []);
  const activeUsers = e.dependency?.activeUsers ?? usageRecord?.activeUsers;
  add('substitutes', 'Inspect realistic substitutes and their accessibility/capacity', ['realistic-substitutes'], Number.isFinite(activeUsers) && activeUsers >= 0 ? [false, true].map(limited => branch(limited ? 'Reviewed alternatives are inaccessible, too distant or lack capacity' : 'A realistic accessible substitute has adequate capacity', { dependency: source(e, 'substitute-inspection', {
    ...(e.dependency ?? {}), activeUsers, alternativesReviewed: true,
    alternatives: [{ id: 'hypothetical:reviewed-substitute', distanceKm: limited ? dp.maximumAlternativeDistanceKm * 2 : dp.maximumAlternativeDistanceKm / 2, accessible: !limited, capacity: activeUsers, availableCapacity: limited ? 0 : activeUsers }]
  }) })) : [], !Number.isFinite(activeUsers) || record.substitutes !== true ? ['Substitute inspection feasibility or the observed active-user denominator is unavailable.'] : []);
  const pilotBlocks = [];
  if (record.pilot !== true) pilotBlocks.push('A feasible bounded pilot design has not been supplied.');
  if (!context.pilotDesign?.purpose || !context.pilotDesign?.scope || !(context.pilotDesign?.durationDays > 0) || !context.pilotDesign?.protectedFunction) pilotBlocks.push('The pilot needs a stated purpose, bounded scope/duration and protected-function plan.');
  if (context.programmeResponseUnresolved !== true) pilotBlocks.push('No unresolved programme-response decision gap is specified.');
  const pilot = { id: 'pilot', title: 'Run a temporary programme pilot', evidenceRole: 'Intervention that generates evidence', targetGapIds: ['programme-response'], burden: p.burden.pilot,
    blockedReasons: pilotBlocks,
    scenarios: [
      { label: 'Purpose-aligned participation/fit improves and protected access is retained', kind: 'Hypothetical pilot outcome', resolves: ['programme-response'], implication: 'Supports further consideration of the reversible programme pathway; does not authorize permanent change.' },
      { label: 'Purpose-aligned outcomes do not improve or protected access worsens', kind: 'Hypothetical pilot outcome', resolves: ['programme-response'], implication: 'Weakens that programme pathway; reassess and retain protection constraints.' },
      { label: 'Outcome is inconclusive or confounded', kind: 'Inconclusive', resolves: [], implication: 'The programme-response gap remains unresolved.' }
    ],
    approvalRequired: true, executionImplemented: false,
    outcomeDefinition: { purpose: 'Test reversible programme fit while retaining protected function', measures: ['Programme-specific participation and fit relative to the recorded baseline', 'Repeat participation/retention where relevant', 'Protected cohort access/function retained', 'Context, delivery fidelity and adverse effects'], interpretation: 'Success is purpose-specific; overall usage recovery is not a universal target.', lifecycle: 'Operator approves and runs the same temporary intervention; measured outcome enters evidence and triggers reassessment in a later checkpoint.' }
  };
  candidates.push(pilot);
  return candidates;
}
