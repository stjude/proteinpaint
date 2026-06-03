import { Canvas } from 'skia-canvas'
import { scaleLinear } from 'd3-scale'
import { mayLog } from './helpers.ts'
import { formatElapsedTime } from '#shared'
import { createConcurrencyLimiter } from './utils/concurrencyLimiter.ts'

/**
 * Rasterize a GRIN2 Manhattan PNG and return interactive points (rows that
 * passed the q-value threshold) with `pixel_x`/`pixel_y` in CSS space so the
 * client SVG overlay can line up rings on top of the PNG.
 *
 * This is the TypeScript replacement for `rust/src/manhattan_plot.rs`. The
 * algorithm mirrors that file step-for-step: cumulative chromosome map,
 * default log cutoff (mean of -log10 q below the hard cap, floored at 40),
 * dynamic y-cap via histogram walk, placement of zero-q rows at the cap,
 * alternating chromosome background bands, anti-aliased dots, and hi-DPR
 * oversampling. Output keys (`png` / `plot_data`) are preserved so the
 * client renderer in client/plots/manhattan/manhattan.ts is unchanged.
 *
 * Modelled on server/src/renderVolcano.ts — see that file for the rationale
 * of the concurrency gate and device-pixel cap.
 */

const MAX_PIXEL_DIM = 4000
const MAX_DOT_RADIUS = 20
// See renderVolcano.ts: hard-cap one-side device-pixel canvas to keep
// worst-case bitmap memory bounded (~256 MB at 8192² × 4 bytes).
const MAX_DEVICE_PIXELS_PER_SIDE = 8192

const renderLimiter = createConcurrencyLimiter({
	maxConcurrent: 5,
	maxQueued: 50,
	taskName: 'manhattan render'
})

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

function finiteAtLeast(value: number, min: number, name: string): number {
	if (!Number.isFinite(value) || value < min) throw new Error(`${name} must be a finite number >= ${min}`)
	return value
}

// Default GRIN2 mutation-type colors. Mirrors the Rust defaults; can be
// overridden by `lesionTypeColors` on the request.
const DEFAULT_COLORS: Record<string, string> = {
	gain: '#FF4444',
	loss: '#4444FF',
	mutation: '#44AA44',
	fusion: '#FFA500',
	sv: '#9932CC'
}
const DEFAULT_FALLBACK_COLOR = '#888888'

const MUTATION_TYPES = ['gain', 'loss', 'mutation', 'fusion', 'sv'] as const
type MutationType = (typeof MUTATION_TYPES)[number]

export type ManhattanPoint = {
	x: number
	y: number
	color: string
	type: string
	gene: string
	chrom: string
	start: number
	end: number
	pos: number
	q_value: number
	nsubj: number | null
	pixel_x: number
	pixel_y: number
}

export type ManhattanChromInfo = {
	start: number
	size: number
	center: number
}

export type ManhattanPlotData = {
	points: ManhattanPoint[]
	chrom_data: Record<string, ManhattanChromInfo>
	total_genome_length: number
	x_buffer: number
	y_min: number
	y_max: number
	device_pixel_ratio: number
	default_log_cutoff: number
	has_capped_points: boolean
}

export type ManhattanRenderResult = {
	png: string
	plot_data: ManhattanPlotData
}

export type ManhattanRenderRequest = {
	/** Per-gene rows from GRIN2 (resultData.geneHits). Uses string keys
	 * `chrom`, `gene`, `loc.start`, `loc.end`, `q.nsubj.<type>`,
	 * `nsubj.<type>` — matches the cache JSON the Rust binary read. */
	geneHits: Array<Record<string, any>>
	/** chrom -> length in bases (e.g. genome.majorchr). */
	chrSizes: Record<string, number>
	/** Inner plot area width in CSS pixels (PNG is plot+2*radius wide). */
	plotWidth: number
	/** Inner plot area height in CSS pixels (PNG is plot+2*radius tall). */
	plotHeight: number
	/** Hi-DPI scale factor; PNG rasterized at plotWidth*dpr × plotHeight*dpr. */
	devicePixelRatio: number
	/** Dot radius in CSS pixels (also drives PNG padding). */
	pngDotRadius: number
	/** q-value cutoff; rows with q <= threshold become interactive points. */
	qValueThreshold: number
	/** Max points allowed above the dynamic y-cap before raising the cap. */
	maxCappedPoints: number
	/** Absolute hard cap (-log10 q) above which points are always clamped. */
	hardCap: number
	/** Histogram bin width on the -log10 scale used by the dynamic y-cap walk. */
	binSize: number
	/** Optional override of `MutationType -> hex color`. */
	lesionTypeColors?: Record<string, string>
}

