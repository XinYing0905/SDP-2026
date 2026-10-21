# Checkpoint 7 — runnable decision workspace

Requires Node 24 with built-in `node:sqlite`. No dependency installation, Python, model service or production notification service is needed.

From `amenity-cp2`:

```powershell
node cp7-server.mjs
```

Open `http://127.0.0.1:4177`. `CP7_PORT` and `CP7_DATABASE` may choose another port/file. The default SQLite file is `amenity-cp2/data/cp7-demo.sqlite`. This is a separate CP7 plan/audit database; the CP6 response database is never opened or mutated by CP7.

## Operator flow

The default Community Hall page consumes the approved resolving CP6 assessment snapshot. It shows the two original sufficiency assessments, then the scoped Reprogramme proposal. Click **Review Reprogramme plan**, inspect scope/protection/rollback/Outcome Contract, tick the review confirmation and **Approve plan — no execution**. The exact confirmation is:

> Plan approval recorded. Execution has not started.

Use the example selector for narrow repair, Preserve, safe sharing, a protection hold, an unresolved tie and a documented lower-impact preference. In the preference example, choosing the other Ready candidate requires a nonempty operator rationale. Decline/defer remain valid. Hard-blocked candidates have no approval button and cannot be approved through the API either.

**Technical QA** retains all A–T cases, full seven-pathway gate matrices, source IDs, action-specific gaps, original diagnosis evidence and input/version traces. An additional N-preference fixture demonstrates the non-numeric same-purpose comparison; it is not a new pathway. **Saved plans** shows immutable reviews and decisions.

## API boundary

| Method/path | Operation |
|---|---|
| GET `/api/cp7/cases` | Read frozen synthetic assessment/scope examples and freshly evaluated CP7 proposals |
| GET/POST `/api/cp7/proposals` | List / explicitly prepare a review |
| GET `/api/cp7/proposals/{id}` | Read exact saved proposal plus computed current validity |
| POST `/api/cp7/proposals/{id}/decision` | Record approve/decline/defer with expected revision, input digest, actor and rationale |
| GET `/api/cp7/proposals/{id}/history` | Read immutable proposal/decision events and revisions |

There is no execute, work-order, schedule, notify, outcome, training, CP4 rerank, CP5 reselection or CP6 update endpoint. Unknown request fields are rejected. The server binds to loopback; same-origin checks/JSON limits are demo safeguards, not production identity/role authorisation.

The demo uses a labelled simulated clock of **29 July 2026**, matching the synthetic assessment and prospective scope windows. Service composition supports a system clock for a future live provider. The clock basis is retained in review/decision records. No job is scheduled by a date field.

## Persistence and snapshot binding

`src/data/repositories/intervention-decision-repository.mjs` reuses the approved SQLite transaction/event/history primitives in a separate database. It also stores a one-time immutable synthetic source registry, preserving exact captured CP6 snapshot IDs across restart instead of regenerating them. That registry is a demo fixture source, not a live resident or assessment integration.

The decision service binds to the entire input digest and computed rule/proposal result. Changes to evidence, scope, source-linked versions, analysis or rule output block new approval. Existing approvals remain immutable history and lose current applicability when their bound input/rules differ. Decline/defer can document a hold; they never authorise the stale action. A superseding review receives its own ID and retains the earlier record.

Formal Preserve requires the original per-diagnosis sufficient High-Dependency state and sufficient protection, not that state as the primary explanation. CP6 counts never set a protection boolean. Case P demonstrates why maintaining a dependent function cannot mean leaving a known unsafe condition unaddressed.

Case K carries a **synthetic existing pilot-plan/evidence-request linkage** alongside the unchanged CP4 pilot selection. If that linkage is unavailable, CP7 blocks readiness rather than generating a second pilot. A real external intervention/evidence-request registry integration remains future work; CP4’s contract is not modified.

## Portable artifact

`Checkpoint-7-Interactive-Preview.html` embeds the actual CP7 service, gates, comparison and approved input snapshots. The only replacement is an explicit volatile in-memory repository adapter plus the already verified browser SHA-256 compatibility shim. No network, sibling files or server are required; **refresh clears its saved plans**. The modular Node + SQLite app remains the persistent architecture/source of truth.

## Verification

```powershell
node scripts/verify-cp7.mjs
node scripts/cp7-portable-preview.mjs
node scripts/verify-cp7-ui.mjs
```

The first command separately runs the original 251 tests and new CP7 tests, checks hashes against the captured 80-file baseline and writes exact A–T inputs and seven-candidate outputs. The second exercises real approval/defer/rationale decisions from the generated browser bundle. The third executes the exact UI code with a DOM stand-in; it is not a pixel/browser screenshot check.

`intervention-assessment-seeds.mjs` contains data-only snapshots from the approved CP6 actual-output report. `intervention-case-snapshots.mjs` contains the A–T inputs, not eligibility or preferred-pathway answers. Normal CP7 runtime does **not** run CP4, CP5 or CP6 workflows. The fixture generator is retained for tests and auditable reproduction, not called by the interactive app.

## Deliberate limitations

Only seeded action scopes and dated synthetic feasibility/protection/reversibility reviews are offered; no general plan-authoring UI or production evidence-verification system is claimed. Qualitative risk categories are recorded inputs, not learned predictions. Case-specific dates and criteria are examples, not universal thresholds. The source adapter is a fixed registry; live CP6/current-data integration is not implemented. Operator identity is simulated. No intervention execution, measured outcomes, Outcome Learning or AI Intervention Learning is implemented.
