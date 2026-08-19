import tape from 'tape'
import { select } from 'd3-selection'
import {
	allgm2sum,
	breakpointGms,
	makeLinearScale,
	makeExonScale,
	makeScale,
	isoformRangeSelect,
	isoformPairRangeSelect
} from '../isoformSelect'
import type { GeneModel } from '../types/isoformSelect'

/**
 * Unit tests for isoformSelect.ts module
 *
 * Test Coverage:
 * - allgm2sum() function that merges exon regions across gene models
 * - makeLinearScale() genomic-to-px scale, the 'genomic' layout of a breakpoint chart
 * - makeExonScale() exon-collapsed scale, the 'rna' layout, and makeScale() dispatching
 * - isoformRangeSelect() breakpoint marks and range selection
 * - isoformPairRangeSelect() paired breakpoints of two genes and range selection
 * - breakpointGms() dropping the isoforms no breakpoint of the chart falls on
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

/* a gene of many exons, where one exon is only a few px of the full width, too small to
read a breakpoint on: exon i spans [1000 + 8000i, 1400 + 8000i], i of 0 to 11 */
const exonStart = (i: number) => 1000 + i * 8000
const exonStop = (i: number) => exonStart(i) + 400
const manyExons: GeneModel = {
	isoform: 'NM_many',
	chr: 'chr1',
	start: exonStart(0),
	stop: exonStop(11),
	strand: '+',
	isdefault: true,
	exon: Array.from({ length: 12 }, (_, i) => [exonStart(i), exonStop(i)])
}
const manyExonsMinus: GeneModel = { ...manyExons, isoform: 'NM_many_minus', strand: '-' }
/** the exon each region of a zoomed scale is of, to check the window is a contiguous run */
const keptExons = (scale: any) => scale.rglst.map((r: any) => (r.start - 1000) / 8000).sort((a, b) => a - b)

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

/**************
 * breakpointGms(), the isoforms a breakpoint can fall on
 **************/

/* short fragment transcripts annotated over the BCR locus, off either end of the gene, of
the kind that fill the track with rows no event of the chart falls on */
const bcrHead: GeneModel = {
	isoform: 'ENST_head',
	chr: 'chr22',
	start: 23150000,
	stop: 23150200,
	strand: '+',
	exon: [[23150000, 23150200]]
}
const bcrTail: GeneModel = {
	isoform: 'ENST_tail',
	chr: 'chr22',
	start: 23350000,
	stop: 23350200,
	strand: '+',
	exon: [[23350000, 23350200]]
}

tape('breakpointGms() - drops the isoforms outside the span of the marks', test => {
	const gms = [bcr, bcrShort, bcrHead, bcrTail]
	// the mark falls on the second exon of BCR, which neither fragment reaches
	const kept = breakpointGms(gms, [{ pos: 23290100 }], undefined)
	test.deepEqual(
		kept.map(gm => gm.isoform),
		[bcr.isoform, bcrShort.isoform],
		'keeps the isoforms the breakpoints fall on'
	)
	// an isoform ending before the first mark, or starting after the last, carries none of them
	const spanning = breakpointGms(gms, [{ pos: 23150100 }, { pos: 23350100 }], undefined)
	test.equal(spanning.length, 4, 'a span reaching both ends keeps every isoform')
	test.end()
})

tape('breakpointGms() - a range already selected is within the span', test => {
	/* the range is on the tail fragment, which no mark is on: it must still be drawn, or the
	track would not show what a saved selection covers */
	const kept = breakpointGms([bcr, bcrHead, bcrTail], [{ pos: 23290100 }], { start: 23350000, stop: 23350200 })
	test.ok(
		kept.some(gm => gm.isoform == bcrTail.isoform),
		'keeps an isoform of the selected range'
	)
	test.equal(
		kept.some(gm => gm.isoform == bcrHead.isoform),
		false,
		'and still drops one outside both the marks and the range'
	)
	test.end()
})

tape('breakpointGms() - keeps every isoform when there is nothing to span', test => {
	const gms = [bcr, bcrHead, bcrTail]
	test.equal(breakpointGms(gms, [], undefined).length, 3, 'a gene with no breakpoint of its own is drawn whole')
	test.equal(breakpointGms(gms, [{ pos: NaN }], undefined).length, 3, 'a breakpoint of no position does not span')
	// nothing to draw is worse than drawing an isoform no breakpoint is on
	test.equal(breakpointGms([bcrHead], [{ pos: 23290100 }], undefined).length, 1, 'a track is never emptied')
	test.end()
})

/**************
 * makeExonScale(), the 'rna' layout
 **************/

