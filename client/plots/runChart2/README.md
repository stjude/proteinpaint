# RunChart2 Documentation

## Introduction

RunChart2 is a time-series visualization for plotting data points in chronological order, revealing trends, shifts, or cycles over time. It is commonly used for quality improvement and time-based data analysis.

RunChart2 supports two modes with the same component and API:

- **Run chart**: Date (X) vs a numeric term (Y). The chart uses a date variable from the dictionary (e.g., date of admission). Dates are ordered chronologically and grouped by month. The X axis is a time scale where each month is a tick; the Y axis shows the selected numeric value (e.g., median) per month. Data points are connected and a median line is drawn.
- **Frequency chart**: Date (X) only—no Y term. The same time scale by month is used; the Y axis shows **count** (samples per month) or **cumulative count** when "Show cumulative frequency" is enabled. Implemented as RunChart2 with `ytw` omitted; the server returns count/cumulative series from the same `termdb/runChart` endpoint. A median line is drawn for count frequency but not for cumulative frequency (where it is not meaningful).

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

The server supports:
- **Run chart**: `buildRunChartFromData()` converts decimal year values (e.g., 2023.83) into monthly buckets and calculates the aggregated Y value (e.g., median) for each month, with metadata like sample counts.
- **Frequency**: `buildFrequencyFromData()` buckets samples by month and returns count per month, or cumulative count when `showCumulativeFrequency` is true.

### Tooltip and median line

- **Tooltip**: In frequency mode, the tooltip always shows the plotted value (Count or Cumulative count) as the first value row. In cumulative mode, a second row "Sample Count" shows the per-month sample count when it differs from the plotted value. In run chart mode, the tooltip shows the Y value and Sample Count.
- **Median line**: Drawn for run chart and for frequency in count mode; not drawn for frequency in cumulative mode.

### Term Configuration

RunChart2 uses a two-term configuration:
- **xtw (X term wrapper)**: The date term, must be of type `date`. Can operate in:
  - **Continuous mode**: Single series aggregated across all dates
  - **Discrete mode**: Multiple series partitioned by time periods (e.g., by year)
- **ytw (Y term wrapper)**: Optional. When present, the numeric term is measured (float/integer) and aggregated (e.g., median) per month—**run chart** mode. When omitted, **frequency** mode: Y is count or cumulative count per month; the setting `showCumulativeFrequency` is sent to the server and controls the Y axis label and values.





## Conclusion

RunChart2 provides a powerful tool for visualizing time-series data, enabling users to detect trends, shifts, and cycles in processes over time. By leveraging aggregation and interactive controls, it helps reveal underlying patterns that may not be apparent in raw data. Its modular architecture ensures flexibility and extensibility for diverse analytical needs.