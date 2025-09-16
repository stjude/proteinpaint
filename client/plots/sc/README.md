_This document is a draft. App is in development_

# Single Cell App
The sc 'super' app is designed to showcase single cell data in multiple modalities. SC.ts is the parent component for the mass UI. The child components are launched based on the configuration in the dataset file from the parent. 

# Code architecture
_TODO_

## Subplots
Subplot creation and rendering: 
1. Subplots are first added as a plot to state.plots[] via app.dispatch(...'plot_create')
2. getState() in SC.ts filters for all plots with parentIds matching the SC id into subplots[]
3. main() in SC.ts iterates through all the subplots to check for a matching component. If none is found, the subplot is set as a component by the subplot.id and rendered. 

Once added as a component, the plot will update everytime app.dispatch is called. 