// Sort chromosomes: numeric first (chr1..chr22), then X, Y, M/MT, then anything else.
// Matches the Rust `cumulative_chrom` ordering so chrom_data and pixel positions agree.
function sortChroms(chroms: string[]): string[] {
	return [...chroms].sort((a, b) => {
		const ka = chromSortKey(a)
		const kb = chromSortKey(b)
		if (ka[0] !== kb[0]) return ka[0] - kb[0]
		return ka[1] - kb[1]
	})
}
function chromSortKey(chr: string): [number, number] {
	const s = chr.startsWith('chr') ? chr.slice(3) : chr
	const n = Number(s)
	if (Number.isInteger(n) && n >= 0 && /^\d+$/.test(s)) return [0, n]
	if (s === 'X') return [1, 23]
	if (s === 'Y') return [1, 24]
	if (s === 'M' || s === 'MT') return [1, 100]
	return [2, Number.MAX_SAFE_INTEGER]
}

function buildCumulativeChrom(chrSizes: Record<string, number>): {
	chromData: Record<string, ManhattanChromInfo>
	totalGenomeLength: number
	sortedChroms: string[]
} {
	const sortedChroms = sortChroms(Object.keys(chrSizes))
	const chromData: Record<string, ManhattanChromInfo> = {}
	let cumulative = 0
	for (const chrom of sortedChroms) {
		const size = chrSizes[chrom]
		if (typeof size !== 'number' || !Number.isFinite(size) || size < 0)
			throw new Error(`chrSizes[${chrom}] must be a non-negative finite number (got ${size})`)
		chromData[chrom] = { start: cumulative, size, center: cumulative + Math.floor(size / 2) }
		cumulative += size
	}
	return { chromData, totalGenomeLength: cumulative, sortedChroms }
}

// Mean of -log10(q) values that are below the hard cap (with zero-q rows
// excluded so their placeholder doesn't drag the mean down), floored at 40.
// Mirrors `get_log_cutoff` in the Rust file — the floor keeps the histogram
// of `calculate_dynamic_y_cap` from collapsing to a single bin.
function getLogCutoff(ys: number[], hardCap: number, excludeIdx: Set<number>): number {
	let sum = 0
	let count = 0
	for (let i = 0; i < ys.length; i++) {
		if (excludeIdx.has(i)) continue
		const y = ys[i]
		if (y < hardCap) {
			sum += y
			count++
		}
	}
	if (count === 0) return hardCap
	return Math.max(40, sum / count)
}

// Histogram-walk dynamic y-cap. Mirrors `calculate_dynamic_y_cap` in Rust.
// See that function for the full algorithm + parameter notes.
function calculateDynamicYCap(
	ys: number[],
	maxCappedPoints: number,
	defaultCap: number,
	hardCap: number,
	binSize: number
): number {
	let numBins = Math.floor((hardCap - defaultCap) / binSize)
	if (numBins <= 0) numBins = 1
	const histogram = new Array<number>(numBins).fill(0)
	let maxY = -Infinity
	let maxYBelowHardCap = -Infinity
	let pointsAboveDefault = 0

	for (const y of ys) {
		if (y > maxY) maxY = y
		if (y > defaultCap) {
			pointsAboveDefault++
			if (y > hardCap) {
				histogram[numBins - 1]++
			} else {
				if (y > maxYBelowHardCap) maxYBelowHardCap = y
				let binIdx = Math.floor((y - defaultCap) / binSize)
				if (binIdx >= numBins) binIdx = numBins - 1
				if (binIdx < 0) binIdx = 0
				histogram[binIdx]++
			}
		}
	}

	if (maxY <= defaultCap) return maxY

	let pointsAbove = pointsAboveDefault
	for (let i = 0; i < histogram.length; i++) {
		if (pointsAbove <= maxCappedPoints) {
			const binUpperBound = defaultCap + (i + 1) * binSize
			const cap =
				maxYBelowHardCap > binUpperBound
					? Math.min(maxYBelowHardCap + binSize, hardCap)
					: Math.min(binUpperBound, hardCap)
			return cap
		}
		pointsAbove -= histogram[i]
	}
	return hardCap
}

export async function renderManhattan(req: ManhattanRenderRequest): Promise<ManhattanRenderResult> {
	return await renderLimiter.run(async () => {
		return await renderManhattan_actual(req)
	})
}

