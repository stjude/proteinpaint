import { pointer } from 'd3-selection'
import { scaleLinear } from 'd3-scale'

/* A heatmap of rows (e.g. samples) by equal-width columns (e.g. CpG bins, or splice junctions) as part
of a block track, with a line from each column down to its place in the genomic view. From top to bottom:

	tk.rows.statistics   optional rows of a value per column, each statRowHeight tall
	tk.rows.heatmap      the matrix, with its annotation columns on the right
	tk.rows.linkage      the lines, and under them the optional intervals row: items drawn at their genomic extent, and
	                     the optional model rows: a gene model each, with what goes with it on the right

Each is { g, height, data }, with the height drawn: 0 when there is nothing to draw. The heatmap also has
leftG and rightG for its labels and annotation columns, and leftWidth, the width of the labels on the left
of the statistics rows and the heatmap, and highlight(col), which outlines a column and its line as on hovering
the column, e.g. when the track's item of the column is hovered, or clears with -1; absent when nothing is drawn.
tk.rows.heatmap.height can be preset, else it is 300. A track sets
the rows up with initLocusHeatmapRows(), keeps its own data for them in `data`, and may keep its other rows
in tk.rows too: the junction track keeps its junctions in tk.rows.jug. It adds whatever goes below, and sets
its own height from locusHeatmapHeight(). */

/** a row above the heatmap with a value per column */
export type LocusHeatmapStat = {
	label: string
	domain: [number, number]
	/** a bar per column, from 0 or from the bottom of a domain above 0; null for none */
	bars?: ({ v: number; color: string; opacity?: number } | null)[]
	/** lines across the columns, e.g. the mean of a group of rows */
	lines?: { color: string; values: (number | null)[] }[]
	/** the gap between two series of values shaded in each column, colors[1] where the second is higher, else colors[0],
	 * e.g. between the means of two groups */
	fill?: { values: [(number | null)[], (number | null)[]]; colors: [string, string] }
}

/** a column on the right of the heatmap: colors, or parts */
export type LocusHeatmapAnnotation = {
	label: string
	/** a color per row; with widths (0 to 1), a bar per row */
	colors?: string[]
	widths?: number[]
	/** per row, the parts of one bar from the left, each a share (0 to 1) of the column's width, e.g. the makeup
	of a total */
	parts?: { color: string; width: number }[][]
}

/** a block of rows, a model each at its genomic extent like the block's gene track, e.g. the isoforms of a gene: a line
 * from line[0] to line[1] and a box per exon, px in the block view. With coding, as sketchGene() of client/dom/sketchGm.ts
 * draws a gene model: the exons at the height of an UTR and the coding parts at full height (none, as of a noncoding
 * transcript: every exon as an UTR); with strand, as it reads on screen, chevrons along the introns and, in white, the
 * coding parts. right() draws what goes with row i in the block's right side, in g at the top of the row; rightWidth is
 * its width there */
export type LocusHeatmapModels = {
	label: string
	/** px above the first row, for its label and what right() draws there, e.g. a title and an axis; default 18 */
	headerHeight?: number
	rowHeight: number
	rows: {
		label: string
		color: string
		line: [number, number]
		exons: [number, number][]
		coding?: [number, number][]
		strand?: '+' | '-'
	}[]
	right?: (g: any, i: number) => void
	rightWidth?: number
	onHover?: (event: any, i: number) => void
	onOut?: () => void
}

export type LocusHeatmapData = {
	/** row names, top to bottom */
	rows: string[]
	/** columns, left to right */
	cols: {
		/** px in the block view where the column's line ends; no line without it */
		x?: number
		/** px that the line runs on below the linkage row, e.g. to a junction's disc */
		dy?: number
		/** per row, aligned with rows[] */
		values: (number | null)[]
	}[]
	color: (v: number) => string
	missingColor: string
	stats?: LocusHeatmapStat[]
	/** columns on the right of the heatmap, see LocusHeatmapAnnotation */
	annotations?: LocusHeatmapAnnotation[]
	/** rows that start a new block of rows, e.g. the first sample of a group: a gap is drawn above each */
	rowBreaks?: number[]
	/** lines of text on the left of the heatmap, shown when the rows are too thin for their names */
	note?: string[]
	/** a row under the lines, in genomic coordinates like the block's other tracks: an item from x0 to x1 (px in the
	 * block view, at least 2 px wide), e.g. the DMRs of a scan at their full length */
	intervals?: {
		label: string
		/** stroke, optional: an outline, e.g. a category of the item apart from what its fill shows */
		items: { x0: number; x1: number; color: string; stroke?: string }[]
		onHover?: (event: any, i: number) => void
		onOut?: () => void
	}
	/** blocks of rows under the lines and the column labels, one under the other, see LocusHeatmapModels */
	models?: LocusHeatmapModels[]
	/** col and row under the pointer */
	onHover?: (event: any, col: number, row: number) => void
	onOut?: () => void
	onClick?: (col: number, row: number) => void
}

