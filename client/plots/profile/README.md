
## Introduction

The [`PrOFILE dashboard`](http://localhost:3000/profile/?role=admin) provides several interactive visualizations to explore and analyze data from participating hospitals. These plots are configured in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) and are available for both "Full" and "Abbreviated" PrOFILE versions. The Full Version is a “look within”, an institutional journey meant for institutions that want to define a local improvement strategy. The Abbreviated Version is a “look across” institutions; it is a multisite, collaborative journey that illustrates the PHO resource landscape for a subnational, national, or regional group of facilities.

 The plots within the PrOFILE dashboard inherit from the base [`profilePlot`](./profilePlot.ts) that encapsulates common functionalities such as the data fetching and the creation of the chart filters. Each specific plot type (e.g., `profilePolar2`, `profileBarchart2`) inherits from this base component extending its logic to render their unique visualization. This structure promotes code reuse and consistency across the different plots. 

Each chart owns a dedicated server endpoint and data logic: `termdb/profilePolar2Scores`, `termdb/profileBarchart2Scores`, `termdb/profileRadar2Scores`, `termdb/profileRadarFacility2Scores`, and `termdb/profileForms2Scores`. The cohort/facility information is derived server-side from the request — clients never send cohort-specific term wrappers. The legacy `profileForms` plot still uses `termdb/profileFormScores` and will be removed once an upgrade path lands.

### Term ID conventions

Every cohort-specific term ID is prefixed `F` (Full) or `A` (Abbreviated). The prefix is concatenated to the bare suffix in `loadFilterTerms()` ([profilePlot.ts](./profilePlot.ts)) — so existing `FC_*`/`PO_*`/`WHO_*` substrings end up as **doubled** prefixes (`FFC_*`, `FPO_*`, `FWHO_*` for Full; `AFC_*`, `APO_*`, `AWHO_*` for Abbreviated). Examples:

- Facility term: `FUNIT` / `AUNIT`
- Filter terms: `Fcountry`/`Acountry`, `FWHO_region`/`AWHO_region`, `FIncome_group`/`AIncome_group`, `FFC_TypeofFacility`/`AFC_TypeofFacility`, `FFC_TeachingFacility`/`AFC_TeachingFacility`, `FFC_ReferralFacility`/`AFC_ReferralFacility`, `FFC_FundingSrc`/`AFC_FundingSrc`, `FPO_HospitalVolume`/`APO_HospitalVolume`, `FYear_implementation`/`AYear_implementation`
- Score terms: `FX24` / `AX117`, etc.

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

This role-based filtering is managed by the `getAdditionalFilter` function in the dataset configuration, which dynamically handles the data queries based on the user's `clientAuthResult`. Certain charts, like the `profileRadarFacility2` chart, are hidden entirely for public users.

Here is a breakdown of the main plot types:


### Polar Chart (profilePolar2)
**Class:** [polar2.ts](./polar2.ts)
**Server route:** [`profile.polar2.ts`](../../../../server/routes/profile.polar2.ts) at endpoint `termdb/profilePolar2Scores`
**Title:** Score-based Results by PrOFILE Module
**Description:** High-level overview of aggregated performance across PrOFILE modules. Each slice of the polar represents a module (e.g., 'National Context', 'Personnel', 'Diagnostics').

**Implementation:**

- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the correct facility term (`FUNIT` for full cohort, `AUNIT` for abbreviated) by inspecting term ID prefixes already present in the request (`scoreTerms` or `filter`), eliminating any client influence over which facility term is used.
- **Always aggregated:** Returns the median percentage across all eligible sites. When only one site is accessible, the median of a single value equals that value.
- **Minimal client payload:** The client strips `scoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`. No `facilityTW`, no `$id`, no client-only term wrapper properties are sent.
- **Consistent eligible sample scoping:** `eligibleSamples` is filtered to `userSites` only when `filterByUserSites` is explicitly `true`. When `filterByUserSites` is `false`, the median is computed across all sites (global aggregate).
- **Public role security:** `sites` is always `[]` for public users — no site IDs or names are ever exposed.
- **Rendering structure:** The `plot()` method is split into focused private methods (`createSvg`, `drawGrid`, `drawArcs`, `drawTable`, `drawLegend`).
- **Documentation icon:** The help icon in the controls panel is enabled for `profilePolar2` in [`controls.btns.js`](../../plots/controls.btns.js). Clicking it opens the polar graph PDF for the active cohort (Abbreviated or Full), configured in [`profilePlot.ts`](./profilePlot.ts).

**Calculation:** For each module, computes `(score / maxScore) * 100` per eligible site, then returns the median across all eligible sites, rounded to the nearest integer.

**Role and cohort coverage:**

| Role | `filterByUserSites` | Eligible samples | `sites` in response |
|------|---------------------|-----------------|---------------------|
| Public | false | All sites | `[]` (never exposed) |
| Admin | false | All sites | Full sorted list |
| Site user | false | All sites (global aggregate) | Full sorted list |
| Site user | true | User's sites only | User's sites only |

Both Full (`FUNIT`) and Abbreviated (`AUNIT`) cohorts are handled automatically — `derivePrefix()` reads the `F`/`A` prefix from term IDs already present in the request, requiring no cohort-specific logic on the client.


### Bar Chart (profileBarchart2)
**Class:** [barchart2.ts](./barchart2.ts)
**Server route:** [`profile.barchart2.ts`](../../../../server/routes/profile.barchart2.ts) at endpoint `termdb/profileBarchart2Scores`
**Title:** Score-based Results for the Component by Module and Domain
**Description:** A detailed multi-level bar chart that breaks down scores by module/domain. It groups domains within larger components (`Context`, `Workforce`, `Diagnostics`, `Therapy`, `Patients and Outcomes`). Full PrOFILE shows side-by-side bars for objective data (Site Coordinator + MD Lead) vs subjective data (Point of Care Staff); Abbreviated PrOFILE shows scores per domain alongside the overall End-user Impression.

**Implementation:**

- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the correct facility term (`FUNIT` for full cohort, `AUNIT` for abbreviated) by inspecting term ID prefixes already present in the request (`scoreTerms` or `filter`).
- **Always aggregated:** Returns the median percentage across all eligible sites.
- **Minimal client payload:** The client strips `scoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`.
- **Consistent eligible sample scoping:** `eligibleSamples` is filtered to `userSites` only when `filterByUserSites` is explicitly `true`. Otherwise the median is computed across all sites (global aggregate).
- **Public role security:** `sites` is always `[]` for public users — no site IDs or names are exposed.
- **Rendering structure:** The `plot()` method is split into focused private methods (`createSvg`, `drawTitleAndDefs`, `drawColumnHeaders`, `drawComponentRows`, `drawGuideLines`, `drawLegend`).
- **Documentation icon:** The help icon in the controls panel is enabled for `profileBarchart2` in [`controls.btns.js`](../../plots/controls.btns.js). Clicking it opens the bar graph PDF for the active cohort.

**Calculation:** For each score term, computes `(score / maxScore) * 100` per eligible site, then returns the median across all eligible sites, rounded to the nearest integer. Each row in the `plotByComponent` groups contributes `term1` (objective) and, when present, `term2` (subjective) into the flat `scoreTerms` list sent to the server.

**Role and cohort coverage:**

| Role | `filterByUserSites` | Eligible samples | `sites` in response |
|------|---------------------|-----------------|---------------------|
| Public | false | All sites | `[]` (never exposed) |
| Admin | false | All sites | Full sorted list |
| Site user | false | All sites (global aggregate) | Full sorted list |
| Site user | true | User's sites only | User's sites only |


### Radar Chart (profileRadar2)
**Class:** [radar2.ts](./radar2.ts)
**Server route:** [`profile.radar2.ts`](../../../../server/routes/profile.radar2.ts) at endpoint `termdb/profileRadar2Scores`
**Description:** Two-series radar polygon comparing two metrics per module. Configurations differ by cohort:
  - **Full PrOFILE:** Site Coordinator vs Point of Care Staff — either Impressions (subjective 1–10 scale) or Score-based Results (calculated scores).
  - **Abbreviated PrOFILE:** Total Score vs End-User Impression per module — aligns objective capabilities against perceived performance.

**Implementation:**

- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the correct facility term (`FUNIT` / `AUNIT`) by inspecting term ID prefixes already present in the request.
- **Always aggregated:** Returns the median percentage across all eligible sites for both series.
- **Minimal client payload:** The client strips `scoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`. Each radar row contributes `term1` and `term2`; the client flattens them into `scoreTerms`.
- **Public role security:** `sites` is always `[]` for public users.
- **Zero-score handling:** Sites with a score of 0 are included in the median (`!= null` filter).
- **Sparse-module rendering:** `d3.line().defined()` lets per-module series contain `null` for modules whose score the server omitted (no eligible data), producing polygon gaps instead of NaN-poisoned paths.

**Calculation:** For each module and each of the two series, computes `(score / maxScore) * 100` per eligible site, then returns the median across all eligible sites, rounded to the nearest integer.


### Facility Radar Chart (profileRadarFacility2)
**Class:** [radarFacility2.ts](./radarFacility2.ts)
**Server route:** [`profile.radarFacility2.ts`](../../../../server/routes/profile.radarFacility2.ts) at endpoint `termdb/profileRadarFacility2Scores`
**Description:** Two overlaid radar polygons: the aggregate median across eligible sites (the "Global" line, gray dashed) and a single facility's row (the "Facility" line, blue solid). Lets users benchmark a specific institution against the aggregated peer landscape.

**Access:** Auth-gated — hidden from public users via `isSupportedChartOverride.profileRadarFacility2` in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts). Only logged-in users (site users and admins) see this chart.

