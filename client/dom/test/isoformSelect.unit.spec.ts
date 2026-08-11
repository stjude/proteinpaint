import tape from 'tape'
import { select } from 'd3-selection'
import { allgm2sum, makeLinearScale, isoformRangeSelect } from '../isoformSelect'
import type { GeneModel } from '../types/isoformSelect'

/**
 * Unit tests for isoformSelect.ts module
 *
 * Test Coverage:
 * - allgm2sum() function that merges exon regions across gene models
 * - makeLinearScale() genomic-to-px scale of isoformRangeSelect()
 * - isoformRangeSelect() breakpoint marks and range selection
 */

/**************
 * Test sections
 **************/

tape('\n', test => {
	test.comment('-***- dom/isoformSelect -***-')
	test.end()
})

/**
 * Test: Empty input
 * Verifies that allgm2sum() handles empty array gracefully
 */
tape('allgm2sum() - empty input', test => {
	const result = allgm2sum([])
	const [rglst, chrcount] = result

	test.equal(rglst.length, 0, 'Should return empty region list for empty input')
	test.equal(chrcount, 0, 'Should return 0 chromosome count for empty input')
	test.end()
})

/**
 * Test: Single gene model with single exon
 * Verifies basic functionality with minimal input
 */
tape('allgm2sum() - single gene model with single exon', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 2000,
			strand: '+',
			exon: [[1000, 1200]]
		}
	]

	const [rglst, chrcount] = allgm2sum(gmlst)

	test.equal(rglst.length, 1, 'Should return one merged region')
	test.equal(chrcount, 1, 'Should return chromosome count of 1')
	test.equal(rglst[0].chr, 'chr1', 'Should have correct chromosome')
	test.equal(rglst[0].bstart, 1000, 'Should have correct start position')
	test.equal(rglst[0].bstop, 1200, 'Should have correct stop position')
	test.equal(rglst[0].reverse, false, 'Should not be reverse strand')
	test.end()
})

/**
 * Test: Multiple non-overlapping exons on same chromosome
 * Verifies that separate exons are kept as separate regions
 */
tape('allgm2sum() - multiple non-overlapping exons', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 3000,
			strand: '+',
			exon: [
				[1000, 1200],
				[1500, 1700],
				[2000, 2300]
			]
		}
	]

	const [rglst, chrcount] = allgm2sum(gmlst)

	test.equal(rglst.length, 3, 'Should return three separate regions for non-overlapping exons')
	test.equal(chrcount, 1, 'Should return chromosome count of 1')
	test.equal(rglst[0].bstart, 1000, 'First region should start at 1000')
	test.equal(rglst[0].bstop, 1200, 'First region should stop at 1200')
	test.equal(rglst[1].bstart, 1500, 'Second region should start at 1500')
	test.equal(rglst[1].bstop, 1700, 'Second region should stop at 1700')
	test.equal(rglst[2].bstart, 2000, 'Third region should start at 2000')
	test.equal(rglst[2].bstop, 2300, 'Third region should stop at 2300')
	test.end()
})

/**
 * Test: Multiple gene models with overlapping exons
 * Verifies that overlapping exons from different isoforms are merged
 */
tape('allgm2sum() - overlapping exons from multiple isoforms', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 2000,
			strand: '+',
			exon: [
				[1000, 1500],
				[1800, 2000]
			]
		},
		{
			isoform: 'NM_002',
			chr: 'chr1',
			start: 1200,
			stop: 2200,
			strand: '+',
			exon: [
				[1200, 1600],
				[1900, 2200]
			]
		}
	]

	const [rglst, chrcount] = allgm2sum(gmlst)

	test.equal(chrcount, 1, 'Should return chromosome count of 1')
	test.equal(rglst.length, 2, 'Should merge overlapping regions into 2 regions')
	// First merged region should be 1000-1600 (combining [1000,1500] and [1200,1600])
	test.equal(rglst[0].bstart, 1000, 'First merged region should start at 1000')
	test.equal(rglst[0].bstop, 1600, 'First merged region should stop at 1600')
	// Second merged region should be 1800-2200 (combining [1800,2000] and [1900,2200])
	test.equal(rglst[1].bstart, 1800, 'Second merged region should start at 1800')
	test.equal(rglst[1].bstop, 2200, 'Second merged region should stop at 2200')
	test.end()
})

