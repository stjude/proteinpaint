# MASS UI

## Introduction

The MASS UI is primarily designed to visualize cohort-based genomic and clinical data.
Samples are annotated by dictionary and other term types. A MASS UI user may easily 
render these annotation data into interactive charts and plots, and dynamically filter,
group, and partition cohort data to detect, analyze, and evaluate relevant patterns.

The MASS UI uses the `rx` framework to coordinate application state changes, and to 
avoid or minimize shared mutable component properties and methods. The state-based approach
simplifies saving and recovery of MASS UI session/views. The component-api based notification 
and lifecycle event notification (postInit, postRender, etc) simplifies synchronization of
changes that may affect multiple components, such as decrementing the number in the 
CHARTS navigation tab when a plot is deleted. 


## app.js

This is the wrapper application code for the MASS UI. It is initialized by `rx` with a dispatch
method to notify the store and child components of state changes. It also creates or deletes 
`state.plots[]` entries using `summary` or `plot.js` code.

## store.js

This is the state manager. All tracked-state changes from an `app.dispatch()` is processed first by
a corresponding store method. After `rx` writes dispatched changes to its internal state object,
it returns an immutable (deep-frozen) state copy to the `app`, which uses the read-only state to
notify all components in the app.

## nav.js

The `nav` component displays tabs at the top of the MASS UI. They may be thought of as a way for the 
app to switch to different features. 

### charts.js

The `charts` component is exposed as a tab by `nav`. Within it's tray or subheader, different
chart buttons are shown as applicable to the current dataset.

### groups.js

The `groups` component is exposed as a tab by `nav`. Within it's tray or subheader, a user may create
or reuse groups to partition the visualized cohort.

### filter

The nav `FILTER` tab uses `client/filter/FilterRxComp` to allow a user to create arbitrary cohort filters
using annotation terms.

### sessionBtn.js

This code handles saving, sharing, and recovery of MASS UI sessions.

## plot.js

This code is used by `app` to create a new `app.components.plot[]` instance based on a newly detected `state.plots[]` entry.


