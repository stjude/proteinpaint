import { scaleLinear } from 'd3-scale'
import type { DataEntry, VolcanoData, VolcanoRenderRequest } from '#types'
import { mayLog } from './helpers.ts'
import { formatElapsedTime } from '#shared'
import { FLAG_SIGNIFICANT, FLAG_FC_POSITIVE, drawVolcanoPng, type VolcanoDrawInput } from './renderVolcanoDraw.ts'
import { runOnPool } from './renderVolcanoPool.ts'

/**
 * Rasterize a volcano scatter PNG and return the threshold-passing rows
 * (sorted ascending by the chosen p-value column) as `dots`, with each dot
 * carrying `pixel_x`/`pixel_y` in CSS space so the client SVG overlay can
 * line up rings on top of the PNG.
 *
 * The returned `VolcanoData<T>` is meant to be nested under `data` on each
 * route's response — sibling to route-specific metadata (sample sizes, method).
 */
const MAX_PIXEL_DIM = 4000
const MAX_INTERACTIVE_DOTS = 50000
const MAX_DOT_RADIUS = 20
// Hard cap on per-side device-pixel canvas dimension. 8192² × 4 bytes ≈
// 256 MB worst case — comfortable server headroom and well above the
// common 400 CSS × DPR 6 = 2400 device px case. The CSS-space cap
// (MAX_PIXEL_DIM) and the DPR cap alone are not enough: at 4000 CSS ×
// DPR 6 the canvas would be 24000² × 4 ≈ 2.3 GB, an easy DoS vector. We
// instead clamp the effective DPR downward when (w × dpr) or (h × dpr)
// would exceed this, so big plots just get less PNG oversampling
// without changing the CSS-space contract.
const MAX_DEVICE_PIXELS_PER_SIDE = 8192

// The heavy draw+encode section runs in a worker-thread pool
// (renderVolcanoPool.ts) so it never blocks the main server event loop. The
// pool size is the concurrency gate — at most a few renders run at once and the
// rest queue — which replaces the former in-process semaphore here.

const DEFAULT_REQ: VolcanoRenderRequest = {
	significanceThresholds: { pValueCutoff: 1.3, pValueType: 'adjusted', foldChangeCutoff: 0.3 },
	pixelWidth: 400,
	pixelHeight: 400,
	maxInteractiveDots: 5000
}

function clampedInt(value: number, min: number, max: number, name: string): number {
	if (!Number.isFinite(value) || value < min || value > max)
		throw new Error(`${name} must be a finite number between ${min} and ${max}`)
	return Math.round(value)
}

function clampedFloat(value: number, min: number, max: number, name: string): number {
	if (!Number.isFinite(value) || value < min || value > max)
		throw new Error(`${name} must be a finite number between ${min} and ${max}`)
	return value
}

export async function renderVolcano<T extends DataEntry>(
	rows: T[],
	req: VolcanoRenderRequest = DEFAULT_REQ
): Promise<VolcanoData<T>> {
	const pixelWidth = clampedInt(req.pixelWidth, 1, MAX_PIXEL_DIM, 'pixelWidth')
	const pixelHeight = clampedInt(req.pixelHeight, 1, MAX_PIXEL_DIM, 'pixelHeight')
	const dotRadius = clampedFloat(req.dotRadius ?? 2.0, 0.1, MAX_DOT_RADIUS, 'dotRadius')
	const maxInteractiveDots =
		req.maxInteractiveDots == null
			? null
			: clampedInt(req.maxInteractiveDots, 0, MAX_INTERACTIVE_DOTS, 'maxInteractiveDots')

	// Clamp to a sane band. The client oversamples by 2× to keep post-render
	// browser zoom sharp, so retina (DPR 2) sends 4 at base zoom and up to ~10
	// at 250% zoom. Cap at 6 so the bitmap memory stays bounded (a 400px plot
	// at DPR 6 is a 2400×2400 pixmap ≈ 23MB) while still oversampling the
	// common cases. Without the upper bound, a malformed client value would
	// blow up bitmap memory quadratically.
	const devicePixelRatio = clampedFloat(req.devicePixelRatio ?? 1.0, 1.0, 6.0, 'devicePixelRatio')

	const pField: 'adjusted_p_value' | 'original_p_value' =
		req.significanceThresholds.pValueType === 'adjusted' ? 'adjusted_p_value' : 'original_p_value'
	const pValueCutoff = req.significanceThresholds.pValueCutoff
	const foldChangeCutoff = req.significanceThresholds.foldChangeCutoff

	const colorSignificant = req.colorSignificant ?? '#d62728'
	const colorSignificantUp = req.colorSignificantUp ?? colorSignificant
	const colorSignificantDown = req.colorSignificantDown ?? colorSignificant
	const colorNonsignificant = req.colorNonsignificant ?? '#000000'

	const t0 = Date.now()

	// One pass: extract fc, p, find the smallest non-zero p so rows with p == 0
	// can be capped at -log10(minNonZeroP) (matches the client's overlay math).
	type Pt = { fc: number; p: number; y: number; significant: boolean }
	const points: Pt[] = new Array(rows.length)
	let minNonZeroP = Infinity
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i] as any
		const fc = row.fold_change
		if (typeof fc !== 'number' || !Number.isFinite(fc)) throw new Error(`row ${i} fold_change is not finite (${fc})`)
		const p = row[pField]
		if (typeof p !== 'number' || !Number.isFinite(p) || p < 0)
			throw new Error(`row ${i} ${pField} must be a finite value >= 0 (got ${p})`)
		if (p > 0 && p < minNonZeroP) minNonZeroP = p
		points[i] = { fc, p, y: 0, significant: false }
	}
	if (!Number.isFinite(minNonZeroP)) minNonZeroP = 1e-300

	// Classify + compute y; track axis extents in the same pass.
	let xAbsMax = 0
	let yMaxData = 0
	for (const pt of points) {
		const pForY = pt.p <= 0 ? minNonZeroP : pt.p
		pt.y = -Math.log10(pForY)
		pt.significant = pt.y > pValueCutoff && Math.abs(pt.fc) > foldChangeCutoff
		if (Math.abs(pt.fc) > xAbsMax) xAbsMax = Math.abs(pt.fc)
		if (pt.y > yMaxData) yMaxData = pt.y
	}

	// Unpadded axis extents — symmetric on x, raw data bounds on y. Fallback
	// to 1.0 when the data has zero spread to keep the scale valid.
	const xSpan = xAbsMax > 0 ? xAbsMax : 1
	const xMinUnpadded = -xSpan
	const xMaxUnpadded = xSpan
	const yMinUnpadded = 0
	const yMaxUnpadded = yMaxData > 0 ? yMaxData : 1

	// Normalize the dot radius into the integer pixel count we'll draw, with a
	// min of 1 so sub-pixel inputs don't collapse to a zero-radius dot. This
	// single value drives both PNG padding and circle rendering.
	const radiusPx = Math.max(1, Math.floor(dotRadius))
	// Pad the PNG by 2*radiusPx so dots at the data edges stay fully visible.
	const padPx = 2 * radiusPx
	const w = pixelWidth + padPx
	const h = pixelHeight + padPx
	if (w > MAX_PIXEL_DIM || h > MAX_PIXEL_DIM)
		throw new Error(`pixel dimensions ${w}x${h} out of range (1–${MAX_PIXEL_DIM})`)

	// Convert pixel padding to data units against the unpadded pixel range so
	// the data/pixel ratio stays identical between padded and unpadded space.
	const xDataPerPx = (xMaxUnpadded - xMinUnpadded) / pixelWidth
	const yDataPerPx = (yMaxUnpadded - yMinUnpadded) / pixelHeight
	const xPadData = radiusPx * xDataPerPx
	const yPadData = radiusPx * yDataPerPx
	const xMin = xMinUnpadded - xPadData
	const xMax = xMaxUnpadded + xPadData
	const yMin = yMinUnpadded - yPadData
	const yMax = yMaxUnpadded + yPadData

	// Scales map the padded data domain to the FULL canvas rect in CSS space.
	// The PNG has no axis offset or margin — that's drawn by the SVG overlay
	// on the client.
	const xScale = scaleLinear().domain([xMin, xMax]).range([0, w])
	const yScale = scaleLinear().domain([yMin, yMax]).range([h, 0])

	// Precompute pixel coords once — used for both the PNG draw loop and
	// the returned `dots` overlay positions. Done before the concurrency
	// gate so the cheap JS work doesn't sit behind the queue.
	const pxCss: Array<[number, number]> = new Array(points.length)
	for (let i = 0; i < points.length; i++) {
		pxCss[i] = [xScale(points[i].fc), yScale(points[i].y)]
	}

	// Clamp DPR downward when the resulting device-pixel canvas would
	// exceed MAX_DEVICE_PIXELS_PER_SIDE on either axis. CSS-space outputs
	// (plotExtent dims, dots pixel_x/y) are unaffected — only PNG
	// oversampling degrades, which is the right tradeoff for pathological
	// inputs. With the current MAX_PIXEL_DIM=4000 and cap=8192, the
	// effective DPR floor is ≥ 2.048, so well-behaved retina requests
	// still come through unchanged.
	const effectiveDpr = Math.min(devicePixelRatio, MAX_DEVICE_PIXELS_PER_SIDE / Math.max(w, h))

	// Pack per-point draw data into transferable typed arrays. These cross the
	// worker boundary (zero-copy via transferList) instead of the row objects —
	// the draw loop only needs pixel coords, significance, and fold-change sign.
	const n = points.length
	const xArr = new Float64Array(n)
	const yArr = new Float64Array(n)
	const flags = new Uint8Array(n)
	for (let i = 0; i < n; i++) {
		const [px, py] = pxCss[i]
		xArr[i] = px
		yArr[i] = py
		let f = 0
		if (points[i].significant) f |= FLAG_SIGNIFICANT
		if (points[i].fc > 0) f |= FLAG_FC_POSITIVE
		flags[i] = f
	}

	const drawInput: VolcanoDrawInput = {
		w,
		h,
		effectiveDpr,
		radiusPx,
		colors: {
			nonsignificant: colorNonsignificant,
			significantUp: colorSignificantUp,
			significantDown: colorSignificantDown
		},
		x: xArr,
		y: yArr,
		flags
	}

	// In the compiled prod runtime, run the heavy draw+encode in the worker pool
	// so it never blocks the main server event loop; the pool size bounds
	// concurrent renders (replaces the former in-process semaphore). Under tsx
	// (dev + the single-process unit suite) we draw on the main thread instead:
	// spawning a worker that re-registers the tsx ESM loader mid-suite races
	// against tsx's Atomics-based loader and hangs. `import.meta.url` ends with
	// .ts under tsx and .js in the prod bundle. Returns the raw PNG bytes; base64
	// here to preserve the `volcanoPng` string contract.
	const isTsRuntime = import.meta.url.endsWith('.ts')
	const pngBuf = isTsRuntime
		? await drawVolcanoPng(drawInput)
		: await runOnPool(drawInput, [xArr.buffer, yArr.buffer, flags.buffer])
	const png = pngBuf.toString('base64')

	// Build the interactive `dots` list: threshold-passers sorted asc by the
	// chosen p-value column, optionally capped at maxInteractiveDots.
	const sigIdx: number[] = []
	for (let i = 0; i < points.length; i++) if (points[i].significant) sigIdx.push(i)
	sigIdx.sort((a, b) => points[a].p - points[b].p)
	const totalSignificantRows = sigIdx.length
	const keep = maxInteractiveDots == null ? sigIdx : sigIdx.slice(0, maxInteractiveDots)
	const dots = keep.map(i => {
		const row = { ...(rows[i] as any) }
		const [px, py] = pxCss[i]
		row.pixel_x = px
		row.pixel_y = py
		return row as T
	})

	mayLog(`Time taken to render volcano PNG (${rows.length.toLocaleString()} rows):`, formatElapsedTime(Date.now() - t0))

	return {
		dots,
		volcanoPng: png,
		plotExtent: {
			xMin,
			xMax,
			yMin,
			yMax,
			xMinUnpadded,
			xMaxUnpadded,
			yMinUnpadded,
			yMaxUnpadded,
			dotRadiusPx: radiusPx,
			pixelWidth: w,
			pixelHeight: h,
			plotLeft: 0,
			plotTop: 0,
			plotRight: w,
			plotBottom: h,
			minNonZeroPValue: minNonZeroP
		},
		totalRows: rows.length,
		totalSignificantRows
	}
}
