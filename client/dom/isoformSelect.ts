import { sketchGmsum, sketchProtein, setupCanvas } from './sketchGm'
import { exoncolor } from '#shared/common.js'
import type {
	GeneModel,
	ExonRegion,
	IsoformSelectOpts,
	IsoformRangeSelectOpts,
	IsoformPairRangeSelectOpts,
	BreakpointMarker,
	BreakpointLink,
	LinearScale,
	ScaleMode,
	SelectedRange
} from './types/isoformSelect'
import type { Div, Td } from '../types/d3'

/*
Standalone reusable component for displaying and selecting gene model isoforms.

Extracted from block.js showisoform4switch() to be reusable.

Two modes:

Single-select (default):
  Click a row to select one isoform. Calls onSelect(gm).
  Used by block.js for isoform switching.

Multi-select (multiSelect: true):
  Each row has a checkbox. A "Select all" toggle at the top and a
  submit button at the bottom. Calls onMultiSelect(gms) on submit.
  Used by isoformExpression.ts to create a custom numeric termCollection
  from multiple isoforms.

See isoformRangeSelect() at the bottom of this file for a related component that
marks breakpoints over the isoform structure and selects a genomic range of them,
and isoformPairRangeSelect() for the two-gene form of it, which links the paired
breakpoints of sv/fusion events between the two genes they join.

******* required (both modes)
.holder     d3 selection to render into
.allgm      array of gene model objects

******* single-select
.onSelect   callback(gm) when an isoform row is clicked

******* multi-select
.multiSelect       set to true
.onMultiSelect     callback(gms[]) when submit is clicked

******* optional
.usegm             currently active gene model, highlighted (single-select only)
.selectedIsoforms  Set of pre-checked isoform IDs (multi-select only)
.getSubmitLabel    (selectedCount) => text for the submit button, called on every
                   selection change (multi-select only, default "Submit (n)")
.maxHeight         max height in px before scrolling (default 200)
.scrollThreshold   number of isoforms before enabling scroll (default 10)
*/

/**
 * Merge all exon regions across gene models to compute a unified layout
 * for sketching isoform exon structure.
 *
 * Returns [rglst, chrcount] where rglst is the merged exon region list
 * and chrcount is the number of distinct chromosomes.
 */
export function allgm2sum(gmlst: GeneModel[]) {
	const chr2gm = new Map<string, GeneModel[]>()
	for (const gm of gmlst) {
		if (gm.hidden) {
			continue
		}
		if (!chr2gm.has(gm.chr)) {
			chr2gm.set(gm.chr, [])
		}
		chr2gm.get(gm.chr)!.push(gm)
	}
	const alllst: ExonRegion[] = []
	for (const [chr, gmlstForChr] of chr2gm.entries()) {
		const elst: number[][] = []
		for (const m of gmlstForChr) {
			for (const e of m.exon) {
				elst.push([e[0], e[1]])
			}
		}
		if (elst.length === 0) continue
		const reverse = gmlstForChr[0].strand == '-'
		elst.sort((a: number[], b: number[]) => a[0] - b[0])
		let thisregion = elst[0]
		const rglst: ExonRegion[] = []
		for (let i = 1; i < elst.length; i++) {
			const e = elst[i]
			if (e[0] > thisregion[1]) {
				const r = {
					chr: chr,
					bstart: thisregion[0],
					bstop: thisregion[1],
					start: thisregion[0],
					stop: thisregion[1],
					reverse: reverse
				}
				if (reverse) {
					rglst.unshift(r)
				} else {
					rglst.push(r)
				}
				thisregion = e
			} else {
				thisregion[1] = Math.max(thisregion[1], e[1])
			}
		}
		const r = {
			chr: chr,
			bstart: thisregion[0],
			bstop: thisregion[1],
			start: thisregion[0],
			stop: thisregion[1],
			reverse: reverse
		}
		if (reverse) {
			rglst.unshift(r)
		} else {
			rglst.push(r)
		}
		alllst.push(...rglst)
	}
	return [alllst, chr2gm.size] as const
}

/**
 * Render a list of gene model isoforms for selection.
 *
 * Single-select: click a row to select one isoform and call onSelect(gm).
 * Multi-select: checkboxes with select-all and submit button, calls onMultiSelect(gms).
 */
