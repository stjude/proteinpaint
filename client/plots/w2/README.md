# w2 whole-slide / spatial image viewer

How a slide file on disk (`.svs` or OME-TIFF) becomes pan-and-zoomable tiles in
the browser, which file does what at each step, and how the pieces combine.

## The pipeline at a glance

```
disk                      server (node)                    python                     client (browser)
----                      -------------                    ------                     ----------------
ds.queries.w2 roots  -->  termdb.wsiBySample.ts  ------------------------------->     Wsi.ts (mass plot)
  <sample>/<image>/       lists samples & images                                      sample table + image tabs
  slide + companions      from disk                                                        |
                                                                                           v
                          wsitiles.ts  <---------------------------------------      View.ts / wsi.direct.ts
                            /meta      ------>  wsi_tile.py meta                     OpenLayers Zoomify source
                            /tile/z/x/y ----->  wsi_tile.py tile  --> ONE JPEG       requests tiles as you pan/zoom
                            /boundaries         (per request, cached)                draws boundary + expression
                            /genecounts ----->  wsi_tile.py genecounts               overlays on top (spatial only)
```

There is no tile server and no redis: every tile is produced by spawning
`wsi_tile.py` once, and node caches the JPEG on disk so a tile is only ever
computed once per (slide, plane, z, x, y).

## Two ways in: the standalone plot vs the single-cell app

`Wsi.ts` is one component with two modes, decided by whether the plot config
carries a `sample`:

- **Standalone — the "Whole Slide Images" mass chart** (no `config.sample`).
  Lists every sample that has at least one *plain* slide on disk (the
  no-`sample_id` form of `termdb/wsiBySample` — spatial-only samples are not
  listed), renders the pick-a-sample table and one tab per image, and shows
  the plain OpenLayers viewer. Spatial images are filtered out of a listed
  sample's tabs, so this mode never shows the burger menu or any overlay
  machinery; the sandbox header stays WHOLE SLIDE IMAGES.
- **Inside the single-cell app — fixed-sample mode** (`config.sample.sID`
  set). The sc app probes `termdb/wsiBySample?sample_id=…` for the selected
  sample (`sc/model/SCModel.hasSpatialImage`) and, when a spatial image with
  its consolidated h5ad exists, shows a **Spatial** plot button
  (`sc/view/PlotButtons.ts`). Clicking it spawns this same `wsi` plot as an
  sc subplot with the sample pinned: the sample table is hidden, images are
  filtered to `type == 'spatial'`, the header becomes SPATIAL VIEWER, and the
  burger menu drives the overlays (steps 4–6 below). The viewer is
  self-contained — its settings live in its own burger menu and are not tied
  to the sc app's map plots (umap/tsne) in any way.

  Probe semantics: the probe only fires for datasets that can have spatial
  images — `termdbConfig.queries.w2` is a presence-only marker exposed by
  termdb.config.ts exactly when `ds.queries.w2` exists, and without it
  `hasSpatialImage` returns false with no request (a non-spatial sc dataset
  never generates wsiBySample traffic). Deliberately not gated on
  supportedChartTypes: an allowlist ds (e.g. mmrf) hides the standalone
  chart from the menu while still serving spatial images per sample.
  Successful probes are cached per sample; server error payloads and network
  failures return false UNCACHED so a later render retries, and an aborted
  request (a superseding state change) rethrows so the stale render stops.

So: spatial viewing is reachable only through the single-cell app, and the
standalone chart is images-only.

## Zoomify tile addressing (shared contract)

The client uses OpenLayers' `Zoomify` source, which addresses tiles as
`{z}/{x}/{y}`: `z` is the pyramid tier (0 = fully zoomed out, the whole slide
in one 256px tile-span; each tier doubles resolution), and `x`/`y` index 256px
tiles within that tier. `wsi_tile.py` re-implements the exact tier math of
`ol/source/Zoomify.js` (`num_tiers`, `tile_region`), so the crop the server
produces always matches the region the client expects — this shared geometry
is the contract that makes the whole pipeline line up.

## Step by step

### 1. Discovery — `server/src/routes/termdb.wsiBySample.ts`

`ds.queries.w2` (see `shared/types/src/dataset.ts`) configures up to two image
roots, both laid out as `<root>/<sample_id>/<imageName>/<files>`:

- `folder` — spatial (Xenium) images. Inside each image folder the slide and
  its consolidated data store are found by suffix match (`tiffFileSuffix`,
  `spatialDataFileSuffix` — the spatial.h5ad holding boundaries, annotations
  and expression).
- `wsiFolder` — plain whole-slide images (`.svs` / `.ome.tif`), one slide per
  image folder.

