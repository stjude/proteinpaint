import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { quadtree } from 'd3-quadtree'
import { pointer } from 'd3-selection'
import { table2col } from '#dom/table2col'
import type { MethylationStarburstResponse } from '#types'

export type StarburstData = Extract<MethylationStarburstResponse, { genes: any }>
export type Cutoffs = { minDeltaBeta: number; maxQ: number }
type Region = 'promoter' | 'body'

/* A gene passing both cutoffs is colored by whether methylation and expression moved the same way (hyper and up,
hypo and down) or opposite ways (hyper and down, hypo and up: the silencing direction). Position already says
which quadrant; the color makes the balance between the two diagonals visible, which the odds ratio states. */
export const colors = { same: '#d95f02', opposite: '#7570b3', below: '#bbb' }

export const regionLabels: Record<Region, string> = {
	promoter: 'Core promoter (TSS −2 kb to +500 bp)',
	body: 'Gene body'
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
function limit(v: number[]) {
	const a = v.map(Math.abs).sort((x, y) => x - y)
	return a[Math.min(a.length - 1, Math.floor(a.length * 0.999))] * 1.05 || 1
}

// a value that rounds to zero prints without a sign, not as -0.000
const fmt = (v: number | null, d = 3) => {
	if (v == null) return '—'
	const t = Math.abs(v).toFixed(d)
	return Number(t) == 0 ? t : (v > 0 ? '+' : '−') + t
}
const fmtQ = (q: number) => (q < 1e-4 ? q.toExponential(1) : q.toPrecision(2))

/** Two scatter panels, core promoter and gene body, sharing both axes. `highlight` genes are ringed and named.
 * Returns the svg. */
export function drawStarburst(
	holder: any,
	data: StarburstData,
	cutoffs: Cutoffs,
	groups: [string, string],
	tip: any,
	onGeneClick: (gene: string) => void,
	highlight: string[] = []
) {
	const W = 300
	const H = 300
	const m = { top: 62, left: 60, bottom: 46, gap: 40 }
	const regions: Region[] = ['promoter', 'body']
	const allDb = regions.flatMap(r => data[r].filter(v => v != null) as number[])
	const x = scaleLinear()
		.domain([-limit(allDb), limit(allDb)])
		.range([0, W])
		.clamp(true)
		.nice()
	const yl = limit(data.log2fc)
	const y = scaleLinear().domain([-yl, yl]).range([H, 0]).clamp(true).nice()
	const svg = holder
		.append('svg')
		.attr('data-testid', 'sjpp-methylationStarburst-svg')
		.attr('width', m.left + 2 * W + m.gap + 20)
		.attr('height', m.top + H + m.bottom + 30)
		.style('font-family', 'Arial, sans-serif')

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

		g.append('text').attr('y', -42).attr('font-weight', 'bold').attr('font-size', 13).text(regionLabels[region])
		g.append('text')
			.attr('data-testid', 'sjpp-methylationStarburst-stats')
			.attr('y', -26)
			.attr('font-size', 11)
			.attr('fill', '#555')
			.text(
				`${idx.length.toLocaleString()} genes · ρ = ${fmt(rho, 2)}` +
					(quad.or ? ` · same-direction OR ${quad.or.toFixed(2)} (${quad.lo!.toFixed(2)}–${quad.hi!.toFixed(2)})` : '')
			)

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
			ctx.arc(x(db[j]), y(fc[j]), pass ? 2.5 : 1.5, 0, 2 * Math.PI)
			ctx.fill()
		}
		g.append('image')
			.attr('class', 'sjpp-methylationStarburst-dots')
			.attr('width', W)
			.attr('height', H)
			.attr('href', canvas.toDataURL())

		// counts in the corners of the quadrants they count
		const corner = (label: string, count: number, color: string, right: boolean, top: boolean) => {
			const t = g
				.append('g')
				.attr('class', 'sjpp-methylationStarburst-count')
				.attr('transform', `translate(${right ? W - 6 : 6},${top ? 14 : H - 8})`)
			t.append('circle')
				.attr('cx', right ? -4 : 4)
				.attr('cy', -4)
				.attr('r', 4)
				.attr('fill', color)
			t.append('text')
				.attr('x', right ? -12 : 12)
				.attr('text-anchor', right ? 'end' : 'start')
				.attr('font-size', 11)
				.text(`${label} ${count.toLocaleString()}`)
		}
		corner('hypo, up', quad.n.hypoUp, colors.opposite, false, true)
		corner('hyper, up', quad.n.hyperUp, colors.same, true, true)
		corner('hypo, down', quad.n.hypoDown, colors.same, false, false)
		corner('hyper, down', quad.n.hyperDown, colors.opposite, true, false)

		// named genes: a ring on the dot and the name beside it, on the side with more room, and under the dot
		// near the top edge, where the corner counts are
		for (const gene of highlight) {
			const j = idx.findIndex(i => data.genes[i] == gene)
			if (j == -1) continue
			const [cx, cy] = [x(db[j]), y(fc[j])]
			const right = cx < W - 60
			const h = g.append('g').attr('class', 'sjpp-methylationStarburst-highlight')
			h.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4).attr('fill', 'none').attr('stroke', '#000')
			h.append('text')
				.attr('x', cx + (right ? 7 : -7))
				.attr('y', cy + (cy < 24 ? 16 : 4))
				.attr('text-anchor', right ? 'start' : 'end')
				.attr('font-size', 11)
				.attr('font-style', 'italic')
				.attr('stroke', 'white')
				.attr('stroke-width', 3)
				.attr('paint-order', 'stroke')
				.text(gene)
		}

		g.append('g').attr('transform', `translate(0,${H})`).call(axisBottom(x).ticks(5))
		g.append('g').call(axisLeft(y).ticks(6))
		g.append('text')
			.attr('x', W / 2)
			.attr('y', H + 36)
			.attr('text-anchor', 'middle')
			.attr('font-size', 12)
			.text(`Δβ${data.corrected ? ' beyond background' : ''}, ${groups[1]} − ${groups[0]}`)
		if (k == 0)
			g.append('text')
				.attr('transform', `translate(-42,${H / 2}) rotate(-90)`)
				.attr('text-anchor', 'middle')
				.attr('font-size', 12)
				.text(`log2 fold change, ${groups[1]} / ${groups[0]}`)

		// hover and click: the nearest gene within a few pixels
		const qt = quadtree<number>()
			.x(j => x(db[j]))
			.y(j => y(fc[j]))
			.addAll(idx.map((_, j) => j))
		const ring = g
			.append('circle')
			.attr('r', 5)
			.attr('fill', 'none')
			.attr('stroke', '#000')
			.style('pointer-events', 'none')
			.style('display', 'none')
		const nearest = (event: any) => {
			const [px, py] = pointer(event, g.node())
			return qt.find(px, py, 6)
		}
		g.append('rect')
			.attr('data-testid', 'sjpp-methylationStarburst-hit')
			.attr('width', W)
			.attr('height', H)
			.attr('fill', 'transparent')
			.style('cursor', 'pointer')
			.on('mousemove', (event: any) => {
				const j = nearest(event)
				if (j == undefined) {
					ring.style('display', 'none')
					tip.hide()
					return
				}
				const i = idx[j]
				ring.style('display', '').attr('cx', x(db[j])).attr('cy', y(fc[j]))
				tip.clear().show(event.clientX, event.clientY)
				const other: Region = region == 'promoter' ? 'body' : 'promoter'
				const table = table2col({ holder: tip.d })
				table.addRow('Gene', data.genes[i])
				table.addRow(`Δβ, ${region}`, fmt(db[j]))
				table.addRow(`Δβ, ${other}`, fmt(data[other][i]))
				table.addRow('log2 fold change', fmt(fc[j], 2))
				table.addRow('DE q', fmtQ(q[j]))
				tip.d.append('div').style('font-size', '0.8em').style('opacity', 0.7).text('Click for the methylation track')
			})
			.on('mouseout', () => {
				ring.style('display', 'none')
				tip.hide()
			})
			.on('click', (event: any) => {
				const j = nearest(event)
				if (j == undefined) return
				tip.hide()
				onGeneClick(data.genes[idx[j]])
			})
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
	return svg
}

