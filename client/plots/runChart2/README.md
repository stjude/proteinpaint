# RunChart2 Documentation

## Introduction

RunChart2 is a time-series visualization for plotting data points in chronological order, revealing trends, shifts, or cycles over time. It is commonly used for quality improvement and time-based data analysis.

The chart uses a date variable from the dictionary (e.g., the date of admission) as input. The dates are ordered chronologically and grouped by month. The X axis shows a time scale where each month becomes a tick, and each data point is plotted in its corresponding month. The number of data points in a month represents the Y value for that month.

RunChart2 connects the data points and adds a median line by calculating the middle value of the data and drawing a horizontal line across the chart.

## Features

- Plots values over time for one or more groups
- Interactive controls for data exploration and customization
- Support for dividing data by time periods or other dimensions
- Configurable aggregation methods (median)
- Full immutability pattern preventing unintended state mutations

## Architecture

RunChart2 follows a modular design with clear separation of data, view, and logic:

- **[RunChart2.ts](./RunChart2.ts)**: Main component that orchestrates the plot lifecycle
- **[RunChart2Controls.ts](./RunChart2Controls.ts)**: Defines interactive controls for the plot
- **[RunChart2Model.ts](./model/RunChart2Model.ts)**: Handles data fetching and preparation
- **[RunChart2ViewModel.ts](./viewModel/ViewModel.ts)**: Manages view state and reactivity
- **[RunChart2View.ts](./view/View.ts)**: Renders the D3-based visualization

## Technical Implementation

### Data Flow and Aggregation

RunChart2 fetches data from the server endpoint `termdb/runChart`, which performs server-side aggregation to group time-series data by month. The aggregation method available is:

- **Median**: Middle value of sorted data points in each bucket

The server-side function `buildRunChartFromData()` converts decimal year values (e.g., 2023.83) into monthly buckets and calculates the aggregated Y value for each month, along with metadata like sample counts.

### Term Configuration

RunChart2 uses a two-term configuration:
- **xtw (X term wrapper)**: The date term, must be of type `date`. Can operate in:
  - **Continuous mode**: Single series aggregated across all dates
  - **Discrete mode**: Multiple series partitioned by time periods (e.g., by year)
- **ytw (Y term wrapper)**: The numeric term being measured (float/integer type)





## Conclusion

RunChart2 provides a powerful tool for visualizing time-series data, enabling users to detect trends, shifts, and cycles in processes over time. By leveraging aggregation and interactive controls, it helps reveal underlying patterns that may not be apparent in raw data. Its modular architecture ensures flexibility and extensibility for diverse analytical needs.