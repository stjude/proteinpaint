import { pointer } from 'd3-selection'
import { scaleLinear } from 'd3-scale'

/* A heatmap of rows (e.g. samples) by equal-width columns (e.g. CpG bins, or splice junctions) as part
of a block track, with a line from each column down to its place in the genomic view. From top to bottom:

	tk.rows.statisticsG   optional rows of a value per column, each tk.rows.statisticsHeight tall
	tk.rows.heatmapG      the matrix, tk.rows.heatmapHeight; tk.annotationColG on its right
	tk.rows.linkageG      the lines, tk.rows.linkageHeight

The heights can be preset on tk.rows. The track supplies the data and adds whatever goes below, and
sets its own height from the returned one. */

/** a row above the heatmap with a value per column */
export type LocusHeatmapStat = {
	label: string
	domain: [number, number]
	/** a bar per column, from 0 or from the bottom of a domain above 0; null for none */
	bars?: ({ v: number; color: string; opacity?: number } | null)[]
	/** lines across the columns, e.g. the mean of a group of rows */
	lines?: { color: string; values: (number | null)[] }[]
	/** a filled dot is solid, the others are faded */
	dots?: { col: number; v: number; color: string; filled: boolean }[]
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
	/** columns on the right of the heatmap, each with a color per row; with widths (0 to 1), a bar per row */
	annotations?: { label: string; colors: string[]; widths?: number[] }[]
	/** rows that start a new block of rows, e.g. the first sample of a group: a gap is drawn above each */
	rowBreaks?: number[]
	/** lines of text on the left of the heatmap, shown when the rows are too thin for their names */
	note?: string[]
	/** col and row under the pointer */
	onHover?: (event: any, col: number, row: number) => void
	onOut?: () => void
	onClick?: (col: number, row: number) => void
}

const annW = 12, // width of an annotation column of colors
	annBarW = 40, // and of one of bars
	statGap = 4

/** draws into tk.glider, tk.gleft and tk.gright, and returns the height drawn */
export function renderLocusHeatmap(tk: any, block: any, data: LocusHeatmapData): number {
	const r = (tk.rows ||= {})
	r.statisticsHeight ||= 40
	r.heatmapHeight ||= 300
	r.linkageHeight ||= 60
	if (!r.heatmapG) {
		const g = tk.glider.append('g')
		r.statisticsG = g.append('g')
		r.heatmapG = g.append('g')
		r.linkageG = g.append('g')
		r.leftG = tk.gleft.append('g')
		tk.annotationColG = tk.gright.append('g')
	}
	for (const g of [r.statisticsG, r.heatmapG, r.linkageG, r.leftG, tk.annotationColG]) g.selectAll('*').remove()
	const nc = data.cols.length,
		nr = data.rows.length
	if (!nc || !nr) return 0

	const stats = data.stats || []
	// without statistics rows, the annotation columns still start below the track's config handle
	const y1 = stats.length ? stats.length * (r.statisticsHeight + statGap) : data.annotations?.length ? 16 : 0
	const y2 = y1 + r.heatmapHeight
	const cw = block.width / nc,
		rh = r.heatmapHeight / nr
	const leftLabel = (y: number, text: string, size = 11) =>
		r.leftG
			.append('text')
			.attr('x', block.tkleftlabel_xshift)
			.attr('y', y)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('font-size', size)
			.text(text)

	stats.forEach((s, k) => {
		const g = r.statisticsG.append('g').attr('transform', `translate(0,${k * (r.statisticsHeight + statGap)})`)
		const sy = scaleLinear().domain(s.domain).range([r.statisticsHeight, 0]).clamp(true)
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
		for (const l of s.lines || []) {
			// a gap in the values breaks the line
			let d = '',
				pen = 'M'
			l.values.forEach((v, i) => {
				if (v === null) return (pen = 'M')
				d += `${pen}${(i + 0.5) * cw},${sy(v)}`
				pen = 'L'
			})
			g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', l.color).attr('stroke-width', 1.5)
		}
		/* solid or faded, which still reads when the dots are a few px wide, as a ring does not. The solid ones
		are drawn last, with a white edge that sets them off from the bars and from each other. */
		for (const d of [...(s.dots || [])].sort((a, b) => Number(a.filled) - Number(b.filled)))
			g.append('circle')
				.attr('cx', (d.col + 0.5) * cw)
				.attr('cy', sy(d.v))
				.attr('r', Math.min(3.5, Math.max(2.5, cw / 2)))
				.attr('fill', d.color)
				.attr('fill-opacity', d.filled ? 1 : 0.25)
				.attr('stroke', d.filled ? 'white' : 'none')
				.attr('stroke-width', 0.5)
		leftLabel(
			k * (r.statisticsHeight + statGap) + r.statisticsHeight / 2 + (k ? 0 : 6),
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
			.attr('height', r.heatmapHeight)
			.attr('preserveAspectRatio', 'none')
			.style('image-rendering', 'pixelated')
	image(r.heatmapG, canvas, 0, block.width)

	// row names when the rows are tall enough to read, else the note
	if (rh >= 9) data.rows.forEach((name, j) => leftLabel(y1 + (j + 0.5) * rh, name, Math.min(11, rh)))
	// under the track's label when the heatmap starts at the top
	else (data.note || []).forEach((text, i) => leftLabel(Math.max(y1, 16) + 8 + i * 14, text))

	let ax = 0
	for (const a of data.annotations || []) {
		const w = a.widths ? annBarW : annW
		const c = document.createElement('canvas')
		c.width = w
		c.height = nr
		const actx = c.getContext('2d')!
		a.colors.forEach((color, j) => {
			actx.fillStyle = color
			actx.fillRect(0, j, a.widths ? Math.max(1, Math.round(a.widths[j] * w)) : w, 1)
		})
		image(tk.annotationColG, c, ax, w)
		// under the column and reading down, clear of the config handle above
		tk.annotationColG
			.append('text')
			.attr('transform', `translate(${ax + annW / 2},${y2 + 4}) rotate(90)`)
			.attr('dominant-baseline', 'central')
			.attr('font-size', 10)
			.text(a.label)
		ax += w + 3
	}

	// a gap across the heatmap and the annotation columns, under the hit layer
	for (const row of data.rowBreaks || [])
		for (const [g, width] of [
			[r.heatmapG, block.width],
			[tk.annotationColG, ax]
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
			: r.linkageG
					.append('line')
					.attr('x1', (i + 0.5) * cw)
					.attr('y1', y2 + 2)
					.attr('x2', c.x)
					.attr('y2', y2 + r.linkageHeight + (c.dy || 0))
					.attr('stroke', '#999')
					.attr('stroke-width', 0.5)
	)
	// the column under the pointer: an outline over the statistics rows and the heatmap, and its line
	const outline = r.heatmapG
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

	/* one hit layer over the statistics rows and the heatmap: hover reads the column and row under the
	pointer, so the cells need no listeners. row is -1 above the heatmap. */
	const at = (event: any): [number, number] => {
		const [mx, my] = pointer(event, r.heatmapG.node())
		return [
			Math.min(nc - 1, Math.max(0, Math.floor(mx / cw))),
			my < y1 ? -1 : Math.min(nr - 1, Math.floor((my - y1) / rh))
		]
	}
	r.heatmapG
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

	tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth || 0, r.leftG.node().getBBox().width)
	return y2 + r.linkageHeight
}
