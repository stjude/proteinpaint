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
1. `SCInteractions.createSubplot()` dispatches `plot_create` with `parentId` set to the SC id and `scItem` cloned from the current selection. This adds the subplot as an entry in `state.plots[]`.
2. `getState()` in SC.ts filters all plots with a `parentId` matching the SC id into `subplots[]`.
3. `main()` passes `subplots[]` to `SCViewRenderer.update()`, which delegates to `SectionRender.update()` for reconciliation and rendering.

Once added as a component, the plot will update every time `app.dispatch` is called.

### Sections (`SectionRender`)
`SectionRender` (in `view/SectionRender.ts`) groups subplots by sample into collapsible sections. It maintains a `sections` map keyed by sample id and a `plotId2Sample` map that links each subplot id back to its sample.

`update()` runs three passes on every render cycle:
1. **Remove stale subplots** — builds an active set from the current state and calls `removeSandbox()` for any component in `sc.components.plots` that is no longer active.
2. **Initialize new subplots** — for each subplot in state, creates its section (via `initSection()`) if one does not exist for the sample, then creates a sandbox (via `initSandbox()`) if one does not exist for the subplot. `initSandbox()` calls `sc.initPlotComponent()` which dynamically imports the chart module and stores the component.
3. **Remove empty sections** — deletes any section whose sandboxes map is empty.

Users can also remove subplots and sections directly:
- **Sandbox close button** — calls `removeSandbox()` then dispatches `plot_delete`.
- **Section close button** — calls `removeSection()`, which removes every sandbox in the section, batches the corresponding `plot_delete` actions into a single `app_refresh` dispatch, and removes the section wrapper from the DOM.