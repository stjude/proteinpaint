# Mass UI Violin Plot

Violin plot component for visualizing the distribution of a numeric term in the ProteinPaint Mass UI.

## Features

- Visualize a single continuous numeric term as a density plot.
- Overlay a second term to render one violin per group; the overlay may be categorical or numeric.
- Divide results by a third term to render separate charts.
- Show pairwise Wilcoxon association tests for overlay groups.
- Show descriptive-statistics legend sections for each numeric wrapper.
- Render rug or bean symbols, median markers, and optional log-scaled axes.
- Sort plots by median and hide or restore individual overlay groups from labels and legends.
- List or select samples and add filters from violin labels or brush selections when the embedding allows it.

## Numeric Term Collections

For a numeric termCollection, the server expands sample values into one virtual sample per member term and creates a synthetic categorical overlay. This lets member terms render as separate violins using the normal overlay pipeline. The term2 and term0 controls are not sent for this mode.

## Architecture

- **Violin.ts**: Component lifecycle, controls, request construction, and response handling.
- **violin.renderer.ts**: SVG, density, axis, legend, summary-statistic, and association-table rendering.
- **violin.interactivity.ts**: Label menus, brush menus, filtering, sample listing/selection, and hiding or restoring plots.
- **settings/**: Default settings and types for violin controls.
- **test/**: Integration tests for rendering, controls, filters, descriptive statistics, and hidden values.

## Data Contract

Violin plots use the shared `termdb/violinBox` route. The response has `descrStats` keyed by term-wrapper `$id`. `Violin.ts` copies each available entry into the corresponding flat `term.q.descrStats` object so legends can render the correct statistics even when `term2` is the continuous wrapper. Per-violin statistics are returned as `summaryStats` on each plot entry.

## Settings

- `orientation`: Horizontal or vertical layout.
- `isLogScale`: Use a logarithmic numeric axis; non-positive primary values are excluded.
- `datasymbol`: Render `rug` or `bean` sample symbols.
- `radius`: Rug length or bean radius.
- `orderByMedian`: Sort violins by median value.
- `showStats`: Show descriptive-statistics legend sections.
- `showAssociationTests`: Show the pairwise Wilcoxon table.
- `medianColor`, `medianLength`, `medianThickness`: Median-marker appearance.
- `svgw`, `axisHeight`, `rightMargin`, `rowSpace`, and `ticks`: Chart dimensions and axis layout.

## Development

Run the client integration tests in `test/` for rendered behavior. The server helpers and route transformations are tested in `server/src/routes/test/violinBox.unit.spec.ts`.