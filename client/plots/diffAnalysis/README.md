# Differential Analysis App
The app is designed to launch plots as components. To share data between components, use DiffAnalysisInteractions.

The differential analysis plot is heavily dependent on the volcano plot data.

## Adding a term type
Ensure the following are completed. This is not a comprehensive list. Modify as needed.
- Add the components or modify the logic (see below).
- Update the array of enabledTermTypes. This is a sanity check. 

## Adding a component (ie. plot) to Diff Analysis app
Ensure the following are completed. This is not a comprehensive list. Modify as needed.
- Add the import statement for the plot in setComponents() for the correct termType or in a default
- Include the tab with callback for the config in DiffAnalysisView code. Use isVisible() to show/hide
plot by termType. 
- opts.controls in the component must receive dom.controls from the DA parent. This allows all plot controls
to appear in the same div. See the implementation in #plots/volcano/Volcano.ts
- Include logic for termTypes as necessary. 

### Version history
- Last updated: 13 Mar 25
- Authored: 6 Mar 25