export type StarburstPathways = NonNullable<StarburstData['pathways']>

const layerLabels = ['Expression', 'Gene body', 'Both, merged']
/** signed -log10 q, blue for sets whose genes went down or lost methylation, orange up or gained (the figure's) */
const CAP = 8
const heat = scaleLinear<string>()
	.domain([-CAP, -CAP / 2, 0, CAP / 2, CAP])
	.range(['#2b6cb0', '#c6d6ea', '#ffffff', '#f4cfae', '#c2410c'])
	.clamp(true)
const SIG = Math.log10(0.05)

/** HALLMARK_TNFA_SIGNALING_VIA_NFKB -> Tnfa signaling via nfkb */
export function setLabel(id: string) {
	const s = id
		.replace(/^(HALLMARK|GOBP|GOMF|GOCC|REACTOME|WP)_/, '')
		.replace(/_/g, ' ')
		.toLowerCase()
	return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The gene sets significant in any layer as three heatmap columns sharing rows, most significant merged first:
 * expression, gene body, and both merged. Dots: q < 0.05; squares: significant only when merged. Returns the svg. */
export function drawPathways(holder: any, pw: StarburstPathways, groups: [string, string], tip: any, maxRows = 40) {
	const sets = [...pw.sets].sort((a, b) => a.layers[2].log10q - b.layers[2].log10q).slice(0, maxRows)
	const cell = { w: 34, h: 15 }
	// room above the cells for the column labels, drawn at 45 degrees
	const m = { top: 112, left: 10 }
	const labelX = m.left + 3 * cell.w + 8
	const svg = holder
		.append('svg')
		.attr('data-testid', 'sjpp-methylationStarburst-pathways')
		// room for the legend line under the columns
		.attr('width', Math.max(labelX + 420, 780))
		.attr('height', m.top + sets.length * cell.h + 78)
		.style('font-family', 'Arial, sans-serif')
	svg
		.append('text')
		.attr('x', m.left)
		.attr('y', 16)
		.attr('font-weight', 'bold')
		.attr('font-size', 13)
		.text(`Gene sets: ${pw.geneSetGroup}`)
	svg
		.append('text')
		.attr('data-testid', 'sjpp-methylationStarburst-pathwayStats')
		.attr('x', m.left)
		.attr('y', 33)
		.attr('font-size', 11)
		.attr('fill', '#555')
		.text(
			`${pw.genes.toLocaleString()} genes with both, ${pw.tested.toLocaleString()} sets tested, ` +
				`${pw.sets.length.toLocaleString()} at q < 0.05` +
				(pw.sets.length > sets.length ? ` (top ${sets.length} shown)` : '') +
				`; genes at p ≤ 0.05: ${pw.passing.map(n => n.toLocaleString()).join(', ')}`
		)
	layerLabels.forEach((label, j) =>
		svg
			.append('text')
			.attr('transform', `translate(${m.left + j * cell.w + cell.w / 2},${m.top - 6}) rotate(-45)`)
			.attr('font-size', 11)
			.text(label)
	)
	const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)
	sets.forEach((s, i) => {
		const merged = s.layers[2].log10q < SIG
		const onlyMerged = merged && s.layers[0].log10q >= SIG && s.layers[1].log10q >= SIG
		s.layers.forEach((l, j) => {
			const c = g
				.append('g')
				.attr('class', 'sjpp-methylationStarburst-pathwayCell')
				.attr('transform', `translate(${j * cell.w},${i * cell.h})`)
			c.append('rect')
				.attr('width', cell.w - 1)
				.attr('height', cell.h - 1)
				.attr('fill', heat(-l.log10q * (l.direction || 1)))
				.attr('stroke', '#eee')
			if (l.log10q < SIG)
				c.append('circle')
					.attr('class', 'sjpp-methylationStarburst-pathwaySig')
					.attr('cx', cell.w / 2)
					.attr('cy', cell.h / 2)
					.attr('r', 2.5)
			if (j == 2 && onlyMerged)
				c.append('rect')
					.attr('class', 'sjpp-methylationStarburst-pathwayMergedOnly')
					.attr('x', cell.w / 2 - 5)
					.attr('y', cell.h / 2 - 5)
					.attr('width', 10)
					.attr('height', 10)
					.attr('fill', 'none')
					.attr('stroke', '#000')
			c.on('mouseover', (event: any) => {
				tip.clear().show(event.clientX, event.clientY)
				const table = table2col({ holder: tip.d })
				table.addRow('Gene set', s.id)
				table.addRow('Genes in set', `${s.size} with both layers`)
				s.layers.forEach((x, k) =>
					table.addRow(
						layerLabels[k],
						`q ${fmtQ(10 ** x.log10q)}, ${x.overlap} genes picked` +
							(x.direction ? `, mostly ${x.direction > 0 ? (k == 1 ? 'gained' : 'up') : k == 1 ? 'lost' : 'down'}` : '')
					)
				)
				if (s.genes.length) table.addRow('Merged, top genes', s.genes.slice(0, 15).join(', '))
			}).on('mouseout', () => tip.hide())
		})
		g.append('text')
			.attr('x', labelX - m.left)
			.attr('y', i * cell.h + cell.h / 2 + 4)
			.attr('font-size', 11)
			.text(setLabel(s.id).slice(0, 70))
			.append('title')
			.text(s.id)
	})

	// legend: the color scale, then the marks
	const ly = m.top + sets.length * cell.h + 22
	const grad = `sjpp-starburst-heat-${Math.random().toString(36).slice(2)}`
	const lg = svg.append('defs').append('linearGradient').attr('id', grad)
	heat.range().forEach((c, k, a) =>
		lg
			.append('stop')
			.attr('offset', k / (a.length - 1))
			.attr('stop-color', c)
	)
	svg
		.append('rect')
		.attr('x', m.left)
		.attr('y', ly)
		.attr('width', 120)
		.attr('height', 10)
		.attr('fill', `url(#${grad})`)
		.attr('stroke', '#999')
	for (const [x, t] of [
		[0, `≤ −${CAP}`],
		[60, '0'],
		[120, `≥ ${CAP}`]
	] as [number, string][])
		svg
			.append('text')
			.attr('x', m.left + x)
			.attr('y', ly + 22)
			.attr('text-anchor', 'middle')
			.attr('font-size', 10)
			.text(t)
	svg
		.append('text')
		.attr('x', m.left + 132)
		.attr('y', ly + 9)
		.attr('font-size', 11)
		.text(
			`signed −log10 q: lower or lost in ${groups[1]} (blue), higher or gained (orange); ● q < 0.05; □ only when merged`
		)
	for (const [k, line] of [
		"Gene body: each patient's gene-body β, centered on their median, Welch t-test.",
		`Merged: directional P-value merging, same direction (Brown df ${pw.brown.df.toFixed(1)} of 4).`
	].entries())
		svg
			.append('text')
			.attr('x', m.left + 132)
			.attr('y', ly + 24 + 13 * k)
			.attr('font-size', 10)
			.attr('fill', '#777')
			.text(line)
	return svg
}
