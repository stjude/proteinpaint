import fs from 'fs'
import readline from 'readline'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'
import type { GRIN2Request } from '../../shared/types/src/routes/grin2.ts'

export type GenomeInfo = {
	majorchr: Record<string, number>
}

// pick only the plot-related keys from GRIN2Request
type RenderKeys =
	| 'width'
	| 'height'
	| 'devicePixelRatio'
	| 'yMaxCap'
	| 'skipChrM'
	| 'pngDotRadius'
	| 'pngAlpha'
	| 'padding'
	| 'yAxisX'
	| 'yAxisY'
	| 'yAxisSpace'
	| 'fontSize'
	| 'drawChrSeparators'

export type GRIN2RenderOpts = Pick<GRIN2Request, RenderKeys>

export type ManhattanPoint = {
	x: number // genome-wide bp (chrom cumulative + loc.start)
	y: number // -log10(q) (possibly scaled to fit cap)
	q: number // raw q-value
	interactive: boolean // whether this point is q <= 0.05
	chrom: string
	pos: number // loc.start
	gene?: string
	type?: 'gain' | 'loss' | 'mutation'
	color?: string
	nsubj?: number
}

export type QValueLocator = {
	type: 'mutation' | 'gain' | 'loss'
	qValueColumnIdx: number
}

export type ManhattanPlotData = {
	png_width: number
	png_height: number
	y_max: number
	y_buffer: number // keep 0 (domains stay at 0..y_max on client)
	x_buffer: number // keep 0 (domains stay at 0..total_bp on client)
	total_genome_length: number
	chrom_data: Record<string, { start: number; size: number; center: number }>
	points: ManhattanPoint[] // significant only
	padding: { left: number; right: number; top: number; bottom: number } // NEW
}

