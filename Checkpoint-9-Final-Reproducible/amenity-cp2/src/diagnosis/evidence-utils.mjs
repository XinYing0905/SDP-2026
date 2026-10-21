export const number = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
export const fraction = x => number(x) && x <= 1;
export const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export const change = (before, after) => number(before) && before > 0 && number(after) ? (after - before) / before : null;
export const refs = (...sections) => [...new Set(sections.filter(Boolean).map(x => x.sourceId).filter(Boolean))];
export function prepareEvidence(input) {
  const evidence = {};
  const warnings = [];
  const asOf = Date.parse(input.asOf + 'T23:59:59Z');
  if (!Number.isFinite(asOf) || !['short-term', 'long-term'].includes(input.decisionHorizon)) throw new Error('Diagnosis requires valid asOf and decisionHorizon');
  for (const key of ['temporal', 'operations', 'residentMix', 'usage', 'programme', 'feedback', 'dependency']) {
    const section = input[key];
    if (!section || !section.sourceId) { evidence[key] = null; warnings.push(`${key}: evidence unavailable; remains unknown.`); continue; }
    const available = Date.parse(section.availableAt + 'T00:00:00Z');
    if (!Number.isFinite(available) || available > asOf) { evidence[key] = null; warnings.push(`${key}: evidence unavailable at analysis time; not used.`); continue; }
    evidence[key] = section;
  }
  return { ...evidence, warnings, decisionHorizon: input.decisionHorizon, asOf: input.asOf };
}
