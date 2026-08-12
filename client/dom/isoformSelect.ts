import { sketchGmsum, sketchProtein, setupCanvas } from './sketchGm'
import { exoncolor } from '#shared/common.js'
import type {
	GeneModel,
	ExonRegion,
	IsoformSelectOpts,
	IsoformRangeSelectOpts,
	LinearScale,
	SelectedRange
} from './types/isoformSelect'
import type { Td } from '../types/d3'

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
marks breakpoints over the isoform structure and selects a genomic range of them.

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

/**
 * Linear genomic scale over a chr region covering the gene models and markers, padded.
 *
 * Deliberately not the exon-collapsed layout of allgm2sum(): sv/fusion breakpoints are
 * mostly intronic (e.g. the two BCR breakpoint clusters of BCR::ABL1 sit in introns), so
 * a collapsed intron would squeeze them into a few px and make a dragged range
 * unmappable back to a genomic coordinate.
 */
export function makeLinearScale(arg: {
	chr: string
	gms: GeneModel[]
	markers?: { pos: number }[]
	pxwidth: number
}): LinearScale {
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
		start,
		stop,
		reverse,
		pxwidth,
		exonsf,
		rglst,
		pos2px: (pos: number) => (reverse ? stop - pos : pos - start) * exonsf,
		px2pos: (px: number) => {
			const pos = Math.round(reverse ? stop - px / exonsf : start + px / exonsf)
			return Math.max(start, Math.min(stop, pos))
		}
	}
}

