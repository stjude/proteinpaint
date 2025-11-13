
## Introduction

The [`PrOFILE dashboard`](http://localhost:3000/profile/?role=admin) provides several interactive visualizations to explore and analyze data from participating hospitals. These plots are configured in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) and are available for both "Full" and "Abbreviated" PrOFILE versions. The Full Version is a “look within”, an institutional journey meant for institutions that want to define a local improvement strategy. The Abbreviated Version is a “look across” institutions; it is a multisite, collaborative journey that illustrates the PHO resource landscape for a subnational, national, or regional group of facilities.

 The plots within the PrOFILE dashboard inherit from the base [`profilePlot`]((../profilePlot.js)) that encapsulates common functionalities such as the data fetching and the creation of the chart filters. Each specific plot type (e.g., `profilePolar`, `profileBarchart`) inherits from this base component extending its logic to render their unique visualization. This structure promotes code reuse and consistency across the different plots. 

The charts retrieve their data by calling either the termdb.profileScores or termdb.profileFormScores endpoint, depending on the type of visualization. Most plots, such as polar, radar, and the profile barchart use the termdb.profileScores endpoint to obtain aggregated scores for each module or domain. In contrast, the profileForms plot calls the termdb.profileFormScores endpoint to fetch detailed, question-level survey responses per domain. 

### How Filters Are Implemented

Each plot in the PrOFILE dashboard includes a set of filters implemented by the `profilePlot` class. These filters allow users to refine the data displayed in the visualizations based on key attributes of participating hospitals or survey responses.

- Filters are defined in the plot configuration (see `filterTWs` in the code).
- The `profilePlot` class uses these filter term wrappers to build dropdowns and other input controls for the user interface.
- Filter options are dynamically populated based on the current settings.

### Typical Filters Added to Each Plot

The following filters are available across all profile plots:

- **Region:** Selects the WHO region of the facility.
- **Country:** Filters by country.
- **Income Group:** Filters by World Bank income classification.
- **Facility Type:** Filters by the type of healthcare facility.
- **Teaching Status:** Filters by whether the facility is a teaching hospital.
- **Referral Status:** Filters by whether the facility is a referral center.
- **Funding Source:** Filters by the primary funding source.
- **Hospital Volume:** Filters by the annual number of new diagnoses.
- **Year of Implementation:** Filters by the year the PrOFILE was implemented.
- **Sites:** Allows selection of one or more specific sites (for users with access).

The sites filter is not shown in the public view, as the public users can only see aggregated data. In the user view they are shown, restricting the list of 
sites to the ones accessible to the user.

When a user selects a filter value, the plot settings are updated and the data is re-fetched to reflect the new filter. Filter controls are rendered in the plot’s UI, and their state is managed by the `profilePlot` class. The main logic for adding and managing filters is in the `setControls` method of `profilePlot`.
Filter term wrappers (`filterTWs`) are loaded and populated in the configuration setup (`loadFilterTerms`).

### Data Access and User Filter

Data visibility is strictly controlled based on the user's role and access to sites, which is determined upon login. The `sjglobal.profile.ts` configuration defines how filters are applied for each role:

*   **Admin:** Administrators have unrestricted access to all data across all participating institutions. No site-based filters are applied.
*   **Site-Level User:** Users are associated with one or more institutions. A filter is automatically applied to most of the queries to restrict data to only their assigned sites, unless the data returned is aggregated and therefore deidentified. This allows the users to see their own data and compare it with aggregated data from all other sites.
*   **Public:** Public users can only view aggregated data. They do not have access to any institution-specific information.

This role-based filtering is managed by the `getAdditionalFilter` function in the dataset configuration, which dynamically handles the data queries based on the user's `clientAuthResult`. Certain charts, like the `profileRadarFacility` chart, are hidden entirely for public users.

Here is a breakdown of the main plot types:


### Polar Chart
**Class:** [profilePolar.js](../profilePolar.js)  
**Title:** Score-based Results by PrOFILE Module  
**Description:** This chart provides a high-level overview of the aggregated performance across different PrOFILE modules. Each slice of the polar represents a module (e.g., 'National Context', 'Personnel', 'Diagnostics').  
**Calculation:** For each module, a percentage score is calculated for every participating institution by dividing its score by the maximum possible score. The value shown on the chart for each module is the **median** of these percentage scores across all institutions included in the current filter. This gives a snapshot of the central tendency of performance in each area.


### Facility Radar Chart
**Class:** [profileRadarFacility.js](../profileRadarFacility.js)  
**Title:** Comparison of Institutional and Aggregated Score-based Results by Module  
**Description:** This radar chart is designed for authenticated users (Site-Level Users and Administrators) to compare their own institution's performance against the aggregated results from all participating institutions.  
**Functionality:**
	- Institutional Score: The score of the user's specific institution for each module.
	- Aggregated Score: The aggregated score for each module across all institutions.
	- Allows institutions to benchmark their performance and identify areas of relative strength or weakness.


### Radar Chart
**Class:** [profileRadar.js](../profileRadar.js)  

This chart type has different configurations for the "Full" and "Abbreviated" PrOFILE versions.

#### Full PrOFILE
This chart allows for a comparison between two different respondent groups within an institution. Users can select from two different comparison views:  
	- **Impressions Comparison:** Compares the subjective "impressions" (on a scale of 1-10) of the Site Coordinator versus the Point of Care (POC) Staff for each module.  
	- **Score-based Results Comparison:** Compares the objective, calculated scores from the responses of the Site Coordinator versus the POC Staff for each module.  

#### Abbreviated PrOFILE
This chart compares two different metrics for the same respondent group for each module.  
**Title:** Comparison of Score-based Results and End-User Impressions by Module  
**Functionality:** It plots the calculated Total Score against the subjective End-User Impression for each module, allowing users to see how objective capabilities align with perceived performance.  


### Bar Chart
**Class:** [profileBarchart.js](../profileBarchart.js)  
**Title:** Score-based Results for the Component by Module and Domain Compared with End-User Impression  
**Description:** This is a detailed, multi-level bar chart that breaks down the scores into more granular levels. It groups domains within larger components (like 'Context', 'Workforce', 'Diagnostics', 'Therapy', and 'Patients and Outcomes').  
**Functionality:**
	- It visualizes scores for each domain within a module.
	- For Full PrOFILE: It presents a side-by-side comparison of scores derived from "Objective data" (from Site Coordinator and MD Lead) and "Subjective data" (from Point of Care Staff).
	- For Abbreviated PrOFILE: For each module, it displays the calculated scores for its constituent domains and also shows the overall "End-user Impression" score for that module as a separate bar for comparison.


### Templates/Forms
**Class:** [profileForms.js](../profileForms.js)  
**Description:** This type of chart known as Templates for the users, allows for the visualization of the amount of response per type of response for each individual questions from the PrOFILE survey, which are not aggregated into scores. This is useful for detailed analysis of specific data points.  
**Plot Types:**
	- Yes/No Barchart: For questions with "Yes", "No", or "Do Not Know" as possible answers, this chart shows the distribution of responses.
	- Likert Scale: For questions based on a Likert scale (e.g., 'Almost Never' to 'Almost Always'), this chart displays the frequency of each response, often colored by module to maintain consistency with other plots.

## Conclusion
These plots collectively provide a comprehensive toolkit for users to analyze PrOFILE data from a high-level summary down to individual data points. The PrOFILE dashboard is designed to empower institutions and collaborative groups to explore, benchmark, and improve pediatric oncology care using interactive, data-driven visualizations. With flexible filters, site-based access, and a variety of plot types, users can gain insights from high-level summaries down to individual survey responses.




