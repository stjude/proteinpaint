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
**Plot Types:**

- **Yes/No Barchart:** For questions with "Yes", "No", or "Do Not Know" as possible answers, this chart shows the distribution of responses.
- **Likert Scale:** For questions based on a Likert scale (e.g., 'Almost Never' to 'Almost Always'), this chart displays the frequency of each response, often colored by module to maintain consistency with other plots.

### Impression view (profileForms `__Impression` mode)

**Class:** [profileForms.ts](./profileForms.ts) (mode-switched in `init()`/`main()`) + render modules [renderImpressionThermometer.ts](./renderImpressionThermometer.ts) and [renderResponseDistribution.ts](./renderResponseDistribution.ts)
**Server route:** [`profile.impressionDistribution.ts`](../../../../server/routes/profile.impressionDistribution.ts) at endpoint `termdb/profileImpressionDistribution`
**Title:** _`<Module>` Module Impressions_ — Status of Module Domains and Subdomains as Rated by Site Coordinator and Point of Care (POC) Staff
**Description:** For one **module** of the PrOFILE survey, the impression view renders **one chart pair per POC responder group**: a median thermometer beside a response-distribution combo chart, comparing the Site Coordinator (SC) and Point-of-Care (POC) Staff 1–10 ratings across eligible sites. Groups stack vertically; a module with no POC responders (Patients & Outcomes) shows a single SC-only thermometer.

#### What you see — thermometer (chart 1)

A single glass vessel — rounded top cap, straight tube, a neck that flares into a weightier bulb — holding two liquid columns, each rising to that staff type's median:

- **Left column in the module color** — the **SC median** across eligible sites.
- **Right column in grey** (`POC_FILL`) — this responder group's **POC median**.
- The **bulb is the reservoir and always reads full**, split the same way (left module color / right grey).
- **Each series is a single closed `<path>`** (`liquidPath()`): half the bulb circle with the bar rising straight out of it — `M` centre → dome → down the bar's outer wall to `BAR_JOIN_Y` → arc around that half of the circle → back up the centre divider. **No joining shape between bar and bulb, and no taper.** The bar meets the circle at exactly the height where the circle is `BAR_W` wide, so the two are tangent and there is no step to hide.

  Traversal order matters: the bar's centre edge and the half-disc's flat edge are collinear, so tracing dome → bar wall → arc → centre keeps the outline a simple closed shape. Going down the centre first and arcing back would pinch the path where the two meet.

  Two earlier attempts failed and are worth not repeating. Drawing the bulb half as its own element left the **entire reservoir unhoverable** — only the bar carried the tooltip datum, so hovering the bulb hit a shape with no `tip` and the delegation's `else` branch dismissed the tooltip. Replacing it with a reservoir *rectangle* butted onto the bar fixed the hover but left a **hard right-angle shoulder at the neck**, the liquid jumping from `BAR_W` to `BULB_R` wide in one step. A cubic taper to smooth that over only made it look like a funnel. The bulb is a circle; the liquid should just be half of it.

  One path is also what makes the body behave as one on hover: anywhere on it, bar or bulb, is the same target, shows the same tooltip and animates together.

- **`NECK_R` is deliberately small (6).** The fillet welding tube to bulb was originally 14, sized for a liquid that filled the flare. Now that the reservoir is the circle itself, a wide fillet flares the *glass* out past the *liquid* and leaves a crescent of empty tube at each shoulder — 14px wide at `NECK_R = 14`, under 5px at 6.
- The **empty state** is one background band per performance zone, filling the whole vessel — the same `impression.zones` colors at the same `0.3` opacity **and the same discrete-band form** the distribution chart uses, so the two charts in a card read as one system. Each band spans its own ratings (`yOf(z.max)` down to `yOf(z.min - 1)`), so adjacent bands meet exactly at the tick between them; the lowest band continues past rating 0 through the bulb, putting the low end of the scale at the reservoir.

  These were originally rendered as a blended vertical gradient, which did not work: a module's zone shades are three tints of a single hue (National Context: `#2FA9F4` → `#1E77BB` → `#15557C`), and at 0.3 opacity over white they land within a few RGB steps of each other. Smoothing the boundaries away left one flat wash with no readable zones. **Keep the bands discrete** — the hard edges are what make the zones legible at all.
