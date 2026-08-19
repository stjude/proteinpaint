import { select } from 'd3-selection'
import type { SvgText } from '../../types/d3'

export type LabelAncestry = {
	ancestor_id: string | number
	ancestor_name?: string // display label; falls back to ancestor_id when absent
	transform: string //side.attr.labelGTransform(lab),
	samples: any[] //lab.row entries, used for span length/extent
	maxTextLengthByAncestorDistance: { [key: number]: number }
	direction: string
	distance: number // ancestor distance, used to stack nested spans by level
}

export const SPANCLS = 'sjpp-matrix-label-span'
export const SPANSELECTOR = `.${SPANCLS}`

// small gap (in px) between a span line and adjacent text: the sample labels next to it,
// its own ancestor label, and the next nested level's line
const SPANLABELPAD = 3

export function setRelatedSamples(grp) {
	grp.relatedSamples = {}
	if (!grp.lst?.length) return
	// at this point, samples have already been sorted by grpLstSampleSorter (mutation, CNV, values, etc),
	// only now pull ancestor-related samples to be grouped with the left-most related sample
	const reorderedByAncestor = new Set()
	const lstCopy: Set<any> = new Set(grp.lst)
	let currentRelated: any[] = []
	for (const s of grp.lst) {
		if (reorderedByAncestor.has(s)) continue
		reorderedByAncestor.add(s)
		lstCopy.delete(s)
		currentRelated = [s]
		if (s._ref_?.ancestors) {
			for (const a of s._ref_.ancestors) {
				const id = a.ancestor_id
				for (const c of lstCopy) {
					// TODO: support multi-level ancestry instead of just the immediate sample parent
					if (c._ref_?.ancestors?.[0]?.ancestor_id === id) {
						reorderedByAncestor.add(c)
						lstCopy.delete(c)
						currentRelated.push(c)
					}
				}
				if (currentRelated.length > 1) grp.relatedSamples[id] = currentRelated
			}
		}
	}
	// reassign only after the loop, so every visited sample (each added to
	// reorderedByAncestor above) is retained; reassigning inside the loop would
	// leave grp.lst as the snapshot from the last ancestor-bearing sample and
	// silently drop any trailing samples iterated after it
	grp.lst = [...reorderedByAncestor]
}

type SampleAncestorList = {
	ancestor_id: string
	distance: number
}[]