tape('makeExonScale() - collapses the introns', test => {
	const scale = makeExonScale({ chr: 'chr22', gms: [bcr], markers: [], pxwidth: 400 })
	test.equal(scale.mode, 'rna', 'is a rna mode scale')
	test.equal(scale.rglst.length, bcr.exon.length, 'lays out one region per exon')
	test.ok(scale.intronpx > 0, 'the introns are gaps of a fixed width')
	// the exons and the gaps between them take up the whole width, and no more
	const total = scale.rglst.reduce((n, r) => n + r.width!, 0) + scale.intronpx * (scale.rglst.length - 1)
	test.ok(Math.abs(total - 400) < 0.01, 'the exons and gaps fill the width exactly')
	test.equal(scale.start, bcr.exon[0][0], 'the scale starts at the first exon')
	test.equal(scale.stop, bcr.exon[bcr.exon.length - 1][1], 'and stops at the last one')
	test.equal(scale.pos2px(scale.start), 0, 'the first position maps to px 0')
	test.equal(Math.round(scale.pos2px(scale.stop)), 400, 'the last one maps to the full width')
	/* an exon of a few hundred bp gets a share of the width proportional to its length,
	rather than the handful of px a linear scale over a gene of 138kb would give it */
	const exonPx = scale.pos2px(bcr.exon[1][1]) - scale.pos2px(bcr.exon[1][0])
	const linear = makeLinearScale({ chr: 'chr22', gms: [bcr], markers: [], pxwidth: 400 })
	test.ok(exonPx > 50, 'an exon takes a readable share of the width')
	test.ok(
		exonPx > 50 * (linear.pos2px(bcr.exon[1][1]) - linear.pos2px(bcr.exon[1][0])),
		'far more than it would linearly'
	)
	test.end()
})

tape('makeExonScale() - round trip within an exon', test => {
	const scale = makeExonScale({ chr: 'chr22', gms: [bcr], markers: [], pxwidth: 400 })
	const pos = bcr.exon[1][0] + 100
	const backAndForth = scale.px2pos(scale.pos2px(pos))
	test.ok(Math.abs(backAndForth - pos) <= 1 / scale.exonsf, 'a position within an exon round trips through px')
	test.end()
})

tape('makeExonScale() - a position off the exons snaps to an edge', test => {
	const scale = makeExonScale({ chr: 'chr22', gms: [bcr], markers: [], pxwidth: 400 })
	/* an intronic breakpoint has no px of its own, so it is drawn at the start of the exon
	after it, which is where the px of the gap it sits in maps back to */
	const intronic = bcr.exon[0][1] + 5000
	test.equal(
		scale.pos2px(intronic),
		scale.pos2px(bcr.exon[1][0]),
		'an intronic position is at the start of the next exon'
	)
	test.equal(scale.px2pos(scale.pos2px(intronic)), bcr.exon[1][0], 'and stays there through a round trip')
	test.equal(scale.pos2px(bcr.start - 50000), 0, 'a position before the gene is at the start of the first exon')
	test.equal(Math.round(scale.pos2px(bcr.stop + 50000)), 400, 'one after it is at the end of the last exon')
	const gapPx = scale.pos2px(bcr.exon[0][1]) + scale.intronpx / 2
	test.equal(scale.px2pos(gapPx), bcr.exon[1][0], 'a px in a gap maps to the start of the exon after it')
	test.end()
})

tape('makeExonScale() - minus strand reads 5 prime to 3 prime', test => {
	const scale = makeExonScale({ chr: 'chr9', gms: [minusGm], markers: [], pxwidth: 400 })
	test.equal(scale.reverse, true, 'minus strand is reversed')
	test.equal(Math.round(scale.pos2px(scale.stop)), 0, 'the last position maps to px 0')
	test.equal(Math.round(scale.pos2px(scale.start)), 400, 'the first one maps to the full width')
	const pos = minusGm.exon[0][0] + 50
	const backAndForth = scale.px2pos(scale.pos2px(pos))
	test.ok(Math.abs(backAndForth - pos) <= 1 / scale.exonsf, 'a position round trips on the minus strand')
	// the regions run right to left, so the gap before an exon in display order is to its right
	const gapPx = scale.pos2px(minusGm.exon[1][0]) + scale.intronpx / 2
	test.equal(scale.px2pos(gapPx), minusGm.exon[0][1], 'a px in a gap maps to the exon after it in display order')
	test.end()
})

tape('makeExonScale() - falls back without an exon structure', test => {
	// the partner of a fusion may be an unannotated locus, with breakpoints but no isoform,
	// so there is nothing to collapse and the breakpoints are laid out linearly
	const scale = makeExonScale({ chr: 'chr22', gms: [], markers: bcrMarkers, pxwidth: 400 })
	test.equal(scale.mode, 'genomic', 'falls back to a linear scale')
	test.equal(scale.intronpx, 0, 'which has no gaps')
	test.ok(scale.start < bcrMarkers[0].pos, 'and spans the markers')
	test.end()
})

