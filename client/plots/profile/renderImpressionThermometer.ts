export const IMPRESSION_MAX_SCORE = 10

// Fallback if a term has no color in jsondata (shouldn't happen for impression terms in
// the live db, but keeps the renderer from emitting `fill="undefined"` if it ever does).
const FALLBACK_COLOR = '#888'

// POC grey — the right (Point-of-Care) half of the tube + bulb, and the shared legend swatch.
export const POC_FILL = '#9e9e9e'

// Hover-highlight descriptor: the hovered half-fill gets a dark outline.
const FILL_HOVER = { on: { stroke: '#222', 'stroke-width': '1.5' }, off: { stroke: 'none' } }

/*
Three impression performance zones (Weak/Intermediate/Strong) labelled along the rating axis.
Bins are config-driven from the dataset (impression.zones) so the boundaries live in one place,
shared with the response-distribution chart.
*/
export type ImpressionZone = { label: string; min: number; max: number; color: string }

// One responder group's median/total (POC side of a single thermometer). null for SC-only modules.
export type ImpressionPoc = { median: number | null; total: number } | null

export type ImpressionThermometerArgs = {
	// d3 selection of the div that will hold this thermometer's own <svg>. Lives inside
	// profilePlot.dom.rightDiv, which owns the mousemove/mouseout tooltip delegation.
	holder: any
	id: any
	// Shared SC median across eligible sites + the site count (n) — the left (module-color) fill.
	sc: { median: number | null; total: number }
	// This group's POC median/total, or null for SC-only modules — the right (grey) fill.
	poc: ImpressionPoc
	// Title for the single 1..maxScore rating axis (left).
	ratingAxisLabel: string
	zones: ImpressionZone[]
	// Per-module color for the SC (left) half of the tube (terms.jsondata.color in the DB).
	colors: { sc: string }
	// Binds tooltip text (+ optional hover descriptor) as the element's datum; the shared
	// profilePlot mousemove→onMouseOver delegation reads __data__. Passed in by profileForms.
	attachTip: (sel: any, text: string, hover?: any) => void
}

// Geometry for a single thermometer svg.
const SVG_W = 300
const TUBE_W = 46
const TUBE_H = 300
const BULB_R = 33
const TUBE_TOP = 24 // small top margin above the tube (labels/header live in the card, not the svg)
const TUBE_BOTTOM = TUBE_TOP + TUBE_H
const CENTER_X = SVG_W / 2
// Median fills read as thick vertical bars inside the tube (one per half), not full half-fills.
const BAR_W = 12
const BULB_CY = TUBE_BOTTOM + 22
const BULB_BOTTOM = BULB_CY + BULB_R
const SVG_H = BULB_BOTTOM + 16