export function isoformSelect(opts: IsoformSelectOpts) {
	const { holder, allgm, multiSelect } = opts
	const maxHeight = opts.maxHeight ?? 200
	const scrollThreshold = opts.scrollThreshold ?? 10

	const [rglst, chrcount] = allgm2sum(allgm)
	if (rglst.length === 0) return

	// compute exon layout sizing
	let pxwidth = 370
	let intronpx = 10
	if (intronpx * (rglst.length - 1) > pxwidth * 0.3) {
		intronpx = Math.max(2, (pxwidth * 0.3) / (rglst.length - 1))
	}
	const inw = intronpx * (rglst.length - 1)
	const exonlen = rglst.reduce((a: number, b: ExonRegion) => a + b.stop - b.start, 0)
	const exonsf = (pxwidth - (inw > pxwidth * 0.4 ? 0 : inw)) / exonlen
	pxwidth = exonlen * exonsf + inw
	for (const e of rglst) {
		e.width = Math.ceil((e.stop - e.start) * exonsf)
	}

	// multi-select state
	const checkedSet = new Set<string>(multiSelect ? opts.selectedIsoforms || [] : [])
	const checkboxes: { isoform: string; input: any }[] = []
	let selectAllCheckbox: any
	let submitBtn: any

	// select-all header (multi-select only)
	if (multiSelect) {
		const headerDiv = holder.append('div').style('margin-bottom', '4px')
		selectAllCheckbox = headerDiv
			.append('input')
			.attr('type', 'checkbox')
			.property('checked', checkedSet.size === allgm.length)
			.style('cursor', 'pointer')
			.on('change', function (this: HTMLInputElement) {
				const checked = this.checked
				for (const cb of checkboxes) {
					cb.input.property('checked', checked)
					if (checked) checkedSet.add(cb.isoform)
					else checkedSet.delete(cb.isoform)
				}
				updateSubmitBtn()
			})
		headerDiv
			.append('span')
			.text(' Select all')
			.style('cursor', 'pointer')
			.style('user-select', 'none')
			.on('click', () => {
				const el = selectAllCheckbox.node() as HTMLInputElement
				el.checked = !el.checked
				el.dispatchEvent(new Event('change'))
			})
	}

	// scrollable container if many isoforms
	let mayscroll = holder
	if (allgm.length > scrollThreshold) {
		mayscroll = holder
			.append('div')
			.attr('tabindex', 0)
			.style('height', maxHeight + 'px')
			.style('overflow-y', 'scroll')
			.style('resize', 'vertical')
	}

	const table = mayscroll.append('table').style('color', '#555')

	// single-select: track labels for highlighting
	const gmlabellst: { isoform: string; chr: string; start: number; label: Td }[] = []

	for (const gm of allgm) {
		const tr = table.append('tr').attr('tabindex', 0)

		if (multiSelect) {
			// checkbox column
			const cb = tr
				.append('td')
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', checkedSet.has(gm.isoform))
				.style('cursor', 'pointer')
				.on('change', function (this: HTMLInputElement) {
					if (this.checked) checkedSet.add(gm.isoform)
					else checkedSet.delete(gm.isoform)
					selectAllCheckbox.property('checked', checkedSet.size === allgm.length)
					updateSubmitBtn()
				})
			checkboxes.push({ isoform: gm.isoform, input: cb })

			// clicking or pressing Enter/Space on the row toggles the checkbox
			tr.style('cursor', 'pointer').on('click', (event: MouseEvent) => {
				if ((event.target as HTMLElement).tagName === 'INPUT') return
				const el = cb.node() as HTMLInputElement
				el.checked = !el.checked
				el.dispatchEvent(new Event('change'))
			})
			tr.on('keydown', (event: KeyboardEvent) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					const el = cb.node() as HTMLInputElement
					el.checked = !el.checked
					el.dispatchEvent(new Event('change'))
				}
			})
		} else {
			// single-select: click row to select
			tr.attr('class', 'sja_clb')
			const selectRow = () => {
				for (const gm2 of gmlabellst) {
					gm2.label.style(
						'color',
						gm2.isoform == gm.isoform && gm2.chr == gm.chr && gm2.start == gm.start ? '#cc0000' : '#545454'
					)
				}
				opts.onSelect!(gm)
			}
			tr.on('click', selectRow)
			tr.on('keydown', (event: KeyboardEvent) => {
				if (event.key == 'Enter') selectRow()
			})
		}

		// DEFAULT label
		tr.append('td')
			.text(gm.isdefault ? 'DEFAULT' : '')
			.style('font-size', '.6em')

		// isoform name
		const usegm = !multiSelect ? opts.usegm : undefined
		const isActive =
			!multiSelect && usegm && gm.isoform == usegm.isoform && gm.chr == usegm.chr && gm.start == usegm.start
		const lab = tr
			.append('td')
			.text(gm.isoform)
			.style('color', isActive ? '#cc0000' : '#545454')
		if (!multiSelect) {
			gmlabellst.push({ isoform: gm.isoform, chr: gm.chr, start: gm.start, label: lab })
		}

		// chromosome column (only if multiple chromosomes)
		if (chrcount > 1) {
			tr.append('td').text(gm.chr)
		}

		// exon structure sketch
		sketchGmsum(tr.append('td'), rglst, gm, exonsf, intronpx, pxwidth, 16, exoncolor)

		// protein length sketch
		sketchProtein(tr.append('td'), gm, 200)
	}

	// submit button (multi-select only)
	if (multiSelect) {
		submitBtn = holder
			.append('button')
			.style('margin-top', '8px')
			.style('cursor', 'pointer')
			.on('click', () => {
				const selected = allgm.filter(gm => checkedSet.has(gm.isoform))
				if (selected.length > 0) opts.onMultiSelect!(selected)
			})
		updateSubmitBtn()
	}

	function updateSubmitBtn() {
		const count = checkedSet.size
		const label = multiSelect && opts.getSubmitLabel ? opts.getSubmitLabel(count) : `Submit (${count})`
		submitBtn.property('disabled', count === 0).text(label)
	}
}

type ScaleArg = {
	chr: string
	gms: GeneModel[]
	markers?: { pos: number }[]
	pxwidth: number
	/** range already selected on the gene. only used to keep it within a zoomed window */
	range?: { start: number; stop: number }
}

/** exons of context kept on each side of the breakpoints when zooming (see focusRegions) */
const zoomPadExons = 1
/** a gene of fewer exons than this is not zoomed, as there is little width to win */
const zoomMinExons = 6

/**
 * What a window over a gene must cover: the breakpoints, and the ends of a range already
 * selected, so that neither a zoom nor an isoform filter can silently narrow a saved
 * selection when it is clamped (see the setRange of each component).
 *
 * Returns null when there is no position to span, e.g. a gene with no breakpoint of its
 * own, which is then drawn whole.
 */
function markerSpan(
	markers: { pos: number }[] | undefined,
	range: { start: number; stop: number } | undefined
): [number, number] | null {
	const positions: number[] = []
	for (const m of markers || []) if (Number.isFinite(m.pos)) positions.push(m.pos)
	if (range) positions.push(range.start, range.stop)
	if (!positions.length) return null
	return [Math.min(...positions), Math.max(...positions)]
}

/**
 * The isoforms of a gene that a breakpoint can fall on: the ones overlapping the span of
 * the marks.
 *
 * An isoform outside the span, e.g. one of the short fragment transcripts annotated over a
 * locus, costs the chart twice over: it takes a row to draw a model no event of the chart
 * falls on, and its exons join the merged layout every isoform is drawn over (see
 * allgm2sum), so they widen the span the breakpoints must share the width with. Dropping
 * them first is what lets the layout, and the zoom of focusRegions below it, follow the
 * isoforms the events are actually on.
 *
 * Every isoform is kept when none of them overlaps the span, as a track of no isoform draws
 * nothing; the marks are then laid over the whole gene, as before.
 */
export function breakpointGms(
	gms: GeneModel[],
	markers: { pos: number }[] | undefined,
	range: { start: number; stop: number } | undefined
): GeneModel[] {
	const span = markerSpan(markers, range)
	if (!span) return gms
	const [lo, hi] = span
	const kept = gms.filter(gm => gm.stop >= lo && gm.start <= hi)
	return kept.length ? kept : gms
}

/**
 * The exons to draw of a gene: the ones the breakpoints fall on, one exon of context on
 * each side, and every exon between them.
 *
 * The window is one contiguous run, so it is a zoom of the gene rather than a splice of it:
 * every gap within it is a real intron, and nothing inside it is left out. An exon of a
 * many-exon gene is only a few px of the full width, too small to read a breakpoint on or
 * to drag a range over; a window of them gets the whole width to share.
 *
 * The context kept is the one flanking exon on each side and no more, whatever share of the
 * gene that leaves out: an exon no breakpoint is on, and no range can be dragged over
 * without covering the flank before it, is width taken from the exons the chart is about.
 * So the whole gene is kept only when the flanks reach its ends, or when it has too few
 * exons to win width by zooming. The locus of a zoomed window is labelled (see locusLabel),
 * as the view is then of a part of the gene.
 */
