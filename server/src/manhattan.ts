import fs from 'node:fs'
import readline from 'node:readline'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'

export type QValueLocator = {
	type: 'mutation' | 'gain' | 'loss'
	qValueColumnIdx: number
}

type ManhattanPoint = {
	x: number
	y: number
	q: number
	interactive: boolean
	chrom: string
	pos: number
	gene: string
	type: 'mutation' | 'gain' | 'loss'
	color: string
}

type ManhattanPlotData = {
	png_width: number
	png_height: number
	y_max: number
	y_buffer: number
	x_buffer: number
	total_genome_length: number
	chrom_data: Record<string, { start: number; size: number; center: number }>
	points: ManhattanPoint[]
	padding: { left: number; right: number; top: number; bottom: number }
}

type GRIN2RenderOpts = {
	plotWidth: number
	plotHeight: number
	devicePixelRatio: number
	yMaxCap: number
	skipChrM: boolean
	pngDotRadius: number
	pngAlpha: number
	padding: { left: number; right: number; top: number; bottom: number }
}

type GenomeInfo = {
	majorchr: Record<string, number>
}

const TYPE_COLOR: Record<'mutation' | 'gain' | 'loss', string> = {
	mutation: '#44AA44',
	gain: '#FF4444',
	loss: '#4444FF'
}

// --- small helper that draws static layers once and exposes plotDot ---
function createManhattanRenderer(opts: {
	W: number
	H: number
	DPR: number
	PAD: { left: number; right: number; top: number; bottom: number }
	totalBp: number
	chrOrder: string[]
	chrom_data: Record<string, { start: number; size: number; center: number }>
	yMaxForAxis: number
	pngDotRadius: number
	pngAlpha: number
}) {
	const { W, H, DPR, PAD, totalBp, chrOrder, chrom_data, yMaxForAxis, pngDotRadius, pngAlpha } = opts

	const canvas = createCanvas(W * DPR, H * DPR)
	const ctx = canvas.getContext('2d')
	if (DPR > 1) ctx.scale(DPR, DPR)

	// Background
	ctx.fillStyle = '#FFFFFF'
	ctx.fillRect(0, 0, W, H)

	// Scales (domains are genome units and -log10(q); ranges include padding)
	const xScale = scaleLinear<number, number>()
		.domain([0, totalBp])
		.range([PAD.left, W - PAD.right])
	const yScale = scaleLinear<number, number>()
		.domain([0, yMaxForAxis])
		.range([H - PAD.bottom, PAD.top])

	// Plotting band height (to keep bands behind dots, respecting dot radius bleed)
	const bandPad = Math.ceil(pngDotRadius)
	const plotTop = Math.max(0, PAD.top - bandPad)
	const plotBottom = Math.min(H, H - PAD.bottom + bandPad)
	const plotHeight = plotBottom - plotTop

	// Alternating chr bands
	chrOrder.forEach((chr, i) => {
		const x0 = xScale(chrom_data[chr].start)
		const x1 = xScale(chrom_data[chr].start + chrom_data[chr].size)
		ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#D3D3D3'
		ctx.fillRect(x0, plotTop, x1 - x0, plotHeight)
	})

	// Prepare dot drawing
	const r = pngDotRadius
	ctx.globalAlpha = pngAlpha

	function plotDot(xGenome: number, yVal: number, color: string) {
		const cx = xScale(xGenome)
		const cy = yScale(yVal)
		ctx.fillStyle = color
		ctx.beginPath()
		ctx.arc(cx, cy, r, 0, Math.PI * 2)
		ctx.fill()
	}

	function finalize(): string {
		ctx.globalAlpha = 1
		return canvas.toBuffer('image/png').toString('base64')
	}

	return { plotDot, finalize, xScale, yScale }
}