/**
 * Mark breakpoints over the isoform structure of a gene and select a genomic range of them.
 *
 * Renders a canvas of breakpoint marks on top of the isoform models, all on one linear
 * scale (see makeLinearScale), and allows dragging a range over them. The range may also
 * be typed in, as a drag over a gene of a hundred kb is too coarse to place a cluster
 * boundary. Calls callback(range) on apply and callback(null) when the range is cleared.
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

	const gms = opts.allgm.filter(gm => gm.chr == chr && !gm.hidden)
	const markers = (opts.markers || []).filter(m => Number.isFinite(m.pos))
	if (!gms.length && !markers.length) {
		holder.append('div').style('opacity', 0.6).text('No gene model or breakpoint to display')
		return
	}
	const scale = makeLinearScale({ chr, gms, markers, pxwidth })

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

	// blank label cell to keep the isoform names aligned with their sketches
	labelCol.append('div').style('height', markerHeight + 'px')

	const markerCanvas = graphCol
		.append('canvas')
		.attr('data-testid', 'sjpp-isoformRangeSelect-marks')
		.style('display', 'block')
		.style('cursor', 'crosshair')
	renderMarks()

	for (const gm of gms) {
		labelCol
			.append('div')
			.style('height', rowHeight + 'px')
			.style('overflow', 'hidden')
			.style('white-space', 'nowrap')
			.style('font-size', '.8em')
			.style('color', gm.isdefault ? '#cc0000' : '#545454')
			.attr('title', gm.isoform)
			.text(gm.isoform)
		const row = graphCol.append('div').style('height', rowHeight + 'px')
		sketchGmsum(row, scale.rglst, gm, scale.exonsf, 0, pxwidth, rowHeight - 2, exoncolor)
	}

	// highlight of the selected range, spanning the marks and all isoform sketches
	const overlay = graphCol
		.append('div')
		.attr('data-testid', 'sjpp-isoformRangeSelect-overlay')
		.style('position', 'absolute')
		.style('top', 0)
		.style('bottom', 0)
		.style('background', 'rgba(30,110,220,.18)')
		.style('border-left', '1px solid #1e6edc')
		.style('border-right', '1px solid #1e6edc')
		.style('pointer-events', 'none')
		.style('display', 'none')

	// coordinate inputs, an exact way to place a range that a drag cannot give
	const controlDiv = holder.append('div').style('margin-top', '6px').style('font-size', '.8em')
	controlDiv
		.append('span')
		.style('opacity', 0.7)
		.text(chr + ':')
	const startInput = addPosInput()
	controlDiv.append('span').style('opacity', 0.7).text('-')
	const stopInput = addPosInput()
	const applyBtn = controlDiv
		.append('button')
		.attr('data-testid', 'sjpp-isoformRangeSelect-apply')
		.style('margin-left', '8px')
		.text('Apply')
		.on('click', () => {
			if (!range) return
			callback({ chr, start: range.start, stop: range.stop })
		})
	const clearBtn = controlDiv
		.append('button')
		.attr('data-testid', 'sjpp-isoformRangeSelect-clear')
		.style('margin-left', '5px')
		.text('Clear')
		.on('click', () => {
			setRange(null)
			callback(null)
		})

	// drag over the marks to select a range
	markerCanvas.on('mousedown', (event: MouseEvent) => {
		event.preventDefault()
		const rect = (markerCanvas.node() as HTMLCanvasElement).getBoundingClientRect()
		const x0 = clampPx(event.clientX - rect.left)
		// listening on window so that a drag continuing outside the canvas still tracks
		const onMove = (e: MouseEvent) => {
			const x1 = clampPx(e.clientX - rect.left)
			// below this the pointer has not really moved, e.g. the jitter of a click,
			// which must not select a zero width range
			if (Math.abs(x1 - x0) < 2) return
			setRangeFromPx(x0, x1)
		}
		const onUp = () => {
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('mouseup', onUp)
		}
		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onUp)
	})

	markerCanvas.on('mousemove', (event: MouseEvent) => {
		const rect = (markerCanvas.node() as HTMLCanvasElement).getBoundingClientRect()
		const x = event.clientX - rect.left
		const hovered = markers.find(m => Math.abs(scale.pos2px(m.pos) - x) <= 3)
		if (hovered) {
			const count = hovered.samplecount
			infoDiv.text(`${chr}:${hovered.pos.toLocaleString()}${count ? ` · ${count} samples` : ''}`)
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

	function addPosInput() {
		return controlDiv
			.append('input')
			.attr('type', 'number')
			.attr('data-testid', 'sjpp-isoformRangeSelect-pos')
			.style('width', '85px')
			.style('margin', '0 3px')
			.on('change', () => {
				const start = Number(startInput.property('value'))
				const stop = Number(stopInput.property('value'))
				if (!Number.isFinite(start) || !Number.isFinite(stop)) {
					// an emptied or unparsable input, restore the displayed range
					setRange(range)
					return
				}
				setRange({ start: Math.min(start, stop), stop: Math.max(start, stop) })
			})
	}

	function clampPx(px: number) {
		return Math.max(0, Math.min(pxwidth, px))
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
			startInput.property('value', range.start)
			stopInput.property('value', range.stop)
		} else {
			overlay.style('display', 'none')
			startInput.property('value', '')
			stopInput.property('value', '')
		}
		applyBtn.property('disabled', !range)
		clearBtn.property('disabled', !range)
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
				(samples ? `, ${samples} samples` : '')
		)
	}

	function renderMarks() {
		const canvas = markerCanvas.node() as HTMLCanvasElement
		const ctx = setupCanvas(canvas, pxwidth, markerHeight)
		// baseline the marks stand on, at the level of the isoform sketches below
		ctx.strokeStyle = '#ccc'
		ctx.beginPath()
		ctx.moveTo(0, markerHeight - 0.5)
		ctx.lineTo(pxwidth, markerHeight - 0.5)
		ctx.stroke()
		if (!markers.length) return
		const maxCount = Math.max(...markers.map(m => m.samplecount || 1))
		ctx.strokeStyle = '#5A5A5A'
		for (const m of markers) {
			// sqrt scale, so that a few high-count breakpoints do not flatten the rest
			const h = 5 + (markerHeight - 8) * Math.sqrt((m.samplecount || 1) / maxCount)
			const x = Math.round(scale.pos2px(m.pos)) + 0.5
			ctx.beginPath()
			ctx.moveTo(x, markerHeight - 1)
			ctx.lineTo(x, markerHeight - 1 - h)
			ctx.stroke()
		}
	}
}
