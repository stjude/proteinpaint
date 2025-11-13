# Run Chart Documentation
# Related Documentation:
- [Scatter Plot README](../scatter/README.md)
- [Frequency Chart README](../frequencyChart/README.md)


## Introduction
Run charts are used to visualize data points in chronological order, revealing trends, shifts, or cycles over time. They are commonly used for quality improvement and time-based data analysis.

## Features
- Plots values over time for one or more groups.
- Interactive controls for filtering, zooming, and adding colors or shapes using additional variables.

## Architecture
Run charts follow a modular design, with separation of data, view, and logic. The core of the run chart implementation is its ViewModel, [`RunChartViewModel`](./runChart.js), which extends the [`ScatterViewModelBase`](../scatter/scatter.js) used for scatter plots. This means the run chart inherits all the interactive features, state management, and customization options of the scatter plot, while adding specific logic for handling time-series data and run chart visualization. 

The `createChart` method in `RunchartModel` is responsible for assembling the chart data for the runchart visualization. It customizes the base scatter chart logic to support aggregation of data points by month and year, which is essential for runchart analysis.

This method overwrites the base scatter chart logic to enable runchart-specific aggregation and grouping, which is not present in the generic scatter plot. This allows users to visualize trends over time by grouping data points into monthly cohorts and applying statistical aggregation.

For further details, see [`runchartModel.ts`](./model/runchartModel.ts).

## Conclusion

Run charts provide a powerful tool for visualizing time-series data, enabling users to detect trends, shifts, and cycles in processes over time. By leveraging aggregation and interactive controls, run charts help reveal underlying patterns that may not be apparent in raw data. Their modular architecture, built on the scatter plot foundation, ensures flexibility and extensibility for diverse analytical needs. For related visualizations and deeper technical details, refer to the scatter and frequency chart documentation.
