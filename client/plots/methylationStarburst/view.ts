import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { table2col } from '#dom/table2col'
import { DataPointInteractions } from '#dom/dataPointInteractions'
import { axisstyle } from '#dom/axisstyle'
import type { ActionMenuItem } from '#dom/dataPointClickMenu'
import type { MethylationStarburstResponse } from '#types'

export type StarburstData = Extract<MethylationStarburstResponse, { genes: any }>
export type Cutoffs = { minDeltaBeta: number; maxQ: number }
type Region = 'promoter' | 'body'

/* A gene passing both cutoffs is colored by whether methylation and expression moved the same way (hyper and up,
hypo and down) or opposite ways (hyper and down, hypo and up: the silencing direction). Position already says
which quadrant; the color makes the balance between the two diagonals visible, which the odds ratio states. */
export { STARBURST_COLORS as colors } from '#shared/dmrColors.js'
import { STARBURST_COLORS as colors } from '#shared/dmrColors.js'

/** the rings of a pathway's leading-edge genes: a green that none of the point colors uses */
export const RING_COLOR = '#0a8a5a'

export const regionLabels: Record<Region, string> = {
	promoter: 'Core promoter (TSS −2 kb to +500 bp)',
	body: 'Transcript body'
}

/** ranks with ties averaged, 1-based */
function rank(v: number[]) {
	const order = v.map((_, i) => i).sort((a, b) => v[a] - v[b])
	const r = new Array(v.length)
	for (let i = 0; i < order.length; ) {
		let j = i
		while (j + 1 < order.length && v[order[j + 1]] == v[order[i]]) j++
		for (let k = i; k <= j; k++) r[order[k]] = (i + j) / 2 + 1
		i = j + 1
	}
	return r
}

/** Spearman's rho: Pearson's r of the ranks */
export function spearman(x: number[], y: number[]) {
	const n = x.length
	if (n < 3) return null
	const rx = rank(x)
	const ry = rank(y)
	const m = (n + 1) / 2
	let sxy = 0
	let sxx = 0
	let syy = 0
	for (let i = 0; i < n; i++) {
		sxy += (rx[i] - m) * (ry[i] - m)
		sxx += (rx[i] - m) ** 2
		syy += (ry[i] - m) ** 2
	}
	return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null
}

/** Genes past both cutoffs by quadrant, and the odds ratio of the same-direction diagonal over the opposite one
 * with a Woolf 95% interval; 0.5 is added to every cell when one is empty. */
export function quadrants(db: number[], fc: number[], q: number[], c: Cutoffs) {
	const n = { hyperUp: 0, hyperDown: 0, hypoUp: 0, hypoDown: 0 }
	for (let i = 0; i < db.length; i++) {
		if (!(Math.abs(db[i]) > c.minDeltaBeta && q[i] < c.maxQ) || fc[i] == 0) continue
		n[db[i] > 0 ? (fc[i] > 0 ? 'hyperUp' : 'hyperDown') : fc[i] > 0 ? 'hypoUp' : 'hypoDown']++
	}
	const cells = [n.hyperUp, n.hypoDown, n.hyperDown, n.hypoUp]
	if (cells.every(v => v == 0)) return { n }
	const [a, d, b, c2] = cells.some(v => v == 0) ? cells.map(v => v + 0.5) : cells
	const lor = Math.log((a * d) / (b * c2))
	const se = Math.sqrt(1 / a + 1 / b + 1 / c2 + 1 / d)
	return { n, or: Math.exp(lor), lo: Math.exp(lor - 1.96 * se), hi: Math.exp(lor + 1.96 * se) }
}

function passes(db: number, q: number, c: Cutoffs) {
	return Math.abs(db) > c.minDeltaBeta && q < c.maxQ
}

/** the symmetric limit of an axis: the 99.9th percentile of |v|, so a few extreme fold changes do not squash the
 * cloud; points past it are drawn on the edge */
/** the axis half-range: every point's |value|, with 5% to spare so none sits on the edge */
function limit(v: number[]) {
	return v.reduce((m, x) => Math.max(m, Math.abs(x)), 0) * 1.05 || 1
}

// a value that rounds to zero prints without a sign, not as -0.000
const fmt = (v: number | null, d = 3) => {
	if (v == null) return '—'
	const t = Math.abs(v).toFixed(d)
	return Number(t) == 0 ? t : (v > 0 ? '+' : '−') + t
}
const fmtQ = (q: number) => (q < 1e-4 ? q.toExponential(1) : q.toPrecision(2))

const circlePath = (r: number) => `M${r},0 A${r},${r} 0 1,1 ${-r},0 A${r},${r} 0 1,1 ${r},0 Z`

