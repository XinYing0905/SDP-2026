# Amenity Decision Intelligence — Checkpoint 5

CP5 implements **Best Question × Best Cohort selection and operator/resident previews only**, following the approved revised CP5 design. All existing CP1–CP4 source modules/contracts/parameters/fixtures/tests remain byte-identical. No dispatch, invitations, submission, response storage/aggregation, evidence conversion/writes, response-driven reassessment, intervention recommendation/execution or AI is implemented. **Stop after CP5; no subsequent stage is authorized.**

Run `npm test` (210 tests), `npm run verify-cp5` (UTF-8 TAP), and `npm run resident-plan-report` (exact 24-case inputs/outputs, catalogue, preservation evidence and static previews). `npm start` builds modules automatically and starts the local static server. No package installation or Python is required.

Live operator routes remain `http://127.0.0.1:4173/#case/NB-A` through `#case/NB-J`. `#case/NB-C` adds a selected programme-fit pair; `#case/NB-D` demonstrates an unresolved needs/impact pair tie. The resident preview route is `http://127.0.0.1:4173/#resident-preview/NB-C`; tied/stale/not-eligible/no-valid-pair plans cannot show a selected question. All five states are demonstrated in `../checkpoint-5-review/Operator-Resident-Previews.html` and the 24 acceptance records. These HTML files are presentation snapshots, not architectural source or browser screenshots.

CP5 modules: `src/resident-evidence/` (reviewed catalogue, eligibility, exact snapshot binding, joint selection), `src/services/resident-evidence-plan-service.mjs`, separate API/client/contract/models/repository/composition, and `frontend/views/resident-evidence-plan.mjs`. The existing upstream clients are delegated unchanged. The new API is currently in process; `server.mjs` serves static modules and does not expose a live backend API. See `docs/resident-evidence-plan-api-contract.md` and `../checkpoint-5-review/Checkpoint-5-Review.md`.

Every substantive option has traceable hypothetical assertions, prerequisites, target gap and limits. No production conversion or sufficiency change occurs. `UNABLE_TO_ASSESS`, `VOLUNTARY_SKIP` and `NO_RESPONSE` stay distinct and unscored. CP4's resident-source winner is fixed. No informative pair means no fallback; equal modeled values stay tied. The current selector conservatively credits potential bounded gap reduction only, never full closure or pathway-change claims.

## Historical Checkpoint 4 baseline notes

Decision-Aware Next-Best Evidence now ranks evidence collection against explicit unresolved explanation, protection or later pathway gaps. Master PRD v1.1 and approved CP1–CP3 (including the CP3 Clarification Addendum) remain unchanged. No resident question/cohort selection, evidence dispatch, intervention recommendation/execution, AI/ML or Outcome Learning is implemented. **Stop before Checkpoint 5.**

Current review: `../checkpoint-4-review/Checkpoint-4-Review.md`; exact synthetic inputs/expected/actual outputs: `Evidence-Cases-A-J.json`. Generate with `npm run next-evidence-report`. Run all tests with `npm test`; plain TAP export with `npm run verify-cp4`. Tests preserve all 109 earlier checks unchanged, plus new CP4 scenarios and boundary checks. CP4 architecture/contract: `docs/next-evidence-api-contract.md`.

Review case URLs: `http://127.0.0.1:4173/#case/NB-A` through `#case/NB-J`. The original overview remains unchanged. Cases demonstrate physical inspection, cohorts, resident programme input, protection gaps, unresolved explanation, no forced collection, unavailable sources, a pilot plan, observation and maintenance review. Each case adds an operator evidence planning section below the existing evidence views. `../checkpoint-4-review/Operator-Preview.html` indexes static presentation snapshots, not the application source.

New module boundaries: `src/next-evidence/` (gaps, scenario designs, ranking), `src/config/next-best-evidence.mjs`, `src/data/synthetic/next-evidence-cases.mjs`, `src/services/next-evidence-service.mjs`, `src/shared/next-evidence-*`, and `frontend/views/next-evidence.mjs`. Existing client/transport/composition modules expose the additional read-only service. Separate Explanation Sufficiency and Protection Context Sufficiency are consumed, never recombined. The scenario heuristic is not AI, calibrated information gain, probability or intervention approval. Temporary pilot execution and later reassessment are deferred; their single-intervention evidence lifecycle is documented.

The original CP3 run/architecture notes below describe the preserved baseline; current CP4 additions are above.

## Run

Requires Node.js 22+; no dependency installation or build step.

```
npm test
npm run build
npm start
npm run report
npm run diagnosis-report
```

Open http://127.0.0.1:4173 in an environment allowing local networking. Build copies modular source into dist; it does not create a self-contained application. Reports and the 109-test TAP log are written to `../checkpoint-3-clarification`. The original overview remains unchanged. To review separate CP3 canonical cases, open `http://127.0.0.1:4173/#case/DX-A` through `#case/DX-G`. These are operator case evidence pages, not new screens or changed CP2 cases.

## Files

