
## Introduction

The [`PrOFILE dashboard`](http://localhost:3000/profile/?role=admin) provides several interactive visualizations to explore and analyze data from participating hospitals. These plots are configured in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) and are available for both "Full" and "Abbreviated" PrOFILE versions. The Full Version is a “look within”, an institutional journey meant for institutions that want to define a local improvement strategy. The Abbreviated Version is a “look across” institutions; it is a multisite, collaborative journey that illustrates the PHO resource landscape for a subnational, national, or regional group of facilities.

 The plots within the PrOFILE dashboard inherit from the base [`profilePlot`]((../profilePlot.js)) that encapsulates common functionalities such as the data fetching and the creation of the chart filters. Each specific plot type (e.g., `profilePolar`, `profileBarchart`) inherits from this base component extending its logic to render their unique visualization. This structure promotes code reuse and consistency across the different plots. 

The charts retrieve their data by calling dedicated or shared server endpoints, depending on the type of visualization. Most plots, such as polar, radar, and the profile barchart use the `termdb/profileScores` endpoint to obtain aggregated scores for each module or domain. The `profileForms` plot calls `termdb/profileFormScores` to fetch detailed, question-level survey responses per domain. Newer plots such as `profilePolar2` use their own dedicated endpoint (`termdb/profilePolar2Scores`), establishing a pattern where each plot owns its route and data logic independently. 

### Term ID conventions

Every cohort-specific term ID is prefixed `F` (Full) or `A` (Abbreviated): facility term `FUNIT`/`AUNIT`, filter terms `Fcountry`/`Acountry` (and `WHO_region`, `Income_group`, `FC_TypeofFacility`, `FC_TeachingFacility`, `FC_ReferralFacility`, `FC_FundingSrc`, `PO_HospitalVolume`, `Year_implementation`), score terms `FX24`/`AX117`, etc.

The convention is used in:

1. `profilePlot.ts` — `getProfilePlotConfig` / `loadFilterTerms` concatenate the prefix with the rest of the term ID.
2. `profile.{polar2,barchart2,radar2,radarFacility2}.ts` — `derivePrefix(query)` scans request term IDs and builds `${prefix}UNIT`.

**Exception: `profile.forms2.ts`** — forms2's score terms are `POC*`-prefixed, so it reads `facilityTW.id` from the dataset config (`plotConfigByCohort[cohort].profileForms2.facilityTW.id`) instead.

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


### Polar Chart v2 (profilePolar2)
**Class:** [polar2.ts](./polar2.ts)
**Server route:** [`profile.polar2.ts`](../../../../server/routes/profile.polar2.ts) at endpoint `termdb/profilePolar2Scores`
**Title:** Score-based Results by PrOFILE Module (v2)
**Description:** A redesigned polar chart that establishes the per-plot dedicated route architecture. Visually identical to the original polar chart but with a cleaner, more secure data flow.

**Key differences from the original Polar Chart:**

- **Dedicated server route:** Uses `termdb/profilePolar2Scores` instead of the shared `termdb/profileScores`. This is the first plot with its own route — future plots (radar, barchart, forms) will follow the same pattern.
- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the correct facility term (`FUNIT` for full cohort, `AUNIT` for abbreviated) by inspecting term ID prefixes already present in the request (`scoreTerms` or `filter`), eliminating any client influence over which facility term is used.
- **Always aggregated:** Always returns the median percentage across all eligible sites. There is no single-site mode — when only one site is accessible, the median of a single value equals that value.
- **Minimal client payload:** The client strips `scoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`. No `facilityTW`, no `$id`, no client-only term wrapper properties are sent.
- **Consistent eligible sample scoping:** `eligibleSamples` is filtered to `userSites` only when `filterByUserSites` is explicitly `true`. When `filterByUserSites` is `false`, the median is computed across all sites (global aggregate), consistent with the original polar chart.
- **Public role security:** `sites` is always `[]` for public users in both this route and `termdb/profileScores` — no site IDs or names are ever exposed to public-role users.
- **Cleaner rendering structure:** The `plot()` method is split into focused private methods (`createSvg`, `drawGrid`, `drawArcs`, `drawTable`, `drawLegend`) instead of one large function.
- **Documentation icon:** The help icon in the controls panel is enabled for `profilePolar2` in [`controls.btns.js`](../../plots/controls.btns.js). Clicking it opens the polar graph PDF for the active cohort (Abbreviated or Full), configured in [`profilePlot.ts`](./profilePlot.ts).

**Calculation:** Identical to the original polar chart — for each module, computes `(score / maxScore) * 100` per eligible site, then returns the median across all eligible sites, rounded to the nearest integer.

**Role and cohort coverage:**

| Role | `filterByUserSites` | Eligible samples | `sites` in response |
|------|---------------------|-----------------|---------------------|
| Public | false | All sites | `[]` (never exposed) |
| Admin | false | All sites | Full sorted list |
| Site user | false | All sites (global aggregate) | Full sorted list |
| Site user | true | User's sites only | User's sites only |

Both Full (`FUNIT`) and Abbreviated (`AUNIT`) cohorts are handled automatically — `derivePrefix()` reads the `F`/`A` prefix from term IDs already present in the request, requiring no cohort-specific logic on the client.


### Bar Chart v2 (profileBarchart2)
**Class:** [barchart2.ts](./barchart2.ts)
**Server route:** [`profile.barchart2.ts`](../../../../server/routes/profile.barchart2.ts) at endpoint `termdb/profileBarchart2Scores`
**Title:** Score-based Results for the Component by Module and Domain (v2)
**Description:** A redesigned bar chart that follows the per-plot dedicated route architecture established by `profilePolar2`. Visually identical to the original bar chart but with a cleaner, more secure data flow.

**Key differences from the original Bar Chart:**

- **Dedicated server route:** Uses `termdb/profileBarchart2Scores` instead of the shared `termdb/profileScores`. Same pattern as `profilePolar2` — each v2 plot owns its route and data logic independently.
- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the correct facility term (`FUNIT` for full cohort, `AUNIT` for abbreviated) by inspecting term ID prefixes already present in the request (`scoreTerms` or `filter`), eliminating any client influence over which facility term is used.
- **Always aggregated:** Always returns the median percentage across all eligible sites. There is no single-site mode — when only one site is accessible, the median of a single value equals that value.
- **Minimal client payload:** The client strips `scoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`. No `facilityTW`, no `$id`, no client-only term wrapper properties are sent.
- **Consistent eligible sample scoping:** `eligibleSamples` is filtered to `userSites` only when `filterByUserSites` is explicitly `true`. When `filterByUserSites` is `false`, the median is computed across all sites (global aggregate).
- **Public role security:** `sites` is always `[]` for public users — no site IDs or names are ever exposed to public-role users.
- **Cleaner rendering structure:** The `plot()` method is split into focused private methods (`createSvg`, `drawTitleAndDefs`, `drawColumnHeaders`, `drawComponentRows`, `drawGuideLines`, `drawLegend`) instead of one large function.
- **Documentation icon:** The help icon in the controls panel is enabled for `profileBarchart2` in [`controls.btns.js`](../../plots/controls.btns.js). Clicking it opens the same bar graph PDF as `profileBarchart` for the active cohort.

**Calculation:** Identical to the original bar chart — for each score term, computes `(score / maxScore) * 100` per eligible site, then returns the median across all eligible sites, rounded to the nearest integer. Each row in the `plotByComponent` groups contributes `term1` (objective) and, when present, `term2` (subjective) into the flat `scoreTerms` list sent to the server.

**Plot configuration:** Shares the same `plotByComponent` configuration as `profileBarchart` in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) — the v2 difference is architectural (route + data flow), not config shape.

