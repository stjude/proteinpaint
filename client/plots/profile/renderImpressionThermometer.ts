export const IMPRESSION_MAX_SCORE = 10

// Universal red→green traffic-light palette for the POC distribution + legend rating
// swatches. Same across all modules (matches the descriptive-report visual). Module
// identity is conveyed through the SC bar + bulb fill, which use a per-module color
// from terms.jsondata.color.
const RATING_COLORS: Record<number, string> = {
	1: '#7a0d0d',
	2: '#b3271e',
	3: '#dc4f24',
	4: '#ee8e2c',
	5: '#fee144',
	6: '#cce256',
	7: '#9bc94f',
	8: '#5fa83a',
	9: '#3d8b35',
	10: '#1b5e20'
}

// Fallback if a term has no color in jsondata (shouldn't happen for impression terms in
// the live db, but keeps the renderer from emitting `fill="undefined"` if it ever does).
const FALLBACK_COLOR = '#888'

export type ImpressionTexts = {
	titleTemplate: string
	subtitle: string[]
	frameSubtitle: string
	leftAxisLabel: string
	rightAxisLabel: string
	footer: string
	legend: { sc: string; median: string }
}

// One responder group's thermometer payload (server: ProfileImpressionResponderDistribution).
type ResponderColumn = {
	label: string
	median: number | null
	total: number
	distribution: { rating: number; count: number; pct: number }[]
}

export type ImpressionRenderArgs = {
	dom: { svg: any; mainG: any; gridG: any; xAxisG: any; headerDiv: any; legendG: any }
	id: any
	module: string
	// { scMedian, scTotal, responders: ResponderColumn[], n }. One thermometer is drawn per
	// responder; an empty responders[] yields a single SC-only thermometer.
	data: any
	texts: ImpressionTexts
	// Per-module color for the SC bar + bulb (sourced from terms.jsondata.color in the DB).
	// The POC distribution and rating-swatch legend use a fixed universal red→green palette
	// (RATING_COLORS) to encode rating level — same across every module.
	colors: { sc: string }
	// Shared Menu instance from profilePlot. Used to render hover tooltips on the SC bar,
	// bulb, POC distribution bands, and POC median ball. Optional — if absent, tooltips
	// are skipped silently.
	tip?: { clear: () => any; hide: () => void; show: (x: number, y: number, ...rest: any[]) => void }
}

// Geometry shared by every thermometer column. Each column keeps the full single-chart
// size; multiple responder columns extend the SVG rightward (the holder scrolls).
const TUBE_W = 50
const TUBE_H = 360
const BULB_R = 42
const SC_BAR_W = 8
const BALL_R = 7
const FRAME_W = 440
const FRAME_H = 600
const FRAME_Y = 140
const HEADER_H = 70
const COL_GAP = 40
const COL_STEP = FRAME_W + COL_GAP
const FIRST_FRAME_X = 100