- **Left axis** (1..10) — the single `impression.ratingAxisLabel` rating scale, drawn with `axisLeft` + the shared `axisstyle` helper, ticks pointing inward. The vessel outline serves as the axis line.
- **Performance zones** (Weak 1–5, Intermediate 6–7, Strong 8–10) are drawn as background bands but **not labelled here** — they are named once per card in the shared legend. Bins are config-driven from `impression.zones` (same bins as the distribution chart).
- SC-only modules render the left column only, and the card legend drops the POC entry.

##### Each piece of text appears exactly once

The view used to repeat itself: the breadcrumb restated the module name the title already gave; the zone names rendered in *both* charts of every card, at two sizes and two greys; the SC/POC legend was drawn by both charts; and the filter block repeated in every card with identical content. The rule now:

| Text | Drawn once by |
|---|---|
| Module name | the page title (`titleTemplate`); the `domainDiv` breadcrumb is hidden in impression mode |
| Applied filters + n | `renderImpression()`, above the cards — not per card |
| Series names (SC / POC) | the shared card legend |
| Zone names | the shared card legend, as swatches at the bands' own 0.3 opacity |

Text sizes step down with the hierarchy: page title `1.1rem` → card header (group label) `1rem` → chart title `0.9rem`. The two chart titles come from `impression.chartTitles.{thermometer,distribution}` and are drawn as html above each chart's svg, in its own column of the card's flex row.

Neither chart renders a legend or a zone label. `renderImpressionLegend()` is the single place both are named.

##### Glass treatment

Depth is built from layered low-opacity white/black gradients clipped to the vessel path: a narrow cylindrical gloss plus a faint vertical sheen on the columns, spherical shading on the bulb, and an inner shadow along the silhouette's edges. **No SVG filters are used** (`feGaussianBlur`/`feDropShadow`): no first-party proteinpaint client code uses them, and filters degrade in the svg→png download path. Clipping a plain horizontal gradient to the vessel is what turns it into an inner shadow — it darkens the edges of the actual silhouette and follows the neck curve for free.

Two constraints learned from review, both worth preserving:

- **Column shading stops at the neck** (`TUBE_BOTTOM`), never continuing to `BULB_BOTTOM`. Carried into the bulb, each column's cylindrical highlight is traced across the reservoir, so it reads as two cylinders passing through a sphere instead of one body of liquid.
- **No white surface decoration on the liquid.** Meniscus caps at each column top and a specular band down the tube wall were both tried and removed — at a 12px column width they read as stray white artifacts drawn over the fill rather than as glass. The gloss is kept to a narrow band for the same reason: a wide white ramp desaturates the series color instead of implying curvature.

The tube and bulb are **one path**, not two shapes. Each side is welded by a fillet arc externally tangent to both the tube wall and the bulb, which puts both joins at G1 continuity — there is no seam to hide. This requires `BULB_R > TUBE_W / 2`; below that the tangent solve has no real root and every derived coordinate goes `NaN`, which would render as an empty svg with nothing thrown, so the module throws at load if the invariant is broken.

#### What you see — response distribution (chart 2)

A frequency-of-responses combo chart, x = impression rating 1..10:

- **Grey columns** on the **right** y-axis — the responder group's POC staff response count per rating.
- **Line in the module color** on the **left** y-axis — the SC site-count per rating (shared across groups). Single-site SC (`scTotal === 1`) is drawn as a lone point instead of a line.
- **Three performance zones** as background bands, identical bins to the thermometer.
- The two y-axes are independent because POC counts far exceed SC counts.

#### How it's reached

There is no top-level chart-type button. The thermometer is rendered automatically when the user clicks a term whose ID ends with `__Impression` in the dictionary tree — this dispatches into `profileForms` because the leaf node is a profileForms instance. The standard tabs flow (Yes/No, Likert) is skipped:

```
profileForms.init()  → detects parentId.endsWith('__Impression')
                     → resolves SC (integer), optional POC (float), and POC responder
                       (multivalue POCFimpression_*) child terms via getTermChildren
                     → captures scChild.color → this.impressionScColor (per-module DB color)
profileForms.main()  → if isImpressionDomain:
                         this.data = await this.fetchImpressionDistribution()
                         this.renderImpression()   // per responder group: thermometer + distribution
```

