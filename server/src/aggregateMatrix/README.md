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

## Implementation

- `AggMatrixRoute.ts` validates requests and selects available methods.
- `aggregateMethods.ts` defines method availability and calculations.
- `getAggMatrixData.ts` loads data and constructs matrix values and axis metadata.

The implementation favors bounded memory use and is intended for relatively small matrices.