export function getSortSamplesByAncestry(self) {
	return (a, b) => {
		const aid = a._ref_.ancestors?.[0]?.ancestor_id
		const bid = b._ref_.ancestors?.[0]?.ancestor_id
		if (!aid && !bid) return 0
		if (!aid) return 1
		if (!bid) return -1
		const alen = self.samplesByAncestorId.get(aid)?.size
		const blen = self.samplesByAncestorId.get(bid)?.size
		if (!alen && !blen) return 0
		if (!alen) return 1
		if (!blen) return -1

		const aa: SampleAncestorList = a._ref_.ancestors || []
		const bb: SampleAncestorList = b._ref_.ancestors || []

		if (aa.length > bb.length) return -1
		if (aa.length < bb.length) return 1
		for (const [i, a] of Object.entries(aa)) {
			if (a.ancestor_id < bb[i].ancestor_id) return -1
			if (a.ancestor_id > bb[i].ancestor_id) return 1
		}
		return 0
	}
}

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
				ancestor_name: a.ancestor_name,
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

	// Render each ancestor label text first, so its rendered size can be measured. A label
	// is drawn horizontally (upright) when its width fits within the horizontal extent of
	// its descendant sample columns (samples.length * colw); otherwise it is rotated
	// vertical. The vertical extent that a label occupies away from its line (its width when
	// rotated, but only its height when horizontal) determines how far out the next nested
	// level must be placed, avoiding overlap that a constant per-level gap could not handle.
	const groups = side.box
		.selectAll(SPANSELECTOR)
		.data(relatedSamples)
		.enter()
		.append('g')
		.attr('class', SPANCLS)
		.attr('transform', r => r.transform)

	const layoutByEntry = new Map<any, { horizontal: boolean; verticalExtent: number }>()
	groups.each(function (this: SVGGElement, r) {
		// prefer the human-readable ancestor name, falling back to the ancestor id
		const box = select(this)
			.append('text')
			.text(r.ancestor_name ?? r.ancestor_id)
			.node()
			?.getBBox() || { width: 0, height: 0 }
		const availableWidth = r.samples.length * d.colw
		const horizontal = box.width <= availableWidth
		layoutByEntry.set(r, { horizontal, verticalExtent: horizontal ? box.height : box.width })
	})

	const lineOffsetByLevel = getLineOffsetByLevel(relatedSamples, layoutByEntry)

	// position the line span and its ancestor label using the measured per-level offsets
	groups.each(function (this: SVGGElement, r) {
		// when the sample labels are rendered at the top of the matrix, the span and its
		// ancestor label are placed above (negative y) and extend upward, away from the
		// matrix; otherwise (bottom) they are placed below and extend downward
		const isTop = getDirection(r, side) === 'top'
		const level = (r.distance || 1) - 1
		const y = isTop ? -lineOffsetByLevel[level] : lineOffsetByLevel[level]
		const xw = d.colw * (r.samples.length - 1)
		const g = select(this)
		// insert the line before the text so it stays behind the ancestor label
		g.insert('line', 'text')
			.attr('x1', -d.colw + 5)
			.attr('x2', xw + 1)
			.attr('y1', y)
			.attr('y2', y)
			.attr('stroke', '#000')
			.attr('stroke-width', 1)

		const textY = y + (isTop ? -SPANLABELPAD : SPANLABELPAD)
		const text = g.select('text').attr('transform', null)
		if (layoutByEntry.get(r)?.horizontal) {
			// upright, centered over the span, just beyond the line
			text
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', isTop ? 'auto' : 'hanging')
				.attr('transform', `translate(${xw / 2},${textY})`)
		} else {
			// rotated vertical, reading away from the matrix
			text
				.attr('text-anchor', isTop ? 'start' : 'end')
				.attr('dominant-baseline', 'auto')
				.attr('transform', `translate(${xw / 2},${textY})rotate(-90)`)
		}
	})
}

// The side's direction is the source of truth when available; otherwise fall back to
// the direction tracked per ancestor entry. This keeps production behavior unchanged
// (the layout side object has no `direction`, so the tracked entry direction is used)
// while allowing a caller/test to drive the placement via side.direction.
function getDirection(d, side) {
	return side.direction ?? d.direction
}

// Compute the positive line-offset magnitude for each nesting level. Level 0 sits just
// past the sample labels; each deeper level sits past the previous level's line AND the
// vertical extent of its ancestor label, so a wide (rotated) label pushes the next level
// proportionally out, while an upright label only reserves its (small) text height.
function getLineOffsetByLevel(relatedSamples, layoutByEntry: Map<any, { verticalExtent: number }>) {
	// how far the rotated sample labels reach (max across all ancestors)
	const sampleLabelExtent = Math.max(
		0,
		...relatedSamples.map(r => Math.max(0, ...Object.values(r.maxTextLengthByAncestorDistance).map(Number)))
	)
	// the largest label extent at each level determines the spacing to the next level
	const maxLabelExtentByLevel: { [level: number]: number } = {}
	for (const r of relatedSamples) {
		const level = (r.distance || 1) - 1
		const ext = layoutByEntry.get(r)?.verticalExtent || 0
		if (!(level in maxLabelExtentByLevel) || ext > maxLabelExtentByLevel[level]) maxLabelExtentByLevel[level] = ext
	}

	const offsetByLevel: { [level: number]: number } = {}
	let extent = sampleLabelExtent
	for (const level of Object.keys(maxLabelExtentByLevel)
		.map(Number)
		.sort((a, b) => a - b)) {
		// place this level's line a small pad beyond the current extent
		offsetByLevel[level] = extent + SPANLABELPAD
		// the ancestor label at this level extends outward from its line by its vertical
		// extent (with a pad between line and text); the next level must clear that
		extent = offsetByLevel[level] + SPANLABELPAD + maxLabelExtentByLevel[level]
	}
	return offsetByLevel
}