#### Term hierarchy

Each `__Impression` parent in the termdb sits at the **module level** (not the domain level). For 11 of the 12 modules it wraps two scalar children; **Patients & Outcomes** is the only SC-only module:

```
# Standard module (11 of 12)
F<Component>__<Module>__Impression                    ← parent (the tree node clicked)
├── <SC term id>       type=integer                   ← Site Coordinator rating (shared SC series)
├── <POC term id>      type=float                     ← per-site POC rating (fallback only)
└── POCFimpression_*   type=multivalue (1+)           ← POC responder group(s); each rating→count
                                                        map drives one chart pair

# SC-only module (Patients & Outcomes only)
FPatients and Outcomes__Patients and Outcomes__Impression
└── FX383              type=integer                   ← Site Coordinator rating (no POC responders)
```

Each **multivalue** responder child (`POCFimpression_*`) is rendered as its own thermometer + distribution pair; a module with several (e.g. Service Capacity) yields several pairs. The **float** POC child is only a fallback for a module that has a per-site POC rating but no responder terms (none today). The **integer** SC child is shared across every pair.

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
   - `scDistribution` — `buildDistribution(scValues, maxScore)` → SC site counts binned per rating 1..10, `{rating, count, pct}`. Drives the SC line; shared across every responder group's chart pair.
   - `responders[]` — one entry per multivalue responder term: `{ termId, label, median, total, distribution }`, where `distribution` is `buildDistribution` over that group's expanded rating→count maps. Each entry drives one chart pair's POC columns + POC median ball. `[]` in SC-only mode.
   - `n` — number of eligible sites (rows) contributing data
   - `sites` — full sorted list (`[]` for public users)

Both series are **site-level**: the SC line/median is the distribution/median of per-site SC ratings; each responder's POC columns/median expand that group's per-site rating→count maps.

#### Colors — where each piece is sourced

Per-module identity comes from the DB color (SC line/bar/bulb); POC greys and zone bands are fixed display constants (zones are config-driven so the bins live in one place).

| Visual element                                          | Source                                                                                         | Notes                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Performance zone bands (Weak/Interm/Strong)             | Per-module `colorMap` gradient — `impression.zones[].shade` names the key (Weak=`SOMETIMES` … Strong=`ALMOST ALWAYS`), resolved in `renderImpression()` | Not hardcoded; module-tinted, DB-config-sourced. Bins shared by both charts. |
| SC left column (thermometer) / SC line (distribution)   | `terms.jsondata.color` for the SC integer term                                                 | Captured in `init()` as `this.impressionScColor` from the filled tw, passed via `colors.sc`. The empty vessel carries the zone gradient, not a tint of this color. |
| POC right column (thermometer) / legend swatch          | `POC_FILL` (`#9e9e9e`) in [renderImpressionThermometer.ts](./renderImpressionThermometer.ts)   | Grey, exported so the shared legend swatches the same grey the fill uses. |
| POC columns (distribution)                              | `POC_COLUMN_FILL` (`#bdbdbd`) in [renderResponseDistribution.ts](./renderResponseDistribution.ts) | Grey, internal to that renderer.                                       |
| Vessel outline (single path), ticks                     | `#444` / `#333`                                                                                | Hardcoded display constants in the thermometer renderer.                  |
| Glass depth (column gloss, bulb shading, inner shadow)  | White/black gradient overlays at low opacity                                                   | Color-agnostic by construction, so they compose over any module color.   |
| Title text color                                        | _none_                                                                                          | Bold, default color — matching polar2/radar2/barchart2. It was `#dd6b20` orange at `1.4rem`, the only custom text color in the profile dir. |

#### Hover tooltips

Both renderers bind tooltip text (and an optional hover-highlight descriptor) as each element's `__data__` via the `attachTip` helper passed in from `profileForms.renderImpression()`. The shared `profilePlot` mousemove/mouseout delegation on `rightDiv` reads `__data__` and shows/hides `this.tip` (same pattern as polar2/radar2) — so any element in the per-group svgs gets tooltips without per-element listeners.