**Implementation:**

- **Single round-trip:** Returns both the aggregate (`term2Score`) and a single-site row (`sampleData`) in one response, eliminating the need for a second facility-site fetch.
- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the facility term from term ID prefixes already present in the request.
- **Minimal client payload:** The client strips `scoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`.
- **Public-role defense-in-depth:** Even though the chart is gated by `isSupportedChartOverride`, the server returns `sites: []` and omits `sampleData` for public-role requests.
- **Zero-score handling:** Sites with a score of 0 are included in the median.
- **Graceful degradation:** When `sampleData` is unavailable (e.g., filter excludes all sites), the facility-site dropdown is skipped — no TypeError.

**Calculation:** For each module, computes `(score / maxScore) * 100` per eligible site; the median across all eligible sites is returned as the aggregate. The single facility's raw percentages are returned as `sampleData.term2Score`.


### Templates/Forms (legacy — profileForms)
**Class:** [profileForms.js](../profileForms.js)  
**Description:** This type of chart known as Templates for the users, allows for the visualization of the amount of response per type of response for each individual questions from the PrOFILE survey, which are not aggregated into scores. This is useful for detailed analysis of specific data points.  
**Plot Types:**
	- Yes/No Barchart: For questions with "Yes", "No", or "Do Not Know" as possible answers, this chart shows the distribution of responses.
	- Likert Scale: For questions based on a Likert scale (e.g., 'Almost Never' to 'Almost Always'), this chart displays the frequency of each response, often colored by module to maintain consistency with other plots.

