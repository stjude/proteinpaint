# Single Cell (SC) App
The SC 'super' app is designed to showcase single cell data in multiple modalities. SC.ts is the parent component for the mass UI. The child components are launched based on the configuration in the dataset file from the parent. 

# Code architecture

## Server Requests
The SC app makes two server requests via SCModel, each corresponding to a different phase of the UI.

### Sample Data (`termdb/singlecellSamples`)
Called during `init()` to populate the sample selection table. The request sends the genome, dslabel, and an optional filter. The response returns an array of `SingleCellSample` objects along with `fields` and `columnNames` used to build the table columns. SCViewModel.getTableData() transforms the samples and column metadata into the table structure rendered by the view. This data drives the rest of the app: the user must select a sample from the table before any plots can be created.

### Plot Data (`termdb/singlecellData`)
Called during `main()` once a sample is selected (`config.settings.sc.item`). The request sends the sample identifier, the list of plot names to fetch (e.g. `['umap', 'tsne']`), and `checkPlotAvailability` (default true). When `checkPlotAvailability` is true, the response returns which plots are available for the sample but not the actual cell data. The available plot names drive the plot buttons rendered by `SCViewRenderer`. Individual subplot components fetch their own cell data independently.

## Subplots

Subplot creation and rendering workflow:
1. `SCInteractions.createSubplot()` dispatches `plot_create` with `parentId` set to the SC id. Each subplot config carries its own `sample: {sID, eID}` (or `term.term.sample: {sID, eID}` for term-based plots). This adds the subplot as an entry in `state.plots[]`.
2. `getState()` in SC.ts filters all plots with a `parentId` matching the SC id into `subplots[]`.
3. `main()` passes `subplots[]` to `SCViewRenderer.update()`, which delegates to `SectionRenderer.update()` for grouping and rendering.

Once added as a component, the plot updates every time `app.dispatch` is called.

### SubplotManager
`SubplotManager` (in `subplots/SubplotManager.ts`) maintains a central registry of all active subplots and their metadata. It does **not** manage rendering — instead, it tracks:
- A `records` Map that indexes each subplot by its `plotId`, storing metadata like `sampleId`, `plotName`, `sectionKey`, `isMetaResult`, and references to the DOM `sandboxDiv`.
- Which subplots are currently active and which sample each belongs to.

The manager provides:
- `map()` — reconciles a new array of subplot configs against the existing active subplots. Removes records for subplots no longer in the array, initializes new records via `initSubplot()`, and returns the flattened list of active subplot records.
- `initSubplotSandbox()` — creates the actual DOM sandbox and initializes the plot component via `dynamicSubplotInit()`. Stores the component in `sc.components.plots[plotId]` and maintains the sandboxDiv reference in the record.
- `setSectionKey()` and `setSandbox()` — update metadata as the SectionRenderer reorganizes plots into sections.
- `getSampleSandboxes()` — indexes active subplots by sample for quick lookup of all plots belonging to a sample.

### Sections (`SectionRenderer`)
`SectionRenderer` (in `view/SectionRenderer.ts`) groups subplots into collapsible sections based on the `groupBy` setting (`'none'`, `'sample'`, or `'plot'`). It maintains:
- A `sections` map keyed by the grouping key (a fixed `'none'` string, a sample id, or a plot name). Each section holds its DOM wrapper, title, subplots container, and a `sandboxes` map of the plots within it.
- A `plotId2Key` map for reverse lookup from subplot id back to its section key.

The `update()` method first checks whether `groupBy` has changed. If so, it delegates to `regroupSections()`, which:
1. Detaches existing sandboxes from their parent section containers (without destroying the plot components).
2. Clears all section wrappers and resets the maps.
3. Removes any subplot components that are no longer active by calling `subplotManager.removeSubplot()`.
4. Recreates section containers with new keys and reparents the detached sandboxes into them.

Otherwise, `update()` reconciles the current state with the new subplots via three passes:
1. **Remove stale subplots** — builds an active set from the current subplots array and calls `removeSandbox()` for any component in `sc.components.plots` that is no longer active.
2. **Initialize new subplots** — for each subplot, derives the section key via `getKey()`, creates its section (via `initSection()`) if one does not exist, then creates a sandbox (via `initSandbox()`) if one does not exist. `initSandbox()` calls `subplotManager.initSubplotSandbox()` to create the DOM and initialize the plot component, then stores the reference in the section's sandboxes map.
3. **Remove empty sections** — deletes any section whose sandboxes map is empty.

Users can remove subplots and sections directly:
- **Sandbox close button** — calls `removeSandbox()`, which removes the DOM element and deletes it from the section's sandboxes map, then dispatches `plot_delete` to update state. `SectionRenderer` later removes the corresponding component from the SubplotManager and deletes the section if it becomes empty.
- **Section close button** — calls `removeSection()`, which removes every sandbox in the section by calling `removeSandbox()` for each, batches the corresponding `plot_delete` actions into a single `app_refresh` dispatch, and removes the section wrapper from the DOM.