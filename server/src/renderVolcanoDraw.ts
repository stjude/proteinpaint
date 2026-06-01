import { Canvas } from 'skia-canvas'

/**
 * Pure draw+encode step for the volcano scatter PNG, shared by the main thread
 * (dev fallback / typing) and the worker entry (renderVolcanoWorker.ts). Takes
 * already-computed device dimensions, pixel coordinates and per-point flags as
 * plain transferable data — no row objects, no d3 scales — so it can run inside
 * a worker thread with a minimal structured-clone/transfer cost.
 *
 * Uses skia-canvas rather than node-canvas: its Skia rasterizer is ~12× faster
 * at bulk path drawing (a 26k-row plot draws+encodes in ~50 ms vs ~600 ms with
 * Cairo) and its `toBuffer` runs async on Skia's own thread pool. Output is
 * pixel-equivalent to the previous node-canvas path.
 *
 * Returns the raw PNG bytes; the caller base64-encodes to preserve the
 * `volcanoPng` string contract on the route response.
 */

// Per-point bit flags packed into the `flags` Uint8Array.
export const FLAG_SIGNIFICANT = 1 // bit 0: passes both thresholds
export const FLAG_FC_POSITIVE = 2 // bit 1: fold_change > 0 (up-regulated)

export interface VolcanoDrawInput {
	w: number
	h: number
	effectiveDpr: number
	radiusPx: number
	colors: {
		nonsignificant: string
		significantUp: string
		significantDown: string
	}
	x: Float64Array // CSS-space x per point
	y: Float64Array // CSS-space y per point
	flags: Uint8Array // FLAG_* bits per point
}

export async function drawVolcanoPng(input: VolcanoDrawInput): Promise<Buffer> {
	const { w, h, effectiveDpr, radiusPx, colors, x, y, flags } = input
	const n = flags.length

	const canvas = new Canvas(w * effectiveDpr, h * effectiveDpr)
	const ctx = canvas.getContext('2d')
	ctx.scale(effectiveDpr, effectiveDpr)
	ctx.fillStyle = '#ffffff'
	ctx.fillRect(0, 0, w, h)
	// 1 CSS px stroke → effectiveDpr device px, matching the previous
	// Rust path's stroke.width = dpr device px (≈ 1 CSS px visible).
	ctx.lineWidth = 1

	// Non-significant first so significant rings sit on top. Each batch
	// accumulates every ring as a subpath in one path, then strokes once
	// — collapses JS↔native overhead from O(N) calls to O(1) per batch.
	// `moveTo(cx + r, cy)` before each `arc(cx, cy, r, 0, 2π)` breaks the
	// implicit straight line from the previous subpath's endpoint to the
	// next arc's start point (angle 0 = +x direction = cx + r, cy).
	ctx.strokeStyle = colors.nonsignificant
	ctx.beginPath()
	for (let i = 0; i < n; i++) {
		if (flags[i] & FLAG_SIGNIFICANT) continue
		const px = x[i]
		const py = y[i]
		ctx.moveTo(px + radiusPx, py)
		ctx.arc(px, py, radiusPx, 0, Math.PI * 2)
	}
	ctx.stroke()

	// Significant on top, batched by down/up so we only set strokeStyle twice.
	for (const up of [false, true]) {
		ctx.strokeStyle = up ? colors.significantUp : colors.significantDown
		ctx.beginPath()
		for (let i = 0; i < n; i++) {
			const f = flags[i]
			if (!(f & FLAG_SIGNIFICANT)) continue
			if (!!(f & FLAG_FC_POSITIVE) !== up) continue
			const px = x[i]
			const py = y[i]
			ctx.moveTo(px + radiusPx, py)
			ctx.arc(px, py, radiusPx, 0, Math.PI * 2)
		}
		ctx.stroke()
	}

	// Async PNG rasterize+encode — skia runs this on its own thread pool, so it
	// doesn't block this thread's loop. Returns the PNG bytes as a Buffer.
	return await canvas.toBuffer('png')
}
