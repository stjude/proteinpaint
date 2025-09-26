// server/src/manhattanFromCache.ts
import fs from 'fs'
import readline from 'readline'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'

/** Genome info must provide cumulative-friendly lengths */
export type GenomeInfo = {
	/** e.g., { chr1: 248956422, chr2: 242193529, ..., chrM?: <len> } */
	majorchr: Record<string, number>
}

/** Interactive point returned to the client (q ≤ 0.05 only) */
export type ManhattanPoint = {
	x: number // genome-wide bp (chrom cumulative + loc.start)
	y: number // -log10(q) (possibly scaled to fit 40 cap)
	q: number // raw q-value
	interactive: boolean // always true for these points
	chrom: string
	pos: number // loc.start
	gene?: string
	type?: 'gain' | 'loss' | 'mutation'
	color?: string
	nsubj?: number // nsubj.<type> if present
}

/** Plot data consumed by your client */
export type ManhattanPlotData = {
	png_width: number
	png_height: number
	y_max: number // axis max used by client (includes small headroom)
	y_buffer: number // keep 0 (client domains start at 0)
	x_buffer: number // keep 0 (client domains start at 0)
	total_genome_length: number
	chrom_data: Record<string, { start: number; size: number; center: number }>
	points: ManhattanPoint[] // significant only
}

/** Options (tweak as needed) */
export type ManhattanRenderOpts = {
	plotWidth?: number
	plotHeight?: number
	devicePixelRatio?: number
	yMaxCap?: number // target cap for tallest point (default 40)
	skipChrM?: boolean
	pngDotRadius?: number // radius in px for PNG dots (default 2)
	pngAlpha?: number // alpha for PNG dots (default 0.7)
	yAxisX?: number // space for y axis (default 60)
	yAxisY?: number // top margin (default 20)
	yAxisSpace?: number // space between y axis and plot (default 10)
	fontSize?: number // font size for axes (default 12)
	showInteractiveDots?: boolean // whether client should show interactive dots (default true)
	interactiveDotRadius?: number // radius in px for interactive dots (default 3)
	interactiveDotStrokeWidth?: number // stroke width in px for interactive dots (default 1)
	drawChrSeparators?: boolean // whether to draw vertical lines between chromosomes (default true)
}