/** a point of one panel: its index in data, and where it is drawn */
/** r: the drawn radius, which the hover ring hugs */
type Point = { i: number; x: number; y: number; r: number }

/** Two scatter panels, core promoter and gene body, sharing both axes. `highlight` genes (or, by isoform, transcript
 * ids) are ringed and named. Hover and click are the portal's DataPointInteractions, as on the Manhattan and volcano
 * plots: a click opens a menu of the point's `getActions` that stays until dismissed, and a click on overlapping points
 * lists them first. Returns the svg, and destroy() for the click menus, to call before drawing again. */
export function drawStarburst(
	holder: any,
	data: StarburstData,
	cutoffs: Cutoffs,
	groups: [string, string],
	tip: any,
	/** the actions of the point at index i of data; its transcript is data.isoforms[i] */
	getActions: (i: number) => ActionMenuItem[],
	highlight: string[] = [],
	/** each panel's plot height; embedded, the volcano's, so the two plots are the same height */
	H = 300,
	/** genes whose transcripts are ringed without names, in RING_COLOR: the genes ActivePathways picked for a gene set */
	ringGenes: Set<string> = new Set()
) {
	const W = 300
	/* Axes as the DM volcano draws them (VolcanoPlotView renderScale): axisstyle black with the axis line, each set
	AXIS_OFFSET px off the plot area, titles inheriting the page font and size ~50 px beyond the axis */
	const AXIS_OFFSET = 20
	const m = { top: 84, left: 100, bottom: 110, gap: 80 }
	const regions: Region[] = ['promoter', 'body']
	const allDb = regions.flatMap(r => data[r].filter(v => v != null) as number[])
	const x = scaleLinear()
		.domain([-limit(allDb), limit(allDb)])
		.range([0, W])
		.nice()
	// each gene's number of transcripts in the plot, for the tooltip
	const transcriptsOf = new Map<string, number>()
	for (const gn of data.genes) transcriptsOf.set(gn, (transcriptsOf.get(gn) || 0) + 1)
	const yl = limit(data.log2fc)
	const y = scaleLinear().domain([-yl, yl]).range([H, 0]).nice()
	const radius = (pass: boolean) => (pass ? 2.5 : 1.5)
	const svg = holder
		.append('svg')
		.attr('data-testid', 'sjpp-methylationStarburst-svg')
		// block: a top margin, which lines the plots up with the volcano's, applies to a block
		.style('display', 'block')
		.attr('width', m.left + 2 * W + m.gap + 30)
		.attr('height', m.top + H + m.bottom + 30)

	const interactions: DataPointInteractions<Point>[] = []

	regions.forEach((region, k) => {
		const idx = data.genes.map((_, i) => i).filter(i => data[region][i] != null)
		const db = idx.map(i => data[region][i] as number)
		const fc = idx.map(i => data.log2fc[i])
		const q = idx.map(i => data.q[i])
		const rho = spearman(db, fc)
		const quad = quadrants(db, fc, q, cutoffs)
		const g = svg
			.append('g')
			.attr('data-testid', `sjpp-methylationStarburst-${region}`)
			.attr('transform', `translate(${m.left + k * (W + m.gap)},${m.top})`)

		g.append('text').attr('y', -66).attr('font-weight', 'bold').attr('font-size', 13).text(regionLabels[region])
		// two lines, so that a long odds ratio is not cut off at the panel's width
		const stats = g
			.append('text')
			.attr('data-testid', 'sjpp-methylationStarburst-stats')
			.attr('y', -50)
			.attr('font-size', 11)
			.attr('fill', '#555')
		stats.append('tspan').text(`${idx.length.toLocaleString()} transcripts · ρ = ${fmt(rho, 2)}`)
		if (quad.or)
			stats
				.append('tspan')
				.attr('x', 0)
				.attr('dy', 14)
				.text(`same-direction OR ${quad.or.toFixed(2)} (${quad.lo!.toFixed(2)}–${quad.hi!.toFixed(2)})`)

		// guides: zero lines and the Δβ cutoff
		const guide = (x1: number, y1: number, x2: number, y2: number, dash?: string) =>
			g
				.append('line')
				.attr('x1', x1)
				.attr('y1', y1)
				.attr('x2', x2)
				.attr('y2', y2)
				.attr('stroke', '#ccc')
				.attr('stroke-dasharray', dash || null)
		guide(0, y(0), W, y(0))
		guide(x(0), 0, x(0), H)
		for (const c of [-cutoffs.minDeltaBeta, cutoffs.minDeltaBeta]) guide(x(c), 0, x(c), H, '4,3')

		// every gene on a canvas, below-cutoff genes first so the colored ones sit on top
		const dpr = window.devicePixelRatio || 1
		const canvas = document.createElement('canvas')
		canvas.width = W * dpr
		canvas.height = H * dpr
		const ctx = canvas.getContext('2d')!
		ctx.scale(dpr, dpr)
		const order = idx.map((_, j) => j).sort((a, b) => +passes(db[a], q[a], cutoffs) - +passes(db[b], q[b], cutoffs))
		for (const j of order) {
			const pass = passes(db[j], q[j], cutoffs)
			ctx.globalAlpha = pass ? 0.9 : 0.35
			ctx.fillStyle = pass ? (db[j] > 0 == fc[j] > 0 ? colors.same : colors.opposite) : colors.below
			ctx.beginPath()
			ctx.arc(x(db[j]), y(fc[j]), radius(pass), 0, 2 * Math.PI)
			ctx.fill()
		}
		g.append('image')
			.attr('class', 'sjpp-methylationStarburst-dots')
			.attr('width', W)
			.attr('height', H)
			.attr('href', canvas.toDataURL())

		// counts at the corners of the quadrants they count, just outside the frame: inside it they covered points and
		// the names of highlighted genes
		const corner = (label: string, count: number, color: string, right: boolean, top: boolean) => {
			const t = g
				.append('g')
				.attr('class', 'sjpp-methylationStarburst-count')
				.attr('transform', `translate(${right ? W : 0},${top ? -8 : H + 98})`)
			t.append('circle')
				.attr('cx', right ? -4 : 4)
				.attr('cy', -4)
				.attr('r', 4)
				.attr('fill', color)
			t.append('text')
				.attr('x', right ? -12 : 12)
				.attr('text-anchor', right ? 'end' : 'start')
				.attr('font-size', 11)
				// a halo, so the count reads over the dots it sits on
				.attr('stroke', 'white')
				.attr('stroke-width', 3)
				.attr('stroke-linejoin', 'round')
				.attr('paint-order', 'stroke')
				.text(`${label} ${count.toLocaleString()}`)
		}
		corner('hypo, up', quad.n.hypoUp, colors.opposite, false, true)
		corner('hyper, up', quad.n.hyperUp, colors.same, true, true)
		corner('hypo, down', quad.n.hypoDown, colors.same, false, false)
		corner('hyper, down', quad.n.hyperDown, colors.opposite, true, false)

		// a pathway's leading-edge genes: rings only, too many to name, under the named genes' rings
		if (ringGenes.size) {
			const rg = g.append('g').attr('class', 'sjpp-methylationStarburst-ring')
			idx.forEach((i, j) => {
				if (!ringGenes.has(data.genes[i])) return
				rg.append('circle')
					.attr('cx', x(db[j]))
					.attr('cy', y(fc[j]))
					.attr('r', 4.5)
					.attr('fill', 'none')
					.attr('stroke', RING_COLOR)
					.attr('stroke-width', 1.5)
			})
		}

		// named genes: a ring on the dot and the name beside it, on the side with more room, and under the dot
		// near the top edge, where the corner counts are
		for (const gene of highlight) {
			// by isoform a gene has a point per transcript: each is ringed, the name goes by the one furthest from 0
			// a gene, or by isoform a transcript id
			const js = idx.map((i, j) => (data.genes[i] == gene || data.isoforms[i] == gene ? j : -1)).filter(j => j != -1)
			if (!js.length) continue
			const h = g.append('g').attr('class', 'sjpp-methylationStarburst-highlight')
			for (const j of js)
				h.append('circle')
					.attr('cx', x(db[j]))
					.attr('cy', y(fc[j]))
					.attr('r', 4)
					.attr('fill', 'none')
					.attr('stroke', '#000')
			const j = js.reduce((a, b) => (Math.hypot(db[b], fc[b]) > Math.hypot(db[a], fc[a]) ? b : a))
			const [cx, cy] = [x(db[j]), y(fc[j])]
			const right = cx < W - 60
			h.append('text')
				.attr('x', cx + (right ? 7 : -7))
				.attr('y', cy + (cy < 24 ? 16 : 4))
				.attr('text-anchor', right ? 'start' : 'end')
				.attr('font-size', 11)
				.attr('font-style', 'italic')
				.attr('stroke', 'white')
				.attr('stroke-width', 3)
				.attr('paint-order', 'stroke')
				.text(js.length > 1 ? `${gene} (${js.length})` : gene)
		}

		for (const [axis, at] of [
			[axisBottom(x).ticks(5), `translate(0,${H + AXIS_OFFSET})`],
			[axisLeft(y).ticks(6), `translate(${-AXIS_OFFSET},0)`]
		] as const)
			axisstyle({ axis: g.append('g').attr('transform', at).call(axis), color: 'black', showline: true })
		// worded as the volcano's x axis
		g.append('text')
			.attr('x', W / 2)
			.attr('y', H + AXIS_OFFSET + 50)
			.attr('text-anchor', 'middle')
			.text(`Δβ (${groups[1]} − ${groups[0]})`)
		if (k == 0) {
			// log₂ with a subscript, as the volcano's fold-change label
			const yl = g
				.append('text')
				.attr('transform', `translate(${-AXIS_OFFSET - 47},${H / 2}) rotate(-90)`)
				.attr('text-anchor', 'middle')
			yl.append('tspan').text('log')
			yl.append('tspan').attr('baseline-shift', 'sub').attr('font-size', '0.7em').text('2')
			yl.append('tspan').text(`(fold-change, ${groups[1]} / ${groups[0]})`)
		}

		const hoverLayer = g.append('g').style('pointer-events', 'none')
		const cover = g
			.append('rect')
			.attr('data-testid', 'sjpp-methylationStarburst-hit')
			.attr('width', W)
			.attr('height', H)
			.attr('fill', 'transparent')
			.style('pointer-events', 'all')
			// the plain pointer, as on the volcano
			.style('cursor', 'default')
		const other: Region = region == 'promoter' ? 'body' : 'promoter'
		const info = (pt: Point, holder: any) => {
			const i = pt.i
			const table = table2col({ holder })
			table.addRow('Gene', data.genes[i])
			table.addRow('Isoform', data.isoforms[i])
			const n = transcriptsOf.get(data.genes[i]) || 1
			if (n > 1) table.addRow('Transcripts of the gene', String(n))
			table.addRow(`Δβ, ${region}`, fmt(data[region][i]))
			table.addRow(`Δβ, ${other}`, fmt(data[other][i]))
			table.addRow('log2 fold change', fmt(data.log2fc[i], 2))
			table.addRow('DE q', fmtQ(data.q[i]))
		}
		const dpi = new DataPointInteractions<Point>({
			cover,
			hoverLayer,
			hoverTip: tip,
			points: idx.map((i, j) => {
				return { i, x: x(db[j]), y: y(fc[j]), r: radius(passes(db[j], q[j], cutoffs)) }
			}),
			getX: pt => pt.x,
			getY: pt => pt.y,
			hitRadius: 5,
			// 1 px out from the point's edge, so the ring sits right around it
			toHoverSpec: pt => ({ path: circlePath(pt.r + 1), transform: `translate(${pt.x},${pt.y})`, strokeWidth: 1 }),
			itemNoun: 'transcript',
			renderSingleHoverTooltip: (pt, holder) => {
				info(pt, holder)
				holder
					.append('div')
					.style('font-size', '0.8em')
					.style('opacity', 0.7)
					.style('padding', '2px 4px')
					.text('Click for options')
			},
			buildMultiHitTableData: pts => ({
				columns: [
					{ label: 'Gene' },
					{ label: 'Isoform' },
					{ label: `Δβ, ${region}` },
					{ label: 'log2 fold change' },
					{ label: 'DE q' }
				],
				rows: pts.map(pt => [
					{ value: data.genes[pt.i] },
					{ value: data.isoforms[pt.i] },
					{ value: fmt(data[region][pt.i]) },
					{ value: fmt(data.log2fc[pt.i], 2) },
					{ value: fmtQ(data.q[pt.i]) }
				])
			}),
			getActions: pt => getActions(pt.i),
			renderSingleHitInfo: info,
			getRowKey: pt => String(pt.i)
		})
		dpi.attach()
		interactions.push(dpi)
	})

	// legend
	const lg = svg.append('g').attr('transform', `translate(${m.left},${m.top + H + m.bottom + 14})`)
	let lx = 0
	for (const [c, label] of [
		[colors.same, 'Same direction'],
		[colors.opposite, 'Opposite direction'],
		[colors.below, `Below cutoffs (|Δβ| ≤ ${cutoffs.minDeltaBeta} or DE q ≥ ${cutoffs.maxQ})`]
	]) {
		lg.append('circle')
			.attr('cx', lx + 4)
			.attr('cy', -4)
			.attr('r', 4)
			.attr('fill', c)
		const t = lg
			.append('text')
			.attr('x', lx + 12)
			.attr('font-size', 11)
			.text(label)
		lx += 12 + (t.node()?.getComputedTextLength?.() || label.length * 6) + 18
	}
	// plotTop: where the panels' plot areas start in the svg, for lining them up with the volcano's
	return { svg, plotTop: m.top, destroy: () => interactions.forEach(d => d.destroy()) }
}
