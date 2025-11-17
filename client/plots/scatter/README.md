
# Scatters

This folder contains the scatter plot and related components. The scatter plot allows to see the relationship between two or three numerical variables in your data. 
The available scatter plot types include:

- **Standard Scatter Plot:** For visualizing the relationship between two variables or a predefined scatter plot such as a TSNE or UMAP.
- **2D Large Scatter Plot:** Optimized for high-density plots with thousands or millions of points.
- **3D Scatter Plot:** For exploring relationships among three variables in three-dimensional space.

A scatter plot may also be generated using __date__ variables as input, please see the runchart and the frequency chart for more details.


- [Run Chart README](../runchart/README.md): The runchart uses as input a date from the dictionary, it orders dates in chronological order and groups them by month. It uses as input a date variable from the dictionary, it may be date of admission, for example.  Then orders the dates in chronological order and groups them by month. The X axis shows a time scale, where each month becomes a tick. Each patient(date) is then plotted in its corresponding month, centered, and the number of patients that fall in a month become represents the Y value for that month.
- [Frequency Chart README](../frequencyChart/README.md): Similar to the runchart, it orders the dates in chronological order and groups them by month. The X axis shows a time scale, where each month becomes a tick. Each patient is plotted in its corresponding month, centered, and the number of patients registered until that time point becomes then the Y axis. In the frequency chart, the number of patients per month(dates) is counted accumulatively.


**ViewModel Architecture:** Each scatter plot is managed by its own ViewModel, which is a subclass of [`ScatterViewModelBase`](./viewmodel/scatterViewModelBase.ts). This base class provides shared logic for managing state, user interactions, and data transformations. Each specific scatter plot type (2D, 3D, large) creates its own ViewModel instance, extending or customizing the base functionality as needed. This design ensures consistency and reusability across different scatter plot implementations.
**Functionality:**
- Visualizes correlation or association between two variables.
- Supports tooltips, zoom, and pan for interactive exploration.
- Interactive controls allow users to customize the visualization:
	- **Color by:** Assign colors to points based on a selected variable (categorical or continuous), making it easy to distinguish groups or visualize gradients.
	- **Shape by:** Assign different shapes to points based on a categorical variable, visually separating sample groups.
	- **Size by:** Adjust the size of points globally or map to a variable (e.g., sample size, reference size) for additional data encoding.
	- **Opacity:** Control the transparency of points, which is especially useful for visualizing dense datasets and reducing overplotting.
	- **Axes and Layout:** Options to show/hide axes, set chart width/height, and save zoom/pan state for flexible display.
	- **Contour Map:** Overlay a density contour map, optionally weighted by a continuous variable, to highlight data distributions.
	- **Scale Order:** Choose ascending or descending order for scaling point sizes, supporting different analytical perspectives.
	- **Other Controls:** Additional options for minimum/maximum shape size and more, enabling fine-tuned customization.


## Component Organization and MVVM Pattern

The scatter plot components are organized using the Model-View-ViewModel (MVVM) architectural pattern. This approach separates the data (Model), the user interface (View), and the logic that connects them (ViewModel), resulting in a modular and maintainable codebase.

- **Model:** Handles the underlying data, including the dataset to be visualized, filtering, and any computed properties or statistics.
- **View:** Responsible for rendering the user interface, such as SVG elements, axes, points, tooltips, and interactive controls. The view listens for changes in the ViewModel and updates the display accordingly.
- **ViewModel:** Acts as an intermediary between the Model and the View. It manages the state, responds to user interactions, applies filters, and updates the Model or View as needed. The ViewModel exposes observables or events that the View can subscribe to for reactive updates.

---

