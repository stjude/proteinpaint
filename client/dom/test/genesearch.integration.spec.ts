import tape from 'tape'
import * as d3s from 'd3-selection'
import { addGeneSearchbox } from '../genesearch.ts'
import { hg38 } from '../../test/testdata/genomes'
import { Menu } from '../menu'
import { detectOne } from '../../test/test.helpers.js'

/* Tests
    - Gene search results on keyup
*/

/**************
 test sections
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
	test.pass('-***- dom/genesearch.integration-***-')
	test.end()
})

tape('Gene search results on keyup', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	getSearchBox(holder, { tip })
	const searchInput = holder.select('input').node() as HTMLInputElement
	const gene = 'p53'

	//Check if the search box is functional
	await detectOne({
		target: tip.dnode,
		trigger() {
			searchInput.value = gene
			searchInput.dispatchEvent(new Event('keyup'))
		}
	})
	/** Leave this
	 * Options populate slightly slower than the menu
	 * Need to wait for options to appear before testing
	 */
	const result = await detectOne({
		selector: '.sja_menuoption',
		target: tip.dnode
	})
	test.true(result.textContent.includes(gene.toUpperCase()), 'Should display matching gene options')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})
