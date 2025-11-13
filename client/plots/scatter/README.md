
# Scatters, Run Chart, and Frequency Chart Documentation

This folder provides several types of scatter plots and related visualizations for exploring relationships between variables in your data. The available scatter plot types include:

- **Standard Scatter Plot:** For visualizing the relationship between two variables or a predefined scatter plot such as a TSNE or UMAP.
- **2D Large Scatter Plot:** Optimized for high-density datasets with thousands or millions of points.
- **3D Scatter Plot:** For exploring relationships among three variables in three-dimensional space.

Each plot type supports adding variables for coloring, filtering, and provides an interactive exploration, making them suitable for a wide range of data analysis tasks.
---

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
**Functionality:**
- Visualizes correlation or association between two variables.
- Supports tooltips, zoom, and pan for interactive exploration.
- Can be configured to highlight or filter by group, cohort, or other attributes.

---

## 3D Scatter Plot
**Class:** [scatter3d.js](./scatter3d.js)  
**Title:** 3D Scatter Plot for Multivariate Data  
**Description:** The 3D scatter plot visualizes the relationship among three quantitative variables for each data point. Each point is positioned in three-dimensional space according to its X, Y, and Z values, allowing users to explore more complex data relationships and patterns.  
**Functionality:**
- Visualizes associations among three variables in a 3D space.
- Supports interactive rotation and zoom for data exploration.

---


## 2D Large Scatter Plot
**Class:** [scatterLarge.js](./scatterLarge.js)  
**Title:** 2D Large Scatter Plot for High-Density Data  
**Description:** The 2D large scatter plot is optimized for visualizing very large datasets with thousands or millions of points. It uses efficient rendering techniques to display dense data without sacrificing interactivity.  
**Functionality:**
- Efficiently visualizes high-density bivariate data.
- Supports zoom, pan, and selection for detailed exploration.
- Can be configured to highlight clusters, outliers, or specific groups.

---
## Customization: Colors, Shapes, and Controls

Scatter plots in this library support extensive customization through interactive controls, allowing users to tailor the visualization to their analysis needs. These controls are dynamically generated in the UI via the `setControls` and `getControlInputs` methods.

### Supported Controls

- **Color:** Assigns colors to points based on a selected variable (categorical or continuous). This helps distinguish groups or highlight gradients in the data.
- **Shape:** Assigns different shapes to points based on a categorical variable, making it easy to visually separate groups.
- **Size:** Adjusts the size of points, either globally or by mapping to a variable (e.g., sample size, reference size).
- **Opacity:** Controls the transparency of points, useful for visualizing dense datasets.
- **Axes and Layout:** Options to show/hide axes, set chart width/height, and save zoom/pan state.
- **Contour Map:** Option to overlay a density contour map, which can be weighted by a continuous variable.
- **Scale Order:** Allows users to choose ascending or descending order for scaling.
- **Other:** Additional controls for minimum/maximum shape size, and more.

These controls are accessible in the plot’s UI and are managed by the ViewModel, ensuring that changes are immediately reflected in the visualization. This flexibility enables users to explore their data from multiple perspectives and uncover deeper insights.
---


## Run Chart
**Class:** [runchart.js](./runchart.js)  
**Title:** Run Chart for Temporal Trends  
**Description:** The run chart displays data points in chronological order, typically to visualize trends, shifts, or cycles over time. It is commonly used for quality improvement, monitoring processes, or any time-based data analysis.  
**Functionality:**
- Plots values over time to reveal trends or changes.
- Supports annotations for events or interventions.
- Allows filtering or highlighting by group or time period.

---


## Frequency Chart
**Class:** [frequencyChart.js](./frequencyChart.js)  
**Title:** Frequency Chart for Distribution Analysis  
**Description:** The frequency chart shows the number of events of the variable requested, accumulated over time
**Functionality:**
- Visualizes the distribution and spread of data.

---


## Data Access and Filtering

All charts retrieve their data from backend endpoints, using filter settings and user context to ensure appropriate data access. 


## Conclusion

These visualizations provide users with powerful tools to analyze relationships and trends in their data. By supporting multiple customizations from the controls, the scatter, run, and frequency charts help users gain actionable insights from complex datasets across a wide range of applications.
