# Checkpoint 9: similar-case intervention evidence

CP9 is the final product-logic checkpoint. This module adds governed historical retrieval. Existing CP1–CP8 files are unchanged.

## Review

Open `../../checkpoint-9-review/Checkpoint-9-Interactive-Preview.html` directly. It contains the operator view, A–O Technical QA and real model validation outputs, with no sibling HTML dependency. It is a captured, read-only review; embeddings were computed in Node, not simulated in the page.

## Run

Node v24.15.0 was used for implementation validation, with built-in SQLite. From this directory:

```sh
npm ci --ignore-scripts
node server.mjs
```

Open http://127.0.0.1:4179. CPU inference was verified on Windows x64. The dependency lock includes the exact Transformers.js package and transitive versions. Ignoring install scripts avoids optional runtime binary downloads; the tested Windows CPU binary is supplied by its locked package.

The model artifacts are bundled under `models/`; `model-manifest.json` binds their SHA-256 hashes. `scripts/fetch-model.mjs` can obtain the same immutable revision if artifacts are absent. Model loading disables remote downloads and checks every artifact hash. There is no generative model fallback.

## Boundaries

- `src/features.mjs`: pre-decision allowlist and conservative exact-known comparability.
- `src/history.mjs`: read-only CP7/CP8 provider, admission and versioned releases.
- `src/semantic.mjs`: frozen semantic encoder and index.
- `src/retrieval.mjs`: feature-only ranking, complete-case denominator and descriptive patterns.
- `src/service.mjs`: input/version checks, immutable retrieval audit.
- `src/current-provider.mjs`: read-only current saved CP7 proposal adapter.
- `src/repository.mjs`: separate append-only CP9 SQLite records.
- `src/http.mjs`: GET-only review/retrieval routes.
- `src/demo-corpus.mjs`: isolated synthetic records through unchanged CP7 approval and CP8 evaluation services.
- `src/relevance-fixtures.mjs`: predeclared held-out English topic relevance, unrelated to outcome effectiveness.

`demo-storage-final/` contains actual saved simulated CP7 approvals and CP8 outcome records, plus a separate CP9 corpus/index/audit database. These are demonstration records, not production or resident data. CP9 runtime providers open upstream databases read-only. Building the demo is an explicit development operation, never a live automatic approval workflow.

`CP9_CP7_DATABASE` may point at another saved CP7 proposal database. `CP9_AS_OF` overrides the explicitly simulated default of 2026-10-01T12:00:00Z. An existing query can be inspected using GET `/api/cp9/inspect?queryId=PLAN_ID&candidateId=reprogramme`. Query input is rechecked after asynchronous inference. This endpoint records only a CP9 retrieval audit; it does not approve or execute anything.

## Validation

```sh
node --test tests/*.test.mjs
node scripts/evaluate-semantic.mjs
node scripts/build-review-data.mjs
node scripts/build-preview.mjs
node scripts/verify-preview.mjs
```

The full CP1–CP8 regression remains `node --test tests/*.test.mjs` from the parent project. The CP9 tests live in a separate folder and do not modify prior expectations.

## Limitations

The corpus is simulated and small. English semantic paraphrases are validated; multilingual retrieval is not. Exact contract/scope/protection matching is intentionally conservative and may abstain when human review could establish equivalence. No supervised intervention-success model, success probability or causal estimate exists. The operator preview is an additive review surface, not a final UI redesign. Final application integration and deployment have not started.