/**
 * Test: Gene models on reverse strand
 * Verifies that reverse strand regions are properly ordered (unshifted vs pushed)
 */
tape('allgm2sum() - reverse strand gene models', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 2000,
			strand: '-',
			exon: [
				[1000, 1200],
				[1500, 1700]
			]
		}
	]

	const [rglst, chrcount] = allgm2sum(gmlst)

	test.equal(rglst.length, 2, 'Should return two regions')
	test.equal(chrcount, 1, 'Should return chromosome count of 1')
	test.equal(rglst[0].reverse, true, 'Should mark regions as reverse strand')
	test.equal(rglst[1].reverse, true, 'Should mark all regions as reverse strand')
	// For reverse strand, regions are unshifted, so they appear in reverse order
	test.equal(rglst[0].bstart, 1500, 'First region in list should be the rightmost exon for reverse strand')
	test.equal(rglst[1].bstart, 1000, 'Second region in list should be the leftmost exon for reverse strand')
	test.end()
})

/**
 * Test: Multiple chromosomes
 * Verifies that gene models on different chromosomes are tracked separately
 */
tape('allgm2sum() - multiple chromosomes', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 2000,
			strand: '+',
			exon: [[1000, 1200]]
		},
		{
			isoform: 'NM_002',
			chr: 'chr2',
			start: 3000,
			stop: 4000,
			strand: '+',
			exon: [[3000, 3200]]
		},
		{
			isoform: 'NM_003',
			chr: 'chr1',
			start: 1500,
			stop: 1800,
			strand: '+',
			exon: [[1500, 1800]]
		}
	]

	const [rglst, chrcount] = allgm2sum(gmlst)

	test.equal(chrcount, 2, 'Should return chromosome count of 2')
	test.equal(rglst.length, 3, 'Should return three regions total')
	// Verify regions from both chromosomes are included
	const chrSet = new Set(rglst.map(r => r.chr))
	test.equal(chrSet.size, 2, 'Should have regions from 2 different chromosomes')
	test.ok(chrSet.has('chr1'), 'Should include chr1')
	test.ok(chrSet.has('chr2'), 'Should include chr2')
	test.end()
})

/**
 * Test: Hidden gene models
 * Verifies that gene models marked as hidden are filtered out
 */
tape('allgm2sum() - hidden gene models are excluded', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 2000,
			strand: '+',
			exon: [[1000, 1200]],
			hidden: false
		},
		{
			isoform: 'NM_002',
			chr: 'chr1',
			start: 1500,
			stop: 1800,
			strand: '+',
			exon: [[1500, 1800]],
			hidden: true
		}
	]

	const rglst = allgm2sum(gmlst)[0]

	test.equal(rglst.length, 1, 'Should exclude hidden gene models from regions')
	test.equal(rglst[0].bstart, 1000, 'Should only include non-hidden gene model')
	test.equal(rglst[0].bstop, 1200, 'Should only include non-hidden gene model')
	test.end()
})

/**
 * Test: All gene models hidden
 * Verifies behavior when all gene models are hidden
 */
tape('allgm2sum() - all gene models hidden', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 2000,
			strand: '+',
			exon: [[1000, 1200]],
			hidden: true
		}
	]

	const [rglst, chrcount] = allgm2sum(gmlst)

	test.equal(rglst.length, 0, 'Should return empty region list when all models are hidden')
	test.equal(chrcount, 0, 'Should return 0 chromosome count when all models are hidden')
	test.end()
})

/**
 * Test: Adjacent exons that should merge
 * Verifies that exons that touch or overlap are properly merged
 */