function focusRegions(
	rglst: ExonRegion[],
	markers: { pos: number }[] | undefined,
	range: { start: number; stop: number } | undefined
): ExonRegion[] {
	if (rglst.length < zoomMinExons) return rglst
	const span = markerSpan(markers, range)
	if (!span) return rglst
	const [lo, hi] = span
	// rglst runs 3' to 5' on the minus strand, so walk the regions by position instead
	const byPos = [...rglst].sort((a, b) => a.start - b.start)
	let first = 0
	while (first < byPos.length - 1 && byPos[first].stop < lo) first++
	let last = byPos.length - 1
	while (last > first && byPos[last].start > hi) last--
	first = Math.max(0, first - zoomPadExons)
	last = Math.min(byPos.length - 1, last + zoomPadExons)
	const kept = new Set(byPos.slice(first, last + 1))
	return rglst.filter(r => kept.has(r))
}

/** compact locus of a zoomed track, e.g. chr22:23180-23240kb, to fit the label column it
 * is shown in. the exact coordinates are in the range inputs below the chart */
function locusLabel(chr: string, start: number, stop: number) {
	if (stop - start >= 1e6) return `${chr}:${(start / 1e6).toFixed(2)}-${(stop / 1e6).toFixed(2)}Mb`
	return `${chr}:${Math.round(start / 1000)}-${Math.round(stop / 1000)}kb`
}

/**
 * Scale of a gene to place breakpoints and a range over, in the layout of the given mode
 * (see ScaleMode): 'genomic' keeps introns at their real width, 'rna' collapses them.
 *
 * The mode follows the dt of the events being charted, not the gene: a genomic sv breaks
 * mostly in introns, so collapsing them would squeeze its breakpoints into a few px, while
 * a rna fusion joins transcripts at exon boundaries, where intronic space is only noise.
 */
export function makeScale(arg: ScaleArg & { mode?: ScaleMode }): LinearScale {
	return arg.mode == 'rna' ? makeExonScale(arg) : makeLinearScale(arg)
}

/** Linear genomic scale over a chr region covering the gene models and markers, padded. */
export function makeLinearScale(arg: ScaleArg): LinearScale {
	const { chr, gms, pxwidth } = arg
	const positions: number[] = []
	for (const gm of gms) positions.push(gm.start, gm.stop)
	// markers are included in the span so that a breakpoint outside the gene, e.g. one
	// upstream of the promoter, is still visible and selectable
	for (const m of arg.markers || []) if (Number.isFinite(m.pos)) positions.push(m.pos)
	if (!positions.length) throw 'no gene model or marker to make a scale with'
	const min = Math.min(...positions)
	const max = Math.max(...positions)
	const pad = Math.max(1, Math.ceil((max - min) * 0.05))
	const start = Math.max(0, min - pad)
	const stop = max + pad
	// strand of the first isoform decides the direction, as in allgm2sum()
	const reverse = gms[0]?.strand == '-'
	const exonsf = pxwidth / (stop - start)
	const rglst: ExonRegion[] = [{ chr, bstart: start, bstop: stop, start, stop, reverse, width: pxwidth }]
	return {
		chr,
		mode: 'genomic',
		zoomed: false,
		start,
		stop,
		reverse,
		pxwidth,
		exonsf,
		rglst,
		intronpx: 0,
		pos2px: (pos: number) => (reverse ? stop - pos : pos - start) * exonsf,
		px2pos: (px: number) => {
			const pos = Math.round(reverse ? stop - px / exonsf : start + px / exonsf)
			return Math.max(start, Math.min(stop, pos))
		}
	}
}

/**
 * Scale over the exon structure of a gene, the exons of all its isoforms merged (see
 * allgm2sum) and the introns between them collapsed to fixed narrow gaps.
 *
 * A position off the exon structure, i.e. in a collapsed intron or outside the gene, has no
 * px of its own and maps to the start of the exon after it, which is also where a px of the
 * gap it sits in maps back to; so a dragged range snaps to exon boundaries and an off-exon
 * position stays put through a round trip. The range stays genomic, so it still covers the
 * introns its ends span over: for a rna fusion nothing breaks there, and an event that did
 * would be matched by the range but drawn at an exon edge.
 *
 * Falls back to makeLinearScale() for a gene with no isoform, e.g. a fusion partner that is
 * an unannotated locus, as there is no exon structure to lay its breakpoints over.
 */
export function makeExonScale(arg: ScaleArg): LinearScale {
	const { chr, gms, pxwidth } = arg
	const [allrg] = allgm2sum(gms.filter(gm => gm.chr == chr))
	if (!allrg.length) return makeLinearScale(arg)
	// zoom to the exons the breakpoints fall on, when there is enough width to win by it
	const rglst = focusRegions(allrg, arg.markers, arg.range)
	const zoomed = rglst.length < allrg.length
	// rglst is in display order, 5' to 3', so a minus strand gene runs right to left
	const reverse = !!rglst[0].reverse
	const gaps = rglst.length - 1
	// a gap is a fixed 10px, narrowed for a gene of many exons so that the gaps together
	// cannot take more than 40% of the width from the exons
	const intronpx = gaps ? Math.min(10, (pxwidth * 0.4) / gaps) : 0
	const exonlen = rglst.reduce((n, r) => n + r.stop - r.start, 0)
	const exonsf = (pxwidth - intronpx * gaps) / exonlen
	/* x of the left edge of each region, accumulated exactly as sketchGmsum() advances over
	rglst, so that a mark and the sketch below it land on the same px. NOTE the widths are
	kept unrounded for that reason */
	const offsets: number[] = []
	let x = 0
	for (const r of rglst) {
		r.width = (r.stop - r.start) * exonsf
		offsets.push(x)
		x += r.width + intronpx
	}
	const start = Math.min(...rglst.map(r => r.start))
	const stop = Math.max(...rglst.map(r => r.stop))
	// regions in ascending position, to find the one a position falls in or before
	const byPos = rglst.map((r, i) => ({ r, offset: offsets[i] })).sort((a, b) => a.r.start - b.r.start)
	return {
		chr,
		mode: 'rna',
		zoomed,
		start,
		stop,
		reverse,
		pxwidth,
		exonsf,
		rglst,
		intronpx,
		pos2px: (pos: number) => {
			const p = Math.max(start, Math.min(stop, pos))
			for (const { r, offset } of byPos) {
				if (p > r.stop) continue
				// within this exon, or in the intron before it, which has no px of its own
				const q = Math.max(p, r.start)
				return offset + (reverse ? r.stop - q : q - r.start) * exonsf
			}
			// unreachable, as p is clamped to the last stop
			return pxwidth
		},
		px2pos: (px: number) => {
			const x = Math.max(0, Math.min(pxwidth, px))
			for (const [i, r] of rglst.entries()) {
				if (x > offsets[i] + r.width!) continue
				// within this exon, or in the gap before it, which maps to its leading edge
				const within = Math.max(0, x - offsets[i]) / exonsf
				return Math.round(reverse ? r.stop - within : r.start + within)
			}
			const last = rglst[rglst.length - 1]
			return reverse ? last.start : last.stop
		}
	}
}