| Hover region                        | Tooltip text                                    |
| ----------------------------------- | ----------------------------------------------- |
| Thermometer SC liquid (column + left half of the bulb)   | `Site Coordinator median: M (n=N SCs)`  |
| Thermometer POC liquid (column + right half of the bulb) | `POC median: M (n=N staff responses)`   |
| Distribution POC column             | `POC rating R: C response(s)`                    |
| Distribution SC point               | `SC rating R: C response(s)`                     |
| Axes, zones, legend, title          | _no tooltip_                                     |

#### User-facing strings & bins (config-driven)

All title/subtitle/axis-label/legend strings **and the performance-zone bins** are sourced from `fullCohortPlots.profileForms.impression` in [`sjglobal.profile.ts`](../../../../dataset/sjglobal.profile.ts): `titleTemplate`, `subtitle[]`, `frameSubtitle` (`{group}` = responder label), `chartTitles.{thermometer,distribution}`, `ratingAxisLabel`, `zones[]` (`{label,min,max,shade}` — the band color is resolved per-module from `colorMap[module][shade]`, not stored on the zone), `distribution.{leftAxisLabel,rightAxisLabel,xAxisLabel}`, and `legend.{sc,poc}`. The `{module}` placeholder is replaced at render time. Zones are the single source of truth for the Weak/Intermediate/Strong bins, shared by both charts.

Both series names sit together under `legend`. `poc` used to be nested at `distribution.legend.poc` while `sc` sat at the top level, so `renderImpression()` had to reassemble the pair; with one shared legend there is no reason for the split.

#### Architecture (alignment with v2 charts)

The impression view is **not** a standalone chart-type — the term node is already reachable inside profileForms. The two chart renderers are pure functions in their own modules, each appending its own `<svg>` into a holder div inside `rightDiv` (so the tooltip delegation covers them):

- **`renderImpressionThermometer.ts`** — exports `renderImpressionThermometer({ holder, id, sc, poc, ratingAxisLabel, zones, colors, attachTip })`, `IMPRESSION_MAX_SCORE`, `POC_FILL`, and the types `ImpressionZone`, `ImpressionPoc`, `ImpressionHover`, `AttachTip`, `ImpressionThermometerArgs`. One vessel per call, holding two liquid columns that run continuously from their medians down into a full split reservoir. All `defs` ids are prefixed with the passed `id`, since several thermometers render on one page (one per responder group).
- **`renderImpressionLegend.ts`** — exports `renderImpressionLegend({ holder, series, zones })` and the type `ImpressionSeriesSymbol` (`'line' | 'square'`). One row of swatches per card, each mirroring the mark that carries it in the response-distribution chart: a **line with a vertex dot** for the SC line series, a **square** for the POC columns, and squares for the zones at the bands' own `0.3` opacity. The thermometer's fills are the same two colors, so the same entries serve both charts. Zones are sorted low to high on a copy, since the caller's array is shared with both chart renderers.
- **`renderResponseDistribution.ts`** — exports `renderResponseDistribution({ holder, id, maxScore, scDistribution, pocDistribution, texts, zones, colors, attachTip })` and `POC_COLUMN_FILL`. One combo chart per call.
- **`profileForms.ts`** — `renderImpression()` draws a centered header (module title + subtitle) followed by the filter legend (applied filters + n) **once**, then a **bordered card** per responder group: the card header holds the group label, the body holds the thermometer + distribution side by side, and one shared legend sits under both. `fetchImpressionDistribution()` POSTs to `termdb/profileImpressionDistribution`, omitting `pocTermId` for SC-only modules and sending `pocResponderTermIds` when present.

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

1. **Type** — `pocTermId` and `pocResponderTermIds` are optional in `ProfileImpressionDistributionRequest`.
2. **Server** — with no POC float and no responder terms, `responders` is `[]` (SC-only); the response still carries `scMedian / scTotal / scDistribution`.
3. **profileForms client** — `init()` doesn't error on missing POC children (only SC absence is a real bug). `fetchImpressionDistribution()` omits `pocTermId`/`pocResponderTermIds` when unset.
4. **Render** — `renderImpression()` sees `responders.length === 0`, so it renders a single SC-only thermometer (POC fill skipped via the `poc == null` guard) and **no** distribution chart; the card legend drops the POC entry but still names the zones.

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