export function renderImpressionThermometer(a: ImpressionThermometerArgs) {
	const maxScore = IMPRESSION_MAX_SCORE
	const scColor = a.colors?.sc || FALLBACK_COLOR
	const scMedian: number | null = a.sc?.median ?? null
	const scTotal: number = a.sc?.total || 0
	const pocMedian: number | null = a.poc?.median ?? null
	const pocTotal: number = a.poc?.total || 0

	const svg = a.holder.append('svg').attr('width', SVG_W).attr('height', SVG_H)
	const root = svg.append('g')

	const tubeX = CENTER_X - TUBE_W / 2
	// rating (1..maxScore) → y on the tube
	const yOf = (rating: number) => TUBE_BOTTOM - (rating / maxScore) * TUBE_H

	// Tube (rounded top, flat bottom). Fills are clipped to the tube; the bulb is drawn solid on
	// top afterwards so it covers the tube's flat bottom edge and reads as one shape.
	const tubePath =
		`M ${tubeX} ${TUBE_TOP + TUBE_W / 2}` +
		` A ${TUBE_W / 2} ${TUBE_W / 2} 0 0 1 ${tubeX + TUBE_W} ${TUBE_TOP + TUBE_W / 2}` +
		` L ${tubeX + TUBE_W} ${TUBE_BOTTOM}` +
		` L ${tubeX} ${TUBE_BOTTOM}` +
		` Z`
	const tubeClipId = `${a.id}-tube-clip`
	root.append('defs').append('clipPath').attr('id', tubeClipId).append('path').attr('d', tubePath)
	const tubeInner = root.append('g').attr('clip-path', `url(#${tubeClipId})`)

	// Empty tube = a light tint of the module color (the unfilled portion above each median).
	tubeInner
		.append('rect')
		.attr('x', tubeX)
		.attr('y', TUBE_TOP)
		.attr('width', TUBE_W)
		.attr('height', TUBE_BOTTOM - TUBE_TOP)
		.attr('fill', scColor)
		.attr('opacity', 0.15)

	// The two median bars sit right next to each other, centered over the bulb: SC just left of
	// center, POC just right. Thick lines rising from the bulb to each median (rounded top); the
	// light tube shows around them rather than a full half-fill.
	if (scMedian != null) {
		const scFill = tubeInner
			.append('rect')
			.attr('class', 'sc-fill')
			.attr('x', CENTER_X - BAR_W)
			.attr('y', yOf(scMedian))
			.attr('width', BAR_W)
			.attr('height', TUBE_BOTTOM - yOf(scMedian))
			.attr('rx', BAR_W / 2)
			.attr('fill', scColor)
		a.attachTip(
			scFill,
			`Site Coordinator median: ${scMedian} (n=${scTotal} ${scTotal === 1 ? 'SC' : 'SCs'})`,
			FILL_HOVER
		)
	}

	// Right (POC) median bar: a thick grey line just right of center, adjacent to the SC bar.
	if (pocMedian != null) {
		const pocFill = tubeInner
			.append('rect')
			.attr('class', 'poc-fill')
			.attr('x', CENTER_X)
			.attr('y', yOf(pocMedian))
			.attr('width', BAR_W)
			.attr('height', TUBE_BOTTOM - yOf(pocMedian))
			.attr('rx', BAR_W / 2)
			.attr('fill', POC_FILL)
		a.attachTip(pocFill, `POC median: ${pocMedian} (n=${pocTotal} staff responses)`, FILL_HOVER)
	}

	// Tube outline (behind the bulb, so its flat bottom is hidden by the bulb).
	root.append('path').attr('d', tubePath).attr('fill', 'none').attr('stroke', '#444').attr('stroke-width', 2)

	// Bulb drawn on top: a split solid circle (left SC / right POC) covering the tube bottom.
	const bulbClipId = `${a.id}-bulb-clip`
	root
		.append('defs')
		.append('clipPath')
		.attr('id', bulbClipId)
		.append('circle')
		.attr('cx', CENTER_X)
		.attr('cy', BULB_CY)
		.attr('r', BULB_R)
	const bulbInner = root.append('g').attr('clip-path', `url(#${bulbClipId})`)
	bulbInner
		.append('rect')
		.attr('x', CENTER_X - BULB_R)
		.attr('y', BULB_CY - BULB_R)
		.attr('width', 2 * BULB_R)
		.attr('height', 2 * BULB_R)
		.attr('fill', scColor)
		.attr('opacity', 0.15)
	if (scMedian != null)
		bulbInner
			.append('rect')
			.attr('x', CENTER_X - BULB_R)
			.attr('y', BULB_CY - BULB_R)
			.attr('width', BULB_R)
			.attr('height', 2 * BULB_R)
			.attr('fill', scColor)
	if (pocMedian != null)
		bulbInner
			.append('rect')
			.attr('x', CENTER_X)
			.attr('y', BULB_CY - BULB_R)
			.attr('width', BULB_R)
			.attr('height', 2 * BULB_R)
			.attr('fill', POC_FILL)
	root
		.append('circle')
		.attr('cx', CENTER_X)
		.attr('cy', BULB_CY)
		.attr('r', BULB_R)
		.attr('fill', 'none')
		.attr('stroke', '#444')
		.attr('stroke-width', 2)

	// LEFT axis: 1..maxScore rating numbers + inward ticks + rotated title.
	const leftLabelX = tubeX - 8
	for (let r = 1; r <= maxScore; r++) {
		const ty = yOf(r)
		root
			.append('text')
			.attr('transform', `translate(${leftLabelX}, ${ty + 4})`)
			.attr('text-anchor', 'end')
			.attr('font-size', '0.78rem')
			.text(r)
		root
			.append('line')
			.attr('x1', tubeX)
			.attr('y1', ty)
			.attr('x2', tubeX + 5)
			.attr('y2', ty)
			.attr('stroke', '#333')
			.attr('stroke-width', 1)
	}
	root
		.append('text')
		.attr('transform', `translate(${tubeX - 32}, ${TUBE_TOP + TUBE_H / 2}) rotate(-90)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', '0.9rem')
		.attr('font-weight', 'bold')
		.text(a.ratingAxisLabel)

	// RIGHT side: performance-zone labels (rotated) at each band's midpoint.
	const rightLabelX = tubeX + TUBE_W + 22
	for (const z of a.zones) {
		const yMid = (yOf(z.max) + yOf(z.min - 1)) / 2
		root
			.append('text')
			.attr('transform', `translate(${rightLabelX}, ${yMid}) rotate(90)`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '0.82rem')
			.attr('fill', '#555')
			.text(z.label)
	}
}
