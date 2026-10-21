import { number, fraction, change, refs } from './evidence-utils.mjs';

export function buildDiagnosisFeatures(e, checks, p) {
  const { temporal: t, residentMix: r, dependency: d } = checks;
  const ops = e.operations;
  const reviewed = Boolean(ops && fraction(ops.recordCoverage) && ops.recordCoverage >= p.minimumRecordCoverage && ops.issueRegisterReviewed === true && Array.isArray(ops.issues));
  const unresolved = reviewed ? ops.issues.filter(x => x.confirmed === true && x.resolved === false) : null;
  const operationalIssue = reviewed ? unresolved.length > 0 ? true : ops.inspectionHealthy === true ? false : null : null;
  const operationalHealthy = reviewed && typeof ops.inspectionHealthy === 'boolean' && number(ops.downtimeHours) ? ops.inspectionHealthy && unresolved.length === 0 && ops.downtimeHours < p.elevatedDowntimeHours : null;
  const programmeChange = e.programme ? change(e.programme.participationBefore, e.programme.participationAfter) : null;
  const feedback = e.feedback;
  const feedbackKnown = feedback && feedback.relevantToProgramme === true && number(feedback.responses) && feedback.responses >= p.minimumFeedbackResponses && number(feedback.mismatchResponses) && feedback.mismatchResponses <= feedback.responses;
  const features = {};
  const add = (key, label, value, domain, ...sources) => { features[key] = { key, label, value: typeof value === 'boolean' ? value : null, domain, sourceRefs: refs(...sources) }; };
  add('operationalIssue', 'Confirmed unresolved operational issue', operationalIssue, 'operations', ops);
  add('downtimeElevated', 'Recorded downtime is elevated', ops && number(ops.downtimeHours) ? ops.downtimeHours >= p.elevatedDowntimeHours : null, 'operations', ops);
  add('operationalComplaints', 'Recorded operational complaints', ops && number(ops.complaintCount) ? ops.complaintCount >= p.minimumOperationalComplaints : null, 'operations', ops);
  add('operationalHealthy', 'Reviewed operational condition appears healthy', operationalHealthy, 'operations', ops);
  add('timeSpecificDeterioration', 'Observed time-specific sustained decline', e.temporal?.timeSlot ? t.persistent === null ? null : t.persistent && t.direction === 'decline' : null, 'temporal', e.temporal);
  add('persistentPattern', 'Independent diagnosis history supports persistent decline', t.persistent === null ? null : t.persistent && t.direction === 'decline', 'temporal', e.temporal);
  add('temporaryPattern', 'Pattern is temporary/not established as persistent', t.temporary, 'temporal', e.temporal);
  add('exceptionalContext', 'Known exceptional context affects pattern', t.exceptional, 'temporal', e.temporal);
  add('recentConcentration', 'Decline concentrated among recent residents', r.recentConcentration, 'residentMix', e.residentMix);
  add('longCohortsStable', 'Retained long-term cohorts show stable usage rates', r.longCohortsStable, 'residentMix', e.residentMix);
  add('turnoverHigh', 'Resident turnover is materially elevated', r.turnoverHigh, 'residentMix', e.residentMix);
  add('stableCohortDecline', 'Multiple retained long-term cohorts decline', r.stableCohortDecline, 'residentMix', e.residentMix);
  add('mixControlled', 'Cross-cohort decline persists with low recorded turnover', r.mixControlled, 'residentMix', e.residentMix);
  add('programmeDecline', 'Programme participation declines materially', programmeChange === null ? null : programmeChange <= -p.programmeDeviation, 'programme', e.programme);
  add('programmeMismatchFeedback', 'Relevant existing feedback supports programme mismatch', feedbackKnown ? feedback.mismatchResponses / feedback.responses >= p.mismatchFeedbackFraction : null, 'feedback', feedback);
  add('lowUtilisation', 'Overall utilisation is low', e.usage && fraction(e.usage.utilisationRate) ? e.usage.utilisationRate <= p.lowUtilisation : null, 'usage', e.usage);
  add('stableRepeatCohort', 'Stable cohort uses the function repeatedly', d.stableRepeatCohort, 'dependency', e.dependency);
  add('documentedDependency', 'Dependency needs explicitly documented', d.documentedDependency, 'dependency', e.dependency);
  add('limitedSubstitutes', 'No realistic accessible substitute in reviewed alternatives', d.limitedSubstitutes, 'alternatives', e.dependency);
  add('disproportionateImpact', 'Loss of function disproportionately affects dependent cohort', d.disproportionateImpact, 'dependency', e.dependency);
  return features;
}
