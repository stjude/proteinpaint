import tape from 'tape'
import { validGeneSetGroup, validNumPermutations, MAX_PERMUTATIONS } from '#src/utils/genesetGroups.ts'

/*
test sections:

validGeneSetGroup(): genome analysisGenesetGroups and blitzgsea libraries
validNumPermutations(): integer range
*/

const genome = {
	termdbs: {
		msigdb: {
			analysisGenesetGroups: [
				{ label: '-', value: '-' },
				{ label: 'H: hallmark gene sets', value: 'H: hallmark gene sets' }
			]
		}
	}
}

tape('\n', test => {
	test.comment('-***- utils/genesetGroups specs -***-')
	test.end()
})

tape('validGeneSetGroup()', test => {
	test.equal(
		validGeneSetGroup(genome, 'H: hallmark gene sets'),
		'H: hallmark gene sets',
		'should accept a listed group'
	)
	test.equal(
		validGeneSetGroup(genome, 'KEGG--blitzgsea', true),
		'KEGG--blitzgsea',
		'should accept a blitzgsea library for blitzgsea'
	)
	test.throws(
		() => validGeneSetGroup(genome, 'KEGG--blitzgsea'),
		/invalid geneSetGroup/,
		'should reject a blitzgsea library for another method'
	)
	for (const group of ["x' UNION SELECT name FROM sqlite_master--", 'CGP: chemical and genetic perturbations', ''])
		test.throws(() => validGeneSetGroup(genome, group, true), `should reject geneSetGroup=${group}`)
	test.throws(() => validGeneSetGroup(genome, ['H: hallmark gene sets']), 'should reject a non-string')
	test.throws(
		() => validGeneSetGroup({}, 'H: hallmark gene sets'),
		'should reject when the genome has no msigdb groups'
	)
	test.end()
})

tape('validNumPermutations()', test => {
	test.equal(validNumPermutations(1000), 1000, 'should accept an integer')
	test.equal(validNumPermutations('250'), 250, 'should convert a string from a GET request')
	for (const n of [undefined, '', -1, 1.5, MAX_PERMUTATIONS + 1, '1e9', 'abc'])
		test.throws(() => validNumPermutations(n), /num_permutations/, `should reject num_permutations=${n}`)
	test.end()
})