/** Drop-in: reads TSV cache and returns { pngBase64, plotData } */
export async function plotManhattan(
	cacheFile: string,
	genome: GenomeInfo,
	opts: ManhattanRenderOpts = {}
): Promise<{ pngBase64: string; plotData: ManhattanPlotData }> {
	const settings = {
		plotWidth: 1000,
		plotHeight: 400,
		devicePixelRatio: 1,
		yMaxCap: 40,
		skipChrM: true,
		pngDotRadius: 2,
		pngAlpha: 0.7,
		...opts
	}

	// ----- Chromosome layout (skip chrM consistently) -----
	const chrOrder = Object.keys(genome.majorchr).filter(c => !(settings.skipChrM && c.replace('chr', '') === 'M'))
	const chrom_data: Record<string, { start: number; size: number; center: number }> = {}
	let totalBp = 0
	for (const chr of chrOrder) {
		const len = genome.majorchr[chr]
		chrom_data[chr] = { start: totalBp, size: len, center: totalBp + len / 2 }
		totalBp += len
	}

	// ----- TSV columns we care about -----
	const FIELD_GENE = 'gene'
	const FIELD_CHROM = 'chrom'
	const FIELD_LOC_START = 'loc.start'

	// lesion-type columns & colors (matches your Python)
	const TYPE_COLOR: Record<'mutation' | 'gain' | 'loss', string> = {
		mutation: '#44AA44',
		gain: '#FF4444',
		loss: '#4444FF'
	}
	const TYPE_COLS: Array<{ type: 'mutation' | 'gain' | 'loss'; qCol: string; nCol: string }> = [
		{ type: 'gain', qCol: 'q.nsubj.gain', nCol: 'nsubj.gain' },
		{ type: 'loss', qCol: 'q.nsubj.loss', nCol: 'nsubj.loss' },
		{ type: 'mutation', qCol: 'q.nsubj.mutation', nCol: 'nsubj.mutation' }
	]

	// ----- Parse TSV -----
	const rl = readline.createInterface({ input: fs.createReadStream(cacheFile) })
	let headerMap: Record<string, number> | null = null

	// For PNG (all points, colored); for interactivity (q≤0.05 only)
	const pngPoints: Array<{ x: number; y: number; color: string }> = []
	const points: ManhattanPoint[] = []
	let yObservedMaxRaw = 10

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
			if (!(chrom in chrom_data)) return

			const locStart = Number(get(FIELD_LOC_START))
			if (!Number.isFinite(locStart)) return

			const xGenome = chrom_data[chrom].start + locStart
			const gene = (get(FIELD_GENE) || undefined) as string | undefined

			// For each lesion type, add a point if q is valid
			for (const { type, qCol, nCol } of TYPE_COLS) {
				const qStr = get(qCol)
				if (!qStr) continue
				const q = Number(qStr)
				if (!Number.isFinite(q) || q <= 0 || q > 1) continue

				const yRaw = -Math.log10(q)
				if (yRaw > yObservedMaxRaw) yObservedMaxRaw = yRaw

				// collect for PNG
				pngPoints.push({ x: xGenome, y: yRaw, color: TYPE_COLOR[type] })

				// collect for interactivity if significant
				if (q <= 0.05) {
					const nsubjStr = get(nCol)
					const nsubj = nsubjStr ? Number(nsubjStr) : undefined
					points.push({
						x: xGenome,
						y: yRaw, // may be scaled later
						q,
						interactive: true,
						chrom,
						pos: locStart,
						gene,
						type,
						color: TYPE_COLOR[type],
						nsubj: Number.isFinite(nsubj as number) ? (nsubj as number) : undefined
					})
				}
			}
		})

		rl.on('close', () => resolve())
		rl.on('error', err => reject(err))
	})

	// ----- Uniform y scaling to a 40 cap (like your Python) -----
	let scale_factor = 1
	let yMaxForAxis: number
	if (pngPoints.length) {
		if (yObservedMaxRaw > settings.yMaxCap) {
			scale_factor = settings.yMaxCap / yObservedMaxRaw
			// scale draw y for both PNG and interactive points
			for (const p of pngPoints) p.y *= scale_factor
			for (const p of points) p.y *= scale_factor
		}
		const scaledMax = Math.max(...pngPoints.map(p => p.y))
		yMaxForAxis = scaledMax + 0.35 // small headroom like the Python
	} else {
		yMaxForAxis = 10
	}

	// ----- Render PNG (bands + colored points only) -----
	const W = settings.plotWidth
	const H = settings.plotHeight
	const DPR = settings.devicePixelRatio

	const canvas = createCanvas(W * DPR, H * DPR)
	const ctx = canvas.getContext('2d')
	if (DPR > 1) ctx.scale(DPR, DPR)

	// white background
	ctx.fillStyle = '#FFFFFF'
	ctx.fillRect(0, 0, W, H)

	// scales (domains start at 0; client will use same)
	const xScale = scaleLinear<number, number>().domain([0, totalBp]).range([0, W])
	const yScale = scaleLinear<number, number>().domain([0, yMaxForAxis]).range([H, 0])

	// alternating chromosome bands
	chrOrder.forEach((chr, i) => {
		const x0 = xScale(chrom_data[chr].start)
		const x1 = xScale(chrom_data[chr].start + chrom_data[chr].size)
		ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#D3D3D3'
		ctx.fillRect(x0, 0, x1 - x0, H)
	})

	// colored points (slight alpha like matplotlib)
	const r = settings.pngDotRadius
	ctx.globalAlpha = settings.pngAlpha
	for (const p of pngPoints) {
		ctx.fillStyle = p.color
		const cx = xScale(p.x)
		const cy = yScale(p.y)
		ctx.beginPath()
		ctx.arc(cx, cy, r, 0, Math.PI * 2)
		ctx.fill()
	}
	ctx.globalAlpha = 1

	const pngBase64 = canvas.toBuffer('image/png').toString('base64')

	// ----- Return plotData for client overlay -----
	const plotData: ManhattanPlotData = {
		png_width: W,
		png_height: H,
		y_max: yMaxForAxis,
		y_buffer: 0,
		x_buffer: 0,
		total_genome_length: totalBp,
		chrom_data,
		points // significant only; each carries type/color/nsubj
	}

	return { pngBase64, plotData }
}