tape('allgm2sum() - adjacent and overlapping exons merge correctly', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 3000,
			strand: '+',
			exon: [
				[1000, 1500],
				[1400, 2000],
				[1900, 2500]
			]
		}
	]

	const rglst = allgm2sum(gmlst)[0]

	test.equal(rglst.length, 1, 'Should merge all overlapping exons into one region')
	test.equal(rglst[0].bstart, 1000, 'Merged region should start at earliest position')
	test.equal(rglst[0].bstop, 2500, 'Merged region should end at latest position')
	test.end()
})

/**
 * Test: Complex scenario with multiple chromosomes and strands
 * Verifies behavior in a realistic complex scenario
 */
tape('allgm2sum() - complex scenario with multiple chromosomes and strands', test => {
	const gmlst: GeneModel[] = [
		{
			isoform: 'NM_001',
			chr: 'chr1',
			start: 1000,
			stop: 2000,
			strand: '+',
			exon: [
				[1000, 1200],
				[1500, 1700]
			]
		},
		{
			isoform: 'NM_002',
			chr: 'chr1',
			start: 1100,
			stop: 1600,
			strand: '+',
			exon: [[1100, 1600]]
		},
		{
			isoform: 'NM_003',
			chr: 'chr2',
			start: 3000,
			stop: 4000,
			strand: '-',
			exon: [
				[3000, 3200],
				[3500, 3700]
			]
		},
		{
			isoform: 'NM_004',
			chr: 'chr1',
			start: 2000,
			stop: 2500,
			strand: '+',
			exon: [[2000, 2500]],
			hidden: true
		}
	]

	const [rglst, chrcount] = allgm2sum(gmlst)

	test.equal(chrcount, 2, 'Should count 2 chromosomes')
	// chr1 should have merged regions from NM_001 and NM_002
	// chr2 should have 2 regions from NM_003
	// NM_004 should be excluded (hidden)
	const chr1Regions = rglst.filter(r => r.chr === 'chr1')
	const chr2Regions = rglst.filter(r => r.chr === 'chr2')

	test.equal(chr1Regions.length, 1, 'chr1 should have 1 region after merging (NM_002 [1100,1600] bridges the gap)')
	test.equal(chr2Regions.length, 2, 'chr2 should have 2 regions')
	test.ok(
		chr2Regions.every(r => r.reverse),
		'chr2 regions should be marked as reverse'
	)
	test.ok(
		chr1Regions.every(r => !r.reverse),
		'chr1 regions should not be marked as reverse'
	)
	test.end()
})

/**************
 * makeLinearScale() and isoformRangeSelect()
 **************/

/* modeled on BCR (chr22, plus strand) with the two breakpoint clusters that motivate
range selection, and on a minus strand gene to cover the flipped scale */
const bcr: GeneModel = {
	isoform: 'NM_004327',
	chr: 'chr22',
	start: 23180000,
	stop: 23318000,
	strand: '+',
	isdefault: true,
	exon: [
		[23180000, 23180200],
		[23290000, 23290300],
		[23317800, 23318000]
	]
}
const bcrShort: GeneModel = {
	isoform: 'NM_021574',
	chr: 'chr22',
	start: 23180000,
	stop: 23290300,
	strand: '+',
	exon: [
		[23180000, 23180200],
		[23290000, 23290300]
	]
}
const minusGm: GeneModel = {
	isoform: 'NM_005157',
	chr: 'chr9',
	start: 130713000,
	stop: 130887000,
	strand: '-',
	exon: [
		[130713000, 130713200],
		[130886800, 130887000]
	]
}
const bcrMarkers = [
	{ pos: 23183000, samplecount: 12 },
	{ pos: 23290100, samplecount: 40 },
	{ pos: 23290500, samplecount: 3 }
]

tape('makeLinearScale() - plus strand round trip', test => {
	const scale = makeLinearScale({ chr: 'chr22', gms: [bcr], markers: [], pxwidth: 400 })
	test.equal(scale.reverse, false, 'plus strand is not reversed')
	test.ok(scale.start < bcr.start && scale.stop > bcr.stop, 'span is padded around the gene')
	test.equal(scale.pos2px(scale.start), 0, 'first position maps to px 0')
	test.equal(Math.round(scale.pos2px(scale.stop)), 400, 'last position maps to the full width')
	test.ok(scale.pos2px(bcr.start) < scale.pos2px(bcr.stop), 'a higher position is further right')
	// a position round trips within the resolution of one px
	const bp = 23290100
	const backAndForth = scale.px2pos(scale.pos2px(bp))
	test.ok(Math.abs(backAndForth - bp) <= 1 / scale.exonsf, 'position round trips through px')
	test.end()
})

