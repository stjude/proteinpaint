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

Formats: anything openslide opens (.svs etc.), plus pyramidal OME-TIFF
(.ome.tif, e.g. Xenium morphology images) — those use JPEG-2000 TIFF
compression (34712) that openslide cannot decode, so they are read via
tifffile (pyramid structure) + PIL (per-tile JP2K decode) instead.

Deps: openslide-python, pillow, tifffile, numpy, h5py. Avoid writing non-fatal
warnings to stderr (run_python() rejects on any stderr output).

Dev usage (bypasses stdin):  python wsi_tile.py --test
"""

import io
import json
import math
import re
import sys
import tempfile

import numpy as np
import openslide
import tifffile
from PIL import Image

# huge whole-slide reads must not trip PIL's DecompressionBomb warning, which
# would land on stderr and make run_python() reject.
Image.MAX_IMAGE_PIXELS = None

TILE_SIZE = 256


# --- Zoomify pyramid geometry (mirrors ol/source/Zoomify.js 'default') -----

def num_tiers(w, h, tile=TILE_SIZE):
    tiers, eff = 0, tile
    while w > eff or h > eff:
        tiers += 1
        eff += eff
    return tiers + 1


def tile_region(w, h, z, x, y, tile=TILE_SIZE):
    """Zoomify (z,x,y) -> (x0,y0,w0,h0,out_w,out_h) in level-0 px, or None."""
    tiers = num_tiers(w, h, tile)
    if not (0 <= z < tiers):
        return None
    ds = 1 << (tiers - 1 - z)
    span = tile * ds
    x0, y0 = x * span, y * span
    if x0 >= w or y0 >= h:
        return None
    w0, h0 = min(span, w - x0), min(span, h - y0)
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
        self._tf = tifffile.TiffFile(path)
        self._levels = self._tf.series[0].levels
        self.plane_count = len(self._levels[0].pages)  # z-planes; 1 for 2D
        self._plane = (
            self.plane_count // 2 if plane is None else max(0, min(self.plane_count - 1, int(plane)))
        )
        # non-first z-planes are TiffFrame objects without tag attributes;
        # .keyframe carries the geometry, which all planes of a level share
        base = self._levels[0].pages[self._plane].keyframe
        self.dimensions = (base.imagewidth, base.imagelength)
        self.level_count = len(self._levels)
        self.level_downsamples = [
            self.dimensions[0] / lvl.pages[self._plane].keyframe.imagewidth for lvl in self._levels
        ]
        self.properties = {}
        for axis, key in (("X", "openslide.mpp-x"), ("Y", "openslide.mpp-y")):
            m = re.search(r'PhysicalSize%s="([\d.eE+-]+)"' % axis, self._tf.ome_metadata or "")
            if m:
                self.properties[key] = m.group(1)
        self._scale = None  # lazy 8-bit contrast reference

    def close(self):
        self._tf.close()

    def get_best_level_for_downsample(self, ds):
        best = 0
        for i, d in enumerate(self.level_downsamples):
            if d <= ds + 0.01:
                best = i
        return best

    def _decode_tile(self, page, index):
        count = page.databytecounts[index]
        if not count:
            return None  # missing tile = background
        fh = self._tf.filehandle
        fh.seek(page.dataoffsets[index])
        img = Image.open(io.BytesIO(fh.read(count)))  # JP2K codestream
        img.load()
        return np.asarray(img)

    def _read_level(self, level, lx, ly, w, h):
        """(lx,ly,w,h) in level coords -> array, zero-padded at edges."""
        page = self._levels[level].pages[self._plane]
        kf = page.keyframe  # geometry lives on the keyframe (see __init__)
        tw, th = kf.tilewidth, kf.tilelength
        tiles_across = -(-kf.imagewidth // tw)
        out = None
        tx0, tx1 = max(0, lx) // tw, max(0, min(lx + w - 1, kf.imagewidth - 1)) // tw
        ty0, ty1 = max(0, ly) // th, max(0, min(ly + h - 1, kf.imagelength - 1)) // th
        for tr in range(ty0, ty1 + 1):
            for tc in range(tx0, tx1 + 1):
                arr = self._decode_tile(page, tr * tiles_across + tc)
                if arr is None:
                    continue
                if out is None:
                    out_shape = (h, w) if arr.ndim == 2 else (h, w, arr.shape[2])
                    out = np.zeros(out_shape, dtype=kf.dtype)
                x0, y0 = tc * tw, tr * th
                ix0, iy0 = max(lx, x0), max(ly, y0)
                ix1 = min(lx + w, x0 + arr.shape[1])
                iy1 = min(ly + h, y0 + arr.shape[0])
                if ix1 <= ix0 or iy1 <= iy0:
                    continue
                out[iy0 - ly:iy1 - ly, ix0 - lx:ix1 - lx] = arr[iy0 - y0:iy1 - y0, ix0 - x0:ix1 - x0]
        return out if out is not None else np.zeros((h, w), dtype=kf.dtype)

    def _get_scale(self):
        if self._scale is None:
            small = self._levels[-1].pages[self._plane].keyframe
            arr = self._read_level(self.level_count - 1, 0, 0, small.imagewidth, small.imagelength)
            p = float(np.percentile(arr, 99.5))
            self._scale = p if p > 0 else 1.0
        return self._scale

    def read_region(self, location, level, size):
        """OpenSlide semantics: location in level-0 coords, size in level coords."""
        ds = self.level_downsamples[level]
        lx, ly = int(location[0] / ds), int(location[1] / ds)
        arr = self._read_level(level, lx, ly, size[0], size[1])
        if arr.dtype != np.uint8:
            arr = np.clip(arr.astype(np.float32) * (255.0 / self._get_scale()), 0, 255).astype(np.uint8)
        return Image.fromarray(arr).convert("RGB")


def open_slide(path, plane=None):
    if path.lower().endswith((".ome.tif", ".ome.tiff")):
        return OmeTiffSlide(path, plane)
    return openslide.OpenSlide(path)  # single-plane formats ignore `plane`


# --- jobs ------------------------------------------------------------------

def meta(slide):
    s = open_slide(slide)
    try:
        mpp_x = s.properties.get("openslide.mpp-x")
        mpp_y = s.properties.get("openslide.mpp-y")
        return {
            "slide_dimensions": list(s.dimensions),
            "mpp": [float(mpp_x), float(mpp_y)] if mpp_x and mpp_y else [],
            "levels": s.level_count,
            "tileSize": TILE_SIZE,
            # z-planes of a 3D OME-TIFF stack; 1 for ordinary 2D slides
            "planes": getattr(s, "plane_count", 1),
        }
    finally:
        s.close()


def tile(slide, z, x, y, quality=80, plane=None):
    s = open_slide(slide, plane)
    try:
        reg = tile_region(*s.dimensions, z, x, y)
        if reg is None:
            raise ValueError(f"tile z={z} x={x} y={y} out of range")
        x0, y0, w0, h0, out_w, out_h = reg
        ds = w0 / (out_w or 1)
        level = s.get_best_level_for_downsample(ds)
        lds = s.level_downsamples[level]
        rw, rh = max(1, round(w0 / lds)), max(1, round(h0 / lds))
        img = s.read_region((x0, y0), level, (rw, rh)).convert("RGB")
        if (rw, rh) != (out_w, out_h):
            img = img.resize((out_w, out_h), Image.BILINEAR)
        fd, out = tempfile.mkstemp(suffix=".jpg", prefix="wsitile-")
        import os
        os.close(fd)
        img.save(out, "JPEG", quality=quality)
        return out
    finally:
        s.close()


def genecounts(h5, gene):
    """Per-cell counts of one gene from a 10x cell_feature_matrix HDF5 (CSC
    sparse, genes x cells). Zero-count cells are omitted. Returns {"error":..}
    (not an exception) when the gene is absent, so the UI gets a clean message
    instead of a traceback."""
    import os
    import h5py
    with h5py.File(h5, "r") as f:
        names = f["matrix/features/name"][:].astype(str)
        hit = np.nonzero(names == gene)[0]
        if hit.size == 0:
            return {"error": f"gene '{gene}' not found in {os.path.basename(h5)}"}
        mask = f["matrix/indices"][:] == hit[0]
        vals = f["matrix/data"][:][mask]
        # row index k of the CSC arrays belongs to the cell whose indptr range contains k
        cols = np.searchsorted(f["matrix/indptr"][:], np.nonzero(mask)[0], side="right") - 1
        barcodes = f["matrix/barcodes"][:].astype(str)
    return {
        "cells": dict(zip(barcodes[cols].tolist(), vals.astype(int).tolist())),
        "max": int(vals.max()) if vals.size else 0,
    }


def _test():
    W, H = 124712, 78731
    tiers = num_tiers(W, H)
    assert tiers == 10
    assert tile_region(W, H, tiers - 1, 0, 0) == (0, 0, 256, 256, 256, 256)
    r0 = tile_region(W, H, 0, 0, 0)
    assert r0[2] == W and r0[3] == H and r0[4] <= 256 and r0[5] <= 256
    last = (W - 1) // 256
    assert tile_region(W, H, tiers - 1, last, 0)[0] + tile_region(W, H, tiers - 1, last, 0)[2] == W
    assert tile_region(W, H, tiers - 1, 10 ** 9, 0) is None
    assert tile_region(W, H, tiers, 0, 0) is None
    print("self-check OK")


def main():
    if "--test" in sys.argv:
        _test()
        return
    job = json.load(sys.stdin)
    if job["action"] == "meta":
        print(json.dumps(meta(job["slide"]), separators=(",", ":")))
    elif job["action"] == "tile":
        plane = int(job["plane"]) if job.get("plane") is not None else None
        print(tile(job["slide"], int(job["z"]), int(job["x"]), int(job["y"]), plane=plane))
    elif job["action"] == "genecounts":
        print(json.dumps(genecounts(job["h5"], job["gene"]), separators=(",", ":")))
    else:
        raise ValueError(f"unknown action {job.get('action')!r}")


if __name__ == "__main__":
    main()
