import { sketchGmsum, sketchProtein } from './sketchGm'
import { exoncolor } from '#shared/common.js'
import type { GeneModel, ExonRegion, IsoformSelectOpts } from './types/isoformSelect'
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
.submitLabel       text for the submit button (multi-select only, default "Submit")
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
			.text(opts.submitLabel || 'Submit')
			.style('margin-top', '8px')
			.style('cursor', 'pointer')
			.on('click', () => {
				const selected = allgm.filter(gm => checkedSet.has(gm.isoform))
				if (selected.length > 0) opts.onMultiSelect!(selected)
			})
		updateSubmitBtn()
	}

	function updateSubmitBtn() {
		const label = multiSelect ? opts.submitLabel || 'Submit' : 'Submit'
		submitBtn.property('disabled', checkedSet.size === 0).text(`${label} (${checkedSet.size})`)
	}
}
