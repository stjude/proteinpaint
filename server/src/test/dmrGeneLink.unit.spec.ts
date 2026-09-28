import tape from 'tape'
import {
	buildTssIndex,
	genesForDmr,
	linkDmrsToGenes,
	classifyLink,
	geneSketch,
	cnvByGroup
} from '../utils/dmrGeneLink.ts'

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

tape('geneSketch orients both strands 5′→3′ and agrees with genesForDmr', t => {
	const dmrs = [dmr(8_500, 9_000), dmr(30_000, 31_000), dmr(101_000, 101_500), dmr(60_000, 60_500), dmr(5_000, 6_000)]
	const a = geneSketch(
		{ name: 'A', chr: 'chr1', start: 10_000, stop: 50_000, strand: '+', exon: [[10_000, 10_500]] },
		dmrs,
		5
	)
	t.equal(a.length, 40_000)
	t.deepEqual(a.exons, [[0, 500]])
	t.deepEqual(
		a.dmrs.map(d => [d.from, d.to, d.context]),
		[
			[-1_500, -1_000, 'promoter'],
			[20_000, 21_000, 'body']
		],
		'a DMR beyond the promoter window is left out'
	)
	const b = geneSketch(
		{
			name: 'B',
			chr: 'chr1',
			start: 60_000,
			stop: 100_000,
			strand: '-',
			exon: [
				[60_000, 61_000],
				[99_000, 100_000]
			]
		},
		dmrs,
		5
	)
	t.deepEqual(
		b.exons,
		[
			[0, 1_000],
			[39_000, 40_000]
		],
		'a - gene reads from its stop'
	)
	t.deepEqual(
		b.dmrs.map(d => [d.from, d.to, d.context]),
		[
			[-1_500, -1_000, 'promoter'],
			[39_500, 40_000, 'body']
		]
	)
	for (const d of [...a.dmrs, ...b.dmrs])
		t.ok(
			genesForDmr(idx, d).some(g => g.context == d.context),
			`${d.start}-${d.stop} gets the context genesForDmr gives it`
		)
	const short = geneSketch(
		{ name: 'S', chr: 'chr1', start: 10_000, stop: 11_000, strand: '+' },
		[dmr(11_500, 13_000)],
		5
	)
	t.deepEqual(
		short.dmrs.map(d => [d.from, d.to, d.context]),
		[[1_500, 2_000, 'promoter']],
		'a gene shorter than the window keeps the whole window, clipped at its edge'
	)
	t.end()
})

tape('cnvByGroup counts assayed samples with a gain or loss', t => {
	const cnvs = [
		{ class: 'CNV_amp', samples: [{ sample_id: 1 }] },
		{ class: 'CNV_amp', samples: [{ sample_id: 1 }] },
		{ class: 'CNV_loss', samples: [{ sample_id: 1 }] },
		{ class: 'CNV_loss', samples: [{ sample_id: 3 }] },
		{ class: 'CNV_amp', samples: [{ sample_id: 9 }] }
	]
	t.deepEqual(
		cnvByGroup(cnvs, [new Set([1, 2]), new Set([3, 4, 5])], new Set([1, 2, 3, 4])),
		[
			{ assayed: 2, gain: 1, loss: 1 },
			{ assayed: 2, gain: 0, loss: 1 }
		],
		'two gain segments count once, a breakpoint counts both ways, unassayed and out-of-group samples are ignored'
	)
	t.end()
})