tape('makeLinearScale() - minus strand flips the scale', test => {
	const scale = makeLinearScale({ chr: 'chr9', gms: [minusGm], markers: [], pxwidth: 400 })
	test.equal(scale.reverse, true, 'minus strand is reversed')
	// the gene reads 5-prime to 3-prime left to right, as it does in isoformSelect()
	test.equal(Math.round(scale.pos2px(scale.stop)), 0, 'last position maps to px 0')
	test.equal(Math.round(scale.pos2px(scale.start)), 400, 'first position maps to the full width')
	test.ok(scale.pos2px(minusGm.start) > scale.pos2px(minusGm.stop), 'a higher position is further left')
	const bp = 130800000
	const backAndForth = scale.px2pos(scale.pos2px(bp))
	test.ok(Math.abs(backAndForth - bp) <= 1 / scale.exonsf, 'position round trips through px on the minus strand')
	test.end()
})

tape('makeLinearScale() - span covers markers outside the gene', test => {
	// a breakpoint may fall outside the gene, e.g. upstream of the promoter, and must
	// still be visible and selectable
	const upstream = { pos: bcr.start - 50000 }
	const scale = makeLinearScale({ chr: 'chr22', gms: [bcr], markers: [upstream], pxwidth: 400 })
	test.ok(scale.start < upstream.pos, 'span starts before the outside marker')
	test.ok(scale.pos2px(upstream.pos) > 0, 'the outside marker is within the canvas')
	test.equal(scale.px2pos(-10), scale.start, 'px before the canvas clamps to the first position')
	test.equal(scale.px2pos(1000), scale.stop, 'px after the canvas clamps to the last position')
	test.end()
})

tape('makeLinearScale() - scale without a gene model', test => {
	// the partner of a fusion may be an unannotated locus, with breakpoints but no isoform
	const scale = makeLinearScale({ chr: 'chr22', gms: [], markers: bcrMarkers, pxwidth: 400 })
	test.equal(scale.reverse, false, 'defaults to the plus strand')
	test.ok(scale.start < bcrMarkers[0].pos, 'span covers the markers')
	test.throws(
		() => makeLinearScale({ chr: 'chr22', gms: [], markers: [], pxwidth: 400 }),
		/no gene model or marker/,
		'throws without anything to scale'
	)
	test.end()
})