tape('makeExonScale() - zooms to the exons of the breakpoints', test => {
	// a breakpoint on exon 5 only, so the window is exons 4 to 6
	const scale = makeExonScale({ chr: 'chr1', gms: [manyExons], markers: [{ pos: exonStart(5) + 200 }], pxwidth: 400 })
	test.equal(scale.zoomed, true, 'the scale covers a window of the gene')
	test.deepEqual(keptExons(scale), [4, 5, 6], 'the exon of the breakpoint and one of context on each side')
	test.equal(scale.start, exonStart(4), 'the scale starts at the first exon of the window')
	test.equal(scale.stop, exonStop(6), 'and stops at the last one')
	// the point of it: the exon of the breakpoint gets a readable share of the width
	const whole = makeExonScale({ chr: 'chr1', gms: [manyExons], markers: [], pxwidth: 400 })
	test.equal(whole.zoomed, false, 'the whole gene is kept when there is no breakpoint to zoom to')
	test.ok(scale.exonsf > 3 * whole.exonsf, 'an exon of the window is several times wider than in the whole gene')
	test.end()
})

tape('makeExonScale() - the window is a contiguous run of exons', test => {
	/* the window is a zoom of the gene, not a splice of it: the exons between two distant
	breakpoints are all drawn, so that every gap within the window is a real intron */
	const scale = makeExonScale({
		chr: 'chr1',
		gms: [manyExons],
		markers: [{ pos: exonStart(3) + 100 }, { pos: exonStart(6) + 100 }],
		pxwidth: 400
	})
	test.equal(scale.zoomed, true, 'the scale covers a window of the gene')
	test.deepEqual(
		keptExons(scale),
		[2, 3, 4, 5, 6, 7],
		'every exon between the two breakpoints is kept, and one each side'
	)
	test.end()
})

tape('makeExonScale() - the window covers the selected range', test => {
	/* a range already selected must be within the window, or clamping it to the scale would
	silently narrow a saved selection (see the setRange of each component) */
	const range = { start: exonStart(9), stop: exonStop(9) }
	const scale = makeExonScale({
		chr: 'chr1',
		gms: [manyExons],
		markers: [{ pos: exonStart(5) + 200 }],
		range,
		pxwidth: 400
	})
	test.ok(scale.start <= range.start && scale.stop >= range.stop, 'the window covers the selected range')
	test.deepEqual(keptExons(scale), [4, 5, 6, 7, 8, 9, 10], 'and every exon between it and the breakpoint')
	test.end()
})

tape('makeExonScale() - keeps the whole gene when zooming would not pay', test => {
	// breakpoints spread over the gene leave too little out to repay the context lost
	const spread = makeExonScale({
		chr: 'chr1',
		gms: [manyExons],
		markers: [{ pos: exonStart(1) + 100 }, { pos: exonStart(10) + 100 }],
		pxwidth: 400
	})
	test.equal(spread.zoomed, false, 'a gene whose breakpoints span it is not zoomed')
	test.equal(spread.rglst.length, 12, 'every exon is kept')
	// and a gene of few exons has little width to win by it
	const few = makeExonScale({ chr: 'chr22', gms: [bcr], markers: bcrMarkers, pxwidth: 400 })
	test.equal(few.zoomed, false, 'a gene of few exons is not zoomed')
	test.equal(few.rglst.length, bcr.exon.length, 'every exon is kept')
	test.end()
})

tape('makeExonScale() - zooms on the minus strand', test => {
	const scale = makeExonScale({
		chr: 'chr1',
		gms: [manyExonsMinus],
		markers: [{ pos: exonStart(5) + 200 }],
		pxwidth: 400
	})
	test.equal(scale.zoomed, true, 'the scale covers a window of the gene')
	test.deepEqual(keptExons(scale), [4, 5, 6], 'the same window as on the plus strand')
	// the regions run 3 prime to 5 prime, so the window reads right to left
	test.equal(scale.rglst[0].start, exonStart(6), 'the highest exon of the window is drawn first')
	test.equal(Math.round(scale.pos2px(scale.stop)), 0, 'the last position of the window maps to px 0')
	test.equal(Math.round(scale.pos2px(scale.start)), 400, 'the first one maps to the full width')
	const pos = exonStart(5) + 200
	test.ok(Math.abs(scale.px2pos(scale.pos2px(pos)) - pos) <= 1 / scale.exonsf, 'a breakpoint round trips')
	test.end()
})