**Role and cohort coverage:**

| Role | `filterByUserSites` | Eligible samples | `sites` in response |
|------|---------------------|-----------------|---------------------|
| Public | false | All sites | `[]` (never exposed) |
| Admin | false | All sites | Full sorted list |
| Site user | false | All sites (global aggregate) | Full sorted list |
| Site user | true | User's sites only | User's sites only |


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

### Templates v2 (profileForms2)
**Class:** [forms2.ts](./forms2.ts)
**Server route:** [`profile.forms2.ts`](../../../../server/routes/profile.forms2.ts) at endpoint `termdb/profileForms2Scores`
**Description:** A redesigned Templates plot following the per-plot dedicated route architecture established by `profilePolar2`. Visually identical to v1 once a domain is picked. The picker UX, however, is different: chart types are categorized as **horizontal tabs at the top** of the picker, and each tab shows a domain dictionary filtered to only domains that offer that chart type.

**Picker UX (chart-type tabs above a filtered domain tree):** Clicking the `Templates 2` button opens a popover with horizontal tabs — one tab per chart type — and an embedded term-picker dictionary below. Switching tabs re-mounts the dictionary with a different chart-type filter, so the user can browse by chart type instead of seeing every domain mixed together.

The picker UI is defined entirely in [`mass/charts.js`](../../mass/charts.js) (`self.showFormsToggleTree`) — the generic [`tree.js`](../../termdb/tree.js) component is untouched. The same `Tabs` component used inside the rendered chart (Yes/No vs Likert) is reused for the picker tabs.

