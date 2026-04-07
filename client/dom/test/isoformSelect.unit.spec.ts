import tape from 'tape'
import { allgm2sum } from '../isoformSelect'
import type { GeneModel } from '../types/isoformSelect'

/**
 * Unit tests for isoformSelect.ts module
 *
 * Test Coverage:
 * - allgm2sum() function that merges exon regions across gene models
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

	test.equal(chr1Regions.length, 2, 'chr1 should have 2 regions after merging')
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
