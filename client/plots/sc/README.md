_This document is a draft. App is in development_

# Single Cell App
The sc 'super' app is designed to showcase single cell data in multiple modalities. SC.ts is the parent component for the mass UI. The child components are launched based on the configuration in the dataset file from the parent. 

# Code architecture

## Server Requests
The SC app makes two server requests via SCModel, each corresponding to a different phase of the UI.

### Sample Data (`termdb/singlecellSamples`)
Called during `init()` to populate the sample selection table. The request sends the genome, dslabel, and an optional filter. The response returns an array of `SingleCellSample` objects along with `fields` and `columnNames` used to build the table columns. SCViewModel.getTableData() transforms the samples and column metadata into the table structure rendered by the view. This data drives the rest of the app: the user must select a sample from the table before any plots can be created.

### Plot Data (`termdb/singlecellData`)
Called during `main()` once a sample is selected (`config.settings.sc.item`). The request sends the sample identifier, the list of plot names to fetch (e.g. `['umap', 'tsne']`), and optional gene/colorBy parameters. The response returns an array of plot objects, each containing cell coordinate arrays (`expCells`, `noExpCells`), color columns, and color mappings. `formatPlotData()` merges and sorts the cell arrays before the view renders them.

## Subplots
Subplot creation and rendering: 
1. Subplots are first added as a plot to `state.plots[]` via `app.dispatch(...'plot_create')`.
2. `getState()` in SC.ts filters all plots with a `parentId` matching the SC id into `subplots[]`.
3. `main()` calls `reconcileSubplots()` which iterates through all subplots to check for a matching component.

### Segments
Each sample has a segment in `this.segments[sampleId]` that holds the title DOM element, a container div for subplots, and a map of sandbox DOM elements keyed by subplot id. When a subplot is encountered for a sample that has no segment yet, `initSegment()` creates the segment. Then `initSubplotComponent()` creates a sandbox within that segment, imports and initializes the plot component, and stores references in both `this.components.plots[subplotId]` and `this.segments[sampleId].sandboxes[subplotId]`.

### Reconciling Deleted Subplots
After initializing new subplots, `reconcileSubplots()` cleans up stale components. It compares the subplot ids present in state against `this.components.plots`. Any component that exists locally but is no longer in state (e.g. deleted by another action such as replacing a transient plot) has its sandbox DOM element removed from the segment and its entry deleted from `this.components.plots`. Finally, `view.removeSegments()` removes any segment whose subplots container has no remaining sandbox headers.

Once added as a component, the plot will update every time `app.dispatch` is called.