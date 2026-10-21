# Checkpoint 8 — Outcome Review runtime

Requires Node 24+ with node:sqlite. No dependency installation or Python is needed to run the application.

## Actual saved CP7 approvals

Start CP7, approve a supported plan, then start `node cp8-server.mjs` in amenity-cp2. Open http://127.0.0.1:4178. CP8 opens the saved CP7 SQLite file read-only; it does not turn eligibility into approval. Set CP7_DATABASE to an existing CP7 database and CP8_DATABASE to a separate outcome database if needed. CP8_PORT defaults to 4178. Unknown/missing CP7 databases fail rather than synthesising approvals.

The actual historical CP7 generic prose contract may be insufficiently evaluable. CP8 does not retrofit targets. Documentary execution and observation JSON may be appended through the UI/API, but this does not execute a plan. Source review/authority metadata and operator identity are trusted local demonstration inputs, not production verification.

## A–O simulated demonstration

Run `node cp8-server.mjs --demo`. This uses separate data/cp8-synthetic-approved-plans.sqlite and data/cp8-synthetic-outcomes.sqlite files. CP8_DEMO_CP7_DATABASE can relocate only the synthetic approval file; it deliberately does not use CP7_DATABASE in demo mode. Synthetic specific contracts are declared and actually approved through the unchanged CP7 service before any outcomes are generated. No existing CP7 record is rewritten. Click Load simulated external records & review to import documentary fixtures, not to execute an activity.

Review time is fixed and disclosed as 15 September 2026 in demo mode. The approval time is 29 July and the preapproved review window is 1 August–12 September. No job is scheduled. Non-demo mode uses the actual system clock.

## Portable preview

checkpoint-8-review/Checkpoint-8-Interactive-Preview.html opens directly with no siblings/network/server. It bundles the same CP8 service, admission, evaluation, conversion and unchanged CP3 modules, with captured actual saved synthetic approvals and a volatile-memory repository. Reload clears all changes. This adapter is not persistent SQLite or public hosting.

## Verification

- `node scripts/verify-cp8.mjs` — original regression, CP8 tests, original-file preservation, exact A–O input/actual result/history exports. Baseline is captured once; do not regenerate it after changes.
- `node scripts/cp8-portable-preview.mjs` — standalone artifact, all A–O exact bundled-service flows and UI behaviour check. No live browser pixel pass is claimed.
- `node scripts/build-cp8-review.mjs` — human-readable HTML/Markdown report from verified results.

No execute, rollback, work-order, schedule, notification, CP4 rerank, CP5 reselection, CP6 mutation or AI endpoint exists. External stop/rollback conditions are reported for human attention only.