### Templates (profileForms2)
**Class:** [forms2.ts](./forms2.ts)
**Server route:** [`profile.forms2.ts`](../../../../server/routes/profile.forms2.ts) at endpoint `termdb/profileForms2Scores`
**Description:** Visualizes the distribution of survey responses per question (not aggregated into scores) — useful for detailed analysis of specific data points. Supports Yes/No barcharts and Likert-scale barcharts. The chart-type picker categorizes chart types as **horizontal tabs at the top**, with each tab showing a domain dictionary filtered to only domains that offer that chart type.

Coexists with the legacy `profileForms` plot, which is still wired in the dataset config and uses the older shared route. Once the upgrade path lands, `profileForms` will be removed and this becomes the only Templates plot.

**Picker UX (chart-type tabs above a filtered domain tree):** Clicking the `Templates 2` button opens a popover with horizontal tabs — one tab per chart type — and an embedded term-picker dictionary below. Switching tabs re-mounts the dictionary with a different chart-type filter, so the user can browse by chart type instead of seeing every domain mixed together. Tabs are ordered by their position in `profileFormsOptions` (the first option becomes the default active tab — currently `Yes/No Barchart`).

The picker UI is defined entirely in [`forms2.ts`](./forms2.ts) (the `makeChartBtnMenu` export, invoked by `loadChartSpecificMenu` in [`mass/charts.js`](../../mass/charts.js)) — the generic [`tree.js`](../../termdb/tree.js) component is untouched. The same `Tabs` component used inside the rendered chart (Yes/No vs Likert) is reused for the picker tabs.

