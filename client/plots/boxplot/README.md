# Mass UI Box plot

Box plot component for visualizing the distribution of numeric data in the ProteinPaint Mass UI.

## Features

### Standard Box Plot
- Visualize distribution of a single numeric term
- Support for overlay (term2) to show distributions grouped by a categorical term
- Support for divide-by (term0) to create separate charts for each category
- Association tests (Wilcoxon) when overlay term is present
- Customizable settings (orientation, scale, colors, display mode)

### Numeric Term Collection Support
When the primary term is a **numeric termCollection**, the box plot will render multiple box plots side-by-side, one for each member term in the collection.

**Key behaviors:**
- Each member term in the collection gets its own box plot
- Colors can be specified per member term via `propsByTermId`
- The term2 (overlay) and term0 (divide-by) controls are hidden for termCollections
- A legend is displayed showing all member terms

**Example use case:** 
Visualizing expression levels of multiple genes (a gene expression signature) where each gene is a member term in the numeric termCollection.

## Architecture

The box plot follows a Model-View-ViewModel pattern:

- **BoxPlot.ts**: Main component class, manages lifecycle and state
- **model/Model.ts**: Handles data requests to the server
  - For numeric termCollections, makes parallel requests for each member term
  - Combines results into a single response structure
- **viewModel/**: Transforms server data into view-ready format
  - ChartsDataMapper: Calculates dimensions and formats plot data
  - LegendDataMapper: Prepares legend items including member terms
- **view/**: Renders the visual elements
  - ChartRender: Renders individual charts with box plots
  - LegendRender: Renders the legend

## Configuration

Box plot settings are controlled via the settings object:
- `isVertical`: Plot orientation (default: false/horizontal)
- `isLogScale`: Use log scale for axis (default: false)
- `orderByMedian`: Order plots by median value (default: false)
- `removeOutliers`: Remove outliers from analysis (default: false)
- `displayMode`: Visual theme ('default', 'filled', 'dark')
- `color`: Default box plot color
- `rowHeight`, `rowSpace`: Box dimensions and spacing
- `plotLength`: Length of the plot axis

## Development

Tests are located in `test/`:
- Unit tests for individual components (ViewModel, ChartsDataMapper, etc.)
- Integration tests for full rendering
- Tests for numeric termCollection support