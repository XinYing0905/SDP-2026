# Competing Diagnosis service contract — Checkpoint 3

**Local executable contract, not a deployed FastAPI endpoint.** The approved Change Detection API remains unchanged. The same client, local transport and replaceable HTTP boundary add one read-only operation:

`GET /api/v1/amenities/{id}/competing-diagnosis` → `getCompetingDiagnosis(id)`.

Envelope: `contractVersion: "competing-diagnosis.v2"`, `amenityId`, `dataProvenance: "Simulated diagnosis evidence"`, `result`. Version 2 deliberately replaces the conflated sufficiency contract; the approved Change Detection API remains at its existing version.

- **Not Assessed:** executionState, upstreamStatus, reason. No four-state score set is fabricated when upstream is not Needs Attention.
- **Assessed:** executionState, upstreamStatus, evidenceSnapshotId, dataProvenance, parameterVersion, scoringInterpretation, the three checks, tri-state evidence features, all four diagnoses with unchanged independent raw points/evidence lists plus own-scale Relative Evidence Support, evidenceSufficiency, warnings, provisionalParameters and coexisting protection context.
- **Errors:** existing unknown-ID/transport error semantics apply. A failed diagnosis load does not erase valid upstream change evidence or fabricate a diagnosis/state.

Exact input/check/assessment/sufficiency declarations are in `src/shared/diagnosis-models.d.ts`. Source sections require a sourceId and availableAt no later than analysis time. Missing/unavailable sections remain null/unknown. Runtime validation checks envelope version/identity/execution and separate sufficiency states, and rejects a combined legacy `evidenceSufficiency.state`; it is not exhaustive production JSON-schema validation.

The diagnosis repository is distinct from the CP2 observation repository. Existing overview list remains unchanged. Separate DX-A…DX-G investigation records can be opened through case URLs and their own upstream change-evidence operation. Existing CP2 B/F cases have no diagnosis source snapshots; if opened, they report unavailable evidence and Insufficient Evidence rather than borrowing unrelated canonical evidence.

`result.evidenceSufficiency` contains `explanationSufficiency`, `protectionContextSufficiency`, `perDiagnosis`, `supportedStates`, `decisionHorizon` and `caveat`. It has no combined `state`. Primary explanation, ambiguity and comparisons are inside explanationSufficiency. Protection gaps and later action-review caveats are inside protectionContextSufficiency. Neither assessment is an action approval or intervention recommendation. No evidence-request selection, resident question, intervention endpoint, AI/ML or outcome-learning endpoint is implemented.

Each diagnosis adds `configuredPositiveSupportScale`, `relativeEvidenceSupport` (0–100 or null) and interpretation. Scale is the sum of maximum positive contributions per rule over the full configuration, not observed features. Raw negative net evidence remains signed in the original raw field, while relative support is bounded below by zero. Entirely unobserved support is null. Values across states are independent and need not sum to 100%. Comparison uses unrounded relative values and separately checks evidence sufficiency.

The declared residence-duration groups are <6 months, 6–24 months, 2–5 years and 5+ years. Every supplied cohort row remains in the check output and UI, including intermediate and unrecognized groups. Rule roles annotate eligibility without filtering intermediate rows out of presentation.

FastAPI, DB storage, authentication, cross-runtime execution and real HTTP deployment remain unimplemented. Services are modular but execute in-process in demo mode. Existing HTTP transport can carry the additive envelope; no claim is made that a backend currently serves it.