export async function plotManhattan(
	cacheFile: string,
	genome: GenomeInfo,
	qValueLocators: QValueLocator[],
	opts: Partial<GRIN2RenderOpts> = {}
): Promise<{ pngBase64: string; plotData: ManhattanPlotData }> {
	const settings = {
		plotWidth: 1000,
		plotHeight: 400,
		devicePixelRatio: 1,
		yMaxCap: 40,
		skipChrM: true,
		pngDotRadius: 2,
		pngAlpha: 0.7,
		padding: { left: 14, right: 14, top: 10, bottom: 12 }, // ⬅️ tweak to taste
		...opts
	}
	const PAD = settings.padding

	// ---------- Chromosome layout (skip chrM) ----------
	const chrOrder = Object.keys(genome.majorchr).filter(c => !(settings.skipChrM && c.replace('chr', '') === 'M'))
	const chrom_data: Record<string, { start: number; size: number; center: number }> = {}
	let totalBp = 0
	for (const chr of chrOrder) {
		const len = genome.majorchr[chr]
		chrom_data[chr] = { start: totalBp, size: len, center: totalBp + len / 2 }
		totalBp += len
	}

	const TYPE_COLOR: Record<'mutation' | 'gain' | 'loss', string> = {
		mutation: '#44AA44',
		gain: '#FF4444',
		loss: '#4444FF'
	}
	// Build index maps from the array you pass in from Python
	const qIdxByType = new Map(qValueLocators.map(d => [d.type, d.qValueColumnIdx]))

	// Fixed base columns from your Python writer (with header present in file)
	const GENE_IDX = 0
	const CHROM_IDX = 1
	const LOC_START_IDX = 2

	// ---------- Parse TSV ----------
	const rl = readline.createInterface({ input: fs.createReadStream(cacheFile) })

	// For PNG (all), for interactivity (q<=0.05)
	const pngPoints: Array<{ x: number; y: number; color: string }> = []
	const points: ManhattanPoint[] = []
	let yObservedMaxRaw = 10
	let isFirstLine = true

	await new Promise<void>((resolve, reject) => {
		rl.on('line', (line: string) => {
			if (!line || !line.trim()) return

			// Skip the header row (we keep it in the file but don’t use it here)
			if (isFirstLine) {
				isFirstLine = false
				return
			}

			const cols = line.split('\t')
			if (cols.length < 4) return

			const gene = cols[GENE_IDX] || undefined
			const chrom = cols[CHROM_IDX]
			if (!chrom) return
			if (settings.skipChrM && chrom.replace('chr', '') === 'M') return
			if (!(chrom in chrom_data)) return

			const locStart = Number(cols[LOC_START_IDX])
			if (!Number.isFinite(locStart)) return

			const xGenome = chrom_data[chrom].start + locStart

			// Use the integer indices provided by Python — no header lookups
			for (const [type, qIdx] of qIdxByType) {
				if (qIdx == null || qIdx < 0 || qIdx >= cols.length) continue

				const q = Number(cols[qIdx])
				if (!Number.isFinite(q) || q <= 0 || q > 1) continue

				const yRaw = -Math.log10(q)
				if (yRaw > yObservedMaxRaw) yObservedMaxRaw = yRaw

				pngPoints.push({ x: xGenome, y: yRaw, color: TYPE_COLOR[type] })

				if (q <= 0.05) {
					points.push({
						x: xGenome,
						y: yRaw,
						q,
						interactive: true,
						chrom,
						pos: locStart,
						gene,
						type,
						color: TYPE_COLOR[type]
					})
				}
			}
		})
		rl.on('close', () => resolve())
		rl.on('error', err => reject(err))
	})

	// ---------- Uniform y scaling to cap (like Python) ----------
	let scale_factor = 1
	let yMaxForAxis: number
	if (pngPoints.length) {
		if (yObservedMaxRaw > settings.yMaxCap) {
			scale_factor = settings.yMaxCap / yObservedMaxRaw
			for (const p of pngPoints) p.y *= scale_factor
			for (const p of points) p.y *= scale_factor
		}
		const scaledMax = Math.max(...pngPoints.map(p => p.y))
		yMaxForAxis = scaledMax + 0.35
	} else {
		yMaxForAxis = 10
	}

	// ---------- Render PNG with pixel padding in RANGE ----------
	const W = settings.plotWidth
	const H = settings.plotHeight
	const DPR = settings.devicePixelRatio

	const canvas = createCanvas(W * DPR, H * DPR)
	const ctx = canvas.getContext('2d')
	if (DPR > 1) ctx.scale(DPR, DPR)

	// background
	ctx.fillStyle = '#FFFFFF'
	ctx.fillRect(0, 0, W, H)

	// ranges include padding; domains remain 0-based
	const xScale = scaleLinear<number, number>()
		.domain([0, totalBp])
		.range([PAD.left, W - PAD.right])

	const yScale = scaleLinear<number, number>()
		.domain([0, yMaxForAxis])
		.range([H - PAD.bottom, PAD.top])

	// draw the plotting band area only (between top/bottom padding)
	const radius_buffer = settings.pngDotRadius
	const bandPad = Math.ceil(radius_buffer)
	const plotTop = Math.max(0, PAD.top - bandPad)
	const plotBottom = Math.min(H, H - PAD.bottom + bandPad)
	const plotHeight = plotBottom - plotTop

	// alternating chr bands inside padded y-range
	chrOrder.forEach((chr, i) => {
		const x0 = xScale(chrom_data[chr].start)
		const x1 = xScale(chrom_data[chr].start + chrom_data[chr].size)
		ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#D3D3D3'
		ctx.fillRect(x0, plotTop, x1 - x0, plotHeight)
	})

	// colored points
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

	// ---------- Return plotData (client mirrors same padding in ranges) ----------
	const plotData: ManhattanPlotData = {
		png_width: W,
		png_height: H,
		y_max: yMaxForAxis,
		y_buffer: 0,
		x_buffer: 0,
		total_genome_length: totalBp,
		chrom_data,
		points,
		padding: PAD
	}

	return { pngBase64, plotData }
}