/** color of a selected range and of the breakpoints falling within it */
const selectColor = '#1e6edc'
/** color of a breakpoint mark or link with no range to be in or out of */
const markColor = '#5A5A5A'
/** color of a breakpoint excluded by the range on its own gene */
const outColor = '#b0b0b0'
/** color of a breakpoint excluded by the range on the other gene of a pair. lighter than
 * outColor, as it fails a constraint that is not editable in this component */
const otherOutColor = '#d6d6d6'
/** color of a hovered link, the same highlight as the default isoform label */
const hoverColor = '#cc0000'

/** direction breakpoint marks grow in from their baseline: 'up' for a track whose isoform
 * sketches are below the marks, 'down' for one whose sketches are above them */
type MarkDirection = 'up' | 'down'

/** draw the breakpoint marks of one gene, their height scaled by sample count */
function renderBreakpointMarks(a: {
	canvas: HTMLCanvasElement
	markers: BreakpointMarker[]
	scale: LinearScale
	pxwidth: number
	height: number
	direction: MarkDirection
	/** color of each mark, defaults to markColor */
	getColor?: (m: BreakpointMarker) => string
}) {
	const { canvas, markers, scale, pxwidth, height, direction } = a
	const ctx = setupCanvas(canvas, pxwidth, height)
	// baseline the marks stand on, at the level of the isoform sketches beside them
	const baseY = direction == 'up' ? height - 0.5 : 0.5
	ctx.strokeStyle = '#ccc'
	ctx.beginPath()
	ctx.moveTo(0, baseY)
	ctx.lineTo(pxwidth, baseY)
	ctx.stroke()
	if (!markers.length) return
	const maxCount = Math.max(...markers.map(m => m.samplecount || 1))
	for (const m of markers) {
		// sqrt scale, so that a few high-count breakpoints do not flatten the rest
		const h = 5 + (height - 8) * Math.sqrt((m.samplecount || 1) / maxCount)
		const x = Math.round(scale.pos2px(m.pos)) + 0.5
		const y0 = direction == 'up' ? height - 1 : 1
		ctx.strokeStyle = a.getColor ? a.getColor(m) : markColor
		ctx.beginPath()
		ctx.moveTo(x, y0)
		ctx.lineTo(x, direction == 'up' ? y0 - h : y0 + h)
		ctx.stroke()
	}
}

/** one row per isoform, its name in the label column and its exon structure sketched
 * over the scale in the graph column */
function renderIsoformRows(a: {
	labelCol: Div
	graphCol: Div
	gms: GeneModel[]
	scale: LinearScale
	pxwidth: number
	rowHeight: number
}) {
	for (const gm of visibleGms(a.gms, a.scale)) {
		a.labelCol
			.append('div')
			.style('height', a.rowHeight + 'px')
			.style('overflow', 'hidden')
			.style('white-space', 'nowrap')
			.style('font-size', '.8em')
			.style('color', gm.isdefault ? hoverColor : '#545454')
			.attr('title', gm.isoform)
			.text(gm.isoform)
		const row = a.graphCol.append('div').style('height', a.rowHeight + 'px')
		// the same intron width the scale accumulates its regions with, or the sketch would
		// not line up with the marks and links placed over it
		sketchGmsum(row, a.scale.rglst, gm, a.scale.exonsf, a.scale.intronpx, a.pxwidth, a.rowHeight - 2, exoncolor, {
			// a zoomed layout gives an exon box the room for its number; an unzoomed one
			// of a many-exon gene does not, and none is drawn
			exonNumbers: true
		})
	}
}

/** the isoforms with something to draw over the scale. one lying outside a zoomed window
 * has no exon and no backbone within it, so it would take a row to render nothing */
function visibleGms(gms: GeneModel[], scale: LinearScale) {
	return gms.filter(gm => gm.stop >= scale.start && gm.start <= scale.stop)
}

/** drag over an element to select a range of px on it, reported as [x0, x1] of that element */
function attachRangeDrag(sel: any, pxwidth: number, onDrag: (x0: number, x1: number) => void) {
	const clampPx = (px: number) => Math.max(0, Math.min(pxwidth, px))
	sel.on('mousedown', (event: MouseEvent) => {
		event.preventDefault()
		const rect = (sel.node() as HTMLElement).getBoundingClientRect()
		const x0 = clampPx(event.clientX - rect.left)
		// listening on window so that a drag continuing outside the element still tracks
		const onMove = (e: MouseEvent) => {
			const x1 = clampPx(e.clientX - rect.left)
			// below this the pointer has not really moved, e.g. the jitter of a click,
			// which must not select a zero width range
			if (Math.abs(x1 - x0) < 2) return
			onDrag(x0, x1)
		}
		const onUp = () => {
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('mouseup', onUp)
		}
		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onUp)
	})
}

/** coordinate inputs of the selected range, an exact way to place it that a drag cannot
 * give, with the buttons to apply and clear it */
