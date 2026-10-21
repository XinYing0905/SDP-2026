# Checkpoint 6 local application

Requires Node 24 with built-in `node:sqlite`. No package installation, Python or external server dependency is needed.

From `amenity-cp2`:

```powershell
node cp6-server.mjs
```

Open `http://127.0.0.1:4176`. This is an additive CP6 application entry; the original CP1–CP5 application and tests are unchanged. Set `CP6_PORT` or `CP6_DATABASE` if required. SQLite defaults to `amenity-cp2/data/cp6-demo.sqlite`, with WAL and FULL synchronous mode. Stop the process normally after use. Keep the database and any WAL/SHM sidecars together while running; no real resident data is included.

## Canonical demo

1. Choose **Canonical resolving example → Open simulated resident collection**. This is explicit operator authorisation and issues ten simulated access references for the frozen intended roster, from twelve known relevant cohort members.
2. Select **Not really** in the mobile touchpoint and click **Submit**. The confirmation is backed by a validated, persisted raw response.
3. Expand **Technical QA / simulated controls** and choose **Submit synthetic example responses**. It fills unanswered recipients to nine total through the same service/API, preserving the answer already submitted. Starting with Not really produces eight Not really and one Mostly. The tenth remains No Response.
4. Click **Close simulated collection**, then **Review evidence & reassess**. Closure is deliberate and may be early in this demo; seven days is the configurable default maximum window, not a mandatory wait or empirically optimal period.
5. Inspect the exact counts, coverage, qualification and before/after result. The unchanged CP3 engine establishes sufficient explanatory evidence and the Programme / Configuration Mismatch primary explanation.
6. Repeat with **Still-insufficient counterexample**. Historical resident-mix evidence is absent and unavailable for the fixture; the same admitted feedback cannot bypass that gate.

For a clean canonical run use a case with no other closed admissible collection. Repeated admissible collections for the same amenity are deliberately held for conflict review. They are not pooled or automatically selected. Use a separate database file for an entirely fresh persistent demo rather than deleting history in the application.

The operator recipient selector is a **simulation harness**, not an identity system. Open/copy the separate mobile touchpoint link before refreshing if you need to resume that recipient: plain access references are returned once, while only SHA-256 digests are persisted. The collection and raw responses survive restart, but access references are not reissued by a new UI session. Saved collections remain inspectable.

## API/service boundary

| Method/path | Purpose |
|---|---|
| GET `/api/cp6/cases` | Read prepared simulated cases; no response-dependent CP4/CP5 reranking |
| GET/POST `/api/cp6/collections` | List / explicitly open a collection |
| GET `/api/cp6/collections/{id}` | Read collection and current immutable-derived view |
| GET `/api/cp6/collections/{id}/resident` | Selected question; requires `x-demo-access` capability |
| POST `/api/cp6/collections/{id}/responses` | Submit one option with idempotency and version binding |
| POST `/api/cp6/collections/{id}/close` | Close and aggregate; expectedRevision required |
| POST `/api/cp6/collections/{id}/reassess` | Admit existing input projection and run original engine; expectedRevision required |
| GET `/api/cp6/collections/{id}/history` | Read immutable events and revision history |

POST requests use JSON. Same-origin writes are enforced when Origin is present. This is loopback-only, simulated operator authorisation; it is not a production authentication/privacy boundary. Server receipt time is authoritative, client timestamps cannot be before opening or after receipt. No unissued member can submit.

`src/cp6/models.d.ts` describes DTOs and `contract.mjs` identifies `resident-response-evidence.v1`. Earlier checkpoint versions are unchanged. Question/cohort/catalogue/analysis/roster digests, precise availability timestamps, raw IDs, option distributions and conversion version are retained in the ledger. Existing CP3 projects availability at day granularity; exact CP6 receipt times remain available in provenance.

## Portable review

`Checkpoint-6-Interactive-Preview.html` is a separate self-contained export of the **same** CP6 service, aggregation/conversion modules, CP5 plan validator and CP3 diagnosis engine. It uses an explicit transactional-style in-memory repository adapter, not SQLite or browser storage. Its SHA-256 shim is checked against Node SHA-256 for ASCII, Unicode and multiblock inputs. Responses last only until refresh/close. A prominent banner explains this limitation.

The static artifact is not the architectural source of truth. The modular Node service and SQLite repository remain executable and persistent. No response API or data is embedded into the preserved CP5 read-only artifact.

## Verification

```powershell
node scripts/verify-cp6.mjs
node scripts/cp6-portable-preview.mjs
node scripts/verify-cp6-ui.mjs
```

The first command separately runs the original 210 tests and CP6 tests and emits exact A–I inputs/outputs. The second executes canonical resolving and still-insufficient collections from the generated browser bundle. The third exercises the exact UI code with a DOM stand-in; it is not pixel layout verification. See the review package for byte preservation, TAP logs, scenario outputs and limitations.

## Scope stop

No intervention, AI/ML, production dispatch, identity redesign, reopened collections, correction UI, operator protection attestation, automatic protection boolean projection, cross-collection pooling, CP4 reranking or CP5 reselection is implemented.