`termdbConfig.plotConfigByCohort[cohort].profileForms2.domains` (`Array<{ id: domainId, plotTypes: friendlyLabel[] }>`) drives the tab list and per-tab tree filter. Declared as a static array in the dataset config in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) — same array-of-structured-objects shape as the other profile charts (`profilePolar2.terms`, `profileRadar2.options[].terms`, etc.) — and shipped to the client as part of the existing `plotConfigByCohort` payload. No separate field on the wire, no SQL, no DB read. Adding or removing a template-bearing domain is a code edit reviewable in PRs. An empty `domains: []` (e.g., Abbreviated today) triggers the picker's empty-state message.

[`isUsableTerm`](../../../../shared/utils/src/termdb.usecase.js) `case 'profileForms2'` honors `usecase.cohort` and `usecase.subtype` (set by the picker): depth-3 gets `'plot'` only if `domains.find(d => d.id === term.id)?.plotTypes` includes the active subtype; depth-1/2 gets `'branch'` only if any descendant matches (`domains.some(d => d.id.startsWith(prefix) && d.plotTypes.includes(subtype))`). Terms with empty `uses` are entirely excluded by `tree.js`'s filter.

**Key differences from v1 Templates:**

- **Dedicated server route:** Uses `termdb/profileForms2Scores` instead of the shared `termdb/profileFormScores`. Same pattern as the other v2 plots — each plot owns its route and data logic independently.
- **Server-side facility term derivation:** The client does not send `facilityTW`. The server derives the correct facility term (`FUNIT` for full cohort, `AUNIT` for abbreviated) from `__protected__.activeCohort`.
- **Always aggregated:** The server returns the combined categorical dict across all eligible sites. There is no single-site `sampleData` shortcut.
- **Minimal client payload:** The client strips `scoreTerms` and `scScoreTerms` down to `{ term: { id }, q }` before sending via `dofetch3`.
- **Public role security:** `sites` is always `[]` for public users.
- **Cohort coverage:** Wired in both Full and Abbreviated cohort configs. Functional in Full today; Abbrev is dead config until `A*`-prefixed multivalue templates land in the DB.

**Response shape:** `term2Score: { [termId]: { [category]: number } }` — same as v1.

**Plot configuration (shared across v1/v2):** A single module-level constant `profileFormsOptions` in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) defines the `options[]` array, referenced by `fullCohortPlots.profileForms`, `fullCohortPlots.profileForms2`, and `abbrevCohortPlots.profileForms2`. Single source of truth — v1 and v2 cannot drift, and full/abbrev cannot drift.

**Domain × chart-type availability (sjglobal `db.6` snapshot, full cohort):**

| Domain (parent_id) | Yes/No Barchart | Likert Scale |
|---|---:|---:|
| `FContext__National Context__Care Access and Utilization` | 4 | — |
| `FContext__Facility and Local Context__Facility Basic Amenities` | — | 5 |
| `FContext__Finances and Resources__Families/Patients` | — | 42 |
| `FDiagnostics__Diagnostics__General Laboratory` | — | 11 |
| `FWorkforce__Service Integration__Communication` | — | 40 |

Counts are template questions per domain. The picker map itself is **not** computed from this query — it is hardcoded as `profileForms2.domains` inside `fullCohortPlots`/`abbrevCohortPlots` in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) (the canonical source). The SQL below is an audit tool: after a DB change that adds or removes template-bearing domains, run it to verify the dataset's `domains` array still matches what's in the DB, and update the dataset entries if it doesn't.

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