const annW = 12, // width of an annotation column of colors
	annBarW = 40, // of one of bars
	annPartsW = 60, // and of one of bars in parts
	statRowHeight = 40,
	statGap = 4,
	linkageHeight = 60,
	intervalHeight = 10,
	intervalGap = 6,
	modelGap = 18, // above the model rows, for their label
	modelH = 10, // px of a coding exon of a model row, see LocusHeatmapModels
	// the longest a column's label is drawn, in px; longer ones are cut with an ellipsis
	MAX_LABEL = 140

/** tk.rows.statistics, heatmap and linkage, in tk.glider, tk.gleft and tk.gright; other rows of tk.rows are kept */
export function initLocusHeatmapRows(tk: any) {
	const r = (tk.rows ||= {})
	const g = tk.glider.append('g')
	r.statistics = { ...r.statistics, g: g.append('g'), height: 0 }
	r.heatmap = { height: 0, ...r.heatmap, g: g.append('g'), leftG: tk.gleft.append('g'), rightG: tk.gright.append('g') }
	r.heatmap.leftWidth = 0
	r.linkage = { ...r.linkage, g: g.append('g'), height: 0 }
}

/** the height of the statistics rows, the heatmap and the linkage, as last drawn */
export function locusHeatmapHeight(tk: any): number {
	const r = tk.rows || {}
	return (r.statistics?.height || 0) + (r.heatmap?.height || 0) + (r.linkage?.height || 0)
}

