# Frequency Chart Documentation
# Related Documentation:
- [Scatter Plot README](../scatter/README.md)
- [Run Chart README](../runchart/README.md)


## Introduction
The frequency chart was designed to build the sjcares regsitry accrual plot.  The accrual is a visualization tool, often used in clinical trials, that tracks the rate at which participants are recruited over time. The frequency chart receives as input a date variable and shows the accumulated frequency of events over time.


## How Frequency Chart Plotting Works

The core logic for rendering a frequency chart is implemented in the `FrequencyChartModel` class, which extends the base `RunchartModel`. The key method is `createChart`, which is specifically overwritten to handle the unique requirements of frequency charts.

### The `createChart` Method

- **Grouping Samples:** The method first groups the input samples by month and year, using the sample’s `x` value (typically a date or time value). This allows the chart to aggregate counts for each time interval.
- **Sorting and Counting:** The grouped samples are sorted chronologically. For each group (month-year), the method calculates the count of samples and, if cumulative frequency is enabled, maintains a running total.
- **Setting Coordinates:** Each sample’s `x` coordinate is set to the middle of the month, and the `y` coordinate is set to either the count for that interval or the cumulative count, depending on the chart settings.
- **Legend Construction:** Color and shape legends are constructed from the input data, supporting visual differentiation of groups or categories.
- **Chart Assembly:** The processed data, legends, and event values are assembled into a chart object and pushed to the model’s `charts` array for rendering.

### Why Overwrite?

By overwriting `createChart`, the frequency chart can implement custom logic for binning, counting, and cumulative calculations that differ from the base run chart or scatter chart logic. This approach allows for flexible extension and ensures that each chart type can tailor its data processing and rendering to its specific needs.

## Conclusion
Frequency charts are essential for clinical trial monitoring, and any scenario where understanding recruitment or event rates is critical. By leveraging custom binning and cumulative calculations, frequency charts offer deep insights into temporal patterns and trends. For complementary visualizations and further analysis, see the scatter and run chart documentation.
