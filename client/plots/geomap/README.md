# geomap — world map with location pins

A generic, dataset-agnostic mass chart that drops pins on a d3-geo world map. It knows nothing about any
specific dataset — it renders a list of `{ id, name, lat, lon }` markers and optionally emphasizes a subset.
careReg uses it to pin registry **sites**; another dataset could pin **countries** (centroids) or anything
else with coordinates.

## Files
- `Geomap.ts` — the mass plot (`chartType: 'geomap'`), registered in `../importPlot.js`. Thin wrapper.
- `render.ts` — `renderGeomap(holder, geomap, tip?)`, the standalone renderer. Shared by the plot and the
  mass **about** (landing) tab (`client/mass/about.ts`).
- `helpers.ts` — pure helpers (`getValidSites`, `getHighlightSet`, `createProjection`, …) + the world basemap.
- `world.json` — Natural Earth 110m countries GeoJSON basemap (lazy-loaded with the plot).

## Data model
- `GeomapConfig` / `GeomapSite` (`shared/types/src/dataset.ts`): `sites?: {id,name,lat,lon}[]` and
  `highlightIds?: string[]`.
- Pins are **point markers**. Country-level maps use country **centroid** points. Polygon/choropleth fills are
  not supported (a future enhancement).

## Add a map to a dataset (the contract)
1. **Enable it.** In the dataset config set `cohort.termdb.geomap = {}` and, to show it on the landing tab,
   `cohort.massNav.tabs.about.showGeomap = true`. (`geomap` present + the `geoLocation` table existing is what
   the server gates on.)
2. **Provide the pins.** Supply a **coordinate xlsx** and, in the dataset's build, run the shared converter
   `utils/termdb/xlsx_to_geolocation.py <coords.xlsx> geolocation.tsv [--sheet NAME]` to produce a
   `geolocation.tsv`, then pass it to buildTermdb as `geoLocation=geolocation.tsv`. The generic `geoLocation`
   table (defined in `utils/termdb/create.sql`) is loaded from it; at server init `buildGeomapSites`
   (`server/src/termdb.server.init.ts`) reads it into `termdb.geomap.sites`. `id` is the marker's
   link/highlight key (a site code for careReg, a country/ISO code for a country map, etc.).

   **Coordinate xlsx contract** (first sheet or `--sheet`; row 1 = headers, case-insensitive, with aliases):
   `id` (or code / site code / entity site code / iso), `name` (or preferred name / label), `latitude`
   (or lat), `longitude` (or lon / long / lng). If separate lat/lon columns are absent, a single
   "latitude and longitude" (or coordinates / lat/lon) column is split on the comma. Rows without valid,
   in-range coordinates are skipped. The converter is stdlib-only (no openpyxl) so it reads even quirky
   exports.
3. **Highlight a subset (optional).** Set `geomap.highlightIds` to the ids to emphasize. It's generic — the
   plot highlights any pin whose `id` is in the set. Datasets compute it however they like; careReg injects it
   per request in `pruneTermdbConfig` from `clientAuthResult.sites`. Datasets without a highlight hook simply
   show all pins.

Nothing dataset-specific lives here or in the server read — a dataset just points the shared converter at its
own coordinate xlsx and (optionally) owns its highlight logic.