async function renderManhattan_actual(req: ManhattanRenderRequest): Promise<ManhattanRenderResult> {
	const pixelWidth = clampedInt(req.plotWidth, 1, MAX_PIXEL_DIM, 'plotWidth')
	const pixelHeight = clampedInt(req.plotHeight, 1, MAX_PIXEL_DIM, 'plotHeight')
	const dotRadius = clampedFloat(req.pngDotRadius ?? 2, 0.1, MAX_DOT_RADIUS, 'pngDotRadius')
	const devicePixelRatio = clampedFloat(req.devicePixelRatio ?? 1.0, 1.0, 6.0, 'devicePixelRatio')
	const qValueThreshold = finiteAtLeast(req.qValueThreshold, 0, 'qValueThreshold')
	const hardCap = finiteAtLeast(req.hardCap, 0, 'hardCap')
	const binSize = finiteAtLeast(req.binSize, Number.EPSILON, 'binSize')
	const maxCappedPoints = clampedInt(req.maxCappedPoints, 0, 1_000_000, 'maxCappedPoints')

	if (!Array.isArray(req.geneHits)) throw new Error('geneHits must be an array')
	if (!req.chrSizes || typeof req.chrSizes !== 'object') throw new Error('chrSizes is required')

	const t0 = Date.now()

	// 1. Cumulative chromosome map.
	const { chromData, totalGenomeLength, sortedChroms } = buildCumulativeChrom(req.chrSizes)
	// 0.5% buffer on each side of the x-domain (matches Rust's `x_buffer`).
	const xBuffer = Math.floor(totalGenomeLength * 0.005)

	// 2. Walk geneHits; for each gene emit one point per mutation type with a
	// finite, non-negative q-value. Track zero-q rows so we can place them at
	// the y-cap after step 4 (same trick as Rust's placeholder).
	const colors = { ...DEFAULT_COLORS, ...(req.lesionTypeColors ?? {}) }

	type Pt = {
		x: number
		y: number
		color: string
		type: string
		gene: string
		chrom: string
		start: number
		end: number
		q: number
		nsubj: number | null
	}
	const pts: Pt[] = []
	const ys: number[] = []
	const zeroQIndices: number[] = []
	const sigIndices: number[] = []

	for (const row of req.geneHits) {
		const chrom = row.chrom
		if (typeof chrom !== 'string' || !chrom) continue
		const ci = chromData[chrom]
		if (!ci) continue
		const geneStart = row['loc.start']
		const geneEnd = row['loc.end']
		if (typeof geneStart !== 'number' || !Number.isFinite(geneStart)) continue
		if (typeof geneEnd !== 'number' || !Number.isFinite(geneEnd)) continue
		const gene = typeof row.gene === 'string' ? row.gene : ''
		const xPos = ci.start + geneStart

		for (const mtype of MUTATION_TYPES) {
			const qRaw = row[`q.nsubj.${mtype}`]
			if (typeof qRaw !== 'number' || !Number.isFinite(qRaw) || qRaw < 0) continue
			const idx = pts.length
			let y: number
			if (qRaw === 0) {
				zeroQIndices.push(idx)
				y = 0 // placeholder; replaced with y_cap after step 4
			} else {
				y = -Math.log10(qRaw)
			}
			const nsubjRaw = row[`nsubj.${mtype}`]
			const nsubj = typeof nsubjRaw === 'number' && Number.isFinite(nsubjRaw) ? Math.trunc(nsubjRaw) : null
			const color = colors[mtype as MutationType] ?? DEFAULT_FALLBACK_COLOR

			pts.push({
				x: xPos,
				y,
				color,
				type: mtype,
				gene,
				chrom,
				start: geneStart,
				end: geneEnd,
				q: qRaw,
				nsubj
			})
			ys.push(y)
			if (qRaw <= qValueThreshold) sigIndices.push(idx)
		}
	}

	// 3. Default log cutoff (mean of below-hard-cap values, floor 40), with
	// zero-q placeholders excluded so they don't drag the mean down.
	const zeroQSet = new Set<number>(zeroQIndices)
	const logCutoff = getLogCutoff(ys, hardCap, zeroQSet)

	// 4. Dynamic y-cap and final y_max with radius-of-padding (in -log10 units;
	// see Rust manhattan_plot.rs `y_padding = png_dot_radius`).
	const yPadding = dotRadius
	const yMin = 0 - yPadding
	const yCap = calculateDynamicYCap(ys, maxCappedPoints, logCutoff, hardCap, binSize)

	let yMax: number
	let hasCappedPoints = false
	if (ys.length > 0) {
		const maxY = ys.reduce((a, b) => (b > a ? b : a), -Infinity)
		hasCappedPoints = maxY > logCutoff
		// Place zero-q rows at the cap so they appear at the top.
		for (const idx of zeroQIndices) {
			ys[idx] = yCap
			pts[idx].y = yCap
		}
		if (maxY > yCap) {
			for (let i = 0; i < pts.length; i++) {
				if (ys[i] > yCap) {
					ys[i] = yCap
					pts[i].y = yCap
				}
			}
			yMax = yCap + 0.35 + yPadding
		} else {
			yMax = maxY + 0.35 + yPadding
		}
	} else {
		yMax = 1.0 + yPadding
	}

	// 5. Canvas dims. PNG includes 2*radius of padding on each axis so dots at
	// the data edges stay fully visible (matches Rust + renderVolcano).
	const radiusPx = Math.max(1, Math.floor(dotRadius))
	const w = pixelWidth + 2 * radiusPx
	const h = pixelHeight + 2 * radiusPx
	if (w > MAX_PIXEL_DIM || h > MAX_PIXEL_DIM)
		throw new Error(`pixel dimensions ${w}x${h} out of range (1–${MAX_PIXEL_DIM})`)

	// 6. Scales: full padded data domain → full canvas rect (in CSS pixels).
	// The PNG has no axis offset — that's drawn by the SVG overlay on the client.
	const xScale = scaleLinear()
		.domain([-xBuffer, totalGenomeLength + xBuffer])
		.range([0, w])
	const yScale = scaleLinear().domain([yMin, yMax]).range([h, 0])

	// Precompute pixel coords once — used for both the PNG draw loop and the
	// returned interactive `points` overlay positions.
	const pxCss: Array<[number, number]> = new Array(pts.length)
	for (let i = 0; i < pts.length; i++) pxCss[i] = [xScale(pts[i].x), yScale(pts[i].y)]

	// Clamp DPR downward when device-pixel canvas would exceed
	// MAX_DEVICE_PIXELS_PER_SIDE; CSS-space outputs unaffected (see renderVolcano).
	const effectiveDpr = Math.min(devicePixelRatio, MAX_DEVICE_PIXELS_PER_SIDE / Math.max(w, h))

	const canvas = new Canvas(w * effectiveDpr, h * effectiveDpr)
	const ctx = canvas.getContext('2d')
	ctx.scale(effectiveDpr, effectiveDpr)

	// White background (matches Rust root.fill(WHITE)).
	ctx.fillStyle = '#ffffff'
	ctx.fillRect(0, 0, w, h)

	// 7. Alternating chromosome backgrounds. Even bands are white (already
	// painted), odd bands are light gray rendered with 0.5 alpha — matches
	// the `RGBColor(211,211,211).mix(0.5).filled()` from the Rust port,
	// which on a white background yields ~rgb(233,233,233).
	const bandTop = yScale(yMax - yPadding)
	const bandBottom = yScale(yMin + yPadding)
	ctx.save()
	ctx.fillStyle = 'rgba(211,211,211,0.5)'
	for (let i = 0; i < sortedChroms.length; i++) {
		if (i % 2 === 0) continue
		const info = chromData[sortedChroms[i]]
		const x0 = xScale(info.start)
		const x1 = xScale(info.start + info.size)
		ctx.fillRect(x0, bandTop, x1 - x0, bandBottom - bandTop)
	}
	ctx.restore()

	// 8. Filled, anti-aliased dots. skia-canvas anti-aliases fills by
	// default, replacing the tiny-skia step in the Rust port. Group by
	// color so each strokeStyle/fillStyle change happens once per type.
	const byColor = new Map<string, number[]>()
	for (let i = 0; i < pts.length; i++) {
		const c = pts[i].color
		let bucket = byColor.get(c)
		if (!bucket) {
			bucket = []
			byColor.set(c, bucket)
		}
		bucket.push(i)
	}
	for (const [color, idxs] of byColor) {
		ctx.fillStyle = color
		ctx.beginPath()
		for (const i of idxs) {
			const [px, py] = pxCss[i]
			// `moveTo` before each `arc` breaks the implicit line from the
			// previous subpath's endpoint to (cx+r, cy) — see renderVolcano.ts.
			ctx.moveTo(px + radiusPx, py)
			ctx.arc(px, py, radiusPx, 0, Math.PI * 2)
		}
		ctx.fill()
	}

	// Async rasterize+encode on skia's thread pool.
	const png = (await canvas.toBuffer('png')).toString('base64')

	// 9. Build interactive points: only those with q <= threshold. Pixel
	// coords in CSS space so the SVG overlay aligns with the PNG.
	const interactivePoints: ManhattanPoint[] = sigIndices.map(i => {
		const p = pts[i]
		const [px, py] = pxCss[i]
		return {
			x: p.x,
			y: p.y,
			color: p.color,
			type: p.type,
			gene: p.gene,
			chrom: p.chrom,
			start: p.start,
			end: p.end,
			pos: p.start,
			q_value: p.q,
			nsubj: p.nsubj,
			pixel_x: px,
			pixel_y: py
		}
	})

	mayLog(
		`Time taken to render manhattan PNG (${pts.length.toLocaleString()} points):`,
		formatElapsedTime(Date.now() - t0)
	)

	return {
		png,
		plot_data: {
			points: interactivePoints,
			chrom_data: chromData,
			total_genome_length: totalGenomeLength,
			x_buffer: xBuffer,
			y_min: yMin,
			y_max: yMax,
			device_pixel_ratio: effectiveDpr,
			default_log_cutoff: logCutoff,
			has_capped_points: hasCappedPoints
		}
	}
}
