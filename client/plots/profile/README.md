The PrOFILE dashboard provides several interactive visualizations to explore and analyze data from participating hospitals. These plots are configured in `sjglobal.profile.ts` and are available for both "Full" and "Abbreviated" PrOFILE versions. The Full Version is a “look within” – an institutional journey meant for institutions that want to define a local improvement strategy. The Abbreviated Version is a “look across” institutions; it is a multisite, collaborative journey that illustrates the PHO resource landscape for a subnational, national, or regional group of facilities.

## Technical Architecture

The PrOFILE dashboard provides several interactive visualizations to explore and analyze the data from their hospitals. These plots are configured in sjglobal.profile.ts and are available for both "Full" and "Abbreviated" PrOFILE versions. The Full Version is a “look within” – an institutional journey meant for institutions that want to define a local improvement strategy. The Abbreviated Version is a “look across” institutions; it is a multisite, collaborative journey that illustrates the PHO resource landscape for a subnational, national, or regional group of facilities.
The plots within the PrOFILE dashboard inherit from the base `profilePlot` that encapsulates common functionalities such as the data fetching and the creation of the chart filters.

Each specific plot type (e.g., `profilePolar`, `profileBarchart`) inherits from this base component extending its logic to render their unique visualization. This structure promotes code reuse and consistency across the different plots.

### Data Access and Filtering

Data visibility is strictly controlled based on the user's role, which is determined upon login. The `sjglobal.profile.ts` configuration defines how filters are applied for each role:

*   **Admin:** Administrators have unrestricted access to all data across all participating institutions. No site-based filters are applied.
*   **Site-Level User:** Users are associated with one or more institutions. A filter is automatically applied to all queries to restrict data to only their assigned sites. This allows them to see their own data and compare it with aggregated data from all other sites (where the number of sites is greater than a minimum threshold).
*   **Public:** Public users can only view aggregated data. They do not have access to any institution-specific information.

This role-based filtering is managed by the `getAdditionalFilter` function in the configuration, which dynamically handles the data queries based on the user's `clientAuthResult`. Certain charts, like the `profileRadarFacility` chart, are hidden entirely for public users.

Here is a breakdown of the main plot types:

1. Polar Chart (profilePolar)
Title: Score-based Results by PrOFILE Module
Description: This chart provides a high-level overview of the aggregated performance across different PrOFILE modules. Each slice of the polar represents a module (e.g., 'National Context', 'Personnel', 'Diagnostics').
How it's calculated: For each module, a percentage score is calculated for every participating institution by dividing its score by the maximum possible score. The value shown on the chart for each module is the median of these percentage scores across all institutions. This gives a snapshot of the central tendency of performance in each area.
How it's calculated: For each module, a percentage score is calculated for every participating institution by dividing its score by the maximum possible score. The value shown on the chart for each module is the **median** of these percentage scores across all institutions included in the current filter (which depends on the user's role and any active global filters). This gives a snapshot of the central tendency of performance in each area.
2. Facility Radar Chart (profileRadarFacility)
Title: Comparison of Institutional and Aggregated Score-based Results by Module
Description: This radar chart is designed for authenticated users (Site-Level Users and Administrators) to compare their own institution's performance against the aggregated results from all participating institutions.
Functionality: It plots two series on the same radar chart:
Institutional Score: The score of the user's specific institution for each module.
Aggregated Score: The aggregated score for each module across all institutions.
Availability: This chart is not available for public users, as it contains institution-specific data. It allows institutions to benchmark their performance and identify areas of relative strength or weakness.
3. Radar Chart (profileRadar)
This chart type has different configurations for the "Full" and "Abbreviated" PrOFILE versions.

For Full PrOFILE: This chart allows for a comparison between two different respondent groups within an institution. Users can select from two different comparison views:

Impressions Comparison: Compares the subjective "impressions" (on a scale of 1-10) of the Site Coordinator versus the Point of Care (POC) Staff for each module.
Score-based Results Comparison: Compares the objective, calculated scores from the responses of the Site Coordinator versus the POC Staff for each module.
For Abbreviated PrOFILE: This chart compares two different metrics for the same respondent group for each module.

Title: Comparison of Score-based Results and End-User Impressions by Module
Functionality: It plots the calculated Total Score against the subjective End-User Impression for each module, allowing users to see how objective capabilities align with perceived performance.
4. Bar Chart (profileBarchart)
Title: Score-based Results for the Component by Module and Domain Compared with End-User Impression
Description: This is a detailed, multi-level bar chart that breaks down the scores into more granular levels. It groups domains within larger components (like 'Context', 'Workforce', 'Diagnostics', 'Therapy', and 'Patients and Outcomes').
Functionality:
It visualizes scores for each domain within a module.
For Full PrOFILE: It presents a side-by-side comparison of scores derived from "Objective data" (from Site Coordinator and MD Lead) and "Subjective data" (from Point of Care Staff).
For Abbreviated PrOFILE: For each module, it displays the calculated scores for its constituent domains and also shows the overall "End-user Impression" score for that module as a separate bar for comparison.
5. Forms (profileForms)
Description: This section allows for the visualization of responses to individual questions from the PrOFILE survey, which are not aggregated into scores. This is useful for detailed analysis of specific data points.
Plot Types:
Yes/No Barchart: For questions with "Yes", "No", or "Do Not Know" as possible answers, this chart shows the distribution of responses.
Likert Scale: For questions based on a Likert scale (e.g., 'Almost Never' to 'Almost Always'), this chart displays the frequency of each response, often colored by module to maintain consistency with other plots.
These plots collectively provide a comprehensive toolkit for users to analyze PrOFILE data from a high-level summary down to individual data points.


