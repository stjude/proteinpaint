import { select } from 'd3-selection'
import type { SvgText } from '../../types/d3'

export type LabelAncestry = {
	ancestor_id: string
	transform: string //side.attr.labelGTransform(lab),
	samples: string[] //lab.grp.relatedSamples[id],
	maxTextLengthByAncestorDistance: { [key: number]: number }
	direction: string
	distance: number // ancestor distance, used to stack nested spans by level
}

export const SPANCLS = 'sjpp-matrix-label-span'
export const SPANSELECTOR = `.${SPANCLS}`

// gap (in px) added between each successive nested ancestor span level,
// so that a distance-2 ancestor span is rendered beyond the distance-1 spans
const SPANLEVELGAP = 24

export function trackLabelSpanData(
	lab,
	side,
	direction,
	text: SvgText,
	relatedSamplesByAncestorId: Map<string, LabelAncestry>
) {
	if (side.prefix !== 'sample') return
	if (!lab.row?._ref_?.ancestors) return

	for (const a of lab.row._ref_.ancestors) {
		const id = a.ancestor_id
		if (id === undefined || id === null) continue

		let entry = relatedSamplesByAncestorId.get(id)
		if (!entry) {
			entry = {
				ancestor_id: id,
				//row: lab.row,
				transform: side.attr.labelGTransform(lab),
				samples: [],
				maxTextLengthByAncestorDistance: {},
				direction,
				distance: a.distance
			}
			relatedSamplesByAncestorId.set(id, entry)
		}
		// Accumulate every sample that descends from this ancestor, at any distance,
		// so the span brackets the full contiguous descendant range. This matters for
		// a nested ancestor that is both a grandparent of some samples (via an
		// intermediate ancestor) and a direct parent of others: grp.relatedSamples is
		// keyed by each sample's first ancestor only, so it would not include the
		// grandchildren, but the span should still cover all of them.
		entry.samples.push(lab.row)
		// an ancestor may be referenced at different distances by different samples
		// (e.g. a direct parent of some and a grandparent of others); stack its span
		// at the outermost nesting level using the largest observed distance
		if (a.distance > entry.distance) entry.distance = a.distance

		const textBox = text.node()?.getBBox() || { width: 0 }
		const m = entry.maxTextLengthByAncestorDistance
		if (!m[a.distance] || textBox.width > m[a.distance]) m[a.distance] = textBox.width
	}
}

export function renderLabelSpans(relatedSamplesByAncestorId, side, d) {
	// only render a span when it covers more than one sample
	const relatedSamples = [...relatedSamplesByAncestorId.values()].filter(r => r.samples.length > 1)
	side.box.selectAll(SPANSELECTOR).remove()
	const a = side.box.selectAll(SPANSELECTOR).data(relatedSamples)

	a.enter()
		.append('g')
		.each(function (this: SVGGElement, r) {
			const g = select(this).attr('class', SPANCLS).attr('transform', r.transform)

			const y = getSpanYpos(r)
			const xw = d.colw * (r.samples.length - 1)
			g.append('line')
				.attr('x1', -d.colw + 5)
				.attr('x2', xw + 1)
				.attr('y1', y)
				.attr('y2', y)
				.attr('stroke', '#000')
				.attr('stroke-width', 1) //rgba(255, 100, 100, 0.1)`); console.log(208, side.box.select(cls).node())

			g.append('text')
				.attr('text-anchor', 'end')
				.attr('transform', `translate(${xw / 2},${y + 3})rotate(-90)`)
				.text(r.ancestor_id)
		})
}

function getSpanYpos(d) {
	const l = d.maxTextLengthByAncestorDistance
	//console.log(345, l)
	// base extent = how far the (rotated) sample labels reach; nested ancestor
	// levels are pushed further out by SPANLEVELGAP per ancestor distance level
	const labelLen = Math.max(0, ...Object.values(l).map(Number))
	const level = (d.distance || 1) - 1
	const offset = labelLen + 3 + level * SPANLEVELGAP
	return d.direction == 'btm' ? offset : -offset
}
