import tape from 'tape'
import { msigdbTermdb, validGeneSetGroup, validNumPermutations, MAX_PERMUTATIONS } from '#src/utils/genesetGroups.ts'

/*
test sections:

msigdbTermdb(): the termdb of a request's MSigDB release
validGeneSetGroup(): termdb analysisGenesetGroups and blitzgsea libraries
validNumPermutations(): integer range
*/

const groups = [
	{ label: '-', value: '-' },
	{ label: 'H: hallmark gene sets', value: 'H: hallmark gene sets' }
]
const genome = {
	termdbs: {
		msigdb: { release: '2026.2.Hs', analysisGenesetGroups: groups },
		msigdb_2023_2: { release: '2023.2.Hs', analysisGenesetGroups: groups }
	}
}
const termdb = genome.termdbs.msigdb

tape('\n', test => {
	test.comment('-***- utils/genesetGroups specs -***-')
	test.end()
})

tape('msigdbTermdb()', test => {
	for (const r of [undefined, null, ''])
		test.equal(msigdbTermdb(genome, r), genome.termdbs.msigdb, `no release (${r}) gives termdbs.msigdb`)
	test.equal(msigdbTermdb(genome, '2023.2.Hs'), genome.termdbs.msigdb_2023_2, 'a listed release gives its termdb')
	test.equal(msigdbTermdb(genome, '2026.2.Hs'), genome.termdbs.msigdb, 'the current release gives termdbs.msigdb')
	test.throws(() => msigdbTermdb(genome, '2024.1.Hs'), /unknown msigdbRelease/, 'should reject an unlisted release')
	test.throws(() => msigdbTermdb(genome, ['2023.2.Hs']), /must be a string/, 'should reject a non-string')
	test.throws(() => msigdbTermdb({}, undefined), /not available/, 'should reject a genome without a gene set db')
	test.end()
})

tape('validGeneSetGroup()', test => {
	test.equal(
		validGeneSetGroup(termdb, 'H: hallmark gene sets'),
		'H: hallmark gene sets',
		'should accept a listed group'
	)
	test.equal(
		validGeneSetGroup(termdb, 'KEGG--blitzgsea', true),
		'KEGG--blitzgsea',
		'should accept a blitzgsea library for blitzgsea'
	)
	test.throws(
		() => validGeneSetGroup(termdb, 'KEGG--blitzgsea'),
		/invalid geneSetGroup/,
		'should reject a blitzgsea library for another method'
	)
	for (const group of ["x' UNION SELECT name FROM sqlite_master--", 'CGP: chemical and genetic perturbations', ''])
		test.throws(() => validGeneSetGroup(termdb, group, true), `should reject geneSetGroup=${group}`)
	test.throws(() => validGeneSetGroup(termdb, ['H: hallmark gene sets']), 'should reject a non-string')
	test.throws(() => validGeneSetGroup({}, 'H: hallmark gene sets'), 'should reject when the termdb has no groups')
	test.end()
})

tape('validNumPermutations()', test => {
	test.equal(validNumPermutations(1000), 1000, 'should accept an integer')
	test.equal(validNumPermutations('250'), 250, 'should convert a string from a GET request')
	for (const n of [undefined, '', -1, 1.5, MAX_PERMUTATIONS + 1, '1e9', 'abc'])
		test.throws(() => validNumPermutations(n), /num_permutations/, `should reject num_permutations=${n}`)
	test.end()
})
