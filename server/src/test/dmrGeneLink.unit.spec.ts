import tape from 'tape'
import { buildTssIndex, genesForDmr, linkDmrsToGenes, classifyLink } from '../utils/dmrGeneLink.ts'

// plus-strand gene A: TSS 10,000; minus-strand gene B: TSS at its stop, 100,000
const idx = buildTssIndex([
	{ name: 'A', chr: 'chr1', start: 10_000, stop: 50_000, strand: '+' },
	{ name: 'B', chr: 'chr1', start: 60_000, stop: 100_000, strand: '-' }
])
const dmr = (start: number, stop: number, meandiff = -0.2, no_cpgs = 10) => ({
	chr: 'chr1',
	start,
	stop,
	no_cpgs,
	meandiff,
	min_smoothed_fdr: 1e-5
})

tape('genesForDmr places DMRs by strand-aware TSS', t => {
	t.deepEqual(
		genesForDmr(idx, dmr(8_500, 9_000)),
		[{ gene: 'A', context: 'promoter' }],
		'upstream of a + TSS, outside the span'
	)
	t.deepEqual(genesForDmr(idx, dmr(30_000, 31_000)), [{ gene: 'A', context: 'body' }], 'mid-gene')
	t.deepEqual(
		genesForDmr(idx, dmr(60_000, 60_500)),
		[{ gene: 'B', context: 'body' }],
		'the start of a - gene is its 3′ end'
	)
	t.deepEqual(genesForDmr(idx, dmr(101_000, 101_500)), [{ gene: 'B', context: 'promoter' }], 'upstream of a - TSS')
	t.deepEqual(genesForDmr(idx, dmr(55_000, 56_000)), [], 'intergenic')
	t.deepEqual(genesForDmr(idx, { chr: 'chr2', start: 1, stop: 2 }), [], 'unknown chromosome')
	t.end()
})

tape('linkDmrsToGenes keeps the strongest DMR per gene and context', t => {
	const links = linkDmrsToGenes(
		[dmr(20_000, 21_000, -0.1), dmr(30_000, 31_000, 0.3), dmr(40_000, 41_000, 0.5, 2)],
		idx,
		5
	)
	t.equal(links.length, 1)
	t.equal(links[0].nDmrs, 2, 'the 2-CpG DMR is below the floor')
	t.equal(links[0].dmr.deltaBeta, 0.3)
	t.end()
})

tape('classifyLink reads promoter and body in opposite directions', t => {
	t.equal(classifyLink('promoter', 0.2, { fc: -1, p: 0.01 }), 'concordant', 'promoter hyper, expression down')
	t.equal(classifyLink('promoter', 0.2, { fc: 1, p: 0.01 }), 'discordant')
	t.equal(classifyLink('body', -0.2, { fc: -1, p: 0.01 }), 'concordant', 'body hypo, expression down')
	t.equal(classifyLink('body', -0.2, { fc: 1, p: 0.01 }), 'discordant')
	t.equal(classifyLink('body', -0.2, { fc: -1, p: 0.2 }), 'no expression change')
	t.equal(classifyLink('body', -0.2, undefined), 'not tested')
	t.end()
})
