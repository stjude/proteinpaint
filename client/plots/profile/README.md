## Introduction

The [`PrOFILE dashboard`](http://localhost:3000/profile/?role=admin) provides several interactive visualizations to explore and analyze data from participating hospitals. These plots are configured in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) and are available for both "Full" and "Abbreviated" PrOFILE versions. The Full Version is a “look within”, an institutional journey meant for institutions that want to define a local improvement strategy. The Abbreviated Version is a “look across” institutions; it is a multisite, collaborative journey that illustrates the PHO resource landscape for a subnational, national, or regional group of facilities.

The plots within the PrOFILE dashboard inherit from the base [`profilePlot`](./profilePlot.ts) that encapsulates common functionalities such as the data fetching and the creation of the chart filters. Each specific plot type (e.g., `profilePolar2`, `profileBarchart2`) inherits from this base component extending its logic to render their unique visualization. This structure promotes code reuse and consistency across the different plots.

Each chart owns a dedicated server endpoint and data logic: `termdb/profilePolar2Scores`, `termdb/profileBarchart2Scores`, `termdb/profileRadar2Scores`, and `termdb/profileRadarFacility2Scores`. The cohort/facility information is derived server-side from the request — clients never send cohort-specific term wrappers. The legacy `profileForms` plot still uses `termdb/profileFormScores` and will be removed once an upgrade path lands.

### Term ID conventions

Every cohort-specific term ID is prefixed `F` (Full) or `A` (Abbreviated). The prefix is concatenated to the bare suffix in `loadFilterTerms()` ([profilePlot.ts](./profilePlot.ts)) — so existing `FC_*`/`PO_*`/`WHO_*` substrings end up as **doubled** prefixes (`FFC_*`, `FPO_*`, `FWHO_*` for Full; `AFC_*`, `APO_*`, `AWHO_*` for Abbreviated). Examples:

- Facility term: `FUNIT` / `AUNIT`
- Filter terms: `Fcountry`/`Acountry`, `FWHO_region`/`AWHO_region`, `FIncome_group`/`AIncome_group`, `FFC_TypeofFacility`/`AFC_TypeofFacility`, `FFC_TeachingFacility`/`AFC_TeachingFacility`, `FFC_ReferralFacility`/`AFC_ReferralFacility`, `FFC_FundingSrc`/`AFC_FundingSrc`, `FPO_HospitalVolume`/`APO_HospitalVolume`, `FYear_implementation`/`AYear_implementation`
- Score terms: `FX24` / `AX117`, etc.

The convention is used in:

1. `profilePlot.ts` — `getProfilePlotConfig` / `loadFilterTerms` concatenate the prefix with the rest of the term ID.
2. `profile.{polar2,barchart2,radar2,radarFacility2}.ts` — `derivePrefix(query)` scans request term IDs and builds `${prefix}UNIT`.

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

- **Admin:** Administrators have unrestricted access to all data across all participating institutions. No site-based filters are applied.
- **Site-Level User:** Users are associated with one or more institutions. A filter is automatically applied to most of the queries to restrict data to only their assigned sites, unless the data returned is aggregated and therefore deidentified. This allows the users to see their own data and compare it with aggregated data from all other sites.
- **Public:** Public users can only view aggregated data. They do not have access to any institution-specific information.

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

| Role      | `filterByUserSites` | Eligible samples             | `sites` in response  |
| --------- | ------------------- | ---------------------------- | -------------------- |
| Public    | false               | All sites                    | `[]` (never exposed) |
| Admin     | false               | All sites                    | Full sorted list     |
| Site user | false               | All sites (global aggregate) | Full sorted list     |
| Site user | true                | User's sites only            | User's sites only    |

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

| Role      | `filterByUserSites` | Eligible samples             | `sites` in response  |
| --------- | ------------------- | ---------------------------- | -------------------- |
| Public    | false               | All sites                    | `[]` (never exposed) |
| Admin     | false               | All sites                    | Full sorted list     |
| Site user | false               | All sites (global aggregate) | Full sorted list     |
| Site user | true                | User's sites only            | User's sites only    |

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
**Plot Types:** - Yes/No Barchart: For questions with "Yes", "No", or "Do Not Know" as possible answers, this chart shows the distribution of responses. - Likert Scale: For questions based on a Likert scale (e.g., 'Almost Never' to 'Almost Always'), this chart displays the frequency of each response, often colored by module to maintain consistency with other plots.

### Impression Thermometer (profileForms `__Impression` mode)

**Class:** [profileForms.ts](./profileForms.ts) (mode-switched in `init()`/`main()`) + render module [renderImpressionThermometer.ts](./renderImpressionThermometer.ts)
**Server route:** [`profile.impressionDistribution.ts`](../../../../server/routes/profile.impressionDistribution.ts) at endpoint `termdb/profileImpressionDistribution`
**Title:** _`<Module>` Module Impressions_ — Status of Module Domains and Subdomains as Rated by Site Coordinator and Point of Care (POC) Staff
**Description:** A full-detail single thermometer that summarizes the 1–10 rating distribution for one **module** of the PrOFILE survey, comparing the Site Coordinator (SC) and Point-of-Care (POC) Staff viewpoints across all eligible sites.

#### What you see in the chart

Each thermometer combines two perspectives on the same module:

- **Stacked colored fill (1=dark red bottom → 10=dark green top)** — the **POC distribution**: percentage of eligible sites whose POC float rating falls in each integer bin (1..10) after rounding. Heights are percentages of POC respondents. Colors are the universal red→green traffic-light palette `RATING_COLORS` (same in every module — see [Colors](#colors-where-each-piece-is-sourced) below).
- **Vertical bar in the module color** — the **SC median** rating across eligible sites (single integer 1..10). Color comes from each impression term's `jsondata.color` in the DB.
- **Grey ball** — the **POC median** rating across eligible sites (1..10).
- **Bulb in the module color** — same fill as the SC bar; visually anchors the SC value to the bottom of the tube.
- **Right axis** (1..10) — impression rating scale.
- **Left axis** (10%..100%) — POC distribution percentage scale (0% omitted, hidden under the bulb).
- **n indicator (top-right of frame)** — number of eligible sites contributing data after auth/site filtering.
- **Hover tooltips** on POC distribution bands, SC bar, bulb, and POC median ball — see [Hover tooltips](#hover-tooltips) below.

In **SC-only mode** (Patients & Outcomes — see below), the POC distribution stack, POC median ball, left % axis, and rating swatches in the legend are all hidden; only the SC bar + bulb + right rating axis remain.

#### How it's reached

There is no top-level chart-type button. The thermometer is rendered automatically when the user clicks a term whose ID ends with `__Impression` in the dictionary tree — this dispatches into `profileForms` because the leaf node is a profileForms instance. The standard tabs flow (Yes/No, Likert) is skipped:

```
profileForms.init()  → detects parentId.endsWith('__Impression')
                     → resolves SC (integer) + POC (float) child terms via getTermChildren
                     → captures scChild.color → this.impressionScColor (per-module DB color)
profileForms.main()  → if isImpressionDomain:
                         this.data = await this.fetchImpressionDistribution()
                         renderImpressionThermometer({ dom, id, module, data, texts, colors, tip })
```

#### Term hierarchy

Each `__Impression` parent in the termdb sits at the **module level** (not the domain level). For 11 of the 12 modules it wraps two scalar children; **Patients & Outcomes** is the only SC-only module:

```
# Standard module (11 of 12)
F<Component>__<Module>__Impression                    ← parent (the tree node clicked)
├── <SC term id>     type=integer                     ← Site Coordinator rating
└── <POC term id>    type=float                       ← Point-of-Care rating

# SC-only module (Patients & Outcomes only)
FPatients and Outcomes__Patients and Outcomes__Impression
└── FX383            type=integer                     ← Site Coordinator rating (no POC term)
```

#### Per-module data inventory

Snapshot from the live `db.6` for `sjglobal-profile` (run the audit query at the bottom of this section to refresh). Module color comes from `terms.jsondata.color` and is shared by the SC and POC children of the same parent.

| Component           | Module                     | SC term | POC term           | Module color (`jsondata.color`) |
| ------------------- | -------------------------- | ------- | ------------------ | ------------------------------- |
| Context             | National Context           | FX372   | FX384              | `#2076BB` blue                  |
| Context             | Facility and Local Context | FX373   | FX385              | `#1894BC` teal                  |
| Context             | Finances and Resources     | FX374   | FX386              | `#55B5E6` light blue            |
| Workforce           | Personnel                  | FX375   | FX387              | `#40B358` green                 |
| Workforce           | Service Capacity           | FX376   | FX388              | `#63AE51` green                 |
| Workforce           | Service Integration        | FX377   | FX389              | `#C5DAA2` light green           |
| Diagnostics         | Diagnostics                | FX378   | FX390              | `#EF622A` orange                |
| Therapy             | Chemotherapy               | FX379   | FX391              | `#EFE52C` yellow                |
| Therapy             | Supportive Care            | FX380   | FX392              | `#E3C237` mustard               |
| Therapy             | Surgery                    | FX381   | FX393              | `#FCCE09` gold                  |
| Therapy             | Radiation Therapy          | FX382   | FX394              | `#F7D335` yellow                |
| Patients & Outcomes | Patients and Outcomes      | FX383   | _(none — SC only)_ | `#D32628` red                   |

The client doesn't hardcode any of these — it pulls `scChild.color` and `pocChild.color` from `getTermChildren()` results at runtime.

#### Data computation (server route)

[`profile.impressionDistribution.ts`](../../../../server/routes/profile.impressionDistribution.ts) receives `{ scTermId, pocTermId?, maxScore, filter, filterByUserSites }` and:

1. Derives the cohort facility term (`FUNIT`/`AUNIT`) from term-ID prefixes via `derivePrefix()` — same pattern as `profile.polar2`.
2. Builds `terms = [facilityTW, scTW]` and conditionally appends `pocTW` only when `query.pocTermId` is present (SC-only modules omit it).
3. Calls `getData()` on those terms to pull the site-level matrix rows.
4. Filters to `eligibleSamples` — when `filterByUserSites=true` and the user is not public, only sites in `clientAuthResult[activeCohort].sites`; otherwise all sites.
5. Returns:
   - `scMedian` — `median()` of all SC integer values across eligible sites, rounded
   - `scTotal` — number of SC integer values that contributed to `scMedian`
   - `pocMedian` — `median()` of all POC float values across eligible sites, rounded; `null` in SC-only mode
   - `pocTotal` — count of POC float values; `0` in SC-only mode
   - `pocDistribution` — `buildDistribution(pocValues, maxScore)` → bins POC values into 1..10 (rounded), returns `{rating, count, pct}` per bin; `[]` in SC-only mode
   - `n` — number of eligible sites (rows) contributing data
   - `sites` — full sorted list (`[]` for public users)

Everything is **site-level**: the SC bar represents the median SC rating across sites in the cohort, the colored stack represents % of POC respondents in each rating bin.

#### Colors — where each piece is sourced

The chart uses a **hybrid scheme**: a universal hardcoded ramp for rating levels (so all 12 modules share the same red→green level encoding readers can compare across charts), plus a per-module DB color for SC identity (so each module is visually distinct).

| Visual element                                          | Source                                                                                         | Notes                                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| POC distribution bands                                  | `RATING_COLORS` constant in [renderImpressionThermometer.ts](./renderImpressionThermometer.ts) | Universal red→green palette: `1: #7a0d0d` → `10: #1b5e20`. Same in every module.                       |
| Legend rating swatches (1..10)                          | Same `RATING_COLORS`                                                                           | Mirrors the in-tube bands. Hidden in SC-only mode.                                                     |
| SC vertical bar                                         | `terms.jsondata.color` for the SC integer term                                                 | Captured in `init()` as `this.impressionScColor`, passed via `colors.sc`.                              |
| Bulb fill                                               | Same `colors.sc`                                                                               | Same color as the SC bar so they read as one visual unit.                                              |
| Bulb outline                                            | `#444`                                                                                         | Hardcoded in renderer; only drawn outside the tube via an arc path so the tube/bulb joint is seamless. |
| POC median ball fill                                    | `#444`                                                                                         | Hardcoded in renderer.                                                                                 |
| POC median ball stroke                                  | `#000`                                                                                         | Hardcoded in renderer.                                                                                 |
| SC swatch in legend                                     | `colors.sc`                                                                                    | Per-module color matching the SC bar.                                                                  |
| Tube outline                                            | `#444`                                                                                         | Hardcoded in renderer.                                                                                 |
| Frame box + grey header band                            | `#bbb` border + `#f4f4f4` fill                                                                 | Hardcoded in renderer.                                                                                 |
| Title text color (orange "<Module> Module Impressions") | `#dd6b20`                                                                                      | Hardcoded in renderer.                                                                                 |

`RATING_COLORS` was kept hardcoded after a round of experimentation — the `db.6` termdb does **not** carry a 1..10 rating gradient anywhere (only a single `color` per term and per-Likert-category colors in `state.termdbConfig.colorMap`), so the universal palette stays in client code while the module-identity color is sourced from the DB.

#### Hover tooltips

Tooltips use the shared `Menu` instance set up at [profilePlot.ts:66](./profilePlot.ts#L66) as `this.tip`. profileForms passes it to the renderer via `tip: this.tip`; the renderer's small `attachTip(selection, text)` helper binds `mouseover`/`mouseout`. If `tip` is omitted (e.g. test harness), tooltips are silently skipped.

| Hover region                                              | Tooltip text                             |
| --------------------------------------------------------- | ---------------------------------------- |
| POC distribution band (each rating 1..10 with non-zero %) | `Rating R — P.P% (count of total staff)` |
| SC vertical bar                                           | `Site Coordinator median: M (n=N SCs)`   |
| Bulb                                                      | Same as SC bar                           |
| POC median ball                                           | `POC median: M (n=N staff responses)`    |
| Right axis numbers, legend, frame, title                  | _no tooltip_                             |

In SC-only mode the POC band and POC median ball handlers are never attached because the elements aren't created (existing `distTotal > 0` and `pocMedian != null` guards).

#### User-facing strings (config-driven)

All title, subtitle, axis-label, footer, and legend strings are sourced from the dataset config at `fullCohortPlots.profileForms.impression` in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts) — same convention as `profilePolar2.title`. The renderer reads them as a required `texts: ImpressionTexts` arg with no fallbacks; a missing field is a compile-time error. The `{module}` placeholder in `titleTemplate` is replaced at render time with the module name parsed from the term ID.

#### Architecture (alignment with v2 charts)

The thermometer is **not** a standalone chart-type — it would duplicate the dictionary-tree navigation, since the term node is already reachable inside profileForms. But the rendering itself is large enough (~350 lines) and unrelated to the Yes/No / Likert tab flow that it lives in its own pure render module:

- **`renderImpressionThermometer.ts`** — exports `renderImpressionThermometer({ dom, id, module, data, texts, colors, tip })` and `IMPRESSION_MAX_SCORE`. Pure function, no class, no `this`. Holds the universal `RATING_COLORS` palette as a private constant.
- **`profileForms.ts`** — owns the `private async fetchImpressionDistribution()` method that calls `dofetch3('termdb/profileImpressionDistribution', { body: { ... } })` inline, exactly matching the `fetchAggregatedScores`/`fetchFormsAggregatedScores` private-method pattern from `polar2`/`barchart2`/`radar2`. Result stored to `this.data`. `pocTermId` is omitted from the body when `this.pocTW` is not set (SC-only modules).

#### Cohort coverage

Currently **Full only**. The `__Impression` synthetic parents and their SC/POC children are present in the Full cohort termdb (12 parents at this snapshot — 3 Context, 3 Workforce, 1 Diagnostics, 4 Therapy, 1 Patients and Outcomes). The Abbreviated cohort does not have these synthetic parents.

#### Auditing the impression terms in the live DB

```bash
DB=/path/to/files/sjglobal-profile/db.6

# 1. List all 12 module-level __Impression parents
sqlite3 "$DB" "SELECT id FROM terms WHERE id LIKE '%\\_\\_Impression' ESCAPE '\\' ORDER BY id;"

# 2. Confirm each parent has its expected children (1 integer for SC, optional 1 float for POC)
sqlite3 "$DB" "SELECT parent_id, type, COUNT(*) FROM terms \
  WHERE parent_id LIKE '%\\_\\_Impression' ESCAPE '\\' \
  GROUP BY parent_id, type ORDER BY parent_id;"
# Patients & Outcomes will show only the integer row — that's the SC-only design.

# 3. Inventory module colors (what's pulled into colors.sc at runtime)
sqlite3 "$DB" "SELECT parent_id, id, type, json_extract(jsondata,'\$.color') AS color \
  FROM terms WHERE parent_id LIKE '%\\_\\_Impression' ESCAPE '\\' \
  ORDER BY parent_id, type;"
```

#### Patients & Outcomes (SC-only mode)

By design, `FPatients and Outcomes__Patients and Outcomes__Impression` has only an SC integer child (`FX383`). All four layers handle this:

1. **Type** — `pocTermId` is optional in `ProfileImpressionDistributionRequest`.
2. **Server** — when `pocTermId` is absent, `pocTW` is null, the terms array drops it, and the response has `pocMedian: null / pocTotal: 0 / pocDistribution: []`.
3. **profileForms client** — `init()` doesn't error on missing POC child (only SC absence is a real bug). `fetchImpressionDistribution()` omits `pocTermId` from the body when `this.pocTW` is unset.
4. **Renderer** — `hasPoc = data.pocTotal > 0` gates the left axis labels and rotated title, the rating swatches in the legend, and the POC-median legend entry. The existing `if (distTotal > 0)` and `if (pocMedian != null)` guards already skip the distribution stack and median ball.

#### Source of `__Impression` parents

These synthetic parents are **not** generated by [parse.dict.js](../../../../../utils/sjglobal-profile/parse.dict.js), which only builds component/module/domain branches. They are inserted into the `terms` table by a separate step upstream of the DB build. If you need to add or modify an `__Impression` parent, that pipeline is the place to look; this README will be updated as that pathway is documented.

#### Role and cohort coverage

| Role      | `filterByUserSites` | Eligible samples             | `sites` in response  |
| --------- | ------------------- | ---------------------------- | -------------------- |
| Public    | false               | All sites                    | `[]` (never exposed) |
| Admin     | false               | All sites                    | Full sorted list     |
| Site user | false               | All sites (global aggregate) | Full sorted list     |
| Site user | true                | User's sites only            | User's sites only    |

## Conclusion

These plots collectively provide a comprehensive toolkit for users to analyze PrOFILE data from a high-level summary down to individual data points. The PrOFILE dashboard is designed to empower institutions and collaborative groups to explore, benchmark, and improve pediatric oncology care using interactive, data-driven visualizations. With flexible filters, site-based access, and a variety of plot types, users can gain insights from high-level summaries down to individual survey responses.
