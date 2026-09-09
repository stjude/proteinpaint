# singleCell server routes

This document covers all routes in this folder and explains how getter functions created during single-cell query validation are used at request time.

## Big picture

Single-cell routes rely on a two-phase model:

1. Server startup (dataset init): `validate_query_singleCell(ds, genome)` validates config and injects getter functions into `ds.queries.singleCell.*`.
2. Request handling: route `init()` methods call those injected getters (`samples.get`, `data.get`, `geneExpression.get`, `DEgenes.get`).

The startup hook runs from `server/src/mds3.init.js` during dataset validation.

## Getter injection model

The core validator is in `samplesRoute.ts`:

Every sub-query follows the same rule: a ds either supplies its own `get()`, or the built-in
file-based getter is injected here. There is no per-source branching.

- `validate_query_singleCell(ds, genome)`
	- Verifies `singleCell.samples` and `singleCell.data` objects exist.
	- If `samples.get` is missing, calls `validateSamples()` to inject it.
	- For `data`:
		- a ds-supplied `data.get` is used as-is (GDC supplies it from ppgdc's `initQueries()`).
		- otherwise `validateDataPlots()` checks `plots[]`/`plot.folder`, then `validateDataNative()`
		  injects `data.get`.
	- For `geneExpression`:
		- seeds `sample2gene2expressionBins` for every ds, since `termdb.getDefaultBins.js` reads it.
		- a ds-supplied `geneExpression.get` is used as-is (GDC supplies it from ppgdc's `initQueries()`).
		- otherwise `validateGeneExpressionNative()` injects `geneExpression.get`.
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

# Single-cell server support

This directory contains the single-cell HTTP routes and the server-side adapters used by the
termdb matrix and plotting code. Dataset configuration lives under
`ds.queries.singleCell`.

## Architecture

Single-cell datasets are initialized in two stages:

1. `validate_query_singleCell(ds, genome)` runs during `mds3.init`.
2. The routes call getters on `ds.queries.singleCell` at request time.

For native file-backed datasets, validation installs the built-in getters. A source adapter may
provide its own getters instead; GDC is the current example. A supplied getter is not replaced.

`data.plots[]` is required for every dataset, including datasets that supply all of their own
getters, because plot color columns are converted into `ds.queries.singleCell.terms`. A plot
`folder` is required only when the native `samples` or `data` getter will be used. This lets API
backends declare plot metadata without local data folders.

## Dataset initialization

`validate_query_singleCell()` validates and prepares these optional capabilities:

- `samples`: requires an object. Without `samples.get`, `validateSamples()` scans native plot
  folders, builds the sample inventory, reads `sampleColumns`, and installs `samples.get` plus
  `getFilteredSingleCellSamples()`.
- `data`: requires an object and `plots[]`. Without `data.get`, native plot files are validated and
  `validateDataNative()` installs the file-backed getter.
- `geneExpression`: when present, initializes `sample2gene2expressionBins` for termdb binning.
  Without `geneExpression.get`, `validateGeneExpressionNative()` installs a getter and requires
  `geneExpression.folder`. Native stores can also provide `listGenes()`.
- `DEgenes`: when present, `DEgenes.get` must already be supplied. There is no built-in
  differential-expression getter yet.
- `pseudobulk`: `validatePseudobulk()` validates native HDF5 files, converts categories into
  `PSEUDOBULK` terms, records the samples available for each method, and installs `pseudobulk.get()`.
  The current implementation is not supported for GDC.
- `images`: validates `folder` and `fileName`, and defaults `label` to `Images`. Image metadata is
  forwarded through termdb configuration; this directory does not define a separate image route.

`colorColumn2terms()` adds terms for plot color columns. Numeric columns become
`SINGLECELL_NUMERIC_VALUE` terms, and categorical columns become `SINGLECELL_CELLTYPE` terms.
Gene expression terms are available only when `geneExpression` is configured. These terms are
also exposed by `server/src/routes/termdb.config.ts` and used by matrix, filtering, and plotting
workflows.

## Routes

### `termdb/singlecellSamples`

Implemented in `samplesRoute.ts`. Calls `singleCell.samples.get(q)` and returns samples with
single-cell data, optional metadata, and optional cohort-level filtering. Native validation derives
the inventory from plot files. Meta-analysis plots are represented as pseudo-samples; their cell
to cohort-sample mappings are cached for filtering and matrix annotation.

### `termdb/singlecellData`

Implemented in `dataRoute.ts`. Calls `singleCell.data.get(q)` for plot data, or
`geneExpression.listGenes(sample)` when `listGenes` is requested. A native data getter:

- resolves `eID` with `sID` as fallback;
- can return plot availability with `checkPlotAvailability`;
- reads plot TSV files and returns `expCells` and `noExpCells`;
- applies `colorBy` and optional `colorMap`; and
- uses `geneExpression.get()` when a gene overlay is requested.

The route accepts `sample`, `plots`, `gene`, `listGenes`, `colorBy`, and color-map options. API
backends may supply a different `data.get()` implementation.

### `termdb/singleCellPlots`

Implemented in `plotsRoute.ts`. This route builds a scatter response from `data.get()` and returns
either raw cell points or a server-rendered canvas image, selected by `canvasSettings.cutoff`.
It supports:

- categorical cell-type coloring;
- numeric plot-column coloring, including discrete bins and continuous color domains;
- gene-expression coloring and coordinate terms; and
- meta-result filtering through the sample mapping cache.

The request must provide a single-cell `colorTW` or `coordTWs`. Combining `coordTWs` with
`colorTW` is currently not implemented. Numeric color domains support `auto`, `fixed`, and
`percentile` modes. Legend/category formatting is performed in this route because it does not
reuse the full termdb matrix formatting path.

### `termdb/singlecellDEgenes`

Implemented in `DEgenesRoute.ts`. Calls the dataset-supplied `DEgenes.get(q)` for a selected
sample and cluster/category. The result may be a plain gene list or volcano-plot data. Empty
results are returned as a 404-shaped response. Datasets without `DEgenes.get()` fail validation
and do not support this route.

## Matrix integration

`matrixData.ts` adapts cell-level values to the termdb matrix representation. Each cell becomes a
matrix row:

- `SINGLECELL_GENE_EXPRESSION` reads from `geneExpression.get()`;
- `SINGLECELL_NUMERIC_VALUE` reads a numeric plot column; and
- `SINGLECELL_CELLTYPE` reads a categorical plot column.

Numeric values can be binned in discrete or binary mode. For meta-analysis results, cell IDs are
mapped back to cohort samples so cohort-level filters and annotations can be applied. The helper
`hydrateMetaResultCellRows()` copies mapped cohort values onto pseudo-sample rows.

Pseudobulk terms use the general termdb data and DE paths rather than a route in this directory.
The getter reads mean HDF5 data by default and can also expose configured `total` and `percent`
methods. Terms are generated per assay, member, and category.

## Request flow

```text
dataset config
  -> mds3.init
  -> validate_query_singleCell()
  -> native getters installed when needed
  -> termdb route request validation
  -> route delegates to ds.queries.singleCell getter
  -> source-specific files/API data formatted for the response
```

Common failures are an absent `queries.singleCell` block, missing `data.plots[]`, a missing
`plot.folder` or `geneExpression.folder` for a native getter, an unavailable supplied getter, an
invalid genome/dataset/sample, or missing per-sample files. Native getters also reject sample IDs
that would escape the configured data directory.

## Tests

Focused tests for this directory are under `test/`:

- `samplesRoute.unit.spec.ts` covers initialization, native/API getter combinations, required
  folders, term generation, and sample-path validation.
- `plotsRoute.spec.ts` covers legends, gene-expression ranges, numeric values, and unsupported
  request combinations.
- `matrixData.unit.spec.ts` covers cell annotation, numeric/categorical values, gene expression,
  and meta-result mappings.
- `colorDomain.unit.spec.ts` covers automatic, fixed, and percentile numeric domains.