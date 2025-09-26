import fs from 'fs'
import readline from 'readline'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'

/** Adjust these if your TSV headers differ */
const FIELD_CHROM = 'chrom'
const FIELD_LOC_START = 'loc.start'
const FIELD_LOC_END = 'loc.end'
const FIELD_GENE = 'gene'

// candidates in priority order
const Q_CANDIDATES = ['q.nsubj.mutation', 'q.nsubj.gain', 'q.nsubj.loss', 'q1.nsubj', 'q2.nsubj', 'q3.nsubj']
const P_CANDIDATES = ['p.nsubj.mutation', 'p.nsubj.gain', 'p.nsubj.loss', 'p1.nsubj', 'p2.nsubj', 'p3.nsubj']

// Helpers
function numOrUndef(s: string): number | undefined {
	const n = Number(s)
	return Number.isFinite(n) ? n : undefined
}
function minValueInRow(
	get: (k: string) => string,
	names: string[],
	rangeCheck: (n: number) => boolean
): number | undefined {
	let best: number | undefined
	for (const k of names) {
		const n = numOrUndef(get(k))
		if (n == null) continue
		if (!rangeCheck(n)) continue
		best = best == null ? n : Math.min(best, n)
	}
	return best
}

export type ManhattanRenderOpts = {
	plotWidth?: number
	plotHeight?: number
	yMaxCap?: number // cap -log10(q) visually (default 40)
	yAxisX?: number
	yAxisY?: number
	yAxisSpace?: number
	fontSize?: number
	devicePixelRatio?: number
	skipChrM?: boolean
	/** draw thin separators between chrs */
	drawChrSeparators?: boolean
	xBufferFrac?: number // fraction of genome length used as x padding (default 1%)
	yBottomBuffer?: number // padding in -log10(q) units below 0 (default 0.5)
	yHeadroomFrac?: number // top headroom as fraction of observed max (default 5%)
	yHeadroomMin?: number // minimum top headroom in -log10(q) units (default 2)
	yHeadroomMax?: number // maximum top headroom in units (default 6)
}

export type GenomeInfo = {
	/** e.g. { chr1: 248956422, chr2: 242193529, ... } — include chrM if present; we’ll skip it */
	majorchr: Record<string, number>
}

export type ManhattanPoint = {
	x: number // genome-wide cumulative bp position
	y: number // capped -log10(q) used for drawing
	q: number // actual q-value
	interactive: boolean // q <= 0.05
	chrom: string
	pos: number
	gene?: string
}

export type ManhattanPlotData = {
	png_width: number
	png_height: number
	y_max: number
	y_buffer: number
	x_buffer: number
	total_genome_length: number
	chrom_data: Record<string, { start: number; size: number; center: number }>
	points: ManhattanPoint[]
}

/**
 * Read TSV cache and render a full Manhattan plot to PNG using node-canvas.
 * Returns { pngBase64, plotData } suitable for your current client renderer.
 */
export async function plotManhattan(
	cacheFile: string,
	genome: GenomeInfo,
	opts: ManhattanRenderOpts = {}
): Promise<{ pngBase64: string; plotData: ManhattanPlotData }> {
	const settings = {
		plotWidth: 1000,
		plotHeight: 400,
		yMaxCap: 40,
		yAxisX: 70,
		yAxisY: 40,
		yAxisSpace: 40,
		fontSize: 12,
		devicePixelRatio: 1,
		skipChrM: true,
		drawChrSeparators: true,
		xBufferFrac: 0.01, // 1% of genome length on each side
		yBottomBuffer: 0.5, // ~half a unit of padding above the x-axis
		yHeadroomFrac: 0.05, // 5% headroom at the top
		yHeadroomMin: 2,
		yHeadroomMax: 6,
		...opts
	}

	// ==== Build chromosome layout (skip chrM consistently) ====
	const chrOrder = Object.keys(genome.majorchr).filter(c => !(settings.skipChrM && c.replace('chr', '') === 'M'))
	let totalBp = 0
	const chrStart: Record<string, number> = {}
	const chrom_data: ManhattanPlotData['chrom_data'] = {}

	for (const chr of chrOrder) {
		chrStart[chr] = totalBp
		const len = genome.majorchr[chr]
		totalBp += len
		chrom_data[chr] = { start: chrStart[chr], size: len, center: chrStart[chr] + len / 2 }
	}

	// ==== Scales ====
	const xScale = scaleLinear<number, number>().domain([0, totalBp]).range([0, settings.plotWidth])

	// We compute yMax after parsing; start with reasonable fallback
	let yObservedMaxRaw = 10

	// ==== Parse TSV ====
	const rl = readline.createInterface({ input: fs.createReadStream(cacheFile) })
	let headerMap: Record<string, number> | null = null
	const points: ManhattanPoint[] = []

	await new Promise<void>((resolve, reject) => {
		rl.on('line', (line: string) => {
			if (!headerMap) {
				const headers = line.split('\t').map(h => h.trim())
				headerMap = {}
				headers.forEach((h, i) => (headerMap![h] = i))
				return
			}

			const cols = line.split('\t')
			const get = (name: string) => {
				const i = headerMap![name]
				return i == null ? '' : cols[i]
			}

			const chrom = get(FIELD_CHROM)
			if (!chrom) return
			if (settings.skipChrM && chrom.replace('chr', '') === 'M') return
			if (!(chrom in genome.majorchr)) return

			// position = midpoint of [loc.start, loc.end]
			const s = numOrUndef(get(FIELD_LOC_START))
			const e = numOrUndef(get(FIELD_LOC_END))
			if (s == null || e == null) return
			const pos = Math.floor((s + e) / 2)

			// pick the smallest available q across candidate columns
			let q = minValueInRow(get, Q_CANDIDATES, n => n > 0 && n <= 1)

			// fallback: use min p if no q present (treated as q for threshold)
			if (q == null) q = minValueInRow(get, P_CANDIDATES, n => n > 0 && n <= 1)
			if (q == null) return

			// convert to plotting y = -log10(q), cap for drawing
			const yPlotRaw = -Math.log10(q)
			if (!Number.isFinite(yPlotRaw)) return
			if (yPlotRaw > yObservedMaxRaw) yObservedMaxRaw = yPlotRaw
			const y = Math.min(yPlotRaw, settings.yMaxCap)

			const gene = (get(FIELD_GENE) || undefined) as string | undefined
			const xGenome = chrStart[chrom] + pos
			const interactive = q <= 0.05

			points.push({ x: xGenome, y, q, interactive, chrom, pos, gene })
		})

		rl.on('close', () => resolve())
		rl.on('error', err => reject(err))
	})

	const yMax = Math.min(settings.yMaxCap, Math.max(10, yObservedMaxRaw))
	const yScale = scaleLinear<number, number>().domain([0, yMax]).range([settings.plotHeight, 0])

	// ==== Canvas prep ====
	const canvasWidth = Math.ceil(settings.plotWidth * settings.devicePixelRatio)
	const canvasHeight = Math.ceil(settings.plotHeight * settings.devicePixelRatio)

	const canvas = createCanvas(canvasWidth, canvasHeight)
	const ctx = canvas.getContext('2d')
	if (settings.devicePixelRatio > 1) ctx.scale(settings.devicePixelRatio, settings.devicePixelRatio)

	// Background
	ctx.fillStyle = '#FFFFFF'
	ctx.fillRect(0, 0, settings.plotWidth, settings.plotHeight)

	// ==== Alternating chromosome bands ====
	chrOrder.forEach((chr, i) => {
		const x0 = xScale(chrom_data[chr].start)
		const x1 = xScale(chrom_data[chr].start + chrom_data[chr].size)
		ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#D3D3D3'
		ctx.fillRect(x0, 0, x1 - x0, settings.plotHeight)
	})

	// points
	ctx.fillStyle = '#000000'
	const r = 1.5
	for (const p of points) {
		const cx = xScale(p.x)
		const cy = yScale(p.y)
		ctx.beginPath()
		ctx.arc(cx, cy, r, 0, Math.PI * 2)
		ctx.fill()
	}

	// Export png
	const pngBuffer = canvas.toBuffer('image/png')
	const pngBase64 = pngBuffer.toString('base64')

	// ==== plotData for the client overlay ====
	const plotData: ManhattanPlotData = {
		png_width: settings.plotWidth,
		png_height: settings.plotHeight,
		y_max: yMax,
		y_buffer: 0,
		x_buffer: 0,
		total_genome_length: totalBp,
		chrom_data,
		points // includes .interactive flag: q <= 0.05
	}

	return { pngBase64, plotData }
}
