# Plot Components

## Creating a New Plot Component

Every plot component in the mass UI must extend `PlotBase` and implement `RxComponent`:

```ts
import { PlotBase } from '../PlotBase.ts'
import { getCompInit, type RxComponent } from '#rx'

export class MyPlot extends PlotBase implements RxComponent {
	static type = 'myPlot'

	constructor(opts, api) {
		super(opts, api)
		// set up dom, components, etc.
	}

	getState(appState) { /* ... */ }
	async init(appState) { /* ... */ }
	async main() { /* ... */ }
}

export const MyPlotInit = getCompInit(MyPlot)
export const componentInit = MyPlotInit
```

- **`extends PlotBase`** provides `this.app`, `this.id`, `this.state`, `this.opts`, `this.parentId`, `this.components`, `this.dom`, and `getMutableConfig()`. This avoids duplicating boilerplate across every plot.
- **`implements RxComponent`** satisfies the rx reactive contract (`getState`, `init`, `main`).
- **`static type`** is required by `getCompInit` to register the component in the rx store.
- **`super(opts, api)`** in the constructor passes `opts` and the component API to `PlotBase`, which assigns `this.app`, `this.id`, and `this.parentId`.

Additional sections describe special considerations for parent and transient plots. 

## State Tracking and Implementation

Plots are tracked in the MassApp as `app.components.plots{[plotId]: plot_instance}`. Each plot instance is wrapped in the `MassPlot` component defined in `mass/plots.ts`. `MassPlot` handles conveniences like local plot filtering (see section below).

## Local Filters

Local filters are plot-specific filters that adhere to the same TermTypeSearch and tree.usecase{} declarations. These filters are enabled by **default** from `MassPlot`. Setting `config.hidePlotFilter: true` disables the filter. 

# Transient Plots

Transient plots (e.g. dictionary, summaryInput, DEInput, etc.) serve as forms that spawn another plot. On submit, the form should dispatch a `plot_create` for the new plot and a `plot_delete` to destroy itself. Both may be submitted in one dispatch with: 
```
this.app.dispatch({
    type: 'app_refresh',
    subactions: [
        {
        type: 'plot_create',
        config: configWithChanges
    },
    {
        type: 'plot_delete',
        id: this.id
    }]
})
```

# Parent Plots

Parent plots manage child plot components (subplots). There are two strategies for managing children, depending on whether subplots are dynamic or persistent.

## Dynamic Subplots

Dynamic subplots are **separate entries** in `state.plots[]`, each with a `parentId` linking back to the parent. Multiple instances of the same chart type can exist simultaneously (e.g. several scatter plots for different samples/genes). Each subplot has its own unique id and its own rx lifecycle.

### Init and Destroy

`mass/app.ts` includes special considerations for initializing new plots with `.parentId`. mass/app.ts cannot remove components that live inside a parent plot. The parent must handle its own cleanup. 

#### Phase 1 — Remove stale components

Iterates over `sc.components.plots` (the locally tracked component map) and compares each plot id against the set of active subplot ids from state. Any component that no longer exists in state is removed via `removeSandbox()`, which destroys the component, removes the sandbox DOM element from its parent section, and cleans up the `plot2Sample` lookup.

This step runs **first** because mass/app.ts does not destroy nested components (see note in previous section). Also, this step prevents `main()` from attempting to re-initialize a component that was already deleted by a state action (e.g. replacing a transient plot).

#### Phase 2 — Initialize new subplots

The parent plot is responsible for initializing new plots with the following: 

1. Defined sandbox with its own close method
2. Importing the correct chartType componentInit
3. Add plot to parent component `this.components.plots[plotKey] = await componentInit(opts)`

Running this **after** cleanup in Phase 1 avoids stale id collisions.

### Destroying subplots

The parent must destroy the component **and** remove its DOM holder. mass/app.ts cannot remove components that live inside a parent plot. This is especially important when a subplot is replaced by another action (i.e. transient plots). This must be done in phase 1 **and** the sandbox close() method. 

Ex. In the SC app, `removeSandbox()` handles both: it calls `sc.removeComponent(plotId)` (which calls `destroy()` and deletes from `sc.components.plots`) and removes the sandbox DOM element from the section.

## Persistent Child Plots (e.g. DifferentialAnalysis — `setComponent`)

Persistent child plots **share the parent's `this.id`** and config; the active child is selected by `config.childType`. Only one instance per chart type exists. `setComponent()` is called lazily in `main()` only the first time a `childType` is needed, and the component persists for the lifetime of the parent.

Switching between children (e.g. volcano ↔ GSEA) is done by **toggling visibility** (`display: none` / `''`) on the pre-existing DOM containers rather than creating or destroying components. There is no reconciliation loop—components are never removed, only hidden. The pattern is init-once, show/hide.

## Dynamic vs. Persistent — Quick Comparison

| | Dynamic (SC) | Persistent (DiffAnalysis) |
|---|---|---|
| State entries | Separate `state.plots[]` entry per subplot | Single parent entry; `childType` selects active child |
| Instances | Multiple per chart type | One per chart type |
| Lifecycle | Created/destroyed as user acts | Init once, persist forever |
| Switching | Add/remove from state | Toggle DOM visibility |
| Reconciliation | Three-phase (remove → init → prune) | None (lazy init on first use) |