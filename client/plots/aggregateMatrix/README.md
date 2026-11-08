# Aggregate Matrix

The aggregate matrix is a data- and term-type-agnostic visualization that renders aggregate values for term × term combinations. Each cell is a dot, encoded by color and size, or a pie when a gene variant term is on one axis and a term of another type is on the other.

The server does the data processing. See `server/src/aggregateMatrix/README.md` for the route, the aggregation methods, and the assumptions made when processing gene variant terms. This document covers what the client sends, how it is drawn, and what the user can change.

## Plot Configuration

```
{
	chartType: 'aggregateMatrix',
	rows: { [section]: TermWrapper[] },
	columns: { [section]: TermWrapper[] },
	settings: { aggregateMatrix: { ...see below } }
}
```

- Rows and columns are sections, in order, of term wrappers (`{ term, q }`). A bare term is rejected.
- A dictionary term (categorical, integer, float) is the only term of its section. It expands into one row or column for each category or bin. The same is true for a single cell cell type term.
- The other term types are one row or column each, and a section holds one type of term.
- `getPlotConfig` merges the defaults with the config once, when the plot is created. `validatePlotConfig` runs the same checks as the route, so an unsupported request fails before it is sent.
- `TermdbVocab.getAggregateMatrixData` formats the terms of the request.

### Settings

| Setting | Meaning |
| --- | --- |
| `sizeMethod` | Aggregation method that sets the size of a dot. Required. |
| `gradientMethod` | Aggregation method that sets the color. Required unless every dot is a pie, and then it is ignored. It must differ from `sizeMethod`. |
| `startColor`, `stopColor` | Ends of the color gradient. |
| `minDotSize`, `maxDotSize` | Radius in pixels of the smallest and largest dot or pie. |
| `dotInputMin`, `dotInputMax` | The range of the inputs for the two sizes above. |
| `hiddenSliceKeys` | The pie slices that the user hides. Not set until the legend is changed. |

## Dots

A dot is drawn at a size from the size value of its cell and a color from the color value. A dot without both values is drawn blank, and its tooltip says that no data is available.

### Dot sizes

The size of a row or column is set by the largest dot: a cell is `maxDotSize` times `cellToDotSize` (2.5). The size of a dot is `minDotSize` to `maxDotSize`, from the range of the size values.

The defaults are in `settings/defaults.ts`:

- **Dots:** 5 to 20 pixels.
- **Pies:** 30 to 60 pixels, as a pie needs more room.
- **Fitting pies in the window:** when the plot is created, the pie sizes are scaled down so that every row and column fits in the window. It takes the width and height of the window less the room for labels, axis titles, and legend, divides them by the number of columns and rows, and picks the largest max size that fits. The max size is never above 60 or below 20, and the min size keeps its ratio to the max size. This is done once, in `getPlotConfig`, and the result is saved in the config.
- **What this is not:** the fit is an estimate. The plot may not fill the window, labels depend on the data, the count is of terms and not of the categories that a term expands into, and a saved or shared plot keeps the sizes of the window it was made in. A min or max size set by the user is never changed.

## Pies

A pie is made from the single response of the route. The server sends each pie with its slices and the number of samples, and the client turns them into shapes.

- **Size:** the area of a pie is proportional to the number of samples with a value for the gene variant term in the cell, relative to the largest pie. A pie is never smaller than `minDotSize`.
- **Slices:** one for each variant class in the cell, in one order for all the pies. Labels and colors come from the server. The client remaps variant classes through `mclass`, so a `mclassOverride` of the launch arguments applies.
- **Hidden slices:** slices that are hidden by default, such as wildtype and not tested, are sent flagged and not drawn. The user can show them in the legend. When a pie has no slice to draw, or a dot of a pie chart has no pie, it is blank and counted as no data.
- **No color scale:** when every dot is a pie, nothing is colored by a gradient, so no color scale is drawn, there are no color controls, and the tooltip has no color value.

## Legend

- **Color scale:** the gradient, with the colors set by the user. Not drawn when every dot is a pie.
- **Size reference:** two circles at the smallest and largest size. Clicking it opens a menu to change the sizes in pixels. It is the `DotSizeScale` component, and the svg is fit to what was drawn.
- **Pie legend:** a color and label for every slice that can be drawn, hidden or not, including those hidden by default. Hidden slices are crossed out. Clicking a slice opens a menu to hide or show it, show only it, or show all. This is the `LegendItemMenu` component. The choice is saved in `hiddenSliceKeys` and replaces which slices are hidden by default. Slices that are uncomputable are never sent, so they are not in the legend.

## Tooltip

A dot lists its row and column, then its color value and size value. A pie lists:

- The number of samples with a variant.
- The number of variants in the slices that are drawn.
- Each slice that is drawn, with a swatch of its color and its count.

Slices that are hidden are not listed and are not in the total, and the tooltip follows the legend as the user shows and hides slices.

## Implementation

The plot follows model, view model, and view.

- `AggregateMatrix.ts`: the component, `getPlotConfig`, and `validatePlotConfig`.
- `model/AggMatrixModel.ts`: builds the request and calls the vocab.
- `viewModel/AggMatrixViewModel.ts`: the layout of the rows, columns, section labels, and dots.
- `viewModel/PieViewModel.ts`: the pie logic, as pure functions. It makes the slice shapes, decides which slices are hidden, and builds the tooltip and the legend of the pies.
- `viewModel/ViewModelDataTypes.ts`: the data that the view model gives to the view.
- `view/AggMatrixView.ts`: draws the labels, dots, pies, and tooltips.
- `view/LegendRender.ts`: draws the color scale, the size reference, and the pie legend.
- `view/setControls.ts`: the controls for colors and sizes.
- `settings/`: the types, the defaults, and the validation of the sizes.

Components from `client/dom` are `DotSizeScale` and `LegendItemMenu`.

## Tests

- `test/*.unit.spec.ts`: validation, defaults, the view model, and the pies.
- `test/aggregateMatrix.integration.spec.ts`: renders the plot against TermdbTest for each term type, for the pies, and for many rows.
- `client/dom/test/DotSizeScale.unit.spec.ts` and `LegendItemMenu.unit.spec.ts`: the legend components.

From `client`, run a spec with `./test.sh "<pattern>" "dir=<directory>"`.
