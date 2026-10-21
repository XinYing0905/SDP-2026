# CP9 final reproducible delivery

Packaging repair only. Approved CP1-CP9 engines, product source, tests, model artifacts and UI are unchanged. No further checkpoint, UI redesign or deployment.

## Public prerequisites

Windows x64, **Node.js v24.15.0, npm 11.12.1** (public Node distribution). Public access to `https://registry.npmjs.org`. The frozen encoder artifacts are included: no model download, token, Python, private registry, external database or global npm dependency is required. Other platforms/runtime versions need separate verification.

## Exact clean-room commands (PowerShell)

Change only the downloaded ZIP path. A new temporary directory is created outside the development workspace. Only the ZIP is copied in.

```powershell
$ErrorActionPreference = 'Stop'
$cp9DownloadedZip = 'C:\Downloads\Checkpoint-9-Final-Reproducible.zip'
$cp9CleanRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('CP9-clean-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $cp9CleanRoot | Out-Null
Copy-Item -LiteralPath $cp9DownloadedZip -Destination (Join-Path $cp9CleanRoot 'Checkpoint-9-Final-Reproducible.zip')
Set-Location -LiteralPath $cp9CleanRoot
$cp9ZipHashBefore = (Get-FileHash -LiteralPath '.\Checkpoint-9-Final-Reproducible.zip' -Algorithm SHA256).Hash
Expand-Archive -LiteralPath '.\Checkpoint-9-Final-Reproducible.zip' -DestinationPath '.\extracted'
Set-Location -LiteralPath '.\extracted\amenity-cp2\cp9'
Remove-Item Env:NODE_PATH -ErrorAction SilentlyContinue
Remove-Item Env:CP9_RUNTIME_ROOT -ErrorAction SilentlyContinue
node --version
npm --version
npm ci --ignore-scripts --registry=https://registry.npmjs.org --cache ../../../public-npm-cache
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
npm run verify:delivery
if ($LASTEXITCODE -ne 0) { throw 'Delivery verification failed' }
Set-Location -LiteralPath $cp9CleanRoot
$cp9ZipHashAfter = (Get-FileHash -LiteralPath '.\Checkpoint-9-Final-Reproducible.zip' -Algorithm SHA256).Hash
if ($cp9ZipHashBefore -ne $cp9ZipHashAfter) { throw 'ZIP bytes changed' }
Write-Output ('Verified ZIP SHA-256: ' + $cp9ZipHashAfter)
```

The extraction contains `amenity-cp2`, `checkpoint-9-review`, `Source-Manifest.json` and this file. No `node_modules` is shipped. CP9's exact public lockfile is used locally; the parent application has no external dependencies. The explicit cache is brand-new under the clean-room root, outside the extracted project; it avoids the host's default npm cache. `--ignore-scripts` uses the bundled Windows CPU runtime without optional binary downloads. No prior checkout is needed. Do not set `NODE_PATH` or `CP9_RUNTIME_ROOT` to another tree.

## Single verification command

From **`amenity-cp2/cp9`**, run **`npm run verify:delivery`**. Non-zero means a failed required check. It verifies:

1. Extracted source manifest and the 13 original CP9 source/test hashes.
2. Old derived TAP/reports/index/database are removed. The included simulated CP7 approvals and CP8 outcomes are immutable declared input fixtures, not stale generated results.
3. Entire `dist/` is deleted. Unchanged authored compatibility files and stylesheet are restored from included `cp9/delivery-source/legacy-dist`, then the unchanged approved build runs. This repeats from empty `dist`; all hashes must match. No stale `dist` is required.
4. Runtime/test relative imports, including synthetic data, providers, repositories and `dist/detector.mjs`.
5. All suites, real semantic validation and preview navigation. Exact totals/metrics are asserted; missing imports, preservation differences or failed build/tests/validation return non-zero.
6. CP7/CP8 source database bytes stay unchanged. Review HTML, source manifest and separate preservation reports are regenerated in this extracted copy.

Underlying commands run from `amenity-cp2`:

```text
node cp9/scripts/check-build.mjs
  -> restore authored sources; node scripts/build.mjs (two clean builds)
node cp9/scripts/check-imports.mjs
node --test --test-reporter=tap tests/*.test.mjs
node cp9/scripts/refresh-history.mjs
node cp9/scripts/evaluate-semantic.mjs
node cp9/scripts/build-review-data.mjs
node cp9/scripts/build-preview.mjs
node cp9/scripts/verify-preview.mjs
node cp9/scripts/check-preservation.mjs
node --test --test-reporter=tap cp9/tests/*.test.mjs
node --test --test-reporter=tap tests/*.test.mjs cp9/tests/*.test.mjs
node cp9/scripts/build-report.mjs
```

## Expected results

| Check | Required |
|---|---|
| CP1-CP8 | 409 PASS / 0 FAIL |
| CP9 | 50 PASS / 0 FAIL |
| Full regression | 459 PASS / 0 FAIL |
| Original preservation | 139/139 |
| CP9 product source/test preservation | 13/13 |
| Missing local imports | 0 |
| Structured P@3 | 0.333333 |
| Hybrid P@3 | 0.944444 |
| Preview | All 15 A-O routes and navigation PASS |

Semantic metrics are **Prototype validation on simulated cases**, not intervention-effectiveness accuracy. One query worsens with hybrid; see per-query results. No success predictor was trained.

## Evidence and exact-ZIP chronology

To avoid changing a ZIP after it is tested:

1. A candidate ZIP is extracted into an empty directory outside development storage, public dependencies installed and the full command run. Those fresh extracted-copy logs become **pre-freeze rehearsal evidence** inside the final ZIP, with honest recorded paths/timestamps.
2. The final ZIP is frozen, copied by itself to another independent new directory, extracted, installed and fully verified again. It is never repackaged afterward. A final external attestation binds the exact ZIP SHA-256 to the acceptance run. Post-freeze logs stay in that extraction; adding them to the ZIP afterward would change its bytes.

Verification regenerates results **in the extracted copy only**, not the ZIP. Do not run the packaging script after final acceptance. The delivered ZIP is exactly the archive tested at stage 2.

## Inspect results in `checkpoint-9-review`

- `Checkpoint-9-Review.html`, `CP9-Reproducibility-Report.html`, `Clean-Room-Run.json`: regenerated review, provenance, commands, exit codes.
- `CP1-CP8-Tests.tap`, `CP9-Tests.tap`, `Full-Regression.tap`, `Test-Summary.json`.
- `CP1-CP8-Preservation.json` and separate `CP9-Product-Preservation.json`.
- `Build-Verification.json`, `Import-Closure-Verification.json`, `Runtime-Source-Manifest.json`.
- `Semantic-Validation.json`, `Semantic-Index.json`, `Predeclared-Relevance-Judgements.json`.
- `Preview-Verification.json`, unchanged self-contained `Checkpoint-9-Interactive-Preview.html`, A-O actual outputs.

`Source-Manifest.json` inventories the complete payload independently of preservation references. The original benign `.openai/hosting.json` is included byte-for-byte for preservation only; no account or credential is needed.

Preview checks execute the exact inline script/navigation in a minimal Node VM DOM adapter, not browser pixel-level visual QA. Existing preview/report builders are unchanged: regenerating their artifacts is not a UI redesign.
