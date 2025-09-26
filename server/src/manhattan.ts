// server/src/manhattanFromCache.ts
import fs from 'fs'
import readline from 'readline'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'

export type GenomeInfo = {
	majorchr: Record<string, number>
}

export type ManhattanPoint = {
	x: number // genome-wide bp (chrom cumulative + loc.start)
	y: number // -log10(q) (possibly scaled to fit cap)
	q: number // raw q-value
	interactive: boolean // true here (q <= 0.05)
	chrom: string
	pos: number // loc.start
	gene?: string
	type?: 'gain' | 'loss' | 'mutation'
	color?: string
	nsubj?: number
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

export type ManhattanRenderOpts = {
	plotWidth?: number
	plotHeight?: number
	devicePixelRatio?: number
	yMaxCap?: number // target cap (default 40)
	skipChrM?: boolean
	pngDotRadius?: number
	pngAlpha?: number
	/** Pixel padding INSIDE the PNG drawing area (keeps domains 0-based) */
	padding?: { left: number; right: number; top: number; bottom: number }
	yAxisX?: number
	yAxisY?: number
	yAxisSpace?: number
	fontSize?: number
	drawChrSeparators?: boolean
}

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

	// ---------- TSV fields ----------
	const FIELD_GENE = 'gene'
	const FIELD_CHROM = 'chrom'
	const FIELD_LOC_START = 'loc.start'

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

	// ---------- Parse TSV ----------
	const rl = readline.createInterface({ input: fs.createReadStream(cacheFile) })
	let headerMap: Record<string, number> | null = null

	// For PNG (all), for interactivity (q<=0.05)
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

			for (const { type, qCol, nCol } of TYPE_COLS) {
				const qStr = get(qCol)
				if (!qStr) continue
				const q = Number(qStr)
				if (!Number.isFinite(q) || q <= 0 || q > 1) continue

				const yRaw = -Math.log10(q)
				if (yRaw > yObservedMaxRaw) yObservedMaxRaw = yRaw

				pngPoints.push({ x: xGenome, y: yRaw, color: TYPE_COLOR[type] })

				if (q <= 0.05) {
					const nsubjVal = Number(get(nCol))
					points.push({
						x: xGenome,
						y: yRaw, // scaled later if needed
						q,
						interactive: true,
						chrom,
						pos: locStart,
						gene,
						type,
						color: TYPE_COLOR[type],
						nsubj: Number.isFinite(nsubjVal) ? nsubjVal : undefined
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
	const plotTop = PAD.top
	const plotHeight = H - PAD.top - PAD.bottom

	// alternating chr bands inside padded y-range
	chrOrder.forEach((chr, i) => {
		const x0 = xScale(chrom_data[chr].start)
		const x1 = xScale(chrom_data[chr].start + chrom_data[chr].size)
		ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#D3D3D3'
		ctx.fillRect(x0, plotTop, x1 - x0, plotHeight)
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
