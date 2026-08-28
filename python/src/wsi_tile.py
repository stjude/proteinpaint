#!/usr/bin/env python3
"""
wsi_tile.py — standalone WSI tile/metadata CLI for the ProteinPaint WSI viewer.
Replaces the tile server + redis: no server, no state. Node's run_python()
spawns it once per request, pipes a JSON job on stdin, and reads stdout.

Jobs (JSON on stdin, `action` selects):
  {"action":"meta","slide":"/abs/slide.svs"}
      -> stdout: {"slide_dimensions":[w,h],"mpp":..,"levels":..,"tileSize":256}
  {"action":"tile","slide":"/abs/slide.svs","z":9,"x":0,"y":0,"plane":3}
      -> writes ONE JPEG to a temp path, stdout: that path (node sends+deletes it)
      (`plane` optional: z-plane of a 3D OME-TIFF stack; default = middle plane)
  {"action":"genecounts","h5":"/abs/cell_feature_matrix.h5","gene":"ACE2"}
      -> stdout: {"cells":{cell_id:count,...},"max":..} — per-cell counts of one
      gene from a 10x cell_feature_matrix HDF5; {"error":..} if gene not found

Tiles are Zoomify-compatible: geometry is copied from OpenLayers'
ol/source/Zoomify.js 'default' tier math, so the client's tile requests and this
script's crop geometry never disagree.

Formats: anything openslide opens (.svs etc.), plus OME-TIFF (.ome.tif, e.g.
Xenium morphology images), read via tifffile: JPEG-2000 segments (34712 etc.,
which openslide cannot decode) through PIL, all other compressions and striped
layouts through tifffile's own segment decoder, which rejects codecs it cannot
decode with a clear error.

Deps: openslide-python, pillow, tifffile, numpy, h5py. Avoid writing non-fatal
warnings to stderr (run_python() rejects on any stderr output).

Dev usage (bypasses stdin):  python wsi_tile.py --test
"""

import io          # BytesIO: hand an in-memory JPEG-2000 codestream to PIL
import json        # stdin job parsing / stdout result encoding
import math        # ceil for edge-tile output sizes
import re          # extract PhysicalSizeX/Y from the OME-XML metadata blob
import sys         # stdin/argv access in main()
import tempfile    # temp path for the one output JPEG per tile job

import numpy as np       # pixel array assembly and contrast math
import openslide         # native decoder for .svs and other openslide formats
import tifffile          # TIFF/OME-TIFF structure walking + non-JP2K decoding
from PIL import Image    # JP2K decode, resize, JPEG encode

# huge whole-slide reads must not trip PIL's DecompressionBomb warning, which
# would land on stderr and make run_python() reject.
Image.MAX_IMAGE_PIXELS = None

# Zoomify tile edge in px; must match the client's ol/source/Zoomify default
TILE_SIZE = 256


# --- Zoomify pyramid geometry (mirrors ol/source/Zoomify.js 'default') -----

def num_tiers(w, h, tile=TILE_SIZE):
    # count how many times the tile span must double until it covers the slide
    tiers, eff = 0, tile
    # eff is the level-0 pixel span of one tile at the current (coarsest) tier
    while w > eff or h > eff:
        tiers += 1     # one more tier needed
        eff += eff     # doubling eff == halving that tier's resolution
    # +1: the fully-zoomed-out tier where the whole slide fits in one tile
    return tiers + 1


def tile_region(w, h, z, x, y, tile=TILE_SIZE):
    """Zoomify (z,x,y) -> (x0,y0,w0,h0,out_w,out_h) in level-0 px, or None."""
    tiers = num_tiers(w, h, tile)          # total tier count for this slide
    if not (0 <= z < tiers):               # z outside the pyramid
        return None
    ds = 1 << (tiers - 1 - z)              # downsample factor of tier z (2^n)
    span = tile * ds                       # level-0 px covered by one tile at z
    x0, y0 = x * span, y * span            # top-left corner of the tile crop
    if x0 >= w or y0 >= h:                 # tile entirely off the slide
        return None
    w0, h0 = min(span, w - x0), min(span, h - y0)  # crop size, clipped at edges
    # out_w/out_h: pixel size of the JPEG (<= tile; smaller for edge tiles)
    return x0, y0, w0, h0, math.ceil(w0 / ds), math.ceil(h0 / ds)


# --- OME-TIFF reader -------------------------------------------------------

