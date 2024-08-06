import tape from 'tape'
import { string2variant } from '../genesearch.ts'
import { hg38 } from '../../test/testdata/genomes'

/* Tests
    - string2variant() - HGVS deletion and delins variants


	TODO: 
	- getRefAllele
	- checkInput, snp and gene
	- geneCoordSearch
*/

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/genesearch.integration -***-')
	test.end()
})

tape('string2variant() - HGVS deletion and delins variants', async test => {
	test.timeoutAfter(300)

	let variant, expected

	//HGVS variant -> deletion
	variant = await string2variant('chr17:g.7673802delCGCACCTCAAAGCTGTTC', hg38)
	expected = {
		isVariant: true,
		chr: 'chr17',
		pos: 7673802,
		ref: 'CGCACCTCAAAGCTGTTC',
		alt: '-'
	}
	test.deepEqual(variant, expected, 'Should parse HGVS string into a Deletion variant object')

	variant = await string2variant('chr2:g.119955155_119955159delTTTTT', hg38)
	expected = {
		isVariant: true,
		chr: 'chr2',
		pos: 119955155,
		ref: 'TTTTT',
		alt: '-'
	}
	test.deepEqual(
		variant,
		expected,
		'Should return correct deletion variant object when start and stop positions given.'
	)

	variant = await string2variant('chr17:g.abcdelCGCACCTCAAAGCTGTTC', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid position for deletion format')

	variant = await string2variant('chr2:g.abc_119955159delTTTTT', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid start position for deletion format')

	variant = await string2variant('chr2:g.119955155_abcdelTTTTT', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid start position for deletion format')

	//HGVS variant -> deletion/insertion
	variant = await string2variant('chr2:g.119955155_119955159delinsTTTTT', hg38)
	expected = {
		isVariant: true,
		chr: 'chr2',
		pos: 119955155,
		ref: 'AGCTG',
		alt: 'TTTTT'
	}
	test.deepEqual(variant, expected, 'Should parse HGVS string into a Delins variant object')

	variant = await string2variant('chr2:g._delinsTTTTT', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid delins format')

	variant = await string2variant('chr2:g.abc_119955159delinsTTTTT', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid position for delins format')

	test.end()
})
