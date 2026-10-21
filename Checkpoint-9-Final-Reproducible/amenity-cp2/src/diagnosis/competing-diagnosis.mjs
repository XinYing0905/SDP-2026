import { diagnosisParameters } from '../config/diagnosis.mjs';
import { prepareEvidence } from './evidence-utils.mjs';
import { checkTemporal } from './temporal-stability.mjs';
import { checkResidentMix } from './resident-mix-stability.mjs';
import { checkDependency } from './dependency-substitutability.mjs';
import { buildDiagnosisFeatures } from './evidence-features.mjs';
import { scoreDiagnoses } from './scoring.mjs';
import { evaluateSufficiency } from './evidence-sufficiency.mjs';

export function diagnoseCompeting({ changeResult, evidence }, p = diagnosisParameters) {
  if (changeResult.status !== 'Needs Attention') return { executionState: 'Not Assessed', reason: 'Upstream change detection has not identified this amenity as investigation-worthy. No diagnosis is inferred.', upstreamStatus: changeResult.status };
  const e = prepareEvidence(evidence);
  const checks = { temporal: checkTemporal(e, p), residentMix: checkResidentMix(e, p), dependency: checkDependency(e, p) };
  const features = buildDiagnosisFeatures(e, checks, p);
  const diagnoses = scoreDiagnoses(features, p);
  return { executionState: 'Assessed', upstreamStatus: changeResult.status, evidenceSnapshotId: evidence.snapshotId ?? null, dataProvenance: 'Simulated diagnosis evidence', parameterVersion: p.version, scoringInterpretation: 'Raw Evidence Support remains independent signed points. Relative Evidence Support normalizes each state against its own full configured positive scale; it is not causal probability and the four values do not sum to 100%.', checks, features, diagnoses, evidenceSufficiency: evaluateSufficiency(diagnoses, features, checks, e.decisionHorizon, p), warnings: e.warnings, provisionalParameters: p, protection: { relevant: checks.dependency.protectionRelevant, highDependency: checks.dependency.highDependency, note: checks.dependency.protectionRelevant ? 'Dependent-cohort protection remains visible alongside all operational evidence. Low usage does not imply low value.' : 'Unknown or unestablished dependency must not be interpreted as low community value.' } };
}
