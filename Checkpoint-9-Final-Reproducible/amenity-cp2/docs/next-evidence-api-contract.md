# Checkpoint 4 — Decision-Aware Next-Best Evidence

`GET /api/v1/amenities/{encodedId}/next-best-evidence`

Envelope: `next-best-evidence.v1`, `amenityId`, `result`.

The endpoint is currently an in-process, dependency-injected service behind the existing client/transport seam. The HTTP client can consume the same JSON contract; `server.mjs` serves static modules only and does **not** expose a live backend API. No FastAPI, database, remote evidence collection or model training is claimed.

The service obtains the approved detector output, original evidence snapshot and separate operator planning context from repositories. A Stable/Monitoring upstream result returns Not Assessed without running diagnosis or ranking. No approved CP2/CP3 module is modified.

## Result

- Separate `sufficiency.explanationSufficiency` and `sufficiency.protectionContextSufficiency`, copied from unchanged CP3 outputs. There is no combined state/confidence field.
- `gaps`: stable ID, dimension, specific question, why that gap could affect a later decision and feature keys.
- `candidates`: targets, eligibility, rejection reasons, value components, hypothetical contrasting/inconclusive findings and projected effects.
- `nextBestCandidateIds`: highest-value eligible candidates, including visible ties.
- `residentInputEligibleForLaterSelection`: only true for a unique highest-ranked resident evidence candidate with material decision value. This is a handoff condition, not a question, cohort selection or dispatch.
- `collectionTriggered: false`, `interventionSelected: false`, `aiImplemented: false`.
- Source warnings, snapshot identity, method/caveats and all provisional parameters.

Unavailable sources, insufficient planning detail, or no material effect produce zero value and explicit rejection reasons. No eligible candidates means the gaps remain unresolved; it does not default to asking residents. No gap means no collection request from this checkpoint, not approval of an intervention.

## Scenario decision value

For each candidate, evaluate its declared contrasting findings and an inconclusive finding:

`G = mean(number of targeted unresolved gaps made understood in each scenario)`

`D = number of scenarios changing the relevant later pathway assessment / number of scenarios`

`value = (gapReductionWeight × G + pathwayChangeWeight × D) / (1 + burdenPenalty × burden)`

Only eligible candidates with a demonstrated material effect receive positive value. Other fields becoming populated without reducing the targeted gap or changing its pathway have zero value. Scenario means are a transparent comparison convention, **not estimated outcome probabilities, expected information gain, generic confidence or calibrated expected utility**. Equal scenario weighting is not a claim that findings are equally likely. The illustrative scenarios are not exhaustive. No resident response is assumed favourable.

For the explanation dimension, relevant pathway changes include the existing sufficient/insufficient assessment, differentiated primary explanation and plausible competing explanations. For protection, changes include understood/unknown protection context and established high dependency. Unrelated dimension changes do not earn pathway credit. Both sufficiency outputs remain unchanged until real evidence is collected in a later checkpoint.

## Planning context

Availability is explicit; absence is unknown and is ineligible. Available cohort/usage records require source IDs and dates no later than the case as-of date. Cohort comparisons preserve all supplied tenure groups and ignore occupancy ownership as a priority weight. Unknown denominators are not manufactured.

Candidate classes cover maintenance records, physical inspection, cohorts, observations, resident input and a temporary programme pilot. Repeat-use record review and substitute inspection are specific ways of collecting the PRD dependency/substitutability evidence. They are not new diagnosis or intervention features.

Counterfactual replacement records are labelled hypothetical, carry hypothetical source IDs and never overwrite actual evidence. Observation projections use a configurable number of complete comparable periods; recovery/continued decline are assumptions being evaluated, not forecasts. Actual missing/exceptional observations remain unchanged. The register review never fabricates a healthy inspection or erases measured downtime/complaints.

## Temporary pilot

One temporary intervention generates evidence. It is not modelled as a second unrelated evidence-only pilot. Eligibility requires a supplied bounded purpose/scope/duration/protection plan, explicit unresolved programme-response question, reviewed healthy operations, persistent/mix-controlled context and sufficient protection understanding. These are conservative CP4 planning prerequisites, not intervention-specific approval or an implemented intervention ladder.

Pilot branches show purpose-aligned improvement, non-improvement/protection loss and inconclusive results. Pilot outcomes cannot be injected into resident feedback or used to assert an updated CP3 diagnosis. After operator approval and execution at a later stage, measured outcomes must enter versioned evidence and trigger reassessment. That write/reassessment lifecycle is documented, not implemented in CP4.

## Remaining layers

Best Question × Best Cohort selection, resident response handling, actual evidence writes, intervention-specific sufficiency/recommendation, outcome learning, AI intervention learning, FastAPI and persistence remain for later approved checkpoints.
