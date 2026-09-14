import tape from 'tape'
import { genesAt, buildGeneIndex, MAX_GENES_PER_DMR } from '#src/utils/dmrGenes.ts'

/*
test sections:

genesAt: overlap, including genes that start long before the DMR
genesAt: boundaries and absent chromosomes
buildGeneIndex: a genome without gene2coord degrades rather than throwing
*/

/** A scan reports coordinates; the gene name is what makes a row actionable. The case that breaks
 * a naive implementation is a long gene starting far upstream -- DMD spans 2.2Mb, so a DMR inside
 * it is nowhere near its start, and any search that only looks at nearby starts misses it. */

const idx = (genes: [string, string, number, number][]) =>
	buildGeneIndex({
		genedb: {
			db: { prepare: () => ({ all: () => genes.map(g => ({ name: g[0], chr: g[1], start: g[2], stop: g[3] })) }) }
		}
	})!

tape('\n', t => {
	t.comment('-***- dmrGenes specs -***-')
	t.end()
})

tape('genesAt finds overlapping genes including long upstream ones', t => {
	const i = idx([
		['SHORT', 'chr1', 1000, 2000],
		['HUGE', 'chr1', 500, 2_500_000],
		['FAR', 'chr1', 3_000_000, 3_001_000]
	])
	t.deepEqual(genesAt(i, 'chr1', 1200, 1300), ['HUGE', 'SHORT'], 'both overlapping genes, in genomic order')
	t.deepEqual(genesAt(i, 'chr1', 2_400_000, 2_400_100), ['HUGE'], 'a gene starting 2.4Mb upstream is still found')
	t.deepEqual(genesAt(i, 'chr1', 2_600_000, 2_600_100), [], 'past its end, it is not')
	t.deepEqual(genesAt(i, 'chr1', 3_000_500, 3_000_600), ['FAR'], 'and a distant gene is found on its own')
	t.end()
})

tape('genesAt boundaries and unknown chromosomes', t => {
	const i = idx([['G', 'chr1', 1000, 2000]])
	t.deepEqual(genesAt(i, 'chr1', 500, 1000), [], 'a DMR ending exactly at the gene start does not overlap')
	t.deepEqual(genesAt(i, 'chr1', 2000, 2500), [], 'nor one starting exactly at the gene stop')
	t.deepEqual(genesAt(i, 'chr1', 999, 1001), ['G'], 'one base of overlap counts')
	t.deepEqual(genesAt(i, 'chr2', 1000, 2000), [], 'a chromosome with no genes returns nothing')
	t.end()
})

tape('a genome without gene2coord degrades quietly', t => {
	t.equal(buildGeneIndex({}), null, 'no genedb => no index, not a throw')
	t.equal(
		buildGeneIndex({
			genedb: {
				db: {
					prepare: () => {
						throw new Error('no such table')
					}
				}
			}
		}),
		null,
		'missing gene2coord table => no index; the column is simply omitted'
	)
	t.ok(MAX_GENES_PER_DMR > 0, 'the per-DMR cap is set')
	t.end()
})