`termdbConfig.profileForms2Domains` (`Record<cohortKey, Record<domainId, friendlyLabel[]>>`) drives the tab list and per-tab tree filter. Lazy-built on first `/termdb/config` request for the dataset and cached on `tdb` (helper [`getProfileForms2Domains`](../../../../server/routes/profile.forms2.config.ts) — invoked from [`termdb.config.ts`](../../../../server/routes/termdb.config.ts) as a thin pass-through). No startup cost, populated when the first client connects. An empty inner submap (e.g., Abbreviated today) triggers the picker's empty-state message.

[`isUsableTerm`](../../../../shared/utils/src/termdb.usecase.js) `case 'profileForms2'` honors `usecase.cohort` and `usecase.subtype` (set by the picker): depth-3 gets `'plot'` only if `profileForms2Domains[cohort][term.id]` includes the active subtype; depth-1/2 gets `'branch'` only if any descendant matches. Terms with empty `uses` are entirely excluded by `tree.js`'s filter.

**Key differences from v1 Templates:**

- **Dedicated server route:** Uses `termdb/profileForms2Scores` instead of the shared `termdb/profileFormScores`. Same pattern as the other v2 plots — each plot owns its route and data logic independently.
- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the correct facility term (`FUNIT` for full cohort, `AUNIT` for abbreviated) from `__protected__.activeCohort`.
- **Always aggregated:** The server returns the combined categorical dict across all eligible sites. There is no single-site `sampleData` shortcut.
- **Minimal client payload:** The client strips `scoreTerms` and `scScoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`.
- **Public role security:** `sites` is always `[]` for public users.
- **Cohort coverage:** Wired in both Full and Abbreviated cohort configs. Functional in Full today; Abbrev is dead config until `A*`-prefixed multivalue templates land in the DB.

**Response shape:** `term2Score: { [termId]: { [category]: number } }` — same as v1.

**Plot configuration (shared across v1/v2):** A single module-level constant `profileFormsOptions` in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) defines the `options[]` array, referenced by `full.profileForms`, `full.profileForms2`, and `abbrev.profileForms2`. Single source of truth — v1 and v2 cannot drift, and full/abbrev cannot drift.

**Domain × chart-type availability (sjglobal `db.6` snapshot, full cohort):**

| Domain (parent_id) | Yes/No Barchart | Likert Scale |
|---|---:|---:|
| `FContext__National Context__Care Access and Utilization` | 4 | — |
| `FContext__Facility and Local Context__Facility Basic Amenities` | — | 5 |
| `FContext__Finances and Resources__Families/Patients` | — | 42 |
| `FDiagnostics__Diagnostics__General Laboratory` | — | 11 |
| `FWorkforce__Service Integration__Communication` | — | 40 |

Counts are template questions per domain. To regenerate this table after a DB change:

```sql
SELECT parent_id, json_extract(jsondata, '$.subtype') AS subtype, COUNT(*) AS cnt
FROM terms
WHERE type='multivalue' AND json_extract(jsondata, '$.subtype') IS NOT NULL AND parent_id IS NOT NULL
GROUP BY parent_id, subtype
ORDER BY parent_id;
```

(The JSON field is `subtype`. The `get_multivalue_tws` function in `server/src/termdb.sql.js` queries `$.plotType` and is dead code; the live multivalue handler is in [`termdb.server.init.ts`](../../../../server/src/termdb.server.init.ts) which JSON-parses `jsondata` so all fields including `subtype` reach the client.)

## Conclusion
These plots collectively provide a comprehensive toolkit for users to analyze PrOFILE data from a high-level summary down to individual data points. The PrOFILE dashboard is designed to empower institutions and collaborative groups to explore, benchmark, and improve pediatric oncology care using interactive, data-driven visualizations. With flexible filters, site-based access, and a variety of plot types, users can gain insights from high-level summaries down to individual survey responses.