export async function plotManhattan(
	cacheFile: string,
	genome: GenomeInfo,
	qValueLocators: QValueLocator[],
	opts: Partial<GRIN2RenderOpts> = {}
): Promise<{ pngBase64: string; plotData: ManhattanPlotData }> {
	const settings: GRIN2RenderOpts = {
		plotWidth: 1000,
		plotHeight: 400,
		devicePixelRatio: 1,
		yMaxCap: 40,
		skipChrM: true,
		pngDotRadius: 2,
		pngAlpha: 0.7,
		padding: { left: 14, right: 14, top: 10, bottom: 12 },
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

	// Build index map once
	const qIdxByType = new Map(qValueLocators.map(d => [d.type, d.qValueColumnIdx]))

	// Fixed columns in cache file
	const GENE_IDX = 0
	const CHROM_IDX = 1
	const LOC_START_IDX = 2

	// ---------------- Pass 1: find yObservedMaxRaw ----------------
	let yObservedMaxRaw = 10
	await new Promise<void>((resolve, reject) => {
		const rl1 = readline.createInterface({ input: fs.createReadStream(cacheFile) })
		let isFirstLine = true

		rl1.on('line', (line: string) => {
			if (!line || !line.trim()) return
			if (isFirstLine) {
				isFirstLine = false // skip header
				return
			}
			const cols = line.split('\t')
			if (cols.length < 4) return

			const chrom = cols[CHROM_IDX]
			if (!chrom) return
			if (settings.skipChrM && chrom.replace('chr', '') === 'M') return
			if (!(chrom in chrom_data)) return

			for (const [, qIdx] of qIdxByType) {
				if (qIdx == null || qIdx < 0 || qIdx >= cols.length) continue
				const q = Number(cols[qIdx])
				if (!Number.isFinite(q) || q <= 0 || q > 1) continue
				const yRaw = -Math.log10(q)
				if (yRaw > yObservedMaxRaw) yObservedMaxRaw = yRaw
			}
		})
		rl1.on('close', () => resolve())
		rl1.on('error', err => reject(err))
	})

	// ---------- Determine y scale (uniform scaling if above cap) ----------
	let scale_factor = 1
	if (yObservedMaxRaw > settings.yMaxCap) scale_factor = settings.yMaxCap / yObservedMaxRaw

	// After scaling, the true plotted max is min(yObservedMaxRaw, yMaxCap)
	const yMaxForAxis = Math.min(yObservedMaxRaw, settings.yMaxCap) + 0.35

	// ---------- Init canvas + static layers ONCE ----------
	const W = settings.plotWidth
	const H = settings.plotHeight
	const DPR = settings.devicePixelRatio

	const renderer = createManhattanRenderer({
		W,
		H,
		DPR,
		PAD,
		totalBp,
		chrOrder,
		chrom_data,
		yMaxForAxis,
		pngDotRadius: settings.pngDotRadius,
		pngAlpha: settings.pngAlpha
	})

	// For interactivity (q <= 0.05)
	const points: ManhattanPoint[] = []

	// ---------------- Pass 2: stream and plot dots ----------------
	await new Promise<void>((resolve, reject) => {
		const rl2 = readline.createInterface({ input: fs.createReadStream(cacheFile) })
		let isFirstLine = true

		rl2.on('line', (line: string) => {
			if (!line || !line.trim()) return
			if (isFirstLine) {
				isFirstLine = false // skip header
				return
			}
			const cols = line.split('\t')
			if (cols.length < 4) return

			const gene = cols[GENE_IDX]
			const chrom = cols[CHROM_IDX]
			if (!chrom) return
			if (settings.skipChrM && chrom.replace('chr', '') === 'M') return
			if (!(chrom in chrom_data)) return

			const locStart = Number(cols[LOC_START_IDX])
			if (!Number.isFinite(locStart)) return

			const xGenome = chrom_data[chrom].start + locStart

			for (const [type, qIdx] of qIdxByType) {
				if (qIdx == null || qIdx < 0 || qIdx >= cols.length) continue
				const q = Number(cols[qIdx])
				if (!Number.isFinite(q) || q <= 0 || q > 1) continue

				let y = -Math.log10(q)
				if (scale_factor !== 1) y *= scale_factor

				// draw per point (no re-render of static layers)
				renderer.plotDot(xGenome, y, TYPE_COLOR[type])

				// keep only interactive set (q<=0.05)
				if (q <= 0.05) {
					points.push({
						x: xGenome,
						y,
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
		rl2.on('close', () => resolve())
		rl2.on('error', err => reject(err))
	})

	// ---------- PNG out ----------
	const pngBase64 = renderer.finalize()

	// ---------- Return plotData (for D3 overlay, hovers, etc.) ----------
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