export function renderImpressionThermometer(a: ImpressionRenderArgs) {
	// One full-detail thermometer per responder group, laid out side by side in a single SVG.
	// Per column: stacked color fill = that responder group's rating distribution; vertical bar
	// + bulb = the shared SC median; grey ball = that group's POC median.
	a.dom.headerDiv.style('display', 'none')

	const data: any = a.data || {}
	const maxScore = IMPRESSION_MAX_SCORE
	const moduleName = a.module || ''
	const scColor = a.colors?.sc || FALLBACK_COLOR
	const scMedian: number | null = data.scMedian ?? null
	const scTotal: number = data.scTotal || 0
	const n: number = data.n ?? 0

	const responders: ResponderColumn[] = Array.isArray(data.responders) ? data.responders : []
	// SC-only modules (e.g. Patients & Outcomes) carry no responder groups → render a single
	// POC-less column labeled with the generic frame subtitle.
	const columns: { col: ResponderColumn | null; label: string; hasPoc: boolean }[] = responders.length
		? responders.map(r => ({ col: r, label: r.label, hasPoc: true }))
		: [{ col: null, label: a.texts.frameSubtitle, hasPoc: false }]

	// Render directly into the svg with absolute coords; reset mainG transform to identity so
	// transforms set up for the Likert/YN paths don't apply.
	a.dom.mainG.attr('transform', 'translate(0, 0)')
	a.dom.gridG.attr('transform', 'translate(0, 0)')
	a.dom.xAxisG.attr('transform', 'translate(0, 0)')

	const lastFrameRight = FIRST_FRAME_X + (columns.length - 1) * COL_STEP + FRAME_W
	a.dom.svg.attr('width', lastFrameRight + FIRST_FRAME_X).attr('height', FRAME_Y + FRAME_H + 130)

	const root = a.dom.mainG
	const rowCenterX = (FIRST_FRAME_X + lastFrameRight) / 2

	// Wires mouseenter/mouseleave on a d3 selection to show `text` in the shared profilePlot
	// tip. No-op if the tip wasn't passed (defensive — keeps the renderer usable in tests).
	const tip = a.tip
	const attachTip = (sel: any, text: string) => {
		if (!tip) return
		sel
			.style('cursor', 'pointer')
			.attr('pointer-events', 'all')
			.on('mouseenter', (event: MouseEvent) => {
				const menu = tip.clear()
				menu.d.text(text)
				menu.show(event.clientX, event.clientY, true, true)
			})
			.on('mouseleave', () => tip.hide())
	}

	// Title block (once, centered over the whole row)
	root
		.append('text')
		.attr('transform', `translate(${rowCenterX}, 50)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', '1.6rem')
		.attr('font-weight', 'bold')
		.attr('fill', '#dd6b20')
		.text(a.texts.titleTemplate.replace('{module}', moduleName))
	a.texts.subtitle.forEach((line, i) => {
		root
			.append('text')
			.attr('transform', `translate(${rowCenterX}, ${80 + i * 20})`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '0.95rem')
			.text(line)
	})

	const anyPoc = columns.some(c => c.hasPoc)

	columns.forEach((column, ci) => {
		const frameX = FIRST_FRAME_X + ci * COL_STEP
		const titleX = frameX + FRAME_W / 2

		// Frame box + grey header band
		root
			.append('rect')
			.attr('x', frameX)
			.attr('y', FRAME_Y)
			.attr('width', FRAME_W)
			.attr('height', FRAME_H)
			.attr('fill', 'none')
			.attr('stroke', '#bbb')
			.attr('stroke-width', 2)
		root
			.append('rect')
			.attr('x', frameX)
			.attr('y', FRAME_Y)
			.attr('width', FRAME_W)
			.attr('height', HEADER_H)
			.attr('fill', '#f4f4f4')
			.attr('stroke', '#bbb')
			.attr('stroke-width', 1)
		root
			.append('text')
			.attr('transform', `translate(${titleX}, ${FRAME_Y + 32})`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '1.05rem')
			.attr('font-weight', 'bold')
			.text(moduleName)
		root
			.append('text')
			.attr('transform', `translate(${titleX}, ${FRAME_Y + 54})`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '0.9rem')
			.text(column.label)

		// Tube geometry (per column)
		const tubeX = frameX + FRAME_W / 2 - TUBE_W / 2
		const tubeTop = FRAME_Y + HEADER_H + 40
		const tubeBottom = tubeTop + TUBE_H
		const bulbCx = tubeX + TUBE_W / 2
		const bulbCy = tubeBottom + 22
		const tubePath =
			`M ${tubeX} ${tubeTop + TUBE_W / 2}` +
			` A ${TUBE_W / 2} ${TUBE_W / 2} 0 0 1 ${tubeX + TUBE_W} ${tubeTop + TUBE_W / 2}` +
			` L ${tubeX + TUBE_W} ${tubeBottom}` +
			` L ${tubeX} ${tubeBottom}` +
			` Z`

		const labelGap = 6
		const leftLabelX = tubeX - labelGap
		const rightLabelX = tubeX + TUBE_W + labelGap

		// LEFT axis numbers: 10..100% (only for columns that have a POC distribution).
		if (column.hasPoc) {
			for (let p = 10; p <= 100; p += 10) {
				const ty = tubeBottom - (p / 100) * TUBE_H
				root
					.append('text')
					.attr('transform', `translate(${leftLabelX}, ${ty + 4})`)
					.attr('text-anchor', 'end')
					.attr('font-size', '0.78rem')
					.text(`${p}%`)
			}
		}

		// RIGHT axis numbers: 1..10 ratings
		for (let r = 1; r <= maxScore; r++) {
			const ty = tubeBottom - (r / maxScore) * TUBE_H
			root
				.append('text')
				.attr('transform', `translate(${rightLabelX}, ${ty + 4})`)
				.attr('text-anchor', 'start')
				.attr('font-size', '0.78rem')
				.text(r)
		}

		// Rotated axis titles inside this frame, flanking the tube. Left title only when the
		// column has a POC distribution to describe; right (rating) title always shown.
		const axisMidY = tubeTop + TUBE_H / 2
		if (column.hasPoc) {
			root
				.append('text')
				.attr('transform', `translate(${tubeX - 44}, ${axisMidY}) rotate(-90)`)
				.attr('text-anchor', 'middle')
				.attr('font-size', '0.9rem')
				.attr('font-weight', 'bold')
				.text(a.texts.leftAxisLabel)
		}
		root
			.append('text')
			.attr('transform', `translate(${tubeX + TUBE_W + 44}, ${axisMidY}) rotate(90)`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '0.9rem')
			.attr('font-weight', 'bold')
			.text(a.texts.rightAxisLabel)

		// Tube outline (rounded top, flat bottom hidden by bulb)
		root.append('path').attr('d', tubePath).attr('fill', '#ffffff').attr('stroke', '#444').attr('stroke-width', 2)

		// POC distribution stack (clipped to tube shape), unique clip per column
		const dist: any[] = column.col?.distribution || []
		const distTotal = dist.reduce((s: number, d: any) => s + (d?.pct || 0), 0)
		if (distTotal > 0) {
			const clipId = `${a.id}-imp-${ci}-clip`
			root.append('defs').append('clipPath').attr('id', clipId).append('path').attr('d', tubePath)
			const stackG = root.append('g').attr('clip-path', `url(#${clipId})`)
			const distByRating: Record<number, { count: number; pct: number }> = {}
			for (const d of dist) distByRating[d.rating] = { count: d.count || 0, pct: d.pct || 0 }
			const pocTotal: number = column.col?.total || 0
			let cum = 0
			for (let r = 1; r <= maxScore; r++) {
				const bin = distByRating[r]
				const pct = bin?.pct || 0
				if (pct <= 0) continue
				const yStart = tubeBottom - (cum / 100) * TUBE_H
				const yEnd = tubeBottom - ((cum + pct) / 100) * TUBE_H
				const rect = stackG
					.append('rect')
					.attr('x', tubeX)
					.attr('y', yEnd)
					.attr('width', TUBE_W)
					.attr('height', yStart - yEnd)
					.attr('fill', RATING_COLORS[r])
				attachTip(rect, `Rating ${r} — ${pct.toFixed(1)}% (${bin.count} of ${pocTotal} staff)`)
				cum += pct
			}
		}

		// Inside-tube tick marks at every 10%
		const tickLen = 5
		for (let p = 10; p <= 100; p += 10) {
			const ty = tubeBottom - (p / 100) * TUBE_H
			root
				.append('line')
				.attr('x1', tubeX)
				.attr('y1', ty)
				.attr('x2', tubeX + tickLen)
				.attr('y2', ty)
				.attr('stroke', '#333')
				.attr('stroke-width', 1)
			root
				.append('line')
				.attr('x1', tubeX + TUBE_W - tickLen)
				.attr('y1', ty)
				.attr('x2', tubeX + TUBE_W)
				.attr('y2', ty)
				.attr('stroke', '#333')
				.attr('stroke-width', 1)
		}

		// SC vertical bar overlay (shared median across eligible sites)
		if (scMedian != null) {
			const barH = (scMedian / maxScore) * TUBE_H
			const scBar = root
				.append('rect')
				.attr('x', bulbCx - SC_BAR_W / 2)
				.attr('y', tubeBottom - barH)
				.attr('width', SC_BAR_W)
				.attr('height', barH)
				.attr('fill', scColor)
			attachTip(scBar, `Site Coordinator median: ${scMedian} (n=${scTotal} SCs)`)
		}

		// Bulb fill + outline arc
		const bulb = root.append('circle').attr('cx', bulbCx).attr('cy', bulbCy).attr('r', BULB_R).attr('fill', scColor)
		if (scMedian != null) attachTip(bulb, `Site Coordinator median: ${scMedian} (n=${scTotal} SCs)`)
		const halfW = TUBE_W / 2
		const intersectY = bulbCy - Math.sqrt(BULB_R * BULB_R - halfW * halfW)
		const bulbOutline = `M ${tubeX + TUBE_W} ${intersectY}` + ` A ${BULB_R} ${BULB_R} 0 1 1 ${tubeX} ${intersectY}`
		root.append('path').attr('d', bulbOutline).attr('fill', 'none').attr('stroke', '#444').attr('stroke-width', 2)

		// POC median ball (this responder group)
		const pocMedian: number | null = column.col?.median ?? null
		const pocTotalForTip: number = column.col?.total || 0
		if (pocMedian != null) {
			const ballY = tubeBottom - (pocMedian / maxScore) * TUBE_H
			const ball = root
				.append('circle')
				.attr('cx', bulbCx)
				.attr('cy', ballY)
				.attr('r', BALL_R)
				.attr('fill', '#444')
				.attr('stroke', '#000')
				.attr('stroke-width', 1)
			attachTip(ball, `POC median: ${pocMedian} (n=${pocTotalForTip} staff responses)`)
		}

		// n indicator (top-right of this frame)
		root
			.append('text')
			.attr('transform', `translate(${frameX + FRAME_W - 12}, ${FRAME_Y + 22})`)
			.attr('text-anchor', 'end')
			.attr('font-size', '0.8rem')
			.text(`n = ${n}`)
	})

	// Footer (once)
	root
		.append('text')
		.attr('transform', `translate(${FIRST_FRAME_X}, ${FRAME_Y + FRAME_H + 36})`)
		.attr('font-size', '0.85rem')
		.attr('font-weight', 'bold')
		.text(a.texts.footer)

	// Legend (once): rating swatches + SC swatch + POC median ball
	const legendY = FRAME_Y + FRAME_H + 64
	const legendG = a.dom.legendG.attr('transform', `translate(${FIRST_FRAME_X}, ${legendY})`)
	legendG.selectAll('*').remove()
	const swSize = 14
	const ratingsTop = [10, 9, 8, 7, 6]
	const ratingsBottom = [5, 4, 3, 2, 1]
	const drawRow = (ratings: number[], rowY: number) => {
		let x = 0
		for (const r of ratings) {
			legendG
				.append('rect')
				.attr('x', x)
				.attr('y', rowY - swSize + 4)
				.attr('width', swSize)
				.attr('height', swSize)
				.attr('fill', RATING_COLORS[r])
			legendG
				.append('text')
				.attr('transform', `translate(${x + swSize + 4}, ${rowY + 2})`)
				.attr('font-size', '0.85rem')
				.text(r)
			x += 50
		}
		return x
	}
	let markerX = 0
	if (anyPoc) {
		const lastX = drawRow(ratingsTop, 0)
		drawRow(ratingsBottom, 22)
		markerX = lastX + 30
	}

	// SC swatch + label always render.
	legendG
		.append('rect')
		.attr('x', markerX)
		.attr('y', -swSize + 4)
		.attr('width', swSize)
		.attr('height', swSize)
		.attr('fill', scColor)
	legendG
		.append('text')
		.attr('transform', `translate(${markerX + swSize + 4}, 2)`)
		.attr('font-size', '0.85rem')
		.text(a.texts.legend.sc)

	// POC median legend entry — skip when no column has POC (SC-only).
	if (anyPoc) {
		legendG
			.append('circle')
			.attr('cx', markerX + 7)
			.attr('cy', 22 - 4)
			.attr('r', BALL_R)
			.attr('fill', '#444')
			.attr('stroke', '#000')
			.attr('stroke-width', 1)
		legendG
			.append('text')
			.attr('transform', `translate(${markerX + swSize + 4}, ${22 + 2})`)
			.attr('font-size', '0.85rem')
			.text(a.texts.legend.median)
	}
}
