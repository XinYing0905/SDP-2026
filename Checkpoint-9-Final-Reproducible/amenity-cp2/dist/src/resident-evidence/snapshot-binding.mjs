// Exact canonical content comparison, not a collision-prone abbreviated checksum or security token.
export function canonicalContent(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalContent).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonicalContent(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function makePlanBinding({ diagnosisEnvelope, nextEvidenceEnvelope, cohortSnapshot, catalogueVersion, analysisAsOf, currentFunction }) {
  return canonicalContent({ diagnosisEnvelope, nextEvidenceEnvelope, cohortSnapshot, catalogueVersion, analysisAsOf, currentFunction });
}