tape('makeScale() - dispatches on the mode', test => {
	const arg = { chr: 'chr22', gms: [bcr], markers: [], pxwidth: 400 }
	test.equal(makeScale({ ...arg, mode: 'rna' }).mode, 'rna', 'rna mode collapses the introns')
	test.equal(makeScale({ ...arg, mode: 'genomic' }).mode, 'genomic', 'genomic mode keeps them')
	test.equal(makeScale(arg).mode, 'genomic', 'genomic is the default')
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
	test.equal(
		holder.select('[data-testid="sjpp-isoformRangeSelect-track"]').attr('data-scale-mode'),
		'genomic',
		'lays the isoforms out genomically by default'
	)
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

tape('isoformRangeSelect() - drag over the isoform sketches', test => {
	/* the highlight spans the marks and the isoform sketches under them, so the drag does
	too: dragging only over the strip of marks would leave most of what it selects inert */
	const holder = select(document.body).append('div')
	const api = isoformRangeSelect({
		holder,
		allgm: [bcr, bcrShort],
		chr: 'chr22',
		markers: bcrMarkers,
		callback: () => {}
	})!
	const track = holder.select('[data-testid="sjpp-isoformRangeSelect-track"]').node() as HTMLElement
	const rect = track.getBoundingClientRect()
	const x0 = api.scale.pos2px(23289000)
	const x1 = api.scale.pos2px(23291000)
	// at the bottom of the track, i.e. over an isoform sketch rather than over the marks
	track.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left + x0, clientY: rect.bottom - 3, bubbles: true }))
	window.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + x1, clientY: rect.bottom - 3 }))
	window.dispatchEvent(new MouseEvent('mouseup', {}))
	const range = api.getRange()!
	test.ok(range, 'a drag over an isoform sketch selects a range')
	test.ok(range.start <= 23290100 && range.stop >= 23290100, 'covering the breakpoint under it')
	test.ok(
		holder.select('[data-testid="sjpp-isoformRangeSelect-info"]').text().includes('of 3 breakpoints'),
		'and it is reported'
	)
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - clearing a coordinate restores the range', test => {
	/* a number input reports an emptied field as the empty string, which Number() turns into
	0: a finite value that was taken as a typed coordinate and clamped to the start of the
	scale, so clearing an input to retype it silently widened the range */
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
	const inputs = holder.selectAll('[data-testid="sjpp-isoformRangeSelect-pos"]').nodes() as HTMLInputElement[]
	inputs[0].value = ''
	inputs[0].dispatchEvent(new Event('change'))
	test.deepEqual(
		api.getRange(),
		{ chr: 'chr22', start: 23290000, stop: 23290300 },
		'clearing the start coordinate leaves the range as it was'
	)
	test.equal(inputs[0].value, '23290000', 'and puts the coordinate back in the input')
	// the same for the other end, and for a field the input cannot parse
	inputs[1].value = ''
	inputs[1].dispatchEvent(new Event('change'))
	test.deepEqual(
		api.getRange(),
		{ chr: 'chr22', start: 23290000, stop: 23290300 },
		'clearing the stop coordinate leaves the range as it was'
	)
	test.equal(applied, 'not called', 'and nothing is applied by it')
	// a coordinate typed over the restored one still takes effect
	inputs[0].value = '23180000'
	inputs[0].dispatchEvent(new Event('change'))
	test.deepEqual(api.getRange()!.start, 23180000, 'a typed coordinate still changes the range')
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - sample counts of an upper bound tally', test => {
	// the markers may be tallied per pair of breakpoints, where a sample with two events is
	// counted once per event, so their sums cannot be read as a number of samples
	const holder = select(document.body).append('div')
	isoformRangeSelect({
		holder,
		allgm: [bcr],
		chr: 'chr22',
		markers: bcrMarkers,
		range: { start: 23180000, stop: 23300000 },
		samplesAreUpperBound: true,
		callback: () => {}
	})
	test.ok(
		holder.select('[data-testid="sjpp-isoformRangeSelect-info"]').text().includes('up to 55 samples'),
		'the count is reported as an upper bound'
	)
	const exact = select(document.body).append('div')
	isoformRangeSelect({
		holder: exact,
		allgm: [bcr],
		chr: 'chr22',
		markers: bcrMarkers,
		range: { start: 23180000, stop: 23300000 },
		callback: () => {}
	})
	const text = exact.select('[data-testid="sjpp-isoformRangeSelect-info"]').text()
	test.ok(text.includes('55 samples') && !text.includes('up to'), 'and as a count when the tally is exact')
	exact.remove()
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

