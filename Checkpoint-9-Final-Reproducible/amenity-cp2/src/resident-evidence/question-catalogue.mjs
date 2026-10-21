const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const common = ['Documented relevant membership/exposure', 'Known programme/function and reference period', 'Dated planning coverage basis; no assumed turnout', 'Corroboration and unchanged CP3 gates before any feature/sufficiency conclusion'];
const option = (id, label, assertionId, assertion, required, cannotEstablish) => ({ id, label, assertionId, assertion, required: [...common, ...required], cannotEstablish });
const nonSubstantive = [
  { id: 'UNABLE_TO_ASSESS', label: 'Unable to assess / not familiar enough', meaning: 'Explicit inability or insufficient familiarity; not an amenity opinion.', substantive: false, credit: 0 },
  { id: 'VOLUNTARY_SKIP', label: 'Skip / prefer not to answer', meaning: 'Voluntary non-response; familiarity and motive remain unknown.', substantive: false, credit: 0 }
];
export const questionCatalogue = freeze({ version: 'reviewed-cp5-1.0', reviewed: true, provenance: 'Reviewed templates and approved planning semantics; no response conversion', questions: [
  { id: 'Q-PROGRAMME-FIT', version: '1.0', sourceCandidateId: 'residents', dimension: 'Explanation', targetGapId: 'programme-fit', secondaryGapIds: ['explanation-discrimination'],
    wording: 'Does the current [amenity] programme still match how you would use this space today?',
    exposureRequirement: 'programmeFamiliarity',
    options: [
      option('PF-YES', 'Yes', 'reported-current-fit', 'Respondent reports current programme fit.', ['Actual familiarity; dated/cohort evidence for wider or historical claims'], ['Universal fit', 'Operational health', 'Historical persistence', 'Cause of decline']),
      option('PF-MOSTLY', 'Mostly', 'reported-qualified-fit', 'Respondent reports broad but qualified fit; reservations are unspecified.', ['Preserve the qualification; no invented reasons/severity'], ['Complete satisfaction', 'Binary mismatch', 'A specific configuration defect']),
      option('PF-NOT-REALLY', 'Not really', 'reported-poor-fit', 'Respondent reports poor current fit.', ['Programme, temporal and mix corroboration before a sustained explanation'], ['Cause of decline', 'Cross-cohort persistent mismatch', 'Permission to remove']),
      option('PF-NO-LONGER-NEED', 'I no longer need this type of programme', 'reported-ceased-personal-need', 'Respondent reports no current personal need for this programme type; distinct from dissatisfaction.', ['Separate dated/cohort evidence for when/why need changed'], ['Programme dissatisfaction', 'Programme mismatch', 'Automatic mismatchResponses increment', 'Low community value'])
    ],
    scenarioGroups: [{ id: 'current-fit-reports', optionIds: ['PF-YES', 'PF-MOSTLY'] }, { id: 'poor-fit-or-ceased-need-reports', optionIds: ['PF-NOT-REALLY', 'PF-NO-LONGER-NEED'] }], nonSubstantive
  },
  { id: 'Q-DEPENDENT-NEEDS', version: '1.1', sourceCandidateId: 'dependencyResidents', dimension: 'Protection context', targetGapId: 'dependent-needs', secondaryGapIds: [],
    wording: "How important is access to [amenity's current function] for the activities you currently use it for?",
    exposureRequirement: 'documentedCurrentUse',
    options: [
      option('DN-ESSENTIAL', 'Essential', 'reported-essential-importance', 'A documented current user reports essential importance; possible evidence of reliance.', ['Function/activity interpretation and documented assessment context'], ['Verified absence of substitutes', 'Stable repeat usage', 'Disproportionate impact', 'Complete High-Dependency state']),
      option('DN-IMPORTANT', 'Important', 'reported-important-access', 'User reports important access without necessarily reporting essential reliance.', ['Do not upgrade important to essential; stronger reliance needs corroboration'], ['Essential dependency', 'Severe harm', 'Completed protection assessment']),
      option('DN-OPTIONAL', 'Useful but optional', 'reported-optional-benefit', 'User reports useful but optional access; benefit is retained.', ['Do not generalize optionality to other users'], ['Low community value', 'No dependency among other users', 'Adequate substitutes']),
      option('DN-NO-CURRENT-RELIANCE', 'I do not currently rely on it', 'reported-no-current-reliance', 'A current user reports no current reliance, without denying use or value.', ['Current use remains distinct from reliance; no cohort-wide inference'], ['Zero use', 'No benefit', 'No protected users', 'Safe intervention'])
    ], scenarioGroups: [{ id: 'important-access-reports', optionIds: ['DN-ESSENTIAL', 'DN-IMPORTANT'] }, { id: 'optional-or-no-reliance-reports', optionIds: ['DN-OPTIONAL', 'DN-NO-CURRENT-RELIANCE'] }], nonSubstantive
  },
  { id: 'Q-PROTECTED-IMPACT', version: '1.0', sourceCandidateId: 'dependencyResidents', dimension: 'Protection context', targetGapId: 'protected-impact', secondaryGapIds: [],
    wording: "If [amenity's current function] were unavailable, how much would that affect your ability to continue the activity you use it for?",
    exposureRequirement: 'documentedCurrentUse',
    options: [
      option('PI-CANNOT-CONTINUE', 'I could not continue', 'reported-severe-anticipated-impact', 'User anticipates being unable to continue the activity.', ['Comparative/documentary context before disproportionality; inspect substitutes separately'], ['Observed actual harm', 'Proof alternatives do not exist', 'Disproportionality by itself', 'Complete high dependency']),
      option('PI-CONSIDERABLY-HARDER', 'It would be considerably harder', 'reported-substantial-anticipated-difficulty', 'User anticipates substantial difficulty continuing.', ['Distribution/comparison/context before disproportionate group impact'], ['Inability to continue', 'Verified substitute capacity', 'Sufficient protection']),
      option('PI-SLIGHTLY-HARDER', 'It would be slightly harder', 'reported-limited-anticipated-difficulty', 'User anticipates some limited effect, not zero effect.', ['Do not round to zero or generalize; comparative context still needed'], ['No impact', 'Low amenity value', 'No more-affected minority']),
      option('PI-NO-PERSONAL-EFFECT', 'It would not affect me', 'reported-no-personal-effect', 'User anticipates no personal effect on continuing the activity.', ['Individual/context-specific report; no inference about nonresponders'], ['No effect on other users', 'Adequate substitutes', 'Absence of protected needs'])
    ], scenarioGroups: [{ id: 'severe-or-substantial-impact-reports', optionIds: ['PI-CANNOT-CONTINUE', 'PI-CONSIDERABLY-HARDER'] }, { id: 'limited-or-no-personal-impact-reports', optionIds: ['PI-SLIGHTLY-HARDER', 'PI-NO-PERSONAL-EFFECT'] }], nonSubstantive
  }
] });

// Missing/no received response is not a choice and never means a voluntary skip.
export const missingResponseSemantics = freeze({ id: 'NO_RESPONSE', label: 'Missing / no received response', meaning: 'Unknown whether anyone received, considered or answered a question.', substantive: false, credit: 0 });

export function validateScenarioBinding(question, scenario) {
  const options = question.options.filter(o => scenario.optionIds?.includes(o.id));
  if (!options.length || options.length !== scenario.optionIds?.length) return false;
  return options.every(o => scenario.assertionIds?.includes(o.assertionId)) && scenario.assertionIds.length === options.length && scenario.targetGapId === question.targetGapId;
}