- `frontend/`: composition entry, application routing and pure presentation views/styles.
- `src/statistics/change-detection/detector.mjs`: byte-identical approved detector. Its adjacent config re-export keeps the original import unchanged.
- `src/config/change-detection.mjs`: byte-identical **Provisional MVP Parameters** and metric definitions.
- `src/config/diagnosis.mjs`: separate provisional diagnosis weights and sufficiency/check thresholds.
- `src/diagnosis/`: independent temporal, cohort and dependency checks; evidence features, scoring and sufficiency modules. No intervention or learning algorithms.
- `src/data/synthetic/diagnosis-cases.mjs`: separate CP3 cases, source-labelled evidence and upstream series. CP2 fixtures remain unchanged.
- `src/services/competing-diagnosis-service.mjs`: additive diagnosis operation behind the existing client/transport boundary.
- `frontend/views/diagnosis-evidence.mjs`: display-only diagnosis panel within case evidence.
- `src/data/`: byte-identical synthetic fixtures and an injected repository implementation.
- `src/services/`: executable application service, independent of UI.
- `src/api/`: versioned client, in-process adapter and future HTTP adapter.
- `src/shared/`: runtime envelope contract and TypeScript declaration models; not a compiled TypeScript app.
- `src/composition/demo-client.mjs`: wires temporary synthetic/local implementations outside presentation code.
- `docs/change-api-contract.md`, `backend/README.md`: precise contract and honest future-backend/persistence boundary.
- `tests/detector.test.mjs`: original 24 tests unchanged. `tests/architecture.test.mjs`: 30 integration/parity checks unchanged. `tests/diagnosis.test.mjs`: 32 canonical/perturbation/contract/UI checks, updated only for the requested CP3 clarification. `tests/diagnosis-clarification.test.mjs`: 23 preservation/comparability/separation/cohort checks. `tests/baseline/`: immutable earlier hashes, raw outputs, evidence ledgers and presentation strings.
- `artifacts/checkpoint-2/Amenity-Change-Evidence.html`: frozen portable CP2 demo, not application source. `scripts/standalone.mjs` now verifies its hash only.
- `dist/`: generated modular delivery files plus three legacy re-export shims so original tests/import paths continue working. Do not edit generated code.
- `server.mjs`: unchanged local static preview server, not the backend. Build/start does not execute Python or expose product API endpoints.

## Detection policy

Eight weekly baseline periods precede four current periods. An individual observation is materially changed only when it passes both its metric-specific absolute floor and 20% relative deviation (relative percentage undefined at zero baseline). The current mean must also pass. Persistence requires at least three consecutive eligible current periods ending at the latest scheduled period. At least two signals must have sustained change in the same semantic direction. Rising cancellations align with declining activity; rising activity is also analyzed as meaningful change.

Needs Attention means these gates pass, not that a cause or action is known. Monitoring covers partial change, limited coverage or current contextual uncertainty. Stable means no current sustained change is established from adequate observations, including recovered temporary dips. It never establishes operational health or community value.

Known exceptional closure, holiday, event and unavailable-data periods are visible, excluded from behavioral means, and break persistence. Recorded maintenance/downtime is contextual only, not a diagnosis. Missing observations are null/unknown, never imputed or treated as negative evidence. Valid signals can qualify even when other data are missing; warnings remain explicit. Fewer than two assessable signals cannot reach Needs Attention under the default policy.

## Technical boundary

The current executable adapter uses dependency-free JavaScript because Python is unavailable here. UI → client → service → repository/statistical module are separated. The approved frontend/backend/persistent/statistical/later-service direction is retained; this temporary in-process runtime is not a replacement monolithic frontend architecture.

FastAPI, a persistent repository and the cross-runtime detector hosting boundary remain unimplemented. The fetch adapter is contract-tested with mocked network, not a claim of a live backend. A later backend must preserve the contract and approved detector rather than silently reimplement its logic. All threshold choices and the conservative context policy remain unchanged and provisional.

No full seasonal model, formal significance test, causal inference, automatic data integrations, authentication or resident delivery is implemented. Input series must use one aligned seven-day grid per analysis and nonnegative counts or rates in [0,1]. Correlated booking/user signals are consistency signals, not independent statistical evidence.

## Diagnosis boundary

Only upstream Needs Attention cases execute diagnosis. Four fixed states maintain independent signed raw Evidence Support. Relative Evidence Support uses each state's own full configured positive scale, never the four-state sum; it is not causal probability. Unknown features do not contribute points or contradictions, and entirely unknown support remains null. Evidence ledgers, coverage and raw contributions remain unchanged. The three checks use separate diagnosis evidence, not the upstream status as proof.

Evidence Sufficiency now contains separate **Explanation Sufficiency** and **Protection Context Sufficiency**, with no combined case-level sufficient flag. Primary/ambiguity comparisons use comparable support plus explanatory evidence gates. Missing dependency evidence leaves a protection gap; it does not invalidate an otherwise sufficient explanation. High dependency can be adequately understood while the change remains unexplained. Action-specific sufficiency stays deferred. All four residence-duration groups are retained; intermediate 6–24 month rows are displayed without joining the current recent/long-term comparison. See `docs/diagnosis-api-contract.md` and the Clarification Addendum for the v2 result contract and formulas.