function renderRangeControls(a: {
	holder: Div
	chr: string
	/** a range typed into the inputs, sorted by position; undefined when an input was
	 * emptied or is unparsable, which restores the displayed range */
	onTyped: (r: { start: number; stop: number } | undefined) => void
	onApply: () => void
	onClear: () => void
}) {
	const controlDiv = a.holder.append('div').style('margin-top', '6px').style('font-size', '.8em')
	controlDiv
		.append('span')
		.style('opacity', 0.7)
		.text(a.chr + ':')
	const startInput = addPosInput()
	controlDiv.append('span').style('opacity', 0.7).text('-')
	const stopInput = addPosInput()
	const applyBtn = controlDiv
		.append('button')
		.attr('data-testid', 'sjpp-isoformRangeSelect-apply')
		.style('margin-left', '8px')
		.text('Apply')
		.on('click', a.onApply)
	const clearBtn = controlDiv
		.append('button')
		.attr('data-testid', 'sjpp-isoformRangeSelect-clear')
		.style('margin-left', '5px')
		.text('Clear')
		.on('click', a.onClear)

	return {
		/** show the given range on the inputs, and enable the buttons only when there is one */
		update(range: { start: number; stop: number } | null) {
			startInput.property('value', range ? range.start : '')
			stopInput.property('value', range ? range.stop : '')
			applyBtn.property('disabled', !range)
			clearBtn.property('disabled', !range)
		}
	}

	function addPosInput() {
		return controlDiv
			.append('input')
			.attr('type', 'number')
			.attr('data-testid', 'sjpp-isoformRangeSelect-pos')
			.style('width', '85px')
			.style('margin', '0 3px')
			.on('change', () => {
				/* a number input reports an emptied field, and one holding something it cannot
				parse, as the empty string. NOTE test the raw strings rather than what they
				convert to: Number('') is 0, a finite value that would be taken as a typed
				coordinate and clamp the range to the start of the scale, so clearing an input
				to retype it silently widened the range instead of restoring it */
				const startText = String(startInput.property('value')).trim()
				const stopText = String(stopInput.property('value')).trim()
				const start = Number(startText)
				const stop = Number(stopText)
				if (!startText || !stopText || !Number.isFinite(start) || !Number.isFinite(stop)) {
					a.onTyped(undefined)
					return
				}
				a.onTyped({ start: Math.min(start, stop), stop: Math.max(start, stop) })
			})
	}
}

/**
 * Mark breakpoints over the isoform structure of a gene and select a genomic range of them.
 *
 * Renders a canvas of breakpoint marks on top of the isoform models, all on one linear
 * scale (see makeScale, laid out per opts.mode), and allows dragging a range over them. The range may also
 * be typed in, as a drag over a gene of a hundred kb is too coarse to place a cluster
 * boundary. Calls callback(range) on apply and callback(null) when the range is cleared.
 *
 * Only the isoforms a breakpoint can fall on are drawn (see breakpointGms), as in the paired
 * chart below.
 *
 * Used by variantConfig.ts to restrict a sv/fusion tvs to breakpoints of a range, e.g. to
 * select the cases of only one of the two BCR breakpoint clusters of BCR::ABL1.
 */
export function isoformRangeSelect(opts: IsoformRangeSelectOpts) {
	const { holder, chr, callback } = opts
	const pxwidth = opts.pxwidth ?? 400
	const labelWidth = opts.labelWidth ?? 110
	const rowHeight = 18
	const markerHeight = 40

	const markers = (opts.markers || []).filter(m => Number.isFinite(m.pos))
	const allgm = opts.allgm.filter(gm => gm.chr == chr && !gm.hidden)
	// only the isoforms a breakpoint can fall on, picked before the scale so that the layout
	// follows them alone (see breakpointGms)
	const gms = breakpointGms(allgm, markers, opts.range)
	if (!gms.length && !markers.length) {
		holder.append('div').style('opacity', 0.6).text('No gene model or breakpoint to display')
		return
	}
	// the range is passed so that a zoomed window cannot leave it out (see focusRegions)
	const scale = makeScale({ chr, gms, markers, pxwidth, mode: opts.mode, range: opts.range })

	// current selection, kept in genomic coordinates so that it survives a re-render
	let range: { start: number; stop: number } | null = opts.range
		? { start: opts.range.start, stop: opts.range.stop }
		: null

	// readout of the hovered mark, or of the current selection when not hovering
	const infoDiv = holder
		.append('div')
		.attr('data-testid', 'sjpp-isoformRangeSelect-info')
		.style('font-size', '.8em')
		.style('opacity', 0.7)
		.style('margin-bottom', '3px')
		.style('height', '1.2em')

	const flexDiv = holder.append('div').style('display', 'flex')
	const labelCol = flexDiv
		.append('div')
		.style('width', labelWidth + 'px')
		.style('flex', '0 0 auto')
	const graphCol = flexDiv
		.append('div')
		.style('position', 'relative')
		.style('width', pxwidth + 'px')

	/* label cell beside the marks, keeping the isoform names aligned with their sketches. it
	names the locus when only a window of the gene is drawn, so that the view is not taken
	for the whole gene */
	const locusCell = labelCol
		.append('div')
		.attr('data-testid', 'sjpp-isoformRangeSelect-locus')
		.style('height', markerHeight + 'px')
		.style('display', 'flex')
		.style('align-items', 'flex-end')
	if (scale.zoomed) {
		locusCell
			.append('div')
			.style('font-size', '.7em')
			.style('opacity', 0.6)
			.style('overflow', 'hidden')
			.style('white-space', 'nowrap')
			.attr('title', `${chr}:${scale.start.toLocaleString()}-${scale.stop.toLocaleString()}`)
			.text(locusLabel(chr, scale.start, scale.stop))
	}

	/* the marks and the isoform sketches under them are one track, and a range is dragged
	over the whole of it: the highlight spans it, so anything less would leave part of what
	the drag selects looking inert */
	const track = graphCol
		.append('div')
		.attr('data-testid', 'sjpp-isoformRangeSelect-track')
		.attr('data-scale-mode', scale.mode)
		.style('cursor', 'crosshair')
	const markerCanvas = track
		.append('canvas')
		.attr('data-testid', 'sjpp-isoformRangeSelect-marks')
		.style('display', 'block')
	renderBreakpointMarks({
		canvas: markerCanvas.node() as HTMLCanvasElement,
		markers,
		scale,
		pxwidth,
		height: markerHeight,
		// the isoform sketches are below the marks, so the marks stand on them
		direction: 'up'
	})

	renderIsoformRows({ labelCol, graphCol: track, gms, scale, pxwidth, rowHeight })

	// highlight of the selected range, spanning the marks and all isoform sketches
	const overlay = graphCol
		.append('div')
		.attr('data-testid', 'sjpp-isoformRangeSelect-overlay')
		.style('position', 'absolute')
		.style('top', 0)
		.style('bottom', 0)
		.style('background', 'rgba(30,110,220,.18)')
		.style('border-left', `1px solid ${selectColor}`)
		.style('border-right', `1px solid ${selectColor}`)
		.style('pointer-events', 'none')
		.style('display', 'none')

	const controls = renderRangeControls({
		holder,
		chr,
		onTyped: r => setRange(r || range),
		onApply: () => {
			if (!range) return
			callback({ chr, start: range.start, stop: range.stop })
		},
		onClear: () => {
			setRange(null)
			callback(null)
		}
	})

	// drag anywhere over the track, marks or isoforms alike, to select a range
	attachRangeDrag(track, pxwidth, (x0, x1) => setRangeFromPx(x0, x1))

	markerCanvas.on('mousemove', (event: MouseEvent) => {
		const rect = (markerCanvas.node() as HTMLCanvasElement).getBoundingClientRect()
		const x = event.clientX - rect.left
		const hovered = markers.find(m => Math.abs(scale.pos2px(m.pos) - x) <= 3)
		if (hovered) {
			const count = hovered.samplecount
			infoDiv.text(`${chr}:${hovered.pos.toLocaleString()}${count ? ` · ${sampleLabel(count)}` : ''}`)
		} else {
			updateInfo()
		}
	})
	markerCanvas.on('mouseleave', () => updateInfo())

	setRange(range)

	return {
		scale,
		getRange: () => (range ? { chr, start: range.start, stop: range.stop } : null),
		setRange: (r: SelectedRange | null) => setRange(r)
	}

	function setRangeFromPx(x0: number, x1: number) {
		const a = scale.px2pos(x0)
		const b = scale.px2pos(x1)
		// on the minus strand the left px is the higher position, so sort by position
		setRange({ start: Math.min(a, b), stop: Math.max(a, b) })
	}

	function setRange(r: { start: number; stop: number } | null) {
		range = r ? { start: Math.max(scale.start, r.start), stop: Math.min(scale.stop, r.stop) } : null
		if (range) {
			const x0 = scale.pos2px(range.start)
			const x1 = scale.pos2px(range.stop)
			overlay
				.style('display', '')
				.style('left', Math.min(x0, x1) + 'px')
				.style('width', Math.max(1, Math.abs(x1 - x0)) + 'px')
		} else {
			overlay.style('display', 'none')
		}
		controls.update(range)
		updateInfo()
	}

	function updateInfo() {
		if (!range) {
			infoDiv.text(`${markers.length} breakpoints, drag to select a range`)
			return
		}
		const inRange = markers.filter(m => m.pos >= range!.start && m.pos <= range!.stop)
		const samples = inRange.reduce((n, m) => n + (m.samplecount || 0), 0)
		infoDiv.text(
			`${chr}:${range.start.toLocaleString()}-${range.stop.toLocaleString()} · ` +
				`${inRange.length} of ${markers.length} breakpoints` +
				(samples ? `, ${sampleLabel(samples)}` : '')
		)
	}

	/** a count of samples, said as an upper bound when the caller declares that the tally it
	 * was summed from may hold one sample more than once (see opts.samplesAreUpperBound) */
	function sampleLabel(n: number) {
		return opts.samplesAreUpperBound ? `up to ${n} samples` : `${n} samples`
	}
}

