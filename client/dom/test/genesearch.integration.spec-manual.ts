import tape from 'tape'
import { string2variant } from '../genesearch.ts'
import { hg38 } from '../../test/testdata/genomes'

/* Tests
    - string2variant() - HGVS deletion and delins variants

*** Tests cannot be run on CI because the fasta file is not available ***
Run manually as needed. 
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

	variant = await string2variant('chr2:g.119955155_119955159del', hg38)
	expected = {
		isVariant: true,
		chr: 'chr2',
		ref: 'AGCTG',//on CI this shows as undefined because the fasta file is not available
		alt: '-'
	}
	test.deepEqual(
		variant,
		expected,
		'Should return correct deletion variant object when start and stop positions are present but not a reference allele.'
	)

	variant = await string2variant('chr17:g.abcdelCGCACCTCAAAGCTGTTC', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid position for deletion format')

	variant = await string2variant('chr2:g.abc_119955159del', hg38)
	//expected = undefined
	test.equal(
		variant,
		expected,
		'Should return undefined for invalid start position for deletion with no reference allele'
	)

	variant = await string2variant('chr2:g.119955155_abcdel', hg38)
	//expected = undefined
	test.equal(
		variant,
		expected,
		'Should return undefined for invalid stop position for deletion with no reference allele'
	)

	//HGVS variant -> deletion/insertion
	variant = await string2variant('chr2:g.119955155_119955159delinsTTTTT', hg38)
	expected = {
		isVariant: true,
		chr: 'chr2',
		pos: 119955155,
		ref: 'AGCTG',//on CI this shows as undefined because the fasta file is not available
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