class OmeTiffSlide:
    """Pyramidal OME-TIFF reader exposing the small slice of the OpenSlide API
    used below (dimensions, level_count, level_downsamples,
    get_best_level_for_downsample, read_region, properties, close).

    Grayscale uint16 planes (DAPI etc.) are contrast-scaled to 8-bit using a
    global percentile from the smallest pyramid level, so all tiles brighten
    uniformly. For a 3D z-stack (e.g. morphology.ome.tif, axes ZYX) `plane`
    picks the z-plane; default is the middle one, typically best-focused.
    """

    def __init__(self, path, plane=None):
        self._tf = tifffile.TiffFile(path)          # open the TIFF container
        self._levels = self._tf.series[0].levels    # pyramid levels of the first series
        self.plane_count = len(self._levels[0].pages)  # z-planes; 1 for 2D
        # reject rather than clamp: node caches tiles under the *requested*
        # plane value, so silently mapping many planes to one would fill the
        # cache with duplicate JPEGs under distinct keys
        if plane is not None and not 0 <= int(plane) < self.plane_count:
            raise ValueError(f"plane {plane} out of range [0, {self.plane_count})")
        # default to the middle z-plane, typically the best-focused one
        self._plane = self.plane_count // 2 if plane is None else int(plane)
        # non-first z-planes are TiffFrame objects without tag attributes;
        # .keyframe carries the geometry, which all planes of a level share
        base = self._levels[0].pages[self._plane].keyframe
        self.dimensions = (base.imagewidth, base.imagelength)  # level-0 (w, h)
        self.level_count = len(self._levels)                   # pyramid depth
        # per-level downsample factor relative to level 0, from the width ratio
        self.level_downsamples = [
            self.dimensions[0] / lvl.pages[self._plane].keyframe.imagewidth for lvl in self._levels
        ]
        self.properties = {}  # populated below with openslide-style mpp keys
        # pull microns-per-pixel out of the OME-XML (PhysicalSizeX/Y attributes)
        for axis, key in (("X", "openslide.mpp-x"), ("Y", "openslide.mpp-y")):
            m = re.search(r'PhysicalSize%s="([\d.eE+-]+)"' % axis, self._tf.ome_metadata or "")
            if m:
                self.properties[key] = m.group(1)  # keep as string, like openslide
        self._scale = None  # lazy 8-bit contrast reference

    def close(self):
        self._tf.close()  # release the file handle

    def get_best_level_for_downsample(self, ds):
        # walk the (ascending) downsamples; keep the last level still <= ds,
        # i.e. the smallest level that is at least as sharp as requested
        best = 0
        for i, d in enumerate(self.level_downsamples):
            if d <= ds + 0.01:  # +0.01 absorbs float rounding in the ratios
                best = i
        return best

    # TIFF compression codes whose segments are standalone JPEG-2000
    # codestreams that PIL opens directly (Aperio 33003/33005, JP2K 34712)
    _JP2K = {33003, 33004, 33005, 34712}

    def _decode_tile(self, page, index):
        count = page.databytecounts[index]  # stored byte length of segment `index`
        if not count:
            return None  # missing tile = background
        fh = self._tf.filehandle            # the underlying open file
        fh.seek(page.dataoffsets[index])    # jump to the segment's file offset
        data = fh.read(count)               # raw (still compressed) segment bytes
        kf = page.keyframe                  # tag values live on the keyframe
        if int(kf.compression) in self._JP2K:
            img = Image.open(io.BytesIO(data))  # JP2K codestream
            img.load()                          # force the actual decode now
            return np.asarray(img)              # PIL image -> numpy array
        # any other compression (raw, LZW, Deflate, ...): tifffile's own segment
        # decoder, which raises a clear error for codecs it cannot decode
        arr = kf.decode(data, index)[0]  # (depth, h, w, samples)
        # collapse the depth axis; keep (h, w, samples)
        arr = arr.reshape(arr.shape[-3], arr.shape[-2], arr.shape[-1])
        # single-sample data becomes a 2D grayscale array
        return arr[:, :, 0] if arr.shape[2] == 1 else arr

    def _read_level(self, level, lx, ly, w, h):
        """(lx,ly,w,h) in level coords -> array, zero-padded at edges."""
        page = self._levels[level].pages[self._plane]  # the requested plane at this level
        kf = page.keyframe  # geometry lives on the keyframe (see __init__)
        # tiled layout, or striped (tilewidth 0): a strip is a full-width tile
        tw = kf.tilewidth or kf.imagewidth
        th = kf.tilelength or min(kf.rowsperstrip, kf.imagelength)
        tiles_across = -(-kf.imagewidth // tw)  # ceil-div: segments per row
        out = None  # allocated lazily once the first segment reveals the dtype/bands
        # segment-grid range [tx0..tx1] x [ty0..ty1] touched by the rectangle
        tx0, tx1 = max(0, lx) // tw, max(0, min(lx + w - 1, kf.imagewidth - 1)) // tw
        ty0, ty1 = max(0, ly) // th, max(0, min(ly + h - 1, kf.imagelength - 1)) // th
        for tr in range(ty0, ty1 + 1):        # each segment row
            for tc in range(tx0, tx1 + 1):    # each segment column
                # decode segment (tr, tc); row-major index into the flat lists
                arr = self._decode_tile(page, tr * tiles_across + tc)
                if arr is None:
                    continue  # missing segment stays zero (background)
                if out is None:
                    # first decoded segment defines gray vs multi-band output
                    out_shape = (h, w) if arr.ndim == 2 else (h, w, arr.shape[2])
                    out = np.zeros(out_shape, dtype=kf.dtype)
                x0, y0 = tc * tw, tr * th  # segment's top-left in level coords
                # intersection of the segment with the requested rectangle
                ix0, iy0 = max(lx, x0), max(ly, y0)
                ix1 = min(lx + w, x0 + arr.shape[1])
                iy1 = min(ly + h, y0 + arr.shape[0])
                if ix1 <= ix0 or iy1 <= iy0:
                    continue  # no overlap after clipping
                # paste the overlapping part into the output at its offset —
                # this is where the individual TIFF segments are combined
                out[iy0 - ly:iy1 - ly, ix0 - lx:ix1 - lx] = arr[iy0 - y0:iy1 - y0, ix0 - x0:ix1 - x0]
        # all segments missing: return an all-background array of the right size
        return out if out is not None else np.zeros((h, w), dtype=kf.dtype)

    def _get_scale(self):
        # compute (once) the 99.5th-percentile intensity of the smallest
        # pyramid level; used as the white point for uint16 -> uint8 scaling
        if self._scale is None:
            small = self._levels[-1].pages[self._plane].keyframe  # coarsest level geometry
            arr = self._read_level(self.level_count - 1, 0, 0, small.imagewidth, small.imagelength)
            p = float(np.percentile(arr, 99.5))  # robust to a few hot pixels
            self._scale = p if p > 0 else 1.0    # guard an all-zero image
        return self._scale

    def read_region(self, location, level, size):
        """OpenSlide semantics: location in level-0 coords, size in level coords."""
        ds = self.level_downsamples[level]                    # level's downsample factor
        lx, ly = int(location[0] / ds), int(location[1] / ds)  # level-0 -> level coords
        arr = self._read_level(level, lx, ly, size[0], size[1])  # assemble the pixels
        if arr.dtype != np.uint8:
            # uint16 grayscale (DAPI etc.): scale so the global percentile maps
            # to 255, clip, and convert — every tile brightens consistently
            arr = np.clip(arr.astype(np.float32) * (255.0 / self._get_scale()), 0, 255).astype(np.uint8)
        return Image.fromarray(arr).convert("RGB")  # uniform RGB PIL image out


def open_slide(path, plane=None):
    # format dispatch by extension: OME-TIFF -> our tifffile-based reader
    if path.lower().endswith((".ome.tif", ".ome.tiff")):
        return OmeTiffSlide(path, plane)
    return openslide.OpenSlide(path)  # single-plane formats ignore `plane`


# --- jobs ------------------------------------------------------------------

def meta(slide):
    s = open_slide(slide)  # either reader; both expose the same attributes
    try:
        mpp_x = s.properties.get("openslide.mpp-x")  # microns/px, if known
        mpp_y = s.properties.get("openslide.mpp-y")
        return {
            "slide_dimensions": list(s.dimensions),  # level-0 [w, h] in px
            "mpp": [float(mpp_x), float(mpp_y)] if mpp_x and mpp_y else [],
            "levels": s.level_count,                 # pyramid depth
            "tileSize": TILE_SIZE,                   # client needs the tile edge
            # z-planes of a 3D OME-TIFF stack; 1 for ordinary 2D slides
            "planes": getattr(s, "plane_count", 1),
        }
    finally:
        s.close()  # always release the slide, even on error


def tile(slide, z, x, y, quality=80, plane=None):
    s = open_slide(slide, plane)  # OmeTiffSlide rejects out-of-range planes itself
    try:
        # openslide formats ignore `plane` (plane_count 1): reject any plane
        # other than 0 so distinct plane values can't cache duplicate tiles
        if plane is not None and not 0 <= int(plane) < getattr(s, "plane_count", 1):
            raise ValueError(f"plane {plane} out of range [0, {getattr(s, 'plane_count', 1)})")
        # map the Zoomify address to a level-0 crop + output size
        reg = tile_region(*s.dimensions, z, x, y)
        if reg is None:
            raise ValueError(f"tile z={z} x={x} y={y} out of range")
        x0, y0, w0, h0, out_w, out_h = reg
        ds = w0 / (out_w or 1)                       # downsample this tile needs
        level = s.get_best_level_for_downsample(ds)  # cheapest level sharp enough
        lds = s.level_downsamples[level]             # that level's own downsample
        # crop size in the chosen level's coordinates (>=1 px each way)
        rw, rh = max(1, round(w0 / lds)), max(1, round(h0 / lds))
        # read the region from the pyramid (format-specific decode happens here)
        img = s.read_region((x0, y0), level, (rw, rh)).convert("RGB")
        if (rw, rh) != (out_w, out_h):
            # bridge the gap between the level's resolution and the tile's
            img = img.resize((out_w, out_h), Image.BILINEAR)
        fd, out = tempfile.mkstemp(suffix=".jpg", prefix="wsitile-")  # temp output path
        import os
        os.close(fd)                                # PIL reopens by name; free the fd
        img.save(out, "JPEG", quality=quality)      # the ONE artifact of this job
        return out                                  # node copies to cache, serves, deletes
    finally:
        s.close()  # always release the slide


def genenames(h5ad):
    """All gene names of a spatial .h5ad, in file order (var/_index). Lets the
    client discover/validate genes instead of trusting configuration."""
    import h5py
    with h5py.File(h5ad, "r") as f:
        return {"genes": f["var/_index"][:].astype(str).tolist()}


def genecounts(h5ad, gene):
    """Per-cell counts of one gene from a spatial .h5ad. X (cells x genes) may
    be CSR, CSC or dense — dispatched on AnnData's encoding-type attribute;
    anything else is rejected with a clear error, as is an absent gene, so
    the UI gets a message instead of a traceback. Zero-count cells are
    omitted."""
    import os
    import h5py
    with h5py.File(h5ad, "r") as f:
        names = f["var/_index"][:].astype(str)            # all gene names
        hit = np.nonzero(names == gene)[0]                # index of the gene
        if hit.size == 0:
            return {"error": f"gene '{gene}' not found in {os.path.basename(h5ad)}"}
        gi = int(hit[0])                                  # the gene's column index
        X = f["X"]                                        # cells x genes, encoding varies
        enc = str(X.attrs.get("encoding-type", ""))
        if isinstance(X, h5py.Dataset):
            # dense X: the gene's column, nonzero cells only
            col = X[:, gi]
            cells = np.nonzero(col)[0]
            vals = col[cells]
        elif enc == "csr_matrix":
            # cell-major: scan the column indices for this gene's entries
            mask = X["indices"][:] == gi
            vals = X["data"][:][mask]
            # entry k belongs to the cell whose indptr range contains k
            cells = np.searchsorted(X["indptr"][:], np.nonzero(mask)[0], side="right") - 1
        elif enc == "csc_matrix":
            # gene-major: the gene's column is one contiguous slice
            s, e = X["indptr"][gi : gi + 2]
            cells = X["indices"][s:e]
            vals = X["data"][s:e]
        else:
            return {"error": f"unsupported X encoding '{enc}' in {os.path.basename(h5ad)}"}
        barcodes = f["obs/_index"][:].astype(str)         # cell ids, obs order
    return {
        "cells": dict(zip(barcodes[cells].tolist(), vals.astype(int).tolist())),
        "max": int(vals.max()) if vals.size else 0,  # legend upper bound
    }


def h5ad_annotations(h5ad):
    """Every annotated cell's type from a spatial .h5ad, as JSON — cell types
    are free text (may contain commas/quotes), so they travel as JSON, never
    CSV. QC-filtered cells ('' type) are omitted."""
    import h5py
    with h5py.File(h5ad, "r") as f:
        types = _h5ad_cell_types(f)                       # one string per cell, '' = untyped
        ids = f["obs/_index"][:].astype(str)              # cell ids, obs order
    return {"cells": {i: t for i, t in zip(ids.tolist(), types.tolist()) if t}}


def _h5ad_cell_types(f):
    """obs/cell_type of an open .h5ad as one string per cell: handles the
    categorical group anndata usually writes (categories + integer codes,
    -1 = NaN) and a plain string dataset; anything else raises with the
    encountered layout named."""
    import h5py
    ct = f["obs/cell_type"]
    if isinstance(ct, h5py.Group):
        cats = np.append(ct["categories"][:].astype(str), "")  # -1 codes -> ''
        return cats[ct["codes"][:]]
    if isinstance(ct, h5py.Dataset):
        return ct[:].astype(str)
    raise ValueError(f"unsupported obs/cell_type layout {type(ct).__name__}")


def h5ad_csv(h5ad, kind):
    """Regenerate a boundary CSV from a spatial .h5ad's ragged polygon store
    (uns/{kind}_boundaries: cell_id[i] owns vertices[indptr[i]:indptr[i+1]]).
    kind: 'cell' | 'nucleus'. CSV is safe as this wire format because every
    column is a Xenium cell id or a number — never free text (cell types are
    served as JSON by h5ad_annotations instead). Writes the CSV to a temp
    file and returns its path (large output; same print-a-path contract as
    tile()).
    ponytail: boundaries regenerate on every request (~1s for ~700k rows);
    node caches per h5ad mtime on disk if this ever shows up."""
    import os
    import h5py
    # read (and thereby validate) the store BEFORE creating the temp file, so
    # a missing/corrupt h5ad can't leak an orphan into the temp directory
    with h5py.File(h5ad, "r") as f:
        b = f[f"uns/{kind}_boundaries"]                      # the ragged polygon store
        ids = b["cell_id"][:].astype(str)                    # one id per polygon
        indptr = b["indptr"][:]                              # ring offsets into vertices
        verts = b["vertices"][:]                             # (N, 2) um coordinates
    fd, out = tempfile.mkstemp(suffix=".csv", prefix="wsih5ad_")
    try:
        with os.fdopen(fd, "w") as w:                        # closes the fd, error or not
            w.write('"cell_id","vertex_x","vertex_y"\n')
            for i, cid in enumerate(ids):
                for x, y in verts[indptr[i]:indptr[i + 1]]:
                    w.write(f'"{cid}",{x:.4f},{y:.4f}\n')
    except BaseException:
        os.unlink(out)                                       # a failed write never leaks the file
        raise
    return out  # node reads, serves, deletes


def h5ad_celltypes(h5ad):
    """Distinct non-empty cell types of a spatial .h5ad, sorted — the meta
    request's type discovery for the client's filter dropdowns."""
    import h5py
    with h5py.File(h5ad, "r") as f:
        return {"cellTypes": sorted(set(t for t in _h5ad_cell_types(f) if t))}


def _test():
    # offline self-check of the Zoomify tier math against known geometry
    W, H = 124712, 78731
    tiers = num_tiers(W, H)
    assert tiers == 10                                                # expected pyramid depth
    assert tile_region(W, H, tiers - 1, 0, 0) == (0, 0, 256, 256, 256, 256)  # full-res corner tile
    r0 = tile_region(W, H, 0, 0, 0)
    assert r0[2] == W and r0[3] == H and r0[4] <= 256 and r0[5] <= 256  # z=0 covers the whole slide
    last = (W - 1) // 256
    # right-edge tile must end exactly at the slide width
    assert tile_region(W, H, tiers - 1, last, 0)[0] + tile_region(W, H, tiers - 1, last, 0)[2] == W
    assert tile_region(W, H, tiers - 1, 10 ** 9, 0) is None  # x past the edge
    assert tile_region(W, H, tiers, 0, 0) is None            # z past the pyramid
    print("self-check OK")


def main():
    if "--test" in sys.argv:
        _test()   # dev self-check, no stdin needed
        return
    job = json.load(sys.stdin)  # ONE job object per process
    if job["action"] == "meta":
        print(json.dumps(meta(job["slide"]), separators=(",", ":")))  # compact JSON to stdout
    elif job["action"] == "tile":
        plane = int(job["plane"]) if job.get("plane") is not None else None
        print(tile(job["slide"], int(job["z"]), int(job["x"]), int(job["y"]), plane=plane))  # temp jpg path
    elif job["action"] == "genecounts":
        print(json.dumps(genecounts(job["h5"], job["gene"]), separators=(",", ":")))
    elif job["action"] == "genenames":
        print(json.dumps(genenames(job["h5"]), separators=(",", ":")))
    elif job["action"] == "h5ad_csv":
        print(h5ad_csv(job["h5ad"], job["kind"]))  # temp csv path
    elif job["action"] == "h5ad_annotations":
        print(json.dumps(h5ad_annotations(job["h5ad"]), separators=(",", ":")))
    elif job["action"] == "h5ad_celltypes":
        print(json.dumps(h5ad_celltypes(job["h5ad"]), separators=(",", ":")))
    else:
        raise ValueError(f"unknown action {job.get('action')!r}")


if __name__ == "__main__":
    main()  # entry point when spawned by node's run_python()