**Classes Involved:**
- [`scatter.ts`](./scatter.ts): Main scatter plot component, orchestrates rendering and user interaction.
- [`model/scatterModel.ts`](./model/scatterModel.ts): Handles data loading, filtering and chart setup.
- [`viewmodel/scatterViewModelBase.ts`](./viewmodel/scatterViewModelBase.ts): Base ViewModel class, provides shared logic for state management and interactivity.
- [`viewmodel/scatterViewModel.ts`](./viewmodel/scatterViewModel.ts): Standard 2D scatter ViewModel, extends base functionality for SVG rendering and controls.
- [`viewmodel/scatterViewModel2DLarge.ts`](./viewmodel/scatterViewModel2DLarge.ts): ViewModel for high-density 2D scatter plots, optimized for large datasets and canvas rendering.
- [`viewmodel/scatterViewModel3D.ts`](./viewmodel/scatterViewModel3D.ts): ViewModel for 3D scatter plots, manages THREE.js scene and 3D interactivity.
- [`viewmodel/scatterLasso.ts`](./viewmodel/scatterLasso.ts): Implements lasso selection for interactive sample grouping.
- [`viewmodel/scatterLegend.ts`](./viewmodel/scatterLegend.ts): Manages color and shape legends for the chart.
- [`viewmodel/scatterTooltip.ts`](./viewmodel/scatterTooltip.ts): Handles tooltips and sample information display.
- [`viewmodel/scatterZoom.ts`](./viewmodel/scatterZoom.ts): Provides zoom and pan functionality for chart navigation.
- [`viewmodel/scatterInteractivity.ts`](./viewmodel/scatterInteractivity.ts): Manages user interactions and event handling.
- [`viewmodel/scatterLegendInteractivity.ts`](./viewmodel/scatterLegendInteractivity.ts): Adds interactivity to legend elements.
- [`scatterTypes.ts`](./scatterTypes.ts): Type definitions for chart, legend, and sample objects.


### Main Methods: ScatterModel
- **initData:** Fetches and initializes chart data, processes server response, and sets up chart objects.
- **createChart:** Constructs chart objects, determines if large rendering is needed, and builds legends.
- **initRanges:** Calculates axis ranges (min/max) for all charts, supporting user overrides and global settings.

### Main Methods: ScatterViewModel
- **renderSerie:** Renders the main chart series, including points and optional contours; delegates to base logic and adds custom features.
- **renderContours:** Draws density contours on the chart using D3, supporting both categorical and continuous variables.
- **addLegendSVG:** Creates and inserts the SVG legend for color and shape mappings.

---

## 3D Scatter Plot
**Class:** [viewmodel/scatterViewModel3D.ts](./viewmodel/scatterViewModel3D.ts)  
**Title:** 3D Scatter Plot for Multivariate Data  
**Description:** The 3D scatter plot visualizes the relationship among three quantitative variables for each data point. Each point is positioned in three-dimensional space according to its X, Y, and Z values, allowing users to explore more complex data relationships and patterns.  
**Functionality:**
- Visualizes associations among three variables in a 3D space.
- Supports interactive rotation and zoom for data exploration.

**Overwritten Methods:**
The 3D scatter plot is managed by `ScatterViewModel3D`, which extends the base `ScatterViewModel`. The key method overwritten is `renderSerie`, which:
- Sets up a 3D scene using THREE.js, including camera, axes, and interactive controls (OrbitControls).
- Maps data points to 3D coordinates and colors, using buffer geometry for efficient rendering.
- Handles contour map overlays and dynamic axis labeling for enhanced visualization.
- Implements custom event handling for zoom and rotation, providing a rich interactive experience.
Other helper methods, such as `renderContourMap` and `addLabels`, are also customized to support 3D-specific features.



## 2D Large Scatter Plot
**Class:** [viewmodel/scatterViewModel2DLarge.ts](./viewmodel/scatterViewModel2DLarge.ts)  
**Title:** 2D Large Scatter Plot for High-Density Data  
**Description:** The 2D large scatter plot is optimized for visualizing very large datasets with thousands or millions of points. It uses efficient rendering techniques to display dense data without sacrificing interactivity.  
**Functionality:**
- Efficiently visualizes high-density bivariate data.
- Supports zoom, pan, and selection for detailed exploration.
- Can be configured to highlight clusters, outliers, or specific groups.

**Overwritten Methods:**
The 2D large scatter plot is managed by `ScatterViewModel2DLarge`, which extends the base `ScatterViewModel`. The main method overwritten is `renderSerie`, which:
- Uses THREE.js to render large numbers of points efficiently on a canvas.
- Maps data points to 2D coordinates and colors, using buffer geometry and custom textures.
- Implements drag controls and custom zoom handling for smooth navigation.





## Conclusion

Scatter plots in this library offer a flexible and interactive framework for exploring complex relationships in multidimensional datasets. With support for advanced customization—such as coloring, shaping, sizing, and density contours—users can tailor visualizations to highlight patterns, clusters, and outliers. The modular MVVM architecture ensures maintainability and extensibility, while efficient rendering techniques enable analysis of both small and very large datasets. By leveraging these features, users can gain deeper insights, drive hypothesis generation, and support decision-making across diverse scientific and analytical domains.
