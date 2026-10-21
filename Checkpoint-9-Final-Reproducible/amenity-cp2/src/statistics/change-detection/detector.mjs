import { parameters, metricDefinitions } from './config.mjs';

const DAY = 86400000;
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Expected ISO period start');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
  return time;
};
const iso = time => new Date(time).toISOString().slice(0, 10);

function validate(p, amenity) {
  for (const key of ['periodDays', 'baselinePeriods', 'currentPeriods', 'minimumPersistence', 'minimumConsistentSignals']) {
    if (!Number.isInteger(p[key]) || p[key] < 1) throw new Error(`Invalid parameter: ${key}`);
  }
  if (p.minimumPersistence > p.currentPeriods) throw new Error('Persistence exceeds current window');
  for (const key of ['minimumBaselineCoverage', 'minimumCurrentCoverage', 'relativeDeviationThreshold']) {
    if (!finite(p[key]) || p[key] <= 0 || p[key] > 1) throw new Error(`Invalid parameter: ${key}`);
  }
  if (p.contextualInterpretation !== 'exclude-exceptional-period-and-break-persistence') throw new Error('Unsupported context policy');
  const keys = amenity.applicableSignals;
  if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length) throw new Error('Unique applicable signals required');
  for (const key of keys) {
    if (!metricDefinitions[key]) throw new Error(`Unsupported signal: ${key}`);
    if (!finite(p.absoluteDeviationFloors[key]) || p.absoluteDeviationFloors[key] <= 0) throw new Error(`Invalid floor: ${key}`);
  }
}

