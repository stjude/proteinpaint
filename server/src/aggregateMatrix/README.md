# Aggregate matrix

_This plot and its server API are under development. The behavior described here may change._

The aggregate matrix summarizes relationships between terms arranged into row and column sections. Each matrix cell contains a color value and a size value calculated with independently selected aggregation methods.

## Server route

The `termdb/aggregateMatrix` route supports two general requests:

- Determine which aggregation methods are available for the selected column terms.
- Calculate the matrix data and axis layout for the selected rows, columns, filters, and methods.

The response keeps each cell self-contained so the client can render the matrix without reconstructing cell metadata from separate lookup tables.

## Aggregation methods

Available methods depend on the dataset and selected term types. Current methods include mean, percent, and count. Some values are calculated from sample intersections, while pseudobulk values are read from validated dataset files.

Method availability is resolved on the server after dataset initialization. Requests are rejected when a selected method is unavailable for the supplied column terms.

## Term handling

Dictionary terms may expand into their observed categories or bins. Sections preserve the grouping and order supplied by the request.

Pseudobulk terms use their configured assay, member, category, and aggregation method. A request currently cannot combine pseudobulk and sample-based columns in the same matrix.

The behavior of numeric non-dictionary terms is still being designed. These terms will likely be represented one line at a time rather than expanded like dictionary terms.

## Gene variant terms and pie charts

Pie charts are not a separate route or request. They apply automatically when a gene variant term is on one axis and a term of another type is on the other. The server decides what each pie contains and how large it is relative to the others, and the client draws them. A dot in a pie chart is a pie or it is no data.

### What a gene variant annotation is

A sample's annotation for a gene variant term is a list of `values`, one for each queried variant type and each variant found. Besides real variants, the list holds the statuses wildtype (`WT`) and not tested (`Blank`). Those statuses are not variants. They say nothing about an alteration, and a sample can have one for every variant type that was queried.

### Assumptions

- **A sample matches the term only when it has a variant.** The matrix value (the count or percent in a cell) uses samples that have at least one value that is not `WT` or `Blank`. This is `hasVariant()`.
- **Slices count values, with two exceptions.** Each real variant is one count, so a sample with two missense variants adds 2 to that slice. `WT` and `Blank` count once per sample, so their numbers are samples and never exceed `n`.
- **Slice colors and labels come only from `mclass` of the shared code, or from the term.** Nothing in the data names a label or color. A class that is not in `mclass` is ignored. `mclassOverride` is applied by the client, so the client re-labels and re-colors the variant classes from `slice.key` when `termType` is `geneVariant`.
- **Uncomputable values are never sent.** A value that the term marks as `uncomputable` is removed before counting, so it does not appear in any slice or in `n`.
- **Hidden values are sent, flagged `hidden`.** A value in `q.hiddenValues` is counted and sent with `hidden: true`. `WT` and `Blank` are hidden by default. The client draws only slices that are not hidden until the user shows them in the legend. When the user has chosen which slices to hide, that choice replaces the server's flags.
- **Hidden slices still count in `n`.** `n` is the number of samples with a usable value in the cell, hidden classes included. It is what sets the radius of the pie.
- **At most 40 slices.** A pie with more has its smallest classes folded into one `__other__` slice. The same slices and colors are used in every pie of the chart, so one legend covers them all.
- **Which axis has the gene variant term does not matter.** The server counts the same way when the gene variant term is on the rows or on the columns.
- **Cells and samples are not mixed.** A `singleCellCellType` term is a cell, and other terms such as age are about a patient, so the request is rejected when they are combined. Cell type with cell type is allowed. Pseudobulk is a sample-level term. The pie chart with a gene variant term and cell types is not supported yet, as cells in a non-meta single cell result do not carry the sample's variants.

### What the response holds

Each dot of a pie chart has a `pie`:

- `n`: samples with a usable value in the cell.
- `variantSamples`: samples with at least one variant. It is the same number that the matrix count method gives for the cell. It is only present for gene variants.
- `radius`: relative to the largest pie, from 0 to 1. It is `sqrt(n / maxN)`, so the area is proportional to `n`. The client turns it into pixels.
- `slices`: `{ key, label, color, count, hidden? }`, in one fixed order. Slices without a count are omitted.
- `termType`: tells the client what the slice keys mean.

The total of the variants is not sent. It is the sum of the `count` of the slices that the client draws, so it follows what the user hides.

The response also has `sampleType`, so the client can name the samples in a tooltip.

### Numbers to be aware of

- **Count** of a cell is samples with a variant. **Percent** is that count over all samples in the response, not over the samples of the column, so it is a share of the cohort.
- **The size method does not set the size of a pie.** The pie radius comes from `n`, whatever the size method is.
- **A gradient is never applied to a pie.** When every dot is a pie, the request needs no gradient method, and a `gradientMethod` that is sent is ignored. The response then has no `colorScale`, and every `colorValue` is `null`. Every dot is a pie when all terms of one axis are gene variant terms and all terms of the other axis are of another type (`isPieOnly()` in `shared/utils/src/aggregateMatrix.ts`). If an axis has both kinds of term, some dots are not pies, so the request still needs a gradient method and the response has a color scale. The client then shows no color scale, color controls or color value in the tooltip for a chart of only pies.

The pie size not following the size method is expected to change.

## Implementation

- `AggMatrixRoute.ts` validates requests and selects available methods.
- `aggregateMethods.ts` defines method availability and calculations.
- `getAggMatrixData.ts` loads data and constructs matrix values and axis metadata, and sends each sample to the pie counter.
- `pieChartProcessing.ts` decides the slices of a pie. `mclassScheme` is the scheme for gene variants, and `termValuesScheme` is the scheme for terms with categories or bins. `PieCounter` counts the samples of every cell and builds the pies.

The client draws the pies from `client/plots/aggregateMatrix/`. `viewModel/PieViewModel.ts` turns a pie into slice shapes, the tooltip entries and the legend, and `view/LegendRender.ts` renders the legend.

The implementation favors bounded memory use and is intended for relatively small matrices.
