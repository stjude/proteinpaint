import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { detectGt, detectOne } from '../../test/test.helpers.js'

/*******************
 Tests:
    protein mode
    genomic mode
    add variants track
********************/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' }
	},
	debug: 1
})

/**************
 test sections
****************/

tape('\n', test => {
	test.comment('-***- plots/genomeBrowser -***-')
	test.end()
})

tape('protein mode', (test: any) => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'genomeBrowser',
					geneSearchResult: { geneSymbol: 'TP53' }
				}
			]
		},
		genomeBrowser: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(gb) {
		gb.on('postRender.test', null)
		const dom = gb.Inner.dom
		const blockDiv = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
		test.ok(blockDiv, 'Should render block')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 3, 'Block has 3 tracks')
		const proteinTk = tklst[2]
		const rects = await detectGt({ elem: proteinTk, selector: 'rect' })
		test.ok(rects, 'Should have rect elements in protein track')
		if (test._ok) gb.Inner.app.destroy()
		test.end()
	}
})

tape('genomic mode', (test: any) => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'genomeBrowser',
					geneSearchResult: { chr: 'chr17', start: 7666657, stop: 7688274 }
				}
			]
		},
		genomeBrowser: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(gb) {
		gb.on('postRender.test', null)
		const dom = gb.Inner.dom
		const blockDiv = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
		test.ok(blockDiv, 'Should render block')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 3, 'Block has 3 tracks')
		const gmTk = tklst[2]
		const image = await detectOne({ elem: gmTk, selector: 'image' })
		test.ok(image, 'Should have an image in gene model track')
		if (test._ok) gb.Inner.app.destroy()
		test.end()
	}
})

tape('add variants track', (test: any) => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'genomeBrowser',
					geneSearchResult: { geneSymbol: 'TP53' }
				}
			]
		},
		genomeBrowser: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(gb) {
		gb.on('postRender.test', null)
		const dom = gb.Inner.dom
		const tabsDiv = dom.tabsDiv
		const tabs = tabsDiv.selectAll('[data-testid="sja_toggle_button"]').nodes()
		const variantsTab = tabs[1]
		variantsTab.click()
		const variantsCheckbox = tabsDiv.select('input[type="checkbox"]').node()
		variantsCheckbox.click()
		const blockDiv = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
		test.ok(blockDiv, 'Should render block')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 4, 'Block has 4 tracks')
		const variantTk = tklst[0]
		const variants = await detectGt({ elem: variantTk, selector: '.sja_aa_discg' })
		test.ok(variants.length > 0, 'Should render variants in variants track')
		if (test._ok) gb.Inner.app.destroy()
		test.end()
	}
})
