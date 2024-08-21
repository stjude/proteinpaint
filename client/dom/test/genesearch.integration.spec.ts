import tape from 'tape'
import { string2variant } from '../genesearch.ts'
import { hg38 } from '../../test/testdata/genomes'
import { dofetch3 } from '#common/dofetch'
import * as d3s from 'd3-selection'
import { addGeneSearchbox } from '../genesearch.ts'
import { Menu } from '../menu'
import { detectOne } from '../../test/test.helpers.js'

/* Tests
    - SKIPPED string2variant() - HGVS deletion and delins variants
	- search by p53 should find TP53
*/

/**************
 helper functions
***************/

function getHolder() {
	return d3s.select('body').append('div').style('padding', '5px').style('margin', '5px')
}

function getRow(holder) {
	return holder.append('div').style('border', '1px solid #aaa').style('padding', '5px')
}

async function getHg38test() {
	const response = await dofetch3('genomes', { body: { genome: 'hg38-test' } })
	return response.genomes['hg38-test']
}

async function getSearchBox(holder, opts = {}) {
	const hg38_test = await getHg38test()
	const _opts = {
		genome: hg38_test,
		tip: new Menu({ padding: '' }),
		row: getRow(holder)
	}

	const args = Object.assign(_opts, opts)
	addGeneSearchbox(args)
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/genesearch.integration -***-')
	test.end()
})

/*** Tests cannot be run on CI because the fasta file is not available ***
Run manually as needed. */
tape.skip('string2variant() - HGVS deletion and delins variants', async test => {
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
		ref: 'AGCTG', //on CI this shows as undefined because the fasta file is not available
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
		ref: 'AGCTG', //on CI this shows as undefined because the fasta file is not available
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

tape('search by p53 should find TP53', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	await getSearchBox(holder, { tip })
	const searchInput = holder.select('input').node() as HTMLInputElement

	/** Leave this
	 * Options populate slightly slower than tgit he menu
	 * Need to wait for options to appear before testing
	 */
	const gene = 'p53'
	const result = await detectOne({
		selector: '.sja_menuoption',
		target: tip.dnode,
		trigger() {
			searchInput.value = gene
			searchInput.dispatchEvent(new KeyboardEvent('keyup'))
		}
	})
	test.equal(result.textContent, 'TP53', 'found TP53') // p53=TP53 is fact and is not subject to change with test data unlike termdb data

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})
