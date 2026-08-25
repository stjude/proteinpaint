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
  its companion files are found by suffix match (`tiffFileSuffix`,
  `cellBoundariesFileSuffix`, `nucleusBoundariesFileSuffix`,
  `geneExpressionFileSuffix`).
- `wsiFolder` — plain whole-slide images (`.svs` / `.ome.tif`), one slide per
  image folder.

The route lists samples (subfolder names of the roots, unioned with the legacy
`wsimages` sql table when present) and, per sample, its images. Each image is
returned as `WsiImage` (`type:'wsi'`) or `SpatialImage` (`type:'spatial'`,
plus tpmasterdir-relative companion paths and the optional dataset-level
viewer overrides `geneExpression`/`annotationLevel` — the actual gene
defaults are discovered from the expression file at runtime, see step 4).

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
  URLs so a regenerated slide busts the immutable browser cache.
- **`/tile/z/x/y`**: checks the disk cache
  (`cachedir/wsitiles/<sha1(slide:mtime)>_<plane>_<z>_<x>_<y>.jpg`); on a miss
  spawns `wsi_tile.py tile`, copies the produced JPEG into the cache, and
  serves it with `Cache-Control: immutable`.
- **`/boundaries`, `/genecounts`, `/genenames`** (spatial only): serve a
  companion CSV / per-cell counts of one gene / the list of all genes present
  in the companion HDF5. `?file=` is scoped to the selected slide's own image
  folder, so a valid slide query cannot read other samples' or datasets' files.

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

### 4. Client rendering — `client/plots/w2/`

- **`Wsi.ts`** — the mass "Whole Slide Images" plot (rx component). Fetches
  the sample list, renders the burger-menu controls for spatial images (via
  `controlsInit`), and swaps the sandbox header to SPATIAL VIEWER when the
  shown image is spatial. Gene defaults are **discovered from the data**: it
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
- **`wsi.direct.ts`** — the spatial/direct viewer. Same Zoomify map, plus:
  a z-plane slider (from `meta.planes`), boundary overlays (fetches the
  cell/nucleus CSVs via `/boundaries`, converts µm→px with `meta.mpp`, draws
  them as OpenLayers vector layers, hidden beyond `annotationLevel` zooms),
  gene-expression fills (per-gene `/genecounts` requests; each cell
  polygon filled with a log-scaled opacity, one color per gene or one summed
  `gene_groups` overlay, with a legend on the map), and an optional
  **cell-type overlay**: when the cell boundaries CSV carries an extra
  `cell_type` column (per-cell annotations merged into the Xenium export),
  each annotated cell is filled in its type's categorical color with its own
  legend (top-left; genes keep top-right). Off by default — toggled by the
  "Cell types" burger-menu checkbox in the mass plot, or `&cell_types=1` on a
  direct-viewer URL. A CSV without the column makes the toggle a no-op.
- **`Settings.ts` / `interactions/WsiInteractions.ts`** — the plot settings
  (selected sample/image, overlay toggles, genes, annotation level) and the
  dispatchers that write them back into app state, triggering a re-render.

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
