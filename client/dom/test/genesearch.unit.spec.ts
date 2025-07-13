import tape from 'tape'
import * as d3s from 'd3-selection'
import { addGeneSearchbox, string2variant } from '../genesearch.ts'
import { hg38 } from '../../test/testdata/genomes'
import { Menu } from '../menu'

/* Tests
    - Default gene search box
    - string2variant() - simple variant and HGVS snv and insertion variants
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

function getSearchBox(holder, opts = {}) {
	const _opts = {
		genome: hg38,
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
	test.comment('-***- dom/genesearch.unit-***-')
	test.end()
})

tape('Default gene search box', async test => {
	test.timeoutAfter(2000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	getSearchBox(holder, { tip })
	const searchInput = holder.select('input').node() as HTMLInputElement

	// The line below is for typescript to stop complaining
	if (!searchInput) test.fail('No gene search box created')
	test.ok(searchInput.tagName == 'INPUT', 'Should create an input element')
	test.equal(searchInput.placeholder, 'Gene, position, dbSNP', 'Should display the default placeholder text')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('string2variant() - simple variant and HGVS snv and insertion variants', async test => {
	test.timeoutAfter(300)

	type VariantData = { chr: string; pos: number; ref: string; alt: string; isVariant: boolean } | undefined
	let variant: VariantData, expected: VariantData

	//Simple variant
	variant = (await string2variant('chr1.387689.A.G', hg38)) as VariantData
	expected = {
		chr: 'chr1',
		pos: 387689,
		isVariant: true,
		ref: 'A',
		alt: 'G'
	}
	test.deepEqual(variant, expected, 'Should parse string into a simple variant object')

	variant = (await string2variant('chr1.387689', hg38)) as VariantData
	expected = undefined
	test.equal(variant, expected, 'Should return undefined if string input is missing a reference and alternate allele')

	// HGVS variant -> snv
	variant = (await string2variant('NC_000014.9:g.104776629T>C', hg38)) as VariantData
	expected = {
		isVariant: true,
		chr: 'NC_000014.9',
		pos: 104776629,
		ref: 'T',
		alt: 'C'
	}
	test.deepEqual(variant, expected, 'Should parse HGVS string into a SNV variant object')

	// HGVS variant -> insert
	variant = (await string2variant('chr5:g.171410539_171410540insTCTG', hg38)) as VariantData
	expected = {
		isVariant: true,
		chr: 'chr5',
		pos: 171410540,
		ref: '-',
		alt: 'TCTG'
	}
	test.deepEqual(variant, expected, 'Should parse HGVS string into an Insert variant object')

	test.end()
})
