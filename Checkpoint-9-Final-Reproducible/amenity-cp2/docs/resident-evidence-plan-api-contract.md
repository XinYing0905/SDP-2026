# CP5 — resident evidence plans / previews only

Read-only contract: `GET /api/v1/amenities/{encodedId}/resident-evidence-plan`, envelope `resident-evidence-plan.v1`. The local adapter implements this contract in process. The HTTP client is ready for the same JSON response; the static Node server does not expose a live HTTP backend. No FastAPI or database is claimed.

The new additive client delegates every CP1–CP4 method unchanged. Existing APIs, contracts, provisional parameters and source-level ranking remain byte-identical. The CP5 service reads current upstream envelopes and a prepared cohort/planning record. It does not run response-driven diagnosis reassessment or import a diagnosis engine.

## Entry / version binding

Require the existing CP4 unique eligible resident winner (`residents` or `dependencyResidents`), its positive material value and unresolved direct target. No other evidence-source class is reranked or substituted. No-valid-pair and pair-tie states retain the CP4 winner for feasibility review.

`expectedBinding` compares exact canonical content of diagnosis envelope, CP4 envelope (including parameter/decision context outputs), cohort snapshot, catalogue version, analysis date and current function. This is a prepared-input freshness check, not authentication or a shortened collision-prone hash. Diagnosis/CP4 case IDs, snapshot IDs and the two separate sufficiency values must also agree. Cohort snapshots bind their own source/version/as-of to that case. Actual source data later changing without a version/content update remains a production integration concern.

## Result states

- `Draft pair selected`: exactly one highest-value feasible pair; preview only.
- `Pair tie`: equal-value pairs remain listed with no selected question.
- `Not eligible`: no assessed/unique resident CP4 winner.
- `No valid pair`: no available, question-appropriate cohort or material pair; no generic survey fallback.
- `Stale input`: inconsistent case/snapshot/sufficiency/cohort/parameter/catalogue binding.

These are planning workflow states, not diagnoses or sufficiency states. `sufficiency` preserves the approved separate Explanation Sufficiency and Protection Context Sufficiency. `remainingGaps` equals the upstream actual unresolved gaps: no hypothetical finding closes one.

## Question catalogue and value

Three reviewed templates carry IDs/versions, exact substantive options, per-option assertion IDs/text, corroboration assumptions and limits. Q-DEPENDENT-NEEDS uses neutral documented-current-use wording. All 12 options preserve distinct meanings; ceased personal programme need never becomes an automatic mismatch assertion. Generic/leading replacements and arbitrary caller-supplied assertions/groups are not catalogue inputs.

Each valid pair targets its question's direct CP4 gap. Cohorts are assessed jointly with questions using source/date, residency, question-specific exposure, known membership, reference period and documented planning coverage. Current-use questions do not assume dependency. Long-term programme pairs reuse the approved CP3 residence-duration/observation/retention gates; ownership is never a weight. `6–24 months` remains visible and may be informative for current-use questions without being recoded as CP3 recent/long-term.

For each question, the reviewed catalogue declares two contrasting semantic groups, retaining every member option's own assertion/limits, plus one inconclusive group. Both distinct unable/skip outcomes and missing/no response map to zero credit in the inconclusive arithmetic group. Grouping does not combine their future semantics. Arbitrary added labels cannot change this canonical grouping or value.

The selector imports the existing CP4 weights, source burden and tie tolerance. `G` is the arithmetic mean of potential **bounded** target-gap information units across canonical groups; a group earns one only when all its referenced option assertions are valid and cohort/target prerequisites are met. It is not full closure. `D` is conservatively zero: this checkpoint does not award pathway-change credit or implement a gate-trace/response conversion. Thus `score = wG × G / (1 + burdenPenalty × sourceBurden)`. There are no new numeric diagnosis parameters or response probabilities.

This is an illustrative planning convention, not calibrated expected utility, outcome likelihood, respondent importance or generic confidence. Known eligible membership is not a turnout prediction. Corroboration and quality assumptions remain explicit; in particular impact self-report without comparative context cannot establish disproportionate impact. No count, positive answer or template choice bypasses existing sufficiency gates.

## Non-substantive semantics

`UNABLE_TO_ASSESS`: explicit inability / insufficient familiarity, not an amenity opinion.

`VOLUNTARY_SKIP`: chooses not to answer; familiarity and motive remain unknown.

`NO_RESPONSE`: no received answer; receipt, consideration and intent remain unknown. This is not a resident answer choice.

All earn zero planning credit and none is negative substantive evidence. The resident preview shows four substantive choices and two distinct unscored choices. It has no submission control, response event handler or storage.

## Boundaries / failure behaviour

Output guardrails are always false: `dispatchTriggered`, `responsesCollected`, `responseWrites`, `evidenceWrites`, `reassessmentTriggered`, `interventionSelected`, `aiImplemented`.

No response-to-feature adapter, aggregation, evidence write, delivery integration, intervention recommendation/execution or AI is implemented. All transport writes are rejected. Malformed contract responses fail explicitly rather than manufacturing a plan. A plan-service failure leaves upstream views visible. Unselected/tied/stale plans cannot open an arbitrarily chosen resident question.

The synthetic planning repository is read-only and returns isolated copies. Persistence, authenticated snapshot transactions, real coverage validation, response conversion and live browser visual QA remain explicit limitations/future approved work.