tape('isoformRangeSelect() - render', test => {
	const holder = select(document.body).append('div')
	isoformRangeSelect({
		holder,
		allgm: [bcr, bcrShort, minusGm],
		chr: 'chr22',
		markers: bcrMarkers,
		callback: () => {}
	})
	test.ok(holder.select('[data-testid="sjpp-isoformRangeSelect-marks"]').node(), 'renders the breakpoint marks')
	// one canvas of marks plus one sketch per isoform of the chr; the chr9 isoform is not shown
	test.equal(holder.selectAll('canvas').nodes().length, 3, 'renders a sketch for each isoform of the chr')
	test.equal(
		holder.select('[data-testid="sjpp-isoformRangeSelect-overlay"]').style('display'),
		'none',
		'no selection highlight without an initial range'
	)
	test.equal(
		(holder.select('[data-testid="sjpp-isoformRangeSelect-apply"]').node() as HTMLButtonElement).disabled,
		true,
		'apply is disabled without a selection'
	)
	test.ok(
		holder.select('[data-testid="sjpp-isoformRangeSelect-info"]').text().includes('3 breakpoints'),
		'reports the number of breakpoints'
	)
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - initial range and apply', test => {
	const holder = select(document.body).append('div')
	let applied: any = 'not called'
	const api = isoformRangeSelect({
		holder,
		allgm: [bcr],
		chr: 'chr22',
		markers: bcrMarkers,
		range: { start: 23290000, stop: 23290300 },
		callback: r => (applied = r)
	})!
	const overlay = holder.select('[data-testid="sjpp-isoformRangeSelect-overlay"]')
	test.notEqual(overlay.style('display'), 'none', 'initial range is highlighted')
	const inputs = holder.selectAll('[data-testid="sjpp-isoformRangeSelect-pos"]').nodes() as HTMLInputElement[]
	test.equal(inputs[0].value, '23290000', 'start input has the initial range')
	test.equal(inputs[1].value, '23290300', 'stop input has the initial range')
	const info = holder.select('[data-testid="sjpp-isoformRangeSelect-info"]').text()
	test.ok(info.includes('1 of 3 breakpoints'), 'counts the breakpoints of the range')
	test.ok(info.includes('40 samples'), 'sums the samples of the breakpoints of the range')
	;(holder.select('[data-testid="sjpp-isoformRangeSelect-apply"]').node() as HTMLButtonElement).click()
	test.deepEqual(applied, { chr: 'chr22', start: 23290000, stop: 23290300 }, 'apply calls back with the range')
	test.deepEqual(api.getRange(), { chr: 'chr22', start: 23290000, stop: 23290300 }, 'api reports the range')
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - typed coordinates and clear', test => {
	const holder = select(document.body).append('div')
	let applied: any = 'not called'
	isoformRangeSelect({
		holder,
		allgm: [bcr],
		chr: 'chr22',
		markers: bcrMarkers,
		callback: r => (applied = r)
	})
	const inputs = holder.selectAll('[data-testid="sjpp-isoformRangeSelect-pos"]').nodes() as HTMLInputElement[]
	// a drag over a gene of a hundred kb is too coarse to place a cluster boundary,
	// so the range may also be typed in
	inputs[0].value = '23290400'
	inputs[1].value = '23180000' // entered in reverse, must be sorted
	inputs[1].dispatchEvent(new Event('change'))
	const overlay = holder.select('[data-testid="sjpp-isoformRangeSelect-overlay"]')
	test.notEqual(overlay.style('display'), 'none', 'typed range is highlighted')
	test.equal(inputs[0].value, '23180000', 'typed range is sorted by position')
	test.ok(
		holder.select('[data-testid="sjpp-isoformRangeSelect-info"]').text().includes('2 of 3 breakpoints'),
		'counts the breakpoints of the typed range'
	)
	;(holder.select('[data-testid="sjpp-isoformRangeSelect-clear"]').node() as HTMLButtonElement).click()
	test.equal(overlay.style('display'), 'none', 'clear hides the highlight')
	test.equal(applied, null, 'clear calls back with null')
	test.equal(inputs[0].value, '', 'clear empties the inputs')
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - highlight of a minus strand range', test => {
	const holder = select(document.body).append('div')
	const api = isoformRangeSelect({
		holder,
		allgm: [minusGm],
		chr: 'chr9',
		markers: [{ pos: 130720000, samplecount: 5 }],
		range: { start: 130720000, stop: 130780000 },
		callback: () => {}
	})!
	const overlay = holder.select('[data-testid="sjpp-isoformRangeSelect-overlay"]')
	// the scale is flipped, so the left edge of the highlight is the higher position
	const left = Number(overlay.style('left').replace('px', ''))
	test.equal(Math.round(left), Math.round(api.scale.pos2px(130780000)), 'left edge is at the stop position')
	const width = Number(overlay.style('width').replace('px', ''))
	test.ok(width > 0, 'highlight has a width')
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - nothing to display', test => {
	const holder = select(document.body).append('div')
	const api = isoformRangeSelect({
		holder,
		allgm: [minusGm], // of another chr
		chr: 'chr22',
		markers: [],
		callback: () => {}
	})
	test.equal(api, undefined, 'returns nothing when there is neither a gene model nor a marker')
	test.equal(holder.selectAll('canvas').nodes().length, 0, 'renders no canvas')
	test.ok(holder.text().includes('No gene model or breakpoint'), 'says there is nothing to display')
	holder.remove()
	test.end()
})
