#!/usr/bin/env python3
"""
wsi_tile.py — standalone WSI tile/metadata CLI for the ProteinPaint WSI viewer.
Replaces the tile server + redis: no server, no state. Node's run_python()
spawns it once per request, pipes a JSON job on stdin, and reads stdout.

Two jobs (JSON on stdin, `action` selects):
  {"action":"meta","slide":"/abs/slide.svs"}
      -> stdout: {"slide_dimensions":[w,h],"mpp":..,"levels":..,"tileSize":256}
  {"action":"tile","slide":"/abs/slide.svs","z":9,"x":0,"y":0}
      -> writes ONE JPEG to a temp path, stdout: that path (node sends+deletes it)

Tiles are Zoomify-compatible: geometry is copied from OpenLayers'
ol/source/Zoomify.js 'default' tier math, so the client's tile requests and this
script's crop geometry never disagree.

Deps: openslide-python, pillow. Avoid writing non-fatal warnings to stderr (run_python() rejects on any stderr output).

Dev usage (bypasses stdin):  python wsi_tile.py --test
"""

import json
import math
import sys
import tempfile

import openslide
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


# --- jobs ------------------------------------------------------------------

def meta(slide):
    s = openslide.OpenSlide(slide)
    try:
        mpp_x = s.properties.get("openslide.mpp-x")
        mpp_y = s.properties.get("openslide.mpp-y")
        return {
            "slide_dimensions": list(s.dimensions),
            "mpp": [float(mpp_x), float(mpp_y)] if mpp_x and mpp_y else [],
            "levels": s.level_count,
            "tileSize": TILE_SIZE,
        }
    finally:
        s.close()


def tile(slide, z, x, y, quality=80):
    s = openslide.OpenSlide(slide)
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
        print(tile(job["slide"], int(job["z"]), int(job["x"]), int(job["y"])))
    else:
        raise ValueError(f"unknown action {job.get('action')!r}")


if __name__ == "__main__":
    main()