tape('isoformRangeSelect() - drops the isoforms no breakpoint is on', test => {
	/* the fragment transcripts of a locus lie off either end of the breakpoints: drawn, they
	would fill the chart with rows no mark falls on, and stretch the layout over their exons */
	const holder = select(document.body).append('div')
	const api = isoformRangeSelect({
		holder,
		allgm: [bcr, bcrHead, bcrTail],
		chr: 'chr22',
		markers: bcrMarkers,
		callback: () => {}
	})!
	// one canvas of marks, and a sketch of the one isoform the breakpoints are on
	test.equal(holder.selectAll('canvas').nodes().length, 2, 'a fragment off the breakpoints is not sketched')
	test.equal(holder.text().includes('ENST_head'), false, 'nor is it named')
	test.ok(holder.text().includes(bcr.isoform), 'the isoform of the breakpoints is')
	test.ok(api.scale.start > bcrHead.stop, 'the layout is not stretched over a fragment before the gene')
	test.ok(api.scale.stop < bcrTail.start, 'nor over one after it')
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

tape('isoformRangeSelect() - rna mode', test => {
	// a rna fusion joins transcripts at exon boundaries, so the introns between them are
	// collapsed and the exons the breakpoints fall on get a readable share of the width
	const holder = select(document.body).append('div')
	const api = isoformRangeSelect({
		holder,
		allgm: [bcr],
		chr: 'chr22',
		markers: bcrMarkers,
		mode: 'rna',
		callback: () => {}
	})!
	test.equal(api.scale.mode, 'rna', 'the marks are placed over the collapsed layout')
	test.equal(
		holder.select('[data-testid="sjpp-isoformRangeSelect-track"]').attr('data-scale-mode'),
		'rna',
		'which the rendered marks declare'
	)
	test.equal(api.scale.rglst.length, bcr.exon.length, 'one region per exon of the gene')
	// a dragged range snaps to exon boundaries, but is still reported as a genomic range
	api.setRange({ chr: 'chr22', start: 23290000, stop: 23290300 })
	test.deepEqual(api.getRange(), { chr: 'chr22', start: 23290000, stop: 23290300 }, 'the selected range is genomic')
	test.ok(
		holder.select('[data-testid="sjpp-isoformRangeSelect-info"]').text().includes('1 of 3 breakpoints'),
		'the breakpoints of the range are counted by position, as in genomic mode'
	)
	const overlay = holder.select('[data-testid="sjpp-isoformRangeSelect-overlay"]')
	const width = Number(overlay.style('width').replace('px', ''))
	// the exon is 300bp of a 138kb gene, a sliver of the width on a linear scale
	test.ok(width > 50, 'the highlight of an exon-sized range is wide enough to see')
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - rna mode zooms to the breakpoints', test => {
	const holder = select(document.body).append('div')
	const markers = [{ pos: exonStart(5) + 200, samplecount: 9 }]
	const api = isoformRangeSelect({
		holder,
		allgm: [manyExons],
		chr: 'chr1',
		markers,
		mode: 'rna',
		callback: () => {}
	})!
	test.equal(api.scale.zoomed, true, 'the chart covers a window of the gene')
	test.equal(api.scale.rglst.length, 3, 'the exon of the breakpoint and one of context each side')
	// the window is named, so that the view is not taken for the whole gene
	test.equal(
		holder.select('[data-testid="sjpp-isoformRangeSelect-locus"]').text(),
		'chr1:33-49kb',
		'the locus of the window is labelled'
	)
	// one canvas of marks plus the sketch of the isoform, drawn over the window
	test.equal(holder.selectAll('canvas').nodes().length, 2, 'the isoform is sketched over the window')
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - a zoomed window drops the isoforms outside it', test => {
	/* an isoform lying outside the window has no exon and no backbone within it, so its row
	would render nothing; only its name would show, reading as an isoform with no structure */
	const holder = select(document.body).append('div')
	// the window is exons 4 to 6, i.e. positions 33,000 to 49,400
	const downstream: GeneModel = {
		isoform: 'NM_downstream',
		chr: 'chr1',
		start: exonStart(9),
		stop: exonStop(11),
		strand: '+',
		exon: [
			[exonStart(9), exonStop(9)],
			[exonStart(11), exonStop(11)]
		]
	}
	const api = isoformRangeSelect({
		holder,
		allgm: [manyExons, downstream],
		chr: 'chr1',
		markers: [{ pos: exonStart(5) + 200, samplecount: 9 }],
		mode: 'rna',
		callback: () => {}
	})!
	test.equal(api.scale.zoomed, true, 'the chart covers a window of the gene')
	// one canvas of marks, and a sketch of the one isoform reaching into the window
	test.equal(holder.selectAll('canvas').nodes().length, 2, 'the isoform outside the window is not sketched')
	test.equal(holder.text().includes('NM_downstream'), false, 'nor is it named')
	test.ok(holder.text().includes('NM_many'), 'the isoform of the window is')
	holder.remove()
	test.end()
})

tape('isoformRangeSelect() - genomic mode is never zoomed', test => {
	const holder = select(document.body).append('div')
	const api = isoformRangeSelect({
		holder,
		allgm: [manyExons],
		chr: 'chr1',
		markers: [{ pos: exonStart(5) + 200, samplecount: 9 }],
		callback: () => {}
	})!
	test.equal(api.scale.zoomed, false, 'a genomic chart covers the whole locus')
	test.equal(holder.select('[data-testid="sjpp-isoformRangeSelect-locus"]').text(), '', 'so it names no window')
	holder.remove()
	test.end()
})

/**************
 * isoformPairRangeSelect()
 **************/

/* modeled on BCR::ABL1: the two BCR breakpoint clusters, each joining an ABL1 breakpoint,
so that a partner range and a range on the term's own gene select different subsets */
const abl1: GeneModel = {
	isoform: 'NM_005157',
	chr: 'chr9',
	start: 130713000,
	stop: 130887000,
	strand: '+',
	isdefault: true,
	exon: [
		[130713000, 130713200],
		[130886800, 130887000]
	]
}
const pairLinks = [
	// the major junction, and the same BCR breakpoint joining a second ABL1 one
	{ selfPos: 23290100, partnerPos: 130713100, samplecount: 20 },
	{ selfPos: 23290100, partnerPos: 130854000, samplecount: 5 },
	// the minor cluster of BCR, back to the ABL1 breakpoint of the major junction
	{ selfPos: 23183000, partnerPos: 130713100, samplecount: 10 }
]
const pairOpts = () => ({
	self: { gene: 'BCR', chr: 'chr22', allgm: [bcr] },
	partner: { gene: 'ABL1', chr: 'chr9', allgm: [abl1] },
	links: pairLinks
})

/** the coordinates of a point on the link canvas, at the given fraction of its height */
function linkPoint(api: any, canvas: HTMLCanvasElement, link: any, fraction: number) {
	const rect = canvas.getBoundingClientRect()
	const x0 = api.selfScale.pos2px(link.selfPos)
	const x1 = api.partnerScale.pos2px(link.partnerPos)
	return {
		clientX: rect.left + x0 + (x1 - x0) * fraction,
		clientY: rect.top + rect.height * fraction,
		bubbles: true
	}
}

tape('isoformPairRangeSelect() - both tracks drop the isoforms no breakpoint is on', test => {
	const holder = select(document.body).append('div')
	/* the fragment transcripts of each locus lie outside the breakpoints of pairLinks: the
	BCR ones before its first breakpoint or after its last, the ABL1 one past its second exon */
	const abl1Tail: GeneModel = {
		isoform: 'ENST_abl1_tail',
		chr: 'chr9',
		start: 130950000,
		stop: 130950200,
		strand: '+',
		exon: [[130950000, 130950200]]
	}
	const opts = pairOpts()
	const api = isoformPairRangeSelect({
		holder,
		self: { ...opts.self, allgm: [bcr, bcrHead, bcrTail] },
		partner: { ...opts.partner, allgm: [abl1, abl1Tail] },
		links: opts.links,
		callback: () => {}
	})!
	const sketches = (testid: string) => holder.select(`[data-testid="${testid}"]`).selectAll('canvas').nodes().length
	test.equal(sketches('sjpp-isoformPairSelect-selfTrack'), 1, 'the term gene keeps only the isoform of its breakpoints')
	test.equal(sketches('sjpp-isoformPairSelect-partnerTrack'), 1, 'and the partner only the isoform of its own')
	// the dropped isoforms are out of the layout too, not merely undrawn
	test.ok(api.selfScale.start > bcrHead.stop, 'the term track is not stretched over a fragment before it')
	test.ok(api.selfScale.stop < bcrTail.start, 'nor over one after it')
	test.ok(api.partnerScale.stop < abl1Tail.start, 'and neither is the partner track')
	test.equal(holder.text().includes('ENST_head'), false, 'a dropped isoform is not labelled either')
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - render', test => {
	const holder = select(document.body).append('div')
	const api = isoformPairRangeSelect({ holder, ...pairOpts(), callback: () => {} })!
	test.ok(api, 'renders the paired view')
	test.ok(holder.select('[data-testid="sjpp-isoformPairSelect-links"]').node(), 'renders the links between the genes')
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-selfTrack"]').node(),
		'renders the track of the term gene'
	)
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-partnerTrack"]').node(),
		'renders the track of the partner gene'
	)
	/* the links canvas plus one isoform sketch per track. NOTE no canvas of breakpoint marks
	beside either gene: the links already converge on every breakpoint */
	test.equal(holder.selectAll('canvas').nodes().length, 3, 'renders a sketch for the isoform of each gene')
	test.ok(holder.text().includes('BCR'), 'labels the track of the term gene')
	test.ok(holder.text().includes('ABL1'), 'labels the track of the partner gene')
	// each gene is on its own chr, so each track has its own scale
	test.equal(api.selfScale.chr, 'chr22', 'the top track is scaled over the term gene')
	test.equal(api.partnerScale.chr, 'chr9', 'the bottom track is scaled over the partner gene')
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text().includes('3 breakpoint pairs'),
		'reports the number of breakpoint pairs'
	)
	test.equal(
		holder.select('[data-testid="sjpp-isoformPairSelect-overlay"]').style('display'),
		'none',
		'no selection highlight without an initial range'
	)
	test.equal(
		holder.select('[data-testid="sjpp-isoformPairSelect-selfOverlay"]').node(),
		null,
		'no highlight of the term gene without a range on it'
	)
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - the selected range is on the partner gene', test => {
	const holder = select(document.body).append('div')
	let applied: any = 'not called'
	const opts = pairOpts()
	isoformPairRangeSelect({
		holder,
		...opts,
		// covers the ABL1 breakpoint of the two junctions to it, not the third pair
		partner: { ...opts.partner, range: { start: 130713000, stop: 130713200 } },
		callback: r => (applied = r)
	})!
	const overlay = holder.select('[data-testid="sjpp-isoformPairSelect-overlay"]')
	test.notEqual(overlay.style('display'), 'none', 'initial range is highlighted')
	// the highlight spans the partner track only, as the range is not on the term gene
	test.ok(Number(overlay.style('top').replace('px', '')) > 0, 'the highlight starts below the top track')
	const info = holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text()
	test.ok(info.includes('2 of 3 breakpoint pairs'), 'counts the pairs breaking within the range')
	test.ok(info.includes('30 samples'), 'sums the samples of those pairs')
	const inputs = holder.selectAll('[data-testid="sjpp-isoformRangeSelect-pos"]').nodes() as HTMLInputElement[]
	test.equal(inputs[0].value, '130713000', 'the coordinate inputs hold the range of the partner gene')
	;(holder.select('[data-testid="sjpp-isoformRangeSelect-apply"]').node() as HTMLButtonElement).click()
	test.deepEqual(applied, { chr: 'chr9', start: 130713000, stop: 130713200 }, 'apply calls back with the partner range')
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - range on the term gene is context only', test => {
	/* the range on the term's own gene is owned by a control that applies term-wide, so it
	is shown here rather than edited: the pairs failing it cannot match however the partner
	range is placed, so they are reported apart from the ones that still can */
	const holder = select(document.body).append('div')
	const opts = pairOpts()
	const api = isoformPairRangeSelect({
		holder,
		...opts,
		// covers the major BCR cluster only, so the pair of the minor one is unreachable
		self: { ...opts.self, range: { start: 23290000, stop: 23290200 } },
		partner: { ...opts.partner, range: { start: 130713000, stop: 130713200 } },
		callback: () => {}
	})!
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-selfOverlay"]').node(),
		'the range on the term gene is highlighted'
	)
	const info = holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text()
	test.ok(info.includes('2 of 3 breakpoint pairs'), 'counts the pairs of the partner range')
	test.ok(info.includes('1 within the BCR range'), 'says how many of them the range on the term gene leaves')
	test.ok(info.includes('20 samples'), 'counts the samples of those alone')
	test.deepEqual(api.getRange(), { chr: 'chr9', start: 130713000, stop: 130713200 }, 'the range is of the partner gene')
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - hovering and clicking a link', test => {
	const holder = select(document.body).append('div')
	const api = isoformPairRangeSelect({ holder, ...pairOpts(), callback: () => {} })!
	const canvas = holder.select('[data-testid="sjpp-isoformPairSelect-links"]').node() as HTMLCanvasElement
	// near the partner end of the link, where the three of them have diverged
	canvas.dispatchEvent(new MouseEvent('mousemove', linkPoint(api, canvas, pairLinks[0], 0.85)))
	const info = holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text()
	test.ok(info.includes('BCR chr22:23,290,100'), 'reads out the breakpoint of the term gene')
	test.ok(info.includes('ABL1 chr9:130,713,100'), 'reads out the one of the partner it is joined to')
	test.ok(info.includes('20 samples'), 'reads out the samples of the pair')
	// a link is the finest selection there is, so clicking one takes its breakpoint
	canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }))
	test.deepEqual(
		api.getRange(),
		{ chr: 'chr9', start: 130713100, stop: 130713100 },
		'clicking a link selects the breakpoint it is joined to'
	)
	canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text().includes('2 of 3 breakpoint pairs'),
		'leaving the link reports the selection again'
	)
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - drag over the partner track', test => {
	const holder = select(document.body).append('div')
	const api = isoformPairRangeSelect({ holder, ...pairOpts(), callback: () => {} })!
	// the whole track is the drag surface, isoform sketches included
	const track = holder.select('[data-testid="sjpp-isoformPairSelect-partnerTrack"]').node() as HTMLElement
	const rect = track.getBoundingClientRect()
	// over the ABL1 breakpoint of the major junction, which is at the right of the track
	const x0 = api.partnerScale.pos2px(130700000)
	const x1 = api.partnerScale.pos2px(130760000)
	// on the isoform sketch at the bottom of the track, not on any strip of marks
	track.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left + x0, clientY: rect.bottom - 5, bubbles: true }))
	window.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + x1, clientY: rect.top + 5 }))
	window.dispatchEvent(new MouseEvent('mouseup', {}))
	const range = api.getRange()!
	test.equal(range.chr, 'chr9', 'the dragged range is on the partner gene')
	// the drag is mapped through the scale of the partner track, not that of the term gene
	test.ok(range.start <= 130713100 && range.stop >= 130713100, 'the dragged range covers the breakpoint under it')
	test.ok(range.stop < 130854000, 'and not the one outside it')
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text().includes('2 of 3 breakpoint pairs'),
		'the dragged range is reported'
	)
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - rna mode', test => {
	// both genes of one event are laid out the same way
	const holder = select(document.body).append('div')
	const api = isoformPairRangeSelect({ holder, ...pairOpts(), mode: 'rna', callback: () => {} })!
	test.equal(api.selfScale.mode, 'rna', 'the top track collapses its introns')
	test.equal(api.partnerScale.mode, 'rna', 'so does the bottom one')
	test.equal(
		holder.select('[data-testid="sjpp-isoformPairSelect-partnerTrack"]').attr('data-scale-mode'),
		'rna',
		'which the rendered marks declare'
	)
	test.equal(api.selfScale.rglst.length, bcr.exon.length, 'one region per exon of the term gene')
	test.equal(api.partnerScale.rglst.length, abl1.exon.length, 'and per exon of the partner')
	// the two scales are independent, so each collapses its own gene
	test.notEqual(api.selfScale.exonsf, api.partnerScale.exonsf, 'each gene is scaled over its own exon length')
	api.setRange({ chr: 'chr9', start: 130713000, stop: 130713200 })
	test.deepEqual(api.getRange(), { chr: 'chr9', start: 130713000, stop: 130713200 }, 'the selected range is genomic')
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text().includes('2 of 3 breakpoint pairs'),
		'the pairs of the range are counted by position, as in genomic mode'
	)
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - rna mode zooms each track to its own breakpoints', test => {
	const holder = select(document.body).append('div')
	const api = isoformPairRangeSelect({
		holder,
		self: { gene: 'GENEA', chr: 'chr1', allgm: [manyExons] },
		// the partner has few enough exons that there is nothing to win by zooming it
		partner: { gene: 'ABL1', chr: 'chr9', allgm: [abl1] },
		links: [{ selfPos: exonStart(5) + 200, partnerPos: 130713100, samplecount: 20 }],
		mode: 'rna',
		callback: () => {}
	})!
	test.equal(api.selfScale.zoomed, true, 'the track of the many-exon gene is zoomed')
	test.equal(api.selfScale.rglst.length, 3, 'to the exon of its breakpoint and one of context each side')
	test.equal(api.partnerScale.zoomed, false, 'the track of the few-exon gene is not')
	// each track names its own locus, or its chr alone when the whole gene is drawn
	const loci = holder.selectAll('[data-testid="sjpp-isoformPairSelect-locus"]').nodes() as HTMLElement[]
	test.equal(loci[0].textContent, 'chr1:33-49kb', 'the zoomed track is labelled with its window')
	test.equal(loci[1].textContent, 'chr9', 'the other names its chr alone, not a window it is not showing')
	// the link still meets the mark of its breakpoint, which the window is built around
	test.ok(api.selfScale.pos2px(exonStart(5) + 200) > 0, 'the breakpoint is within the zoomed track')
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - sample counts of an upper bound tally', test => {
	const holder = select(document.body).append('div')
	const opts = pairOpts()
	const api = isoformPairRangeSelect({
		holder,
		...opts,
		partner: { ...opts.partner, range: { start: 130713000, stop: 130713200 } },
		samplesAreUpperBound: true,
		callback: () => {}
	})!
	test.ok(
		holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text().includes('up to 30 samples'),
		'a sum over links is reported as an upper bound'
	)
	// a single link is one pair of breakpoints, so its own count is exact either way
	const canvas = holder.select('[data-testid="sjpp-isoformPairSelect-links"]').node() as HTMLCanvasElement
	canvas.dispatchEvent(new MouseEvent('mousemove', linkPoint(api, canvas, pairLinks[0], 0.85)))
	const hover = holder.select('[data-testid="sjpp-isoformPairSelect-info"]').text()
	test.ok(hover.includes('20 samples') && !hover.includes('up to'), 'the count of one link is not hedged')
	holder.remove()
	test.end()
})

tape('isoformPairRangeSelect() - nothing to display', test => {
	const holder = select(document.body).append('div')
	// a partner that is an unannotated locus has no isoform, and here no breakpoint either
	const api = isoformPairRangeSelect({
		holder,
		self: { gene: 'BCR', chr: 'chr22', allgm: [bcr] },
		partner: { gene: 'chr9', chr: 'chr9', allgm: [] },
		links: [],
		callback: () => {}
	})
	test.equal(api, undefined, 'returns nothing when a track has neither a gene model nor a breakpoint')
	test.equal(holder.selectAll('canvas').nodes().length, 0, 'renders no canvas')
	test.ok(holder.text().includes('No gene model or breakpoint'), 'says there is nothing to display')
	holder.remove()
	test.end()
})
