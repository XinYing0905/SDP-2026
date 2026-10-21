# Intended backend boundary — not implemented

The approved direction remains frontend application → backend/application services → persistent repository, with a statistical layer and separately approved later layers.

Python/FastAPI is not runnable in this environment. There is no working Python server, persistent database, cross-process detector bridge or production API in this checkpoint. The temporary in-process JavaScript adapter demonstrates the contract, not completion of that backend.

Future FastAPI endpoints should implement `docs/change-api-contract.md` and use a persistent repository conforming to `AmenityRepository`. Preserve the approved detector behind an explicit runtime adapter unless an independently approved parity-tested migration is requested. Do not replace it with a silent Python rewrite.

`src/services/change-evidence-service.mjs` is the executable current application service. It has no browser dependency and can be called independently of the frontend. It is not embedded in rendering code.

Checkpoint 3 adds `src/services/competing-diagnosis-service.mjs` and `docs/diagnosis-api-contract.md` within the same temporary runtime. This adds no Python/backend deployment and does not complete persistence. Its scoring, checks and sufficiency modules live under `src/diagnosis/`, outside both UI and the approved detector.
