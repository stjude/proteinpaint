
# Scatters

This folder contains the scatter plot and related components. The scatter plot allows to see the relationship between two or three numerical variables in your data. A scatter plot may also be generated using date variables as input, please see the runchart and the frequency chart fore more details.


- [Run Chart README](../runchart/README.md) 
- [Frequency Chart README](../frequencyChart/README.md)

The available scatter plot types include:

- **Standard Scatter Plot:** For visualizing the relationship between two variables or a predefined scatter plot such as a TSNE or UMAP.
- **2D Large Scatter Plot:** Optimized for high-density datasets with thousands or millions of points.
- **3D Scatter Plot:** For exploring relationships among three variables in three-dimensional space.

Each plot type supports adding variables for coloring, filtering, and provides an interactive exploration, making them suitable for a wide range of data analysis tasks.


## Component Organization and MVVM Pattern

The scatter plot components are organized using the Model-View-ViewModel (MVVM) architectural pattern. This approach separates the data (Model), the user interface (View), and the logic that connects them (ViewModel), resulting in a modular and maintainable codebase.

- **Model:** Handles the underlying data, including the dataset to be visualized, filtering, and any computed properties or statistics.
- **View:** Responsible for rendering the user interface, such as SVG elements, axes, points, tooltips, and interactive controls. The view listens for changes in the ViewModel and updates the display accordingly.
- **ViewModel:** Acts as an intermediary between the Model and the View. It manages the state, responds to user interactions, applies filters, and updates the Model or View as needed. The ViewModel exposes observables or events that the View can subscribe to for reactive updates.

---


## Scatter Plot

**Class:** [scatter.js](./scatter.js)  
**Title:** Scatter Plot for Bivariate Data  
**Description:** The scatter plot visualizes the relationship between two quantitative variables for each data point. The data point may also have a color, shape or size, based on additional variables.  

**ViewModel Architecture:** Each scatter plot is managed by its own ViewModel, which is a subclass of [`ScatterViewModelBase`](../scatter/viewmode/scatterViewModelBase.js). This base class provides shared logic for managing state, user interactions, and data transformations. Each specific scatter plot type (2D, 3D, large) creates its own ViewModel instance, extending or customizing the base functionality as needed. This design ensures consistency and reusability across different scatter plot implementations.

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
**Class:** [scatter3d.js](./scatter3d.js)  
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
**Class:** [scatterLarge.js](./scatterLarge.js)  
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