The route lists samples with plain slides (subfolder names of `wsiFolder` that
hold at least one slide — spatial-only samples are excluded, since spatial
images are viewed through the single-cell app's Spatial button instead) and,
per `sample_id`, that sample's images of both kinds. Each image is
returned as `WsiImage` (`type:'wsi'`) or `SpatialImage` (`type:'spatial'`,
plus tpmasterdir-relative companion paths and the optional dataset-level
viewer overrides `geneExpression`/`annotationLevel`/`cellTypes` — the actual
gene defaults are discovered from the expression file at runtime, see step 4;
`cellTypes: true` opens the spatial viewer with the cell-type overlay on).

### 2. Slide resolution & tile serving — `server/src/routes/wsitiles.ts`

All viewer traffic hits `wsitiles/:action`:

- **Slide addressing** (`slidePath()`): the query carries
  `genome, dslabel, sample_id, wsimage, imageType`. `wsimage` must be exactly
  `<imageName>/<slide file>`; `imageType` (`spatial`|`wsi`) pins resolution to
  the matching root so same-named paths in both roots can't collide. The
  resolved file must exist, be a regular file, and match the root's slide kind.
  A separate gated mode (`?slide=`, dev-only) takes a tpmasterdir-relative path.
- **`/meta`**: spawns `wsi_tile.py meta` → dimensions, mpp, level count,
  z-plane count, plus `version` (slide mtime) which the client bakes into tile
  URLs so a regenerated slide busts the immutable browser cache. With
  `?cellAnnotations=<h5ad>` it also reads the distinct `cell_type` values out
  of the consolidated store and adds `cellTypes: [...]` (sorted, cached by
  file mtime) — how the client discovers the types for its filter dropdowns
  up front — and, from that same `stat()`, `spatialVersion` (the h5ad's own
  mtime, independent of the slide file's), which the client bakes into the
  `/boundaries` and `/annotations` URLs below so a regenerated h5ad busts
  *their* cache the same way a regenerated slide busts tiles'.
- **`/tile/z/x/y`**: checks the disk cache
  (`cachedir/wsitiles/<sha1(slide:mtime)>_<plane>_<z>_<x>_<y>.jpg`); on a miss
  spawns `wsi_tile.py tile`, copies the produced JPEG into the cache, and
  serves it with `Cache-Control: immutable`.
- **`/boundaries`, `/annotations`, `/genecounts`, `/genenames`** (spatial
  only): all read the image's consolidated spatial.h5ad (`?file=`).
  `/boundaries` regenerates a polygon CSV (`?kind=cell|nucleus` — safe as CSV:
  ids and numbers only); `/annotations` answers `{cells:{cell_id:type}}` as
  JSON, since cell types are free text that CSV comma-splitting would corrupt;
  the gene actions answer per-cell counts of one gene / every gene name in the
  file. `?file=` is scoped to the selected slide's own image folder, so a
  valid slide query cannot read other samples' or datasets' files. The first
  two responses carry `Cache-Control: public, max-age=3600` with no slide-mtime
  versioning of their own, so the client appends `?v=<spatialVersion>` (from
  `/meta` above) to both requests — otherwise a reprocessed h5ad (e.g. a
  corrected cell-boundary export) would stay invisible behind the browser's
  stale hour-old cache of the old file's response. Both also accept an
  optional `?bbox=x0,y0,x1,y1` (µm) that restricts the answer to cells whose
  centroid falls in that box — see "Raster vs. vector rendering" below. A
  bbox request varies continuously with the view, so (unlike the whole-sample
  request) it is never written to `/boundaries`' own on-disk cache; it
  streams python's temp file straight through instead.
- **`/cellcount`** (spatial only): `{count}` — how many of the sample's cells
  fall in `?bbox=` (or the whole sample without one). Cheap regardless of
  sample size (reads only `obsm/spatial`, never the boundary polygons) — the
  raster-vs-vector decision below is built on it.
- **`/overlaytile/z/x/y`** (spatial only): a server-rendered PNG fill for one
  Zoomify tile, cached like `/tile` (keyed on h5ad version + tile address +
  the fill mode's own fingerprint, since the same tile must re-render if the
  color assignment or gene selection ever changes). `?slide_w=&slide_h=&
  mpp_x=&mpp_y=` come from the client's own already-fetched `/meta` (this
  action never opens the slide file itself); exactly one fill mode, mirroring
  the vector fills' own mutual exclusion — `?colors=` a `{type:'r, g, b'}`
  JSON object for cell-type fills, or `?genes=` a JSON gene-name array +
  `?rgb=&?max_count=` for a gene-expression fill (one gene, or several summed
  into one 'gene group' overlay, same as the vector path) — see "Raster vs.
  vector rendering" below.
- **`/nhood`, `/similar`** (spatial only): the lasso's neighborhood
  enrichment and its similar-region search — see sections 8 and 9 below.

### 3. Decoding & tile production — `python/src/wsi_tile.py`

One JSON job per process on stdin; `open_slide()` dispatches by extension:

- **`.svs` (and anything else)** → `openslide.OpenSlide`. OpenSlide handles the
  pyramid and decoding natively; these are 2D (one plane).
- **`.ome.tif` / `.ome.tiff`** → `OmeTiffSlide`, a small reader built on
  `tifffile` that mimics the slice of the OpenSlide API the tile job needs.
  It exists because Xenium morphology OME-TIFFs use JPEG-2000 TIFF compression
  (code 34712) that openslide cannot decode, and are 3D z-stacks.

For a `tile` job the flow is (identical for both formats, because
`OmeTiffSlide` mimics OpenSlide):

1. `tile_region()` maps `(z, x, y)` to a level-0 pixel rectangle and the
   output size (≤256×256; edge tiles are smaller).
2. `get_best_level_for_downsample()` picks the smallest pyramid level that is
   at least as sharp as the requested zoom, so as little data as possible is
   decoded.
3. `read_region()` reads that rectangle from the chosen level.
   In `OmeTiffSlide` this is where **tiles are combined**: `_read_level()`
   works out which TIFF segments (tiles, or strips treated as full-width
   tiles) the rectangle touches, `_decode_tile()` decodes each one (JPEG-2000
   segments via PIL, every other compression via tifffile's page decoder),
   and the decoded pieces are pasted into one numpy array at their pixel
   offsets, zero-padded at the edges. Grayscale uint16 planes (DAPI) are then
   contrast-scaled to 8-bit using a percentile taken once from the smallest
   pyramid level, so all tiles brighten uniformly.
4. The region is resized to the exact Zoomify output size and saved as one
   JPEG to a temp path, which node caches and serves.

`meta` returns the geometry the client needs before it can ask for tiles;
`genecounts` reads the 10x `cell_feature_matrix` HDF5 (CSC sparse) and returns
per-cell counts for one gene; `genenames` returns every gene name in that
file, in file order.

`h5ad_cell_count` and the `bbox=` parameter of `h5ad_csv`/`h5ad_annotations`
(`_bbox_cell_ids()`) all filter on `obsm/spatial` centroids only — a
cell-count check or a viewport-scoped fetch never touches the boundary
polygon store, so they stay cheap independent of sample size. `overlay_tile`
renders one Zoomify tile's worth of cell fills directly as a
transparent-background PNG (`tile_region()` for the crop geometry, same as a
normal `tile` job; PIL `ImageDraw.polygon()` for the fills) — the
server-rendered stand-in for per-cell vector data once a view holds more
cells than the client's limit (see the client section below). Two mutually
exclusive fill modes, mirroring the client's own vector fills: `type_colors`
(cell-type fills, the original mode) or `genes` + `rgb` + `max_count` (a
gene-expression fill — `_h5ad_gene_counts()`, shared with `genecounts()`,
looked up per gene and summed server-side for a gene group, so the client
never ships per-cell counts through the URL; shaded via `_gene_fill_alpha()`,
the same log-scaled SHADES=8 bucketing as the client's `expressionLayer`). It
currently scans every polygon in `uns/cell_boundaries` per tile (the store
isn't spatially indexed) — once per gene on top of that, for a gene fill —
and draws fills only, no strokes — both are deliberate simplifications for
now (ponytail comments on the function note the upgrade path: a spatial
index on the boundary store, and a second stroke-drawing pass).

### 4. Client rendering — `client/plots/w2/`

- **`Wsi.ts`** — the plot component for both modes above (rx component).
  Standalone it fetches the sample list and shows plain slides; in
  fixed-sample mode (spawned from the sc app) it shows the pinned sample's
  spatial image, renders the burger-menu controls (via `controlsInit`), and
  swaps the sandbox header to SPATIAL VIEWER. Gene defaults are
  **discovered from the data**: it
  calls `/genenames` on the image's expression h5, filters the dataset's
  optional `geneExpression` override to genes actually in the file (falling
  back to the file's first gene), seeds the Genes field with that, and
  attaches the full gene list to the field as a native `<datalist>` so typing
  autocompletes to real genes.
- **`model/Model.ts` / `viewModel/ViewModel.ts`** — thin data layer: query
  `termdb/wsiBySample` and shape the sample table rows.
- **`view/View.ts`** — renders the sample table, one tab per image
  (`imageName` folder labels), and the viewer. For a **plain WSI** it builds
  the OpenLayers map directly: a `Zoomify` source whose URL template hits
  `wsitiles/tile/{z}/{x}/{y}?wsimage=…&imageType=…&v=<version>`; OpenLayers
  then requests, caches, and mosaics the tiles client-side as the user pans
  and zooms — this is where tiles are **combined on screen**. For a
  **spatial** image it delegates to `wsi.direct.ts`, passing the burger-menu
  settings.
- **`wsi.direct.ts`** — the spatial/direct viewer. Same Zoomify map, plus a
  z-plane slider (from `meta.planes`) and the overlay/hover system described
  in the next section. Both entry points converge here: the direct URL
  (`?image_file=…`) and the mass plot (via `View.ts`), so overlay behavior is
  identical in both.
- **`Settings.ts` / `interactions/WsiInteractions.ts`** — the plot settings
  (selected sample/image, overlay toggles, genes, cell-type filter,
  annotation level) and the dispatchers that write them back into app state,
  triggering a re-render.

### 5. Overlays — `client/plots/w2/wsi.direct.ts`

All overlays are OpenLayers vector layers drawn over the tile layer, built
from the h5ad's cell/nucleus polygons (`/boundaries`, µm→px via `meta.mpp`).

- **Boundary strokes** — cell outlines green, nucleus outlines blue.
  `annotation_level=n` (burger: "Annotation level") shows them only within
  the n most zoomed-in levels; zoomed out beyond that they hide. Fills are
  not affected by this gate.
- **Gene expression fills** — one `/genecounts` request per gene
  (`gene_expression=g1,g2`, or the burger's Genes field). Each expressing
  cell is filled in the gene's color with opacity log-scaled to its
  transcript count, bucketed into 8 shades. `gene_groups` ("Gene group"
  mode) instead sums the listed genes per cell into ONE overlay. A gradient
  legend sits at the map's top-right.
- **Cell-type fills** — per-cell annotations come from the h5ad's
  `obs.cell_type`, fetched as JSON via `/annotations` (one entry per
  annotated cell). Each annotated cell is filled in its type's
  categorical color, with a legend at the top-left (cell counts per type in
  parentheses), placed clear of the zoom buttons. Toggled by the "Cell
  types" checkbox or `&cell_types=1`; without the annotations file the
  toggle is a no-op. A QC-filtered cell (empty `cell_type`) stays unfilled.
- **Cell-type filter** — fill only some types: `&cell_types=Tumor,B cells`
  on a URL, or the burger's "Types shown" chained dropdowns (one dropdown
  per selected type plus an "Add type…" dropdown of the remaining ones;
  no selection = all types). The available types are discovered up front by
  the meta request — `wsitiles/meta?cellAnnotations=<h5ad>` scans the file
  and returns `cellTypes:[…]`. Colors are assigned over `meta.cellTypes`'
  own sorted order (not abundance, as it used to be) — cheap regardless of
  sample size, and the SAME order the raster overlay below is colored by, so
  a type keeps its color both when the filter changes and when the view
  switches between raster and vector rendering.
- **Mutual exclusion** — cell-type fills and expression fills never draw
  together (unreadable on top of each other). While cell types are shown the
  expression fills/legend are suppressed, and in the mass plot the two
  checkboxes uncheck each other (last one toggled wins). The "Gene
  expression" checkbox only controls the *fills*: genes stay loaded either
  way so the hover tooltip always reports their counts.
- **Legend pinning** — the legends are absolutely positioned at the map's
  top corners; a scroll listener pushes them down by however much of the
  map's top is scrolled out of view (clamped to the map's bottom), so they
  stay visible as long as any of the image is. A `MutationObserver` on the
  whole page's `style`/`class` attributes (coalesced to one reposition per
  animation frame) catches layout shifts that aren't a scroll or a resize at
  all — the burger menu's own settings panel opens by changing its height/
  visibility style, which pushes the map down without firing either event.
  The scale bar (`client/plots/w2/scaleBar.ts`, bottom-right) solves the same
  problem on its own, self-contained `scroll`/`resize` listeners — it used to
  be a plain OL `Control` anchored to the map's own container, which scrolls
  normally with the page; on a map taller than the browser's own viewport
  (90vh plus whatever sits above it easily exceeds 100vh) that put the bar
  permanently below the fold, reported as "I can't see the scale bar" when
  it was, in fact, present and correctly styled, just scrolled out of view.
  Error banners (`sayerrorOnTop()`, wrapping `#dom`'s `sayerror()`) raise
  their own z-index above the legends/loading indicator for the same
  underlying reason: `.sja_errorbar` is `position:relative` with
  `z-index:auto`, which still paints BEHIND an explicitly z-indexed sibling
  in the same (page-root) stacking context — unreadable, hidden under
  whichever legend happened to be pinned over it at the time. The disabled
  lasso button's own hover tooltip (an `aria-label`-based CSS tooltip, see
  `client/src/style.css`'s `[aria-label]:hover:after`) had the identical
  problem for a subtler reason: `#dom`'s `getHolder()` sets the button's own
  wrapper to `z-index: 1` so the tooltip (itself `z-index: 10000`) outranks
  *plain* page content — but a child's z-index only matters within its own
  parent's stacking context; compared against this plot's own legend
  (`z-index: 10`), it's the WRAPPER's z-index (1) that loses, regardless of
  the tooltip's own value. Fixed by bumping the wrapper's z-index to 100
  after `icons.lasso()` runs.
- **Default framing** — the *first* vector load opens fit to the *sample's
  own cells* (the fetched boundary polygons' bounding box) rather than the
  whole slide canvas, unless `opts.focus` already picked a specific niche
  (the similar-search preview below). A no-op for a well-cropped
  single-section slide, where the cells already fill most of the frame — but
  some raw exports are a shared multi-section slide where a sample's own
  tissue is a small, oddly-placed fraction of a much larger image (two GEO
  accessions imaged on one physical Xenium slide, say); framing on the full
  canvas there left the cells too small to see, which looked like a
  missing-overlay bug rather than a framing one. Later vector rebuilds
  (panning into a new region once below the cell-count limit) don't refit —
  only the user's own pan/zoom moves the view after the first load.
- **Dataset defaults** — `ds.queries.w2` can set `cellTypes: true` to open
  the spatial viewer with the cell-type overlay on (seeded once into the
  burger settings, expression fills off; the checkboxes override after).

### 5b. Raster vs. vector rendering — `client/plots/w2/wsi.direct.ts`

Fetching and rendering every cell's polygon doesn't scale: a 700k-cell sample's
boundary CSV can approach V8's ~512MiB max string length (the exact bug that
motivated this — see `/boundaries`' own streaming fix in section 2), and even
once that's fixed, holding every ring as one `MultiPolygon` OpenLayers feature
is a large in-memory and render-time cost the browser pays regardless of how
much of it is actually on screen. `opts.cellCountLimit` (default
`DEFAULT_CELL_COUNT_LIMIT` = 20,000) draws the line: above that many cells in
the *current view*, a server-rendered raster image stands in for the vector
overlays; at or below it, the normal per-cell vector pipeline (boundaries,
annotations, type/expression fills, hover, lasso) runs as described above,
scoped to just that view.

- **Mode decision (`updateMode()`)** — on load and on every `moveend`, the
  view's extent is converted to a µm bbox (`viewBboxUm()`, the inverse of
  `focusExtent()`'s own transform) and sent to `wsitiles/cellcount`. Above the
  limit: raster. At or below it: vector, but only re-fetched when the mode
  just switched TO vector or the new bbox isn't already contained in what's
  loaded (`bboxContains()`) — a small pan within an already-fetched region
  (itself padded 50% past the exact viewport, `padBbox()`) is a no-op, not a
  refetch. A failed `/cellcount` call leaves the current mode as-is rather
  than guessing. The 50%-a-side padding covers up to 4x the viewport's own
  area, so its own cell count is re-checked with a second `/cellcount` call
  before actually fetching it (`choosePaddedFetchBbox()`): a sparse or empty
  viewport sitting right next to denser tissue just outside it could
  otherwise make the padded fetch cost far more than `cellCountLimit` cells
  — exactly the large-CSV/polygon-memory cost this whole switch exists to
  avoid — so the fallback is the exact (unpadded) viewport, already
  confirmed under budget by the first `/cellcount` call above.
- **Concurrency (`modeGeneration`)** — `moveend` can fire again before a
  previous `updateMode()`'s own `await`s (cellcount, `buildVector()`'s own
  fetches) resolve, with nothing serializing them: a slow vector build
  finishing after a newer, faster raster decision could otherwise restore
  stale layers and re-enable the lasso for what is, by then, a dense view,
  and two overlapping `buildVector()` calls writing the same
  `cellPolys`/`cellTypes`/`vectorLayers` could mix one build's polygons with
  another's annotations. A generation counter, bumped at the very top of
  every `updateMode()` call before any other side effect, is checked at
  every resumption point after an `await` in both `updateMode()` and
  `buildVector()` (which takes the caller's generation as a parameter) —
  superseded calls stop before committing anything further, rather than
  overwriting a newer result once they finally resolve. The `moveend`
  listener is also registered BEFORE the initial `updateMode()` call, not
  after: a pan/zoom during that first, still-awaited call used to fire with
  no listener attached yet to catch it.
- **Raster mode** — one persistent `Zoomify`-tiled `TileLayer` per
  `rasterFills` entry (same tile grid as the slide itself) pointed at
  `wsitiles/overlaytile/{z}/{x}/{y}`, just shown/hidden by `updateMode`
  rather than re-created per transition. `rasterFills` is decided ONCE
  (the burger's checkboxes choose it, not the viewport, so it never changes
  without a full re-render), mirroring the vector fills' own mutual
  exclusion: cell-type fills (`showCellTypes` on, at least one type
  selected) win when both are requested; otherwise, if gene expression fills
  are on (`geneCounts.length && !hideExpressionFills`), one raster layer per
  `geneCounts` entry (one gene, or the one summed gene-group overlay) —
  `overlay_tile` re-sums the group's genes server-side itself rather than
  the client shipping per-cell counts through the URL. With neither
  requested, `rasterFills` is empty and raster mode has nothing to draw (see
  `overlay_tile`'s own ponytail note on strokes — there is no bare
  "boundaries only" raster mode). Boundary strokes, hover, and the lasso are
  all unavailable in this mode regardless of which fill is shown.
- **Vector mode** — `buildVector(bbox)` fetches `/boundaries` (cell +
  nucleus) and `/annotations` scoped to `bbox`, tears down the previous
  view's layers/legends first (`teardownVector()`), and rebuilds the stroke/
  type-fill/expression-fill layers from just that region's cells. Gene
  counts themselves are fetched once for the whole sample (not bbox-scoped —
  one int per expressing cell is far lighter than a boundary CSV's repeated
  vertices, so it hasn't needed to be) and reused by every rebuild; only
  which cells to actually draw changes.
- **Hover and lasso, set up once** — the tooltip and lasso's `Draw`
  interaction/control/menu are created a single time (whenever `spatialData`
  is given at all), not per mode transition. They close over the same
  mutable `cellPolys`/`cellTypes`/`index` the hover tooltip already used, so
  a rebuild just changes what those point at; the listeners themselves are
  never torn down or re-attached. The lasso button is explicitly
  enabled/disabled by mode (`setLassoEnabled()`) — disabled, it clears any
  in-progress drawing and ignores clicks, since raster mode's cell count is,
  by definition, too large for the lasso's selection/enrichment flow to stay
  cheap.
- **Color consistency** — a stable `type -> 'r, g, b'` assignment, built once
  from `meta.cellTypes`' own sorted order (see the cell-type filter bullet
  above), is the single source of truth both rendering paths draw from:
  vector mode's `cellTypeLayer` fill, and the `colors=` JSON object sent to
  `wsitiles/overlaytile`. A type never changes color when the view crosses
  the cell-count threshold. Gene colors are likewise assigned once (one
  `GENE_COLORS` slot per `geneCounts` entry, by position) and carried on
  each entry (`.rgb`, plus `.genes` — the underlying gene list a group
  overlay needs to re-sum), so a gene/gene-group keeps the exact same color
  whether `expressionLayer` (vector) or `overlay_tile`'s `genes=`/`rgb=`
  (raster) is drawing it.
- **Loading indicator** — a "Loading…" box, centered over the map. A
  reference count (`beginLoading()`/`endLoading()`) held open by both
  `updateMode()`'s own `/cellcount` fetch and the map's own pending tile
  loads — tracked via OL's map-level `loadstart`/`loadend` events, which
  fire based on EVERY layer's tile queue collectively (slide tiles and
  however many raster layers there are, not just the raster overlay), the
  same authoritative signal OL itself uses rather than a hand-rolled
  per-source counter (an earlier, per-source `tileloadstart`/`tileloadend`
  version raced: a newly panned-into tile often hadn't started loading yet
  at the exact instant it was checked). Without this, the slide's own tiles
  render first and the cell overlay visibly catches up later. Vector mode
  has no equivalent tile latency of its own: its fetch IS the wait, so it
  calls `endLoading()` the moment `buildVector()` resolves. A
  `STUCK_LOADING_MS` (8s) fallback timer force-hides the indicator and
  resets the count if it's never cleared naturally — OL only dispatches
  `loadend` once its WHOLE tile queue settles, so a single tile stuck
  erroring/retrying (flaky network, a transient 5xx) could otherwise leave
  the indicator up forever.

### 6. Cell hover — `client/plots/w2/wsi.direct.ts`

Whenever cell boundaries are loaded, hovering over a cell shows a tooltip
next to the cursor:

```
cell id: aaabkgcd-1
cell type: Tumor          (when the h5ad carries annotations)
PTPRC expression: 12.0    (one line per loaded gene / gene group)
```

The hit test is a per-cell bounding-box scan plus an even-odd ray cast
(`pointInRing`, unit-tested). The tooltip obeys the same zoom gate as the
boundary strokes: with `annotation_level` set it only appears within the n
most zoomed-in levels. Expression lines come from the same `/genecounts`
data as the fills, so they work even when the fills are hidden (cell types
shown, or "Gene expression" unchecked).

### 7. Lasso selection — `client/plots/w2/wsi.direct.ts`

A control button under the map's zoom buttons (`sjpp-wsi-lasso-btn`) toggles
an OpenLayers `Draw` interaction in freehand polygon mode; while it is on,
dragging draws instead of panning. The drawn ring lives on its own vector
layer (orange). On release, `cellsInLasso()` keeps every cell whose centroid
(vertex mean) falls inside the ring — candidates come from the same RBush
bbox index the hover uses, queried with the ring's extent, so a lasso costs
one ray cast per candidate, not per cell. Selection is not gated by
`annotationLevel`, but it IS gated by the raster/vector mode (section 5b):
disabled while the view is dense enough to be in raster mode.

The result opens a `Menu` (`sjpp-wsi-lasso-menu`): a headline count, a
per-type tally (`sjpp-wsi-lasso-summary`, descending, unannotated last —
the input the neighborhood enrichment step will take), and a `renderTable`
of cell id + type (`sjpp-wsi-lasso-table`). One lasso at a time: a new
drawing replaces the old, and toggling the button off clears the ring and
menu.

### 8. Neighborhood enrichment — `wsitiles/nhood`, `python/src/wsi_tile.py`

The lasso menu's **Neighborhood enrichment** button (`sjpp-wsi-nhood-btn`,
shown only when the h5ad carries cell types AND the current lasso selection
has at least 2 distinct annotated types — the server rejects anything less
anyway (see below), so the button simply isn't offered for a selection that
could only ever error — and hidden in favor of a warning once the selection
is too large — see the workload cap below) POSTs
`{file, ids, k, perms}` to `wsitiles/nhood` — ids only, since the server
reads the selected cells' `obsm/spatial` centroids and `obs/cell_type` from
the h5ad itself. The route bounds `k` (default 6, 1–30), `perms` (default
1000, 10–5000) and `seed`, then runs `nhood_enrichment()` in `wsi_tile.py`, a
scipy/numpy port of the squidpy pipeline the MMRF notebook uses
(`sq.gr.spatial_neighbors(coord_type='generic', n_neighs=6)` +
`sq.gr.nhood_enrichment`):

1. A **directed** kNN graph over the selected cells' centroids
   (`_knn_edges`): each cell → its k nearest others (squidpy's KNNBuilder
   does not symmetrise). k is capped at `cells - 1` for a tiny selection.
2. `count[a][b]` (`_knn_count`) = number of kNN edges from a type-a cell to
   a type-b neighbour — the real, observed tally.
3. The same cells are relabelled by a random permutation of their types
   `perms` times, re-tallying `count` each time (`_permute_zscore`); the
   observed count is turned into a z-score against that permutation
   distribution's mean/population-std. A pair whose count never varies
   across permutations (tiny or lopsided selections) has std 0 — reported as
   `null` (not a stderr warning, which `run_python()` would treat as a
   failure) rather than `NaN`/`Infinity`.

Unannotated cells are dropped first (reported as `skipped`); unknown ids are
ignored. Fewer than two types, or fewer than two annotated cells, comes back
as `{error}`. The response also includes `typeCounts` (per-type composition,
aligned to `types`) — not used by the heatmap itself, but the exact query
signature the similarity search below is built from.

**Workload cap**: `ids.length * k * perms` is the actual cost (one
permutation re-tallies every edge), so the route rejects a request over 50M
regardless of how `k`/`perms` individually clamp — a selection alone can't
be bounded server-side without spawning python, so the client mirrors the
same cap at the button's default k=6/perms=1000 and shows a message instead
of the button for an oversized lasso, before ever making the request.

The client draws the answer with `renderNhoodHeatmap()` into a panel under
the map (`sjpp-wsi-nhood`, one at a time): a diverging blue–gray–red
matrix symmetric around 0, the z-score printed in every cell, a hover
tooltip with the edge count, a legend bar, k/permutation inputs that rerun
the same selection, and a close button. Directly below it (same panel), the
**Find similar regions** controls from the next section pick up where this
leaves off.

### 9. Similar-region search — `wsitiles/similar`, `python/src/wsi_tile.py`

Below the heatmap, `renderSimilarSearch()` offers to search for niches
elsewhere that resemble the just-analyzed selection — in this same sample
(a different location) or in any other spatial sample of the dataset
(`termdb/wsiBySample?imageType=spatial` lists candidates, this sample listed
first as "(this sample)"). Only the query's **signature** — `types`,
`typeCounts`, `count`, optionally `zscore`, all already computed by the
neighborhood enrichment above — travels to the server; the source h5ad is
never read again, so the search only ever opens the *target* sample's file.

Searching **this** sample needs no dataset at all — it reuses the viewer's
own already-known addressing (`opts.spatialData` + the same `slideQuery`/
`slide=` fallback `init()` computed), so the option is offered in direct-file
mode too (`runpp ?image_file=…`, no `genome`/`dslabel`/`sampleId`). Listing
the dataset's *other* spatial samples does need `genome`/`dslabel` and is
skipped without them, leaving the sample dropdown a single "this image" entry
in that mode.

**Two-stage, coarse-to-fine** (`similar_regions()` in `wsi_tile.py`): the
target's cells (restricted to the query's own type vocabulary — a cell of
any other type is ignored, like an unannotated one) are tiled into
`window`-sized, `stride`-spaced square windows (overlapping when
`stride < window`). The client forwards the query's own `k`/`perms` (the
values `query.count`/`query.zscore` were actually computed with — the
heatmap's rerun controls can change these before searching) alongside the
signature, so every target window's kNN graph and rigorous confirmation use
the SAME parameters as the query; comparing graphs built at different
neighbourhood sizes, or z-scores with different permutation-noise levels,
would otherwise skew the ranking. Two workload guards, mirroring the `/nhood` route's cap
but computed here since window count depends on the target's own extent:
`windows × cells > 200M` rejects the whole scan outright (use a larger
window/stride); the rigorous-confirmation stage below shares a single 50M
budget across all `topK` windows it confirms (decremented by each window's
actual `cells × k × perms` as it's spent, not a fresh 50M per window), so a
window that would exceed what's left of it just skips confirmation — its
cheap score still stands — rather than the search failing outright or the
total cost scaling with `topK`.

Candidates that pass every filter below are kept in a **bounded min-heap of
at most `topK` entries**, not a list of every survivor — overlapping windows
routinely leave thousands passing, each carrying its own member-cell-index
array, and retaining all of them until a final sort could hold hundreds of MB
to over 1GB resident alongside the permutation matrices for a result only the
top few ever use.

For every window, in order:

1. **Size filter** — dropped if its cell count falls outside
   ±`sizeTolerance` (client: "size tolerance ±_%", default 10%) of the
   query's own cell count. A similar niche has to be a similar *size*, not
   just a similar mix — otherwise a tiny or huge window could win purely on
   composition.
2. **Same-sample exclusion** — only when searching this sample: dropped if
   more than 50% of its cells are among the query's own selected ids
   (`excludeIds`, threaded through by the client only when the chosen target
   sample equals the source sample — cell ids are per-h5ad, so this is never
   sent cross-sample). Without it, the reference region would trivially
   "find" itself.
3. **Required types** — dropped if it's missing any type the user checked
   "require _ present" for (client: one checkbox per query type, none
   checked by default). A hard gate: no partial credit for scoring well
   otherwise.
4. **Cheap score** — a composition vector (fraction of cells per type) and a
   row-normalized kNN neighbour-count matrix (same kNN construction as
   `nhood_enrichment`, no permutation test) are built for the window and
   compared to the query's own by cosine similarity. Both vectors are first
   scaled by `typeWeights` (client: a "weight" number input per type,
   default 1) — a composition entry for type i by `weight[i]`, an adjacency
   entry (i,j) by `weight[i]*weight[j]` — so weighting a type to 0 removes it
   from the score entirely and a high weight makes matching that type's
   amount/pattern dominate the ranking. Unlike "required", a heavily-weighted
   type is never *guaranteed* present — it's a soft emphasis on top of the
   hard gate, not a replacement for it.

The `topK` (default 10) highest cheap scores are then **confirmed**: each
gets the exact same permutation z-score test `nhood_enrichment` runs
(weights play no part here — this is the real statistical test, not a
tunable score), and — when the query carried a `zscore` matrix — a
`distance` to it (mean absolute difference over cell-type pairs finite in
both; a pair with no cells of one of its types on either side is simply
excluded from the average, not penalized). Results are re-ranked by that
distance, the more rigorous of the two scores.

The client's results table (`sjpp-wsi-similar-niche`'s sibling) lists each
returned window's cell count, its %-difference from the reference, cheap
score, distance, and center coordinates. **Clicking a row** re-enters this
same viewer (`init()`) addressed at the target image, panned and zoomed to
that window (`opts.focus` → `focusExtent()`, the same µm→px transform
`parseBoundaries` uses) with a dashed outline drawn around it, and renders
that window's own enrichment heatmap directly underneath — using the
z-score/count matrices the confirmation stage already computed, no extra
request — so the reference niche's heatmap (still visible above, unscrolled)
and the candidate's sit side by side for a direct comparison.

## SVS vs OME-TIFF: what actually differs

| step | .svs | .ome.tif |
|---|---|---|
| discovery | `wsiFolder` root, matched by extension | `folder` root, matched by `tiffFileSuffix` |
| decoding | openslide (native) | `OmeTiffSlide`: tifffile structure + PIL (JP2K) or tifffile decoder (other codecs) |
| planes | 1 | z-stack; `plane` job param, slider in the viewer |
| pixel type | RGB 8-bit | often uint16 grayscale → percentile contrast-scale to 8-bit |
| overlays | none | boundaries + gene expression via companion files |

Everything downstream of `open_slide()` — tier math, level choice, JPEG
output, node caching, OpenLayers display — is shared between the two formats.
