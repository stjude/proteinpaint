# Disco App
_This readme is in draft format_

_//TODO: add description of code architecture_

## Calculations
Rendering calculations for the rings assumes zero-based genomic positioning. Users however are only allowed to input one-based positioning. 

Rendering calculations for the rings assumes zero-based genomic positioning. Users however are only allowed to input one-based positioning.

## Launching Disco
`runproteinpaint()` detects an `arg.disco` object and calls `launchDisco()` in
`client/src/app.js`. The launcher creates a `PlotApp` instance which
initializes a store from `mass/store.js` to keep the plot configuration and
state. The returned app exposes a `dispatch()` method. Disco components such as
`DiscoInteractions` and the `toggleVisibility()` method use `app.dispatch()`
with actions like `plot_edit` to update the store and re-render the plot.

Example usage:

```javascript
runproteinpaint({
    holder: document.getElementById('view'),
    genome: 'hg38',
    disco: {
        dslabel: 'gdc',
        sample_id: 'SAMPLE01'
    }
}).then(app => {
    // app.dispatch() can update the plot
})
```

The `disco` object may include a `settings` field to override the defaults in
`defaults.ts`. Any interaction that changes these settings triggers
`app.dispatch()` with a `plot_edit` action so the store and UI stay in sync.

## Code Structure
The plot lives under `client/plots/disco`.  The main entry point is
`Disco.ts`, exported through `componentInit`.  It is created by the
`getCompInit()` helper so the app store can manage it like any other plot.
`Disco.ts` sets up UI controls via `multiInit()` and prepares the
`DiscoRenderer` which in turn delegates to several ring renderers
(chromosomes, SNV, CNV, LOH, etc.).  User interactions are defined in
`interactions/DiscoInteractions.ts` and are passed to mapping and rendering
classes as callbacks.

Data mapping is handled by the `data/` and `viewmodel/` directories.  Incoming
records are parsed by `DataMapper` and collected in a `DataHolder`.  A
`ViewModelMapper` then converts this holder into a `ViewModel` used by
`DiscoRenderer`.

## Data Flow
1. `runproteinpaint()` detects `arg.disco` and invokes `launchDisco()` in
   `src/app.js`.
2. `launchDisco()` constructs a `PlotApp` instance which initializes the global
   store from `mass/store.js`.  The store contains the plot configuration under
   `state.plots`.
3. When the Disco component runs, its `main()` method uses the current store
   state to create a `ViewModel` via `ViewModelMapper` and then renders it.
4. Interactions such as menu toggles or color-scale edits dispatch
   `plot_edit` actions.  The store merges these changes into the
   corresponding plot config and triggers a re-render.

This flow keeps the visualization reactive: the store is the single source of
truth and every component re-renders whenever its slice of the state changes.