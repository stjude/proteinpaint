# GSEA plot

This module provides the Gene Set Enrichment Analysis (GSEA) plot component used in ProteinPaint.
The main entry file is `gsea.ts`, which wires together config validation, parameter preparation,
controls, view-model processing, and rendering.

## Config validation rules

`validateConfigByTermType(config)` enforces term-type-specific requirements:

- `PROTEOME_DAP`
	- Requires `config.proteomeDetails`
	- Sets `config.gsea_params.dapParams = config.proteomeDetails`
- `SINGLECELL_CELLTYPE`
	- Requires `config.sample`, `config.termId`, and `config.categoryName`
- All term types
	- Ensures `config.gsea_params` exists

## GSEA lifecycle (`GSEA` class)

### Constructor

- Sets component type (`'gsea'`)
- Creates DOM regions:
	- `actionsDiv` (pathway selector)
	- `loadingDiv`
	- `holder` (main chart area)
	- `detailsDiv` (stats/details/actions)
	- `tableDiv` (results table)
- Reads optional feature flag from session storage:
	- `optionalFeatures.gsea_test` -> enables test-only method options

## `gsea_params` shapes

The component accepts three validated parameter shapes:

- **Proteome DAP mode**
	- `genome`, `dslabel`, `dapParams`
- **Single-cell cell-type mode (inline DE)**
	- `genome`, `genes[]`, `fold_change[]`, `genes_length`
- **Other term types (cached DA output)**
	- `genome`, `cacheId`, `daRequest`, `genes_length`, `dslabel`

The model resolves missing values automatically when possible.

## UI and interactions

- Pathway dropdown in the action bar drives `settings.gsea.pathway` updates.
- Result-row click updates selected geneset (`gsea_params.geneset_name`).
- In differential-analysis context, row click can also set `highlightGenes`.
- Optional "Highlight genes" button dispatches selected genes to volcano child view.
- Download control saves current rendered image (when available).

## Server/API dependencies

- `termdb/singlecellDEgenes` for single-cell DE gene retrieval
- `genesetEnrichment` for enrichment execution and detail output
- Differential-analysis cache path may call volcano-model data retrieval first

## Adding a new term type

At minimum:

1. Extend term-type handling in `validateConfigByTermType()`.
2. Add param-resolution logic in `GSEAModel.getGseaParams()`.
3. Ensure the resulting params satisfy one of the `GseaParams` variants.
4. Confirm request-body mapping in `GSEAViewModel.getRequestBody()`.

### Version history

- Last updated: 9 Jul 26
