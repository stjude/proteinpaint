import { sketchGmsum, sketchProtein } from '../src/client'
import { exoncolor } from '#shared/common.js'
import type { GeneModel, ExonRegion, IsoformSelectOpts } from './types/isoformSelect'
import type { Td } from '../types/d3'

/*
Standalone reusable component for displaying and selecting gene model isoforms.

Extracted from block.js showisoform4switch() to be reusable.

Supports single-select mode: click a row to select one isoform. Used by block.js for isoform switching.

******* required
.holder     d3 selection to render into
.allgm      array of gene model objects
.onSelect   callback when isoform is selected

******* optional
.usegm          currently active gene model, highlighted in the list
.maxHeight      max height in px before scrolling (default 200)
.scrollThreshold  number of isoforms before enabling scroll (default 10)
*/

/**
 * Merge all exon regions across gene models to compute a unified layout
 * for sketching isoform exon structure.
 *
 * Returns [rglst, chrcount] where rglst is the merged exon region list
 * and chrcount is the number of distinct chromosomes.
 */
export function allgm2sum(gmlst: GeneModel[]) {
	const chr2gm = new Map()
	for (const gm of gmlst) {
		if (gm.hidden) {
			continue
		}
		if (!chr2gm.has(gm.chr)) {
			chr2gm.set(gm.chr, [])
		}
		chr2gm.get(gm.chr).push(gm)
	}
	const alllst: ExonRegion[] = []
	for (const [chr, gmlstForChr] of chr2gm.entries()) {
		const elst: number[][] = []
		for (const m of gmlstForChr) {
			for (const e of m.exon) {
				elst.push([e[0], e[1]])
			}
		}
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
 * In single-select mode, clicking a row selects that isoform
 * and calls onSelect(gm).
 */
export function isoformSelect(opts: IsoformSelectOpts) {
	const { holder, allgm, onSelect, usegm } = opts
	const maxHeight = opts.maxHeight ?? 200
	const scrollThreshold = opts.scrollThreshold ?? 10

	const [rglst, chrcount] = allgm2sum(allgm)

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
	const gmlabellst: { isoform: string; chr: string; start: number; label: Td }[] = []

	for (const gm of allgm) {
		const tr = table.append('tr').attr('class', 'sja_clb')

		tr.on('click', () => {
			for (const gm2 of gmlabellst) {
				gm2.label.style(
					'color',
					gm2.isoform == gm.isoform && gm2.chr == gm.chr && gm2.start == gm.start ? '#cc0000' : '#545454'
				)
			}
			onSelect(gm)
		})

		// DEFAULT label
		tr.append('td')
			.text(gm.isdefault ? 'DEFAULT' : '')
			.style('font-size', '.6em')

		// isoform name
		const isActive = usegm && gm.isoform == usegm.isoform && gm.chr == usegm.chr && gm.start == usegm.start
		const lab = tr
			.append('td')
			.text(gm.isoform)
			.style('color', isActive ? '#cc0000' : '#545454')
		gmlabellst.push({ isoform: gm.isoform, chr: gm.chr, start: gm.start, label: lab })

		// chromosome column (only if multiple chromosomes)
		if (chrcount > 1) {
			tr.append('td').text(gm.chr)
		}

		// exon structure sketch
		sketchGmsum(tr.append('td'), rglst, gm, exonsf, intronpx, pxwidth, 16, exoncolor)

		// protein length sketch
		sketchProtein(tr.append('td'), gm, 200)
	}
}