/** draws into tk.rows.statistics, heatmap and linkage, see initLocusHeatmapRows(), and returns the height drawn */
export function renderLocusHeatmap(tk: any, block: any, data: LocusHeatmapData): number {
	if (!tk.rows?.heatmap?.g) initLocusHeatmapRows(tk)
	const { statistics, heatmap, linkage } = tk.rows
	for (const g of [statistics.g, heatmap.g, linkage.g, heatmap.leftG, heatmap.rightG]) g.selectAll('*').remove()
	const nc = data.cols.length,
		nr = data.rows.length
	delete heatmap.highlight
	if (!nc || !nr) {
		statistics.height = heatmap.height = linkage.height = heatmap.leftWidth = 0
		return 0
	}

	const stats = data.stats || []
	// without statistics rows, the annotation columns still start below the track's config handle
	const y1 = stats.length ? stats.length * (statRowHeight + statGap) : data.annotations?.length ? 16 : 0
	heatmap.height ||= 300
	const y2 = y1 + heatmap.height
	const cw = block.width / nc,
		rh = heatmap.height / nr
	const leftLabel = (y: number, text: string, size = 11) =>
		heatmap.leftG
			.append('text')
			.attr('x', block.tkleftlabel_xshift)
			.attr('y', y)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('font-size', size)
			.text(text)

	stats.forEach((s, k) => {
		const g = statistics.g.append('g').attr('transform', `translate(0,${k * (statRowHeight + statGap)})`)
		const sy = scaleLinear().domain(s.domain).range([statRowHeight, 0]).clamp(true)
		const base = sy(0)
		g.append('line').attr('x2', block.width).attr('y1', base).attr('y2', base).attr('stroke', '#ccc')
		;(s.bars || []).forEach((b, i) => {
			if (!b) return
			g.append('rect')
				.attr('x', i * cw + (cw > 3 ? 1 : 0))
				.attr('y', Math.min(base, sy(b.v)))
				.attr('width', cw > 3 ? cw - 2 : cw)
				.attr('height', Math.abs(sy(b.v) - base))
				.attr('fill', b.color)
				.attr('fill-opacity', b.opacity ?? 1)
		})
		// under the lines, faint, so that the lines stay on top
		if (s.fill)
			s.fill.values[0].forEach((a, i) => {
				const b = s.fill!.values[1][i]
				if (a === null || b === null || b === undefined || a == b) return
				g.append('rect')
					.attr('x', i * cw)
					.attr('y', sy(Math.max(a, b)))
					.attr('width', cw)
					.attr('height', Math.abs(sy(a) - sy(b)))
					.attr('fill', s.fill!.colors[b > a ? 1 : 0])
					.attr('fill-opacity', 0.35)
			})
		for (const l of s.lines || []) {
			// a gap in the values breaks the line; a value with none next to it is a dash as wide as its column
			let d = '',
				pen = 'M'
			l.values.forEach((v, i) => {
				if (v === null) return (pen = 'M')
				if (pen == 'M' && (l.values[i + 1] ?? null) === null) d += `M${i * cw},${sy(v)}h${cw}`
				else d += `${pen}${(i + 0.5) * cw},${sy(v)}`
				pen = 'L'
			})
			g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', l.color).attr('stroke-width', 1.5)
		}
		leftLabel(
			k * (statRowHeight + statGap) + statRowHeight / 2 + (k ? 0 : 6),
			`${s.label} (${s.domain[0]} to ${s.domain[1]})`
		)
	})

	/* one canvas pixel per cell, stretched as an image: any number of cells costs one element, and the
	svg download keeps it */
	const canvas = document.createElement('canvas')
	canvas.width = nc
	canvas.height = nr
	const ctx = canvas.getContext('2d')!
	data.cols.forEach((c, i) =>
		c.values.forEach((v, j) => {
			ctx.fillStyle = v === null ? data.missingColor : data.color(v)
			ctx.fillRect(i, j, 1, 1)
		})
	)
	const image = (g: any, c: HTMLCanvasElement, x: number, width: number) =>
		g
			.append('image')
			.attr('href', c.toDataURL())
			.attr('x', x)
			.attr('y', y1)
			.attr('width', width)
			.attr('height', heatmap.height)
			.attr('preserveAspectRatio', 'none')
			.style('image-rendering', 'pixelated')
	image(heatmap.g, canvas, 0, block.width)

	// row names when the rows are tall enough to read, else the note
	if (rh >= 9) data.rows.forEach((name, j) => leftLabel(y1 + (j + 0.5) * rh, name, Math.min(11, rh)))
	// under the track's label when the heatmap starts at the top
	else (data.note || []).forEach((text, i) => leftLabel(Math.max(y1, 16) + 8 + i * 14, text))

	/* A column's label reads down from 4 px under the heatmap, whole up to MAX_LABEL px and cut past it (whole on hover);
	the linkage row is made tall enough for the longest, so that a label never runs into the next track */
	let labelBottom = 0
	let ax = 0
	for (const a of data.annotations || []) {
		const w = a.parts ? annPartsW : a.widths ? annBarW : annW
		const c = document.createElement('canvas')
		// parts get more pixels than they are shown at, for the small ones
		c.width = a.parts ? 240 : w
		c.height = nr
		const actx = c.getContext('2d')!
		if (a.parts)
			a.parts.forEach((row, j) => {
				let x = 0
				for (const p of row) {
					actx.fillStyle = p.color
					actx.fillRect(Math.round(x * c.width), j, Math.max(1, Math.round(p.width * c.width)), 1)
					x += p.width
				}
			})
		else
			(a.colors || []).forEach((color, j) => {
				actx.fillStyle = color
				actx.fillRect(0, j, a.widths ? Math.max(1, Math.round(a.widths[j] * w)) : w, 1)
			})
		image(heatmap.rightG, c, ax, w)
		// under the column and reading down, clear of the config handle above
		const text = heatmap.rightG
			.append('text')
			.attr('transform', `translate(${ax + annW / 2},${y2 + 4}) rotate(90)`)
			.attr('dominant-baseline', 'central')
			.attr('font-size', 10)
		fitLabel(text.node(), a.label, MAX_LABEL)
		labelBottom = Math.max(labelBottom, 4 + text.node().getComputedTextLength() + 4)
		text.append('title').text(a.label)
		ax += w + 3
	}

	// the block's room on the right of the tracks is fixed: more when the columns need it
	const rightWidth = Math.max(ax, ...(data.models || []).filter(m => m.rows.length).map(m => m.rightWidth || 0))
	if (rightWidth + 10 > block.rightheadw) {
		block.rightheadw = rightWidth + 10
		block.blocksetw()
	}

	// a gap across the heatmap and the annotation columns, under the hit layer
	for (const row of data.rowBreaks || [])
		for (const [g, width] of [
			[heatmap.g, block.width],
			[heatmap.rightG, ax]
		])
			g.append('line')
				.attr('x2', width)
				.attr('y1', y1 + row * rh)
				.attr('y2', y1 + row * rh)
				.attr('stroke', 'white')
				.attr('stroke-width', 2)

	const lines = data.cols.map((c, i) =>
		c.x === undefined
			? null
			: linkage.g
					.append('line')
					.attr('x1', (i + 0.5) * cw)
					.attr('y1', y2 + 2)
					.attr('x2', c.x)
					.attr('y2', y2 + linkageHeight + (c.dy || 0))
					.attr('stroke', '#999')
					.attr('stroke-width', 0.5)
	)
	// the column under the pointer: an outline over the statistics rows and the heatmap, and its line
	const outline = heatmap.g
		.append('rect')
		.attr('width', cw)
		.attr('height', y2)
		.attr('fill', 'none')
		.attr('stroke', '#000')
		.attr('pointer-events', 'none')
		.attr('display', 'none')
	const highlight = (col: number) => {
		outline.attr('x', col * cw).attr('display', col < 0 ? 'none' : null)
		lines.forEach((l, i) => l?.attr('stroke', i == col ? '#000' : '#999').attr('stroke-width', i == col ? 1.5 : 0.5))
	}
	heatmap.highlight = highlight

	/* one hit layer over the statistics rows and the heatmap: hover reads the column and row under the
	pointer, so the cells need no listeners. row is -1 above the heatmap. */
	const at = (event: any): [number, number] => {
		const [mx, my] = pointer(event, heatmap.g.node())
		return [
			Math.min(nc - 1, Math.max(0, Math.floor(mx / cw))),
			my < y1 ? -1 : Math.min(nr - 1, Math.floor((my - y1) / rh))
		]
	}
	heatmap.g
		.append('rect')
		.attr('width', block.width)
		.attr('height', y2)
		.attr('fill', 'transparent')
		.on('mousemove', (event: any) => {
			/* not for the block's cursor bar: the pointer's x is a column here, not a genomic position.
			onHover may place the bar where the column is. */
			event.stopPropagation()
			const [col, row] = at(event)
			highlight(col)
			data.onHover?.(event, col, row)
		})
		.on('mouseout', () => {
			highlight(-1)
			data.onOut?.()
		})
		.on('click', (event: any) => data.onClick?.(...at(event)))

	// the intervals: genomic, under the ends of the lines, so they line up with the ruler and the other tracks
	let below = 0
	if (data.intervals) {
		const iv = data.intervals
		const iy = y2 + linkageHeight + intervalGap
		leftLabel(iy + intervalHeight / 2, iv.label)
		linkage.g
			.append('line')
			.attr('x2', block.width)
			.attr('y1', iy + intervalHeight / 2)
			.attr('y2', iy + intervalHeight / 2)
			.attr('stroke', '#eee')
		iv.items.forEach((it, i) => {
			const x0 = Math.max(0, Math.min(it.x0, it.x1)),
				x1 = Math.min(block.width, Math.max(it.x0, it.x1))
			if (x1 < 0 || x0 > block.width) return
			const w = Math.max(2, x1 - x0)
			linkage.g
				.append('rect')
				.attr('x', x1 - x0 < 2 ? (x0 + x1) / 2 - 1 : x0)
				.attr('y', iy)
				.attr('width', w)
				.attr('height', intervalHeight)
				.attr('fill', it.color)
				.attr('stroke', it.stroke || null)
				.attr('stroke-width', it.stroke ? 1 : null)
				.style('cursor', iv.onHover ? 'default' : null)
				.on('mouseover', (event: any) => iv.onHover?.(event, i))
				.on('mouseout', () => iv.onOut?.())
		})
		below = intervalGap + intervalHeight + 2
	}
	// the model rows, under the lines and the column labels
	const linkageTop = Math.max(linkageHeight + below, labelBottom)
	let modelsHeight = 0
	// the part of x0..x1 in the view, at least 1 px
	const clip = (x0: number, x1: number) => {
		const a = Math.max(0, Math.min(x0, x1)),
			b = Math.min(block.width, Math.max(x0, x1))
		return b < 0 || a > block.width ? null : [a, Math.max(1, b - a)]
	}
	for (const m of data.models || []) {
		if (!m.rows.length) continue
		const header = m.headerHeight ?? modelGap
		const top = y2 + linkageTop + modelsHeight + header
		leftLabel(top - 9, m.label)
		m.rows.forEach((r, i) => {
			const y = top + i * m.rowHeight,
				cy = y + m.rowHeight / 2
			const row = linkage.g.append('g')
			const line = clip(r.line[0], r.line[1])
			if (line)
				row
					.append('line')
					.attr('x1', line[0])
					.attr('x2', line[0] + line[1])
					.attr('y1', cy)
					.attr('y2', cy)
					.attr('stroke', r.color)
			// full height, or an UTR's, a fifth of it less above and below, as sketchGene()
			const box = (e: [number, number], h: number) => {
				const c = clip(e[0], e[1])
				if (c)
					row
						.append('rect')
						.attr('x', c[0])
						.attr('y', cy - h / 2)
						.attr('width', c[1])
						.attr('height', h)
						.attr('fill', r.color)
				return c
			}
			for (const e of r.exons) box(e, r.coding ? modelH - 2 * Math.ceil(modelH / 5) : modelH)
			const coding = (r.coding || []).map(e => box(e, modelH)).filter(c => c) as number[][]
			if (r.strand) {
				// the introns: the line between the exons, left to right on screen
				const ex = r.exons
					.map(e => clip(e[0], e[1]))
					.filter(c => c)
					.sort((a, b) => a![0] - b![0]) as number[][]
				const introns = ex.slice(1).map((e, k) => [ex[k][0] + ex[k][1], e[0]])
				chevrons(row, introns, cy, r.strand, r.color)
				chevrons(
					row,
					coding.map(c => [c[0], c[0] + c[1]]),
					cy,
					r.strand,
					'white'
				)
			}
			leftLabel(cy, r.label, 10)
			if (m.right) m.right(heatmap.rightG.append('g').attr('transform', `translate(0,${y})`), i)
			// the row as a whole for the pointer, over the gaps between exons too
			row
				.append('rect')
				.attr('y', y)
				.attr('width', block.width)
				.attr('height', m.rowHeight)
				.attr('fill', 'transparent')
				.on('mouseover', (event: any) => m.onHover?.(event, i))
				.on('mouseout', () => m.onOut?.())
		})
		modelsHeight += header + m.rows.length * m.rowHeight
	}
	statistics.height = y1
	linkage.height = linkageTop + modelsHeight
	heatmap.leftWidth = heatmap.leftG.node().getBBox().width
	tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth || 0, heatmap.leftWidth)
	return locusHeatmapHeight(tk)
}

/* chevrons pointing the way of strand ('+' rightward) along each span [x0, x1] that has room, centered on y, as
sketchGene() draws a gene model's strand */
function chevrons(g: any, spans: number[][], y: number, strand: '+' | '-', color: string) {
	const h = modelH - 4,
		w = h / 2,
		gap = h / 2,
		pad = 2
	let d = ''
	for (const [x0, x1] of spans) {
		const len = x1 - x0
		const n = Math.floor((len - pad * 2) / (w + gap))
		if (n < 1) continue
		let x = x0 + (len - n * (w + gap) + gap) / 2
		for (let i = 0; i < n; i++, x += w + gap)
			d +=
				strand == '+'
					? `M${x},${y - h / 2}L${x + w},${y}L${x},${y + h / 2}`
					: `M${x + w},${y - h / 2}L${x},${y}L${x + w},${y + h / 2}`
	}
	if (d) g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1)
}

/** sets an svg text to label, cut with an ellipsis until it is at most px long as drawn */
export function fitLabel(node: SVGTextElement, label: string, px: number) {
	node.textContent = label
	for (let n = label.length - 1; n > 0 && node.getComputedTextLength() > px; n--)
		node.textContent = label.slice(0, n) + '…'
}
