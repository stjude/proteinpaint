import tape from 'tape'
// import * as d3s from 'd3-selection'
import { string2variant } from '../genesearch.ts'
import { hg38 } from '../../test/testdata/genomes'
// import { Menu } from '../menu'

/* Tests
    - string2variant() - HGVS deletion and delins variants
*/

/**************
 helper functions
***************/

// function getHolder() {
// 	return d3s.select('body').append('div').style('padding', '5px').style('margin', '5px')
// }

// function getRow(holder) {
// 	return holder.append('div').style('border', '1px solid #aaa').style('padding', '5px')
// }

// function getSearchBox(holder, opts = {}) {
// 	const _opts = {
// 		genome: hg38,
// 		tip: new Menu({ padding: '' }),
// 		row: getRow(holder)
// 	}

// 	const args = Object.assign(_opts, opts)
// 	addGeneSearchbox(args)
// }

/**************
 integration tests
***************/

tape('\n', test => {
	test.pass('-***- dom/genesearch integration -***-')
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

	test.end()
})
