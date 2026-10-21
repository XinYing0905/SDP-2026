import { diagnosisStates } from '../config/diagnosis.mjs';

export function scoreDiagnoses(features, p) {
  return diagnosisStates.map(name => {
    const supportingEvidence = [], contradictingEvidence = [], missingEvidence = [], neutralEvidence = [];
    let rawEvidenceSupport = 0, observedWeight = 0, totalWeight = 0, positivePoints = 0, contradictionPoints = 0, configuredPositiveSupportScale = 0;
    for (const [key, weights] of Object.entries(p.weights[name])) {
      const f = features[key];
      const possibleWeight = Math.max(...weights.map(Math.abs));
      configuredPositiveSupportScale += Math.max(0, ...weights);
      totalWeight += possibleWeight;
      if (f.value === null) { missingEvidence.push({ ...f, reason: `${f.label}: unavailable or insufficiently observed.`, points: null }); continue; }
      observedWeight += possibleWeight;
      const points = weights[f.value ? 0 : 1];
      const item = { ...f, points, finding: `${f.label}: observed ${f.value ? 'present' : 'absent'}.` };
      rawEvidenceSupport += points;
      if (points > 0) { supportingEvidence.push(item); positivePoints += points; }
      else if (points < 0) { contradictingEvidence.push(item); contradictionPoints += -points; }
      else neutralEvidence.push(item);
    }
    // Denominator is the full configured scale, never only observed features.
    const relativeEvidenceSupport = observedWeight === 0 || configuredPositiveSupportScale === 0 ? null : 100 * Math.max(0, Math.min(1, rawEvidenceSupport / configuredPositiveSupportScale));
    return { name, rawEvidenceSupport, configuredPositiveSupportScale, relativeEvidenceSupport, relativeSupportInterpretation: 'Own-scale comparative evidence support, not causal probability. Independent across states; does not sum to 100%.', supportLabel: observedWeight === 0 ? 'Unassessed' : rawEvidenceSupport >= p.strongSupportPoints ? 'Strong Support' : rawEvidenceSupport >= p.plausibleSupportPoints ? 'Some Support' : 'Limited / Contradicted Support', supportingEvidence, contradictingEvidence, missingEvidence, neutralEvidence, positivePoints, contradictionPoints, coverage: totalWeight ? observedWeight / totalWeight : 0, observedWeight, totalWeight, supportingDomains: [...new Set(supportingEvidence.map(x => x.domain))] };
  });
}
