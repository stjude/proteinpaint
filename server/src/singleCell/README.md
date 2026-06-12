# singleCell server routes

This document covers all routes in this folder and explains how getter functions created during single-cell query validation are used at request time.

## Big picture

Single-cell routes rely on a two-phase model:

1. Server startup (dataset init): `validate_query_singleCell(ds, genome)` validates config and injects getter functions into `ds.queries.singleCell.*`.
2. Request handling: route `init()` methods call those injected getters (`samples.get`, `data.get`, `geneExpression.get`, `DEgenes.get`).

The startup hook runs from `server/src/mds3.init.js` during dataset validation.

## Getter injection model

The core validator is in `samplesRoute.ts`:

- `validate_query_singleCell(ds, genome)`
	- Verifies `singleCell.samples` and `singleCell.data` objects exist.
	- If `samples.get` is missing, calls `validateSamples()` to inject it.
	- For `data.src`:
		- `gdcapi`: delegates to GDC validator (`gdc_validate_query_singleCell_data`) to provide `data.get`.
		- `native`: calls `validateDataNative()` to inject `data.get`.
	- For `geneExpression.src`:
		- `native`: `validateGeneExpressionNative()` injects `geneExpression.get`.
		- `gdcapi`: `gdc_validateGeneExpression()` injects `geneExpression.get`.
	- For DE genes:
		- `validate_query_singleCell_DEgenes(ds)` ensures `DEgenes.get` exists (currently GDC-backed).
	- Builds reusable single-cell term metadata with `colorColumn2terms()`.

In short: route handlers are thin wrappers around runtime-injected dataset getters.

## Route index

### 1) `termdb/singlecellSamples`

- File: `samplesRoute.ts`
- Request checker: `validTermdbSingleCellSamplesRequest()`
- Route init: `init({ genomes })`
- Runtime getter called: `ds.queries.singleCell.samples.get(q)`

Purpose:

- Return samples that have single-cell data (plus optional metadata columns).
- Optionally filter by cohort-level termdb filters.

How validation creates its getter:

- `validateSamples(q, ds)` scans plot folders/files and builds sample inventory.
- Adds sample-level annotations from `sampleColumns` by term id.
- Injects `S.get = async (_q) => {...}` that:
	- returns `samples` list,
	- applies optional filtering via `getData({ filter, filter0, terms }, ds, true)`,
	- includes `metaResults` if configured.

Important route behavior:

- If dataset already provides `samples.get`, validator does not overwrite it.
- Meta-analysis result files are handled as special pseudo-samples and can carry cell->sample mapping (`metaIdMap`) for downstream usage.

### 2) `termdb/singlecellData`

- File: `dataRoute.ts`
- Request checker: `validTermdbSingleCellDataRequest()`
- Route init: `init({ genomes })`
- Runtime getter called: `ds.queries.singleCell.data.get(q)`

Purpose:

- Return per-sample plot cells and optional gene expression overlays.
- Optionally return only plot availability (`checkPlotAvailability`).

How validation creates its getter:

- Native datasets: `validateDataNative(D, ds)` injects `D.get = async (q) => {...}`.
- GDC datasets: `gdc_validate_query_singleCell_data()` in GDC module provides `data.get`.

Native `data.get` flow:

- Resolves selected sample id (`eID` fallback to `sID`).
- If `checkPlotAvailability=true`, calls `getAvailablePlots(...)` and returns available plot names only.
- Otherwise loads requested plot TSV files, parses cells, applies selected color column, and returns:
	- `expCells` (if gene expression exists for cell),
	- `noExpCells`.
- If `q.gene` is provided and `geneExpression` is configured, calls `ds.queries.singleCell.geneExpression.get(...)`.

Related getter dependency:

- `data.get` optionally depends on `geneExpression.get` (also injected during validation) when gene overlay is requested.

### 3) `termdb/singleCellPlots`

- File: `plotsRoute.ts`
- Request checker: `validTermdbSingleCellPlotsRequest()`
- Route init: `init({ genomes })`
- Runtime getter called indirectly: `ds.queries.singleCell.data.get(arg)`

Purpose:

- Build scatter-ready payload for a single-cell plot.
- Return either:
	- raw sample points (small datasets), or
	- server-rendered canvas image (large datasets).

How it uses getters from sample-route validation:

- This route does not define its own dataset getter.
- It depends on `data.get` that was validated/injected by `validate_query_singleCell` in `samplesRoute.ts`.
- For gene-expression coloring, it sets `arg.gene` and relies on `data.get` -> `geneExpression.get` chain.
- For categorical cell-type coloring, it sets `arg.colorBy` and reads categories from returned cells.

Notes:

- Requires `colorTW.term` to be a recognized single-cell term (`SINGLECELL_GENE_EXPRESSION` or `SINGLECELL_CELLTYPE`).
- Recreates group/category formatting logic for legend generation because termdb matrix formatting is not reused in this path.

### 4) `termdb/singlecellDEgenes`

- File: `DEgenesRoute.ts`
- Request checker: `validTermdbSingleCellDEgenesRequest()`
- Route init: `init({ genomes })`
- Runtime getter called: `ds.queries.singleCell.DEgenes.get(q)`

Purpose:

- Return DE genes for selected cluster/category vs rest of cells.
- Supports plain gene lists or volcano-plot-oriented response shape.

How validation creates its getter:

- `validate_query_singleCell(ds, genome)` calls `validate_query_singleCell_DEgenes(ds)`.
- In `DEgenesRoute.ts`, that validator currently supports `src == 'gdcapi'` and delegates to GDC validator (`gdc_validate_query_singleCell_DEgenes`) to define `DEgenes.get`.
- Non-GDC source currently throws (`unknown singleCell.DEgenes.src`).

## End-to-end request lifecycle

1. Dataset config is loaded.
2. `validate_query_singleCell()` runs during `mds3.init`.
3. Missing getters are injected onto `ds.queries.singleCell`.
4. Route request arrives.
5. Route-level checker normalizes request shape.
6. Route `init()` performs genome/dataset guards.
7. Route delegates to injected getter.
8. Getter performs source-specific IO/processing and returns payload.

## Validation functions and what they add

- `validateSamples()`
	- Adds: `samples.get`
	- Also populates sample inventory and optional metadata columns.

- `validateDataNative()`
	- Adds: `data.get` for native files.
	- Includes plot availability logic and TSV parsing.

- `validateGeneExpressionNative()` / `gdc_validateGeneExpression()`
	- Adds: `geneExpression.get`.
	- Used by `data.get` when `q.gene` is provided.

- `validate_query_singleCell_DEgenes()`
	- Ensures `DEgenes.get` is available for supported sources (currently GDC).

- `colorColumn2terms()`
	- Adds: `ds.queries.singleCell.terms` synthesized from plot color columns.
	- Used by downstream term/vocab workflows and by plotting/color logic.

## Common error conditions seen by routes

- Invalid genome or dataset label.
- Dataset has no `queries.singleCell` block.
- Expected getter missing (usually means validation did not run or source config is invalid).
- Source-specific validation failures (`unknown singleCell.*.src`).
- Per-sample data files missing for requested plot/sample combination.

## Practical dependency map

- `singlecellSamples` -> `samples.get` (injected by `validateSamples` unless dataset-supplied)
- `singlecellData` -> `data.get` (injected by `validateDataNative` or GDC validator)
- `singleCellPlots` -> `data.get` -> optional `geneExpression.get`
- `singlecellDEgenes` -> `DEgenes.get` (injected by DE validator)

This is the main pattern to keep in mind: route files define HTTP behavior, while validation functions define data access behavior.