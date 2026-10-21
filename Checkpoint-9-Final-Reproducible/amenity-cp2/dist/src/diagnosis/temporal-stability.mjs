import { number, change, mean, refs } from './evidence-utils.mjs';

export function checkTemporal(e, p) {
  const section = e.temporal;
  const unknown = reason => ({ state: 'Insufficiently Observed', persistent: null, temporary: null, exceptional: null, reasons: [reason], sourceRefs: refs(section), trailingPeriods: 0, trailingDays: 0 });
  if (!section || !number(section.periodDays) || section.periodDays < 1 || !Array.isArray(section.observations)) return unknown('Comparable dated temporal observations are unavailable.');
  const rows = section.observations;
  if (rows.length < p.minimumTemporalPoints) return unknown('Too few independent diagnosis-period observations; Needs Attention is not proof of diagnostic persistence.');
  const baseline = rows.slice(0, p.temporalBaselinePeriods);
  const recent = rows.slice(-p.temporalRecentPeriods);
  if (rows.some((row, i) => !Number.isFinite(Date.parse(row.periodStart + 'T00:00:00Z')) || (i && Date.parse(row.periodStart) - Date.parse(rows[i - 1].periodStart) !== section.periodDays * 86400000))) return unknown('Temporal grid is missing, duplicated or not comparable.');
  const latestEnd = Date.parse(rows.at(-1).periodStart) + (section.periodDays - 1) * 86400000;
  if (latestEnd > Date.parse(e.asOf + 'T23:59:59Z')) return unknown('Temporal observation extends beyond analysis time.');
  if ([...baseline, ...recent].some(row => !number(row.usage) || typeof row.exceptional !== 'boolean')) return unknown('Missing usage or context metadata prevents a temporal conclusion.');
  if ([...baseline, ...recent].some(row => row.exceptional)) return { state: 'Affected by Known Exceptional Context', persistent: null, temporary: null, exceptional: true, reasons: ['Known exceptional context prevents interpreting these periods as ordinary persistent change.'], sourceRefs: refs(section), trailingPeriods: 0, trailingDays: 0 };
  const baselineValue = mean(baseline.map(x => x.usage));
  const deltas = recent.map(x => change(baselineValue, x.usage));
  if (deltas.some(x => x === null)) return unknown('Temporal relative pattern is undefined against a zero/missing baseline.');
  const latestSign = Math.sign(deltas.at(-1));
  let trailingPeriods = 0;
  for (const delta of [...deltas].reverse()) {
    if (Math.abs(delta) < p.temporalDeviation || Math.sign(delta) !== latestSign) break;
    trailingPeriods++;
  }
  const trailingDays = trailingPeriods * section.periodDays;
  const persistent = trailingPeriods >= p.temporalRecentPeriods && trailingDays >= p.minimumPersistentDays;
  const temporary = !persistent;
  return { state: persistent ? 'Persistent' : 'Temporary / Not Established as Persistent', persistent, temporary, exceptional: false, direction: latestSign < 0 ? 'decline' : latestSign > 0 ? 'increase' : 'stable', baselineValue, recentValues: recent.map(x => x.usage), trailingPeriods, trailingDays, reasons: [persistent ? `Material same-direction pattern observed for ${trailingDays} days in separate diagnosis history.` : 'Available pattern is short-lived, recovered or below diagnostic persistence requirements.'], sourceRefs: refs(section) };
}