/**
 * Chart the paired breakpoints of sv/fusion events over both genes they join, and select
 * a genomic range on the partner gene.
 *
 * The two genes are stacked as parallel tracks, each on its own scale of its own
 * chr (see makeScale, laid out per opts.mode), with a line between the two breakpoints of every distinct
 * event: the term's own gene above, the partner below. The strength of a line is its
 * sample count, so that a recurrent breakpoint pair, e.g. the major BCR::ABL1 junction,
 * reads at a glance. Which breakpoint of one gene goes with which of the other is lost by
 * charting either gene alone (see isoformRangeSelect), and is what this view recovers.
 *
 * Only the range on the partner gene is selected here, by dragging over its marks, typing
 * coordinates, or clicking a link to take its breakpoint. The range on the term's own gene
 * is owned by a separate control that applies term-wide (see variantConfig.ts), so it is
 * shown as context only: it is highlighted, and the links failing it are dimmed, as those
 * events cannot match however the partner range is placed.
 *
 * Returns undefined, having said so in the holder, when neither track can be scaled.
 */
export function isoformPairRangeSelect(opts: IsoformPairRangeSelectOpts) {
	const { holder, self, partner, callback } = opts
	const pxwidth = opts.pxwidth ?? 400
	const labelWidth = opts.labelWidth ?? 110
	const rowHeight = 18
	// breathing room between the link band and the isoform sketches it runs to
	const trackGap = 10
	const linkHeight = 70

	// a pair missing a coordinate on either side cannot be drawn as a link
	const links = opts.links.filter(l => Number.isFinite(l.selfPos) && Number.isFinite(l.partnerPos))
	/* marks of a track are the distinct breakpoints of its gene, summing the samples of
	every pair converging on the same position. NOTE that sums a sample with two events at
	one position, to different breakpoints of the other gene, once per event */
	const selfMarks = collapseMarks(l => l.selfPos)
	const partnerMarks = collapseMarks(l => l.partnerPos)
	/* the isoforms of each gene the breakpoints of that gene can fall on, picked before the
	scales so that the layout of a track follows them alone (see breakpointGms). both genes
	are filtered the same way: a fusion partner is the term's own gene of the other end */
	const selfGms = breakpointGms(
		self.allgm.filter(gm => gm.chr == self.chr && !gm.hidden),
		selfMarks,
		self.range
	)
	const partnerGms = breakpointGms(
		partner.allgm.filter(gm => gm.chr == partner.chr && !gm.hidden),
		partnerMarks,
		partner.range
	)
	if (!links.length && (!selfGms.length || !partnerGms.length)) {
		// without links, a track holds only its isoform sketches, and one of them has none
		holder.append('div').style('opacity', 0.6).text('No gene model or breakpoint to display')
		return
	}
	// both genes are of the same events, so they are laid out the same way. each range is
	// passed so that a zoomed window of its gene cannot leave it out (see focusRegions)
	const selfScale = makeScale({
		chr: self.chr,
		gms: selfGms,
		markers: selfMarks,
		pxwidth,
		mode: opts.mode,
		range: self.range
	})
	const partnerScale = makeScale({
		chr: partner.chr,
		gms: partnerGms,
		markers: partnerMarks,
		pxwidth,
		mode: opts.mode,
		range: partner.range
	})
	const maxCount = Math.max(...links.map(l => l.samplecount || 1), 1)

	// current selection on the partner gene, kept in genomic coordinates
	let range: { start: number; stop: number } | null = partner.range
		? { start: partner.range.start, stop: partner.range.stop }
		: null
	// link under the pointer, highlighted and read out while it is
	let hoveredLink: BreakpointLink | undefined

	// readout of the hovered link, or of the current selection when not hovering
	const infoDiv = holder
		.append('div')
		.attr('data-testid', 'sjpp-isoformPairSelect-info')
		.style('font-size', '.8em')
		.style('opacity', 0.7)
		.style('margin-bottom', '3px')
		/* room for two lines, as a readout naming both genes may wrap: with the height
		following the text, the chart would shift under the pointer on hovering a link */
		.style('height', '2.4em')
		.style('overflow', 'hidden')

	const flexDiv = holder.append('div').style('display', 'flex')
	const labelCol = flexDiv
		.append('div')
		.style('width', labelWidth + 'px')
		.style('flex', '0 0 auto')
	const graphCol = flexDiv
		.append('div')
		.style('position', 'relative')
		.style('width', pxwidth + 'px')

	/* the two genes, joined by the band of links. NOTE no strip of breakpoint marks between
	a gene and the band: the links already converge on each breakpoint, so marks would draw
	the same positions twice over and cost the chart the height of two more rows */
	// the isoforms each track actually renders, which a zoomed window may narrow
	const selfRows = visibleGms(selfGms, selfScale)
	const partnerRows = visibleGms(partnerGms, partnerScale)
	const selfTrack = graphCol
		.append('div')
		.attr('data-testid', 'sjpp-isoformPairSelect-selfTrack')
		.attr('data-scale-mode', selfScale.mode)
	renderIsoformRows({ labelCol, graphCol: selfTrack, gms: selfRows, scale: selfScale, pxwidth, rowHeight })
	// breathing room either side of the band, so that the links do not run into the exon
	// boxes they lead to, and so that a track of one isoform is still a fair drag target
	selfTrack.append('div').style('height', trackGap + 'px')
	labelCol.append('div').style('height', trackGap + 'px')

	/* the gene names sit either side of the link band, each next to its own track. one label
	cell holds both, so that they stay level with the band however tall it is */
	const geneLabels = labelCol
		.append('div')
		.style('height', linkHeight + 'px')
		.style('display', 'flex')
		.style('flex-direction', 'column')
		.style('justify-content', 'space-between')
	addGeneLabel(geneLabels, self.gene, selfScale)
	addGeneLabel(geneLabels, partner.gene, partnerScale)
	const linkCanvas = graphCol
		.append('canvas')
		.attr('data-testid', 'sjpp-isoformPairSelect-links')
		.style('display', 'block')

	/* the range is dragged over the whole of the partner track, isoform sketches included:
	its highlight spans them, and with no strip of marks to drag over they are all there is */
	const partnerTrack = graphCol
		.append('div')
		.attr('data-testid', 'sjpp-isoformPairSelect-partnerTrack')
		.attr('data-scale-mode', partnerScale.mode)
		.style('cursor', 'crosshair')
	partnerTrack.append('div').style('height', trackGap + 'px')
	labelCol.append('div').style('height', trackGap + 'px')
	renderIsoformRows({ labelCol, graphCol: partnerTrack, gms: partnerRows, scale: partnerScale, pxwidth, rowHeight })

	// vertical extent of each track within the graph column, to place the highlights over
	const selfHeight = selfRows.length * rowHeight + trackGap
	const partnerTop = selfHeight + linkHeight
	const partnerHeight = trackGap + partnerRows.length * rowHeight

	/* the range on the term's own gene, shown as context. it is not editable here, so it
	is drawn muted and dashed, to read differently from the selection below */
	if (self.range) {
		const overlay = graphCol
			.append('div')
			.attr('data-testid', 'sjpp-isoformPairSelect-selfOverlay')
			.style('position', 'absolute')
			.style('top', 0)
			.style('height', selfHeight + 'px')
			.style('background', 'rgba(120,120,120,.14)')
			.style('border-left', '1px dashed #999')
			.style('border-right', '1px dashed #999')
			.style('pointer-events', 'none')
		const x0 = selfScale.pos2px(Math.max(selfScale.start, self.range.start))
		const x1 = selfScale.pos2px(Math.min(selfScale.stop, self.range.stop))
		overlay.style('left', Math.min(x0, x1) + 'px').style('width', Math.max(1, Math.abs(x1 - x0)) + 'px')
	}

	// highlight of the selected range, spanning the marks and sketches of the partner only
	const overlay = graphCol
		.append('div')
		.attr('data-testid', 'sjpp-isoformPairSelect-overlay')
		.style('position', 'absolute')
		.style('top', partnerTop + 'px')
		.style('height', partnerHeight + 'px')
		.style('background', 'rgba(30,110,220,.18)')
		.style('border-left', `1px solid ${selectColor}`)
		.style('border-right', `1px solid ${selectColor}`)
		.style('pointer-events', 'none')
		.style('display', 'none')

	const controls = renderRangeControls({
		holder,
		chr: partner.chr,
		onTyped: r => setRange(r || range),
		onApply: () => {
			if (!range) return
			callback({ chr: partner.chr, start: range.start, stop: range.stop })
		},
		onClear: () => {
			setRange(null)
			callback(null)
		}
	})

	// drag anywhere over the partner track, isoform sketches included, to select a range
	attachRangeDrag(partnerTrack, pxwidth, (x0, x1) => {
		const a = partnerScale.px2pos(x0)
		const b = partnerScale.px2pos(x1)
		// on the minus strand the left px is the higher position, so sort by position
		setRange({ start: Math.min(a, b), stop: Math.max(a, b) })
	})

	partnerTrack.on('mousemove', (event: MouseEvent) => {
		const rect = (partnerTrack.node() as HTMLElement).getBoundingClientRect()
		const x = event.clientX - rect.left
		// the breakpoints of the gene, which the links converging on them stand for
		const hovered = partnerMarks.find(m => Math.abs(partnerScale.pos2px(m.pos) - x) <= 3)
		if (hovered) {
			infoDiv.text(
				`${partner.gene} ${partner.chr}:${hovered.pos.toLocaleString()}` +
					(hovered.samplecount ? ` · ${sampleLabel(hovered.samplecount)}` : '')
			)
		} else {
			updateInfo()
		}
	})
	partnerTrack.on('mouseleave', () => updateInfo())

	// a link is the finest selection there is, so clicking one takes its breakpoint as the
	// range; the bounds are inclusive, so a range of one position matches that breakpoint
	linkCanvas.on('click', () => {
		if (hoveredLink) setRange({ start: hoveredLink.partnerPos, stop: hoveredLink.partnerPos })
	})
	linkCanvas.on('mousemove', (event: MouseEvent) => {
		const rect = (linkCanvas.node() as HTMLCanvasElement).getBoundingClientRect()
		const hovered = findLink(event.clientX - rect.left, event.clientY - rect.top)
		if (hovered != hoveredLink) {
			hoveredLink = hovered
			linkCanvas.style('cursor', hovered ? 'pointer' : 'default')
			render()
		}
		if (hovered) infoDiv.text(linkLabel(hovered))
		else updateInfo()
	})
	linkCanvas.on('mouseleave', () => {
		if (hoveredLink) {
			hoveredLink = undefined
			render()
		}
		updateInfo()
	})

	setRange(range)

	return {
		selfScale,
		partnerScale,
		getRange: () => (range ? { chr: partner.chr, start: range.start, stop: range.stop } : null),
		setRange: (r: SelectedRange | null) => setRange(r)
	}

	function collapseMarks(get: (l: BreakpointLink) => number): BreakpointMarker[] {
		const byPos = new Map<number, number>()
		for (const l of links) {
			const pos = get(l)
			byPos.set(pos, (byPos.get(pos) || 0) + (l.samplecount || 0))
		}
		return [...byPos].map(([pos, samplecount]) => ({ pos, samplecount }))
	}

	/** name and locus of one gene, beside the end of the link band that runs to its track */
	function addGeneLabel(holder: Div, gene: string, scale: LinearScale) {
		const div = holder.append('div')
		div
			.append('div')
			.style('font-size', '.8em')
			.style('font-weight', 'bold')
			.style('overflow', 'hidden')
			.style('white-space', 'nowrap')
			.attr('title', gene)
			.text(gene)
		/* the locus when only a window of the gene is drawn, so that the view is not taken
		for the whole gene; the chr alone when it is */
		div
			.append('div')
			.attr('data-testid', 'sjpp-isoformPairSelect-locus')
			.style('font-size', '.7em')
			.style('opacity', 0.6)
			.style('overflow', 'hidden')
			.style('white-space', 'nowrap')
			.attr('title', `${scale.chr}:${scale.start.toLocaleString()}-${scale.stop.toLocaleString()}`)
			.text(scale.zoomed ? locusLabel(scale.chr, scale.start, scale.stop) : scale.chr)
	}

	function inPartnerRange(l: BreakpointLink) {
		return !range || (l.partnerPos >= range.start && l.partnerPos <= range.stop)
	}

	function inSelfRange(l: BreakpointLink) {
		return !self.range || (l.selfPos >= self.range.start && l.selfPos <= self.range.stop)
	}

	function linkColor(l: BreakpointLink) {
		if (!inSelfRange(l)) return otherOutColor
		if (!range) return markColor
		return inPartnerRange(l) ? selectColor : outColor
	}

	/** nearest link within a few px of the point, in the coordinates of the link canvas */
	function findLink(x: number, y: number) {
		let best: BreakpointLink | undefined
		let bestDist = 4
		for (const l of links) {
			const d = distToSegment(x, y, selfScale.pos2px(l.selfPos), 0, partnerScale.pos2px(l.partnerPos), linkHeight)
			if (d < bestDist) {
				bestDist = d
				best = l
			}
		}
		return best
	}

	function linkLabel(l: BreakpointLink) {
		return (
			`${self.gene} ${self.chr}:${l.selfPos.toLocaleString()} → ` +
			`${partner.gene} ${partner.chr}:${l.partnerPos.toLocaleString()}` +
			(l.samplecount ? ` · ${l.samplecount} samples` : '') +
			(inSelfRange(l) ? '' : `, outside the ${self.gene} range`)
		)
	}

	function setRange(r: { start: number; stop: number } | null) {
		range = r ? { start: Math.max(partnerScale.start, r.start), stop: Math.min(partnerScale.stop, r.stop) } : null
		if (range) {
			const x0 = partnerScale.pos2px(range.start)
			const x1 = partnerScale.pos2px(range.stop)
			overlay
				.style('display', '')
				.style('left', Math.min(x0, x1) + 'px')
				.style('width', Math.max(1, Math.abs(x1 - x0)) + 'px')
		} else {
			overlay.style('display', 'none')
		}
		controls.update(range)
		render()
		updateInfo()
	}

	function updateInfo() {
		if (!range) {
			infoDiv.text(`${links.length} breakpoint pairs · drag over ${partner.gene}, or click a link, to select a range`)
			return
		}
		const inRange = links.filter(inPartnerRange)
		const reachable = inRange.filter(inSelfRange)
		const samples = reachable.reduce((n, l) => n + (l.samplecount || 0), 0)
		infoDiv.text(
			`${partner.chr}:${range.start.toLocaleString()}-${range.stop.toLocaleString()} · ` +
				`${inRange.length} of ${links.length} breakpoint pairs` +
				// the two ranges are applied together, so say when this one is not what narrows
				(reachable.length == inRange.length ? '' : `, ${reachable.length} within the ${self.gene} range`) +
				(samples ? `, ${sampleLabel(samples)}` : '')
		)
	}

	/** a count of samples, said as an upper bound when the caller declares that the tally it
	 * was summed from may hold one sample more than once (see opts.samplesAreUpperBound). a
	 * single link is one pair of breakpoints, so its own count is exact either way */
	function sampleLabel(n: number) {
		return opts.samplesAreUpperBound ? `up to ${n} samples` : `${n} samples`
	}

	/** redraw the links against the current selection */
	function render() {
		renderLinks()
	}

	function renderLinks() {
		const ctx = setupCanvas(linkCanvas.node() as HTMLCanvasElement, pxwidth, linkHeight)
		// draw the faint links first, so that a recurrent pair is not buried under the rest
		const sorted = [...links].sort((a, b) => (a.samplecount || 1) - (b.samplecount || 1))
		for (const l of sorted) {
			if (l != hoveredLink) drawLink(ctx, l, linkColor(l))
		}
		// the hovered link is drawn last, so that it reads over the ones crossing it
		if (hoveredLink) drawLink(ctx, hoveredLink, hoverColor)
	}

	function drawLink(ctx: CanvasRenderingContext2D, l: BreakpointLink, color: string) {
		// sqrt scale, as for the mark heights, so that a few frequent pairs do not flatten
		// the rest into hairlines
		const strength = Math.sqrt((l.samplecount || 1) / maxCount)
		ctx.strokeStyle = color
		ctx.lineWidth = 0.75 + 3.25 * strength
		/* the width alone carries the sample count: fading a link by its count as well
		would make an infrequent pair that is still reachable look like an excluded one,
		which is what the color says. slightly transparent, so that crossings are legible */
		ctx.globalAlpha = l == hoveredLink ? 1 : 0.85
		ctx.beginPath()
		ctx.moveTo(selfScale.pos2px(l.selfPos), 0)
		ctx.lineTo(partnerScale.pos2px(l.partnerPos), linkHeight)
		ctx.stroke()
		ctx.globalAlpha = 1
	}
}

/** distance from a point to a line segment, to hit test the links */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
	const dx = x2 - x1
	const dy = y2 - y1
	const len2 = dx * dx + dy * dy
	// fraction along the segment of the point nearest to (px,py), clamped to its ends
	const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0
	return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