/** Detection only. No diagnosis, intervention, support or AI fields. */
export function detectChange(amenity, p = parameters) {
  validate(p, amenity);
  const end = date(amenity.analysisPeriodStart);
  const step = p.periodDays * DAY;
  const starts = Array.from({ length: p.baselinePeriods + p.currentPeriods }, (_, i) => iso(end - (p.baselinePeriods + p.currentPeriods - 1 - i) * step));
  const expected = new Set(starts);
  const rows = new Map();
  const warnings = [];
  const contextualCaveats = [];
  for (const row of amenity.observations) {
    const time = date(row.periodStart);
    if ((end - time) % step !== 0) throw new Error('Observation is off the configured period grid');
    if (rows.has(row.periodStart)) throw new Error('Duplicate observation period');
    if (row.context && !['normal', 'closure', 'holiday', 'exceptional-event', 'unavailable-data'].includes(row.context.type)) throw new Error('Unknown context type');
    rows.set(row.periodStart, row);
  }
  const missingPeriods = starts.filter(start => !rows.has(start));
  if (missingPeriods.length) warnings.push(`Missing observation periods: ${missingPeriods.join(', ')}. Values remain unknown.`);
  for (const start of starts) {
    const row = rows.get(start);
    if (row && !row.context) warnings.push(`${start}: context metadata unavailable; exceptional-period context is unknown.`);
    if (row?.context && row.context.type !== 'normal') contextualCaveats.push({ periodStart: start, type: row.context.type, note: row.context.note || '', interpretation: 'Excluded from behavioral baseline/current means; breaks persistence. Not evidence of ordinary demand decline.' });
    if (row && row.maintenance == null) warnings.push(`${start}: maintenance/downtime context unavailable; condition is unknown.`);
    if (row?.maintenance) {
      if (row.maintenance.downtimeHours == null || row.maintenance.ticketCount == null) warnings.push(`${start}: maintenance context incomplete; missing fields remain unknown.`);
      for (const [key, value] of Object.entries(row.maintenance)) {
        if (value != null && (!finite(value) || value < 0)) throw new Error('Invalid maintenance observation');
      }
      if (row.maintenance.downtimeHours > 0 || row.maintenance.ticketCount > 0) contextualCaveats.push({ periodStart: start, type: 'maintenance-context', note: `Recorded downtime: ${row.maintenance.downtimeHours ?? 'unknown'} hours; tickets: ${row.maintenance.ticketCount ?? 'unknown'}. Operational context only; no explanation is inferred.`, interpretation: 'Visible contextual signal; not a diagnosis and not automatically excluded without a known exceptional period.' });
    }
  }
  const metrics = amenity.applicableSignals.map(key => {
    const def = metricDefinitions[key];
    const points = starts.map((start, i) => {
      const row = rows.get(start);
      const rawValue = row?.values?.[key];
      if (rawValue != null && (!finite(rawValue) || rawValue < 0 || (def.unit === 'rate' && rawValue > 1))) throw new Error(`Invalid ${key} at ${start}`);
      const value = rawValue == null ? null : rawValue;
      const excluded = Boolean(row?.context && row.context.type !== 'normal');
      return { periodStart: start, window: i < p.baselinePeriods ? 'baseline' : 'current', value, eligible: value !== null && !excluded, context: row?.context?.type || (row ? 'context-unknown' : 'missing-period') };
    });
    const baselinePoints = points.slice(0, p.baselinePeriods);
    const currentPoints = points.slice(p.baselinePeriods);
    const baselineValues = baselinePoints.filter(x => x.eligible).map(x => x.value);
    const currentValues = currentPoints.filter(x => x.eligible).map(x => x.value);
    const baselineValue = mean(baselineValues);
    const currentValue = mean(currentValues);
    const coverage = { baseline: baselineValues.length / p.baselinePeriods, current: currentValues.length / p.currentPeriods, validBaseline: baselineValues.length, validCurrent: currentValues.length, expectedBaseline: p.baselinePeriods, expectedCurrent: p.currentPeriods };
    const assessable = coverage.baseline >= p.minimumBaselineCoverage && coverage.current >= p.minimumCurrentCoverage;
    for (const window of ['baseline', 'current']) {
      const missing = points.filter(x => x.window === window && x.value === null).map(x => x.periodStart);
      if (missing.length) warnings.push(`${def.label}: unknown ${window} observations at ${missing.join(', ')}; not zero-filled.`);
    }
    if (!assessable) warnings.push(`${def.label}: insufficient eligible coverage (${baselineValues.length}/${p.baselinePeriods} baseline; ${currentValues.length}/${p.currentPeriods} current). No change conclusion for this signal.`);
    const magnitude = baselineValue === null || currentValue === null ? null : currentValue - baselineValue;
    const percentageChange = baselineValue === null || baselineValue === 0 || currentValue === null ? null : magnitude / baselineValue * 100;
    const percentagePointChange = def.unit === 'rate' && magnitude !== null ? magnitude * 100 : null;
    const floor = p.absoluteDeviationFloors[key];
    function direction(value) {
      if (!assessable || baselineValue === null || value === null) return null;
      const delta = value - baselineValue;
      if (Math.abs(delta) < floor || (baselineValue !== 0 && Math.abs(delta / baselineValue) < p.relativeDeviationThreshold)) return null;
      return Math.sign(delta) === def.deteriorationSign ? 'deterioration' : 'increase-or-improvement';
    }
    const latestPoint = currentPoints.at(-1);
    const latestDirection = latestPoint.eligible ? direction(latestPoint.value) : null;
    let trailingPeriods = 0;
    if (latestDirection) {
      for (const point of [...currentPoints].reverse()) {
        if (!point.eligible || direction(point.value) !== latestDirection) break;
        trailingPeriods++;
      }
    }
    const excursions = currentPoints.filter(x => x.eligible && direction(x.value)).map(x => ({ periodStart: x.periodStart, value: x.value, direction: direction(x.value) }));
    const currentDirection = direction(currentValue);
    const persistent = Boolean(assessable && latestDirection && currentDirection === latestDirection && trailingPeriods >= p.minimumPersistence);
    return { key, label: def.label, unit: def.unit, baselineValue, currentValue, magnitude, percentageChange, percentagePointChange, coverage, assessable, currentDirection, latestDirection, persistence: { trailingPeriods, requiredPeriods: p.minimumPersistence, sustained: persistent, missingOrExceptionalBreaksStreak: true }, excursions, points };
  });
  const groups = ['deterioration', 'increase-or-improvement'].map(direction => ({ direction, signals: metrics.filter(m => m.persistence.sustained && m.latestDirection === direction).map(m => m.key) }));
  const leading = groups.reduce((a, b) => b.signals.length > a.signals.length ? b : a);
  const assessableSignals = metrics.filter(m => m.assessable).length;
  const sufficientConsistency = leading.signals.length >= p.minimumConsistentSignals;
  const currentUnknown = metrics.some(m => !m.points.at(-1).eligible || !m.assessable || m.points.slice(p.baselinePeriods).some(x => x.value === null));
  const activeExcursion = metrics.some(m => m.latestDirection);
  const exceptionalCurrent = contextualCaveats.some(c => c.type !== 'maintenance-context' && starts.slice(p.baselinePeriods).includes(c.periodStart));
  let status;
  let explanation;
  if (sufficientConsistency) {
    status = 'Needs Attention';
    explanation = `${leading.signals.length} signals show material ${leading.direction} sustained through at least ${p.minimumPersistence} consecutive eligible periods ending in the latest period. Both relative/absolute deviation and minimum consistency requirements pass. Investigation-worthy change only; no cause is inferred.`;
  } else if (activeExcursion || currentUnknown || exceptionalCurrent || assessableSignals < p.minimumConsistentSignals) {
    status = 'Monitoring';
    explanation = `Needs Attention criteria are not met: ${leading.signals.length}/${p.minimumConsistentSignals} signals meet shared-direction persistence. ${exceptionalCurrent ? 'Known exceptional periods affect interpretation. ' : ''}${currentUnknown ? 'Missing or ineligible data leave uncertainty. ' : ''}${activeExcursion ? 'A current deviation requires more consistent sustained evidence. ' : ''}${assessableSignals < p.minimumConsistentSignals ? 'Too few assessable signals for the configured consistency requirement. ' : ''}This status does not recommend an action.`;
  } else {
    status = 'Stable';
    explanation = `No current sustained multi-signal change meets the configured requirements. ${metrics.some(m => m.excursions.length) ? 'Earlier current-window excursions returned near baseline; a temporary dip alone does not trigger Needs Attention.' : 'Latest eligible observations remain below material-change thresholds.'} Stable describes these observations, not amenity condition or community value.`;
  }
  return { amenityId: amenity.id, amenityName: amenity.name, tier: amenity.tier, status, explanation, parameterVersion: p.version, dataProvenance: 'Simulated input data', baselineWindow: { start: starts[0], end: iso(end - p.currentPeriods * step + (p.periodDays - 1) * DAY), periods: p.baselinePeriods }, currentWindow: { start: starts[p.baselinePeriods], end: iso(end + (p.periodDays - 1) * DAY), periods: p.currentPeriods }, metrics, detectedChangeSignals: metrics.filter(m => m.excursions.length).map(m => ({ signal: m.key, direction: m.latestDirection ?? 'returned-or-unknown', sustained: m.persistence.sustained, periods: m.excursions })), persistence: { requiredPeriods: p.minimumPersistence, result: sufficientConsistency ? 'Sustained consistent change' : 'Sustained consistent change not established', perSignal: metrics.map(m => ({ signal: m.key, ...m.persistence })) }, signalConsistency: { required: p.minimumConsistentSignals, observed: leading.signals.length, direction: leading.signals.length ? leading.direction : null, signals: leading.signals, assessableSignals, meetsRequirement: sufficientConsistency }, contextualCaveats, missingDataWarnings: [...new Set(warnings)], missingPeriods, ignoredOutOfWindowPeriods: [...rows.keys()].filter(k => !expected.has(k)), provisionalParameters: p };
}
