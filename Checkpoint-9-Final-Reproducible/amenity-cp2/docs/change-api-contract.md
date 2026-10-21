# Change Detection API / service contract — v1

Status: **defined and locally exercised**, not a deployed HTTP backend. Python/FastAPI is not executable here. Do not interpret the static preview server as an application backend.

## Methods

| Method | Proposed HTTP path | Client / service operation | Successful body |
|---|---|---|---|
| GET | `/api/v1/amenities/change-overview` | `getOverview()` | OverviewEnvelope |
| GET | `/api/v1/amenities/{id}/change-evidence` | `getChangeEvidence(id)` | EvidenceEnvelope |

All identifiers are URI-encoded path segments. GET operations are read-only; they do not persist or modify records. No endpoint for any later checkpoint is implemented or declared.

Both responses use JSON with `contractVersion: "change-detection.v1"`, `dataProvenance: "Simulated input data"`, `parameters`, `metricDefinitions`, and `simulationNotice`. Overview adds `kind: "overview"` and `entries`; evidence adds `kind: "evidence"` and `entry`.

Each entry contains `input` metadata (id, name, tier, description) and `result`: the **unmodified approved detectChange() output**. The input metadata is not an alternate detector input or inference. Test-only `expectedStatus` does not cross this boundary. Dates are ISO date strings; missing observation values and undefined percentages are null, never NaN/Infinity. Empty arrays and explicit warning fields survive serialization.

The exact interfaces for requests, records, windows, metrics, persistence, consistency, caveats and results are in `src/shared/change-models.d.ts`. `tests/baseline/approved-results.json` contains seven complete result examples. Runtime validation in `change-contract.mjs` checks envelope version/kind, required envelope fields and basic result/status structure; it is not exhaustive JSON-schema validation.

## Errors

Local errors use `ChangeServiceError` with `code`, `message`, `status`. A future HTTP backend must preserve semantic failure instead of synthesizing an amenity status:

- 400 invalid identifier / detector input;
- 404 amenity or route not found;
- 405 unsupported method;
- 500 unhandled server failure;
- 502 malformed/unsupported response at the client;
- 503 service/transport unavailable.

Recommended future HTTP error body: `{ "error": { "code": "AMENITY_NOT_FOUND", "message": "Amenity not found" } }`. The current fetch adapter checks HTTP status and JSON, then the shared client checks envelope structure. It does not yet parse server-specific error-body detail. Transport errors render a load failure, never Stable, Monitoring or Needs Attention.

## Implementations and migration

- **Current:** injected synthetic repository → local application service → approved Node/browser-compatible detector. A local transport dispatches the contract paths without network access. The frontend consumes only the client.
- **Future:** configure `createChangeClient(createHttpChangeTransport({baseUrl}))`. Frontend views and route controller remain unchanged; no fixture fallback should mask a backend error.
- **Intended backend:** FastAPI application layer implementing this contract, persistent repository for actual observations/history, and a runtime boundary to the approved statistical module. How Node execution is hosted behind FastAPI must be designed before production; this checkpoint implements no process bridge and no Python reimplementation.
- **Persistence:** `AmenityRepository` defines list/get-by-ID. The synthetic implementation stores cloned in-memory seed records. A future DB adapter loads the same domain records; SQLite was the proposed initial store, not an existing database in this checkpoint.
- Separate later diagnosis, evidence, intervention history and learning services must be introduced under their own approved scopes. Their algorithms, endpoints, data models and UI are not stubbed or implemented here.

The present overview carries complete evidence for the seven demo amenities to preserve the existing presentation. Pagination, production query selection, authentication, authorization and data-volume optimization remain deferred; they are not claimed solved by this transport boundary.
