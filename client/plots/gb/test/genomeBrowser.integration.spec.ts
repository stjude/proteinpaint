import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { detectGt, detectOne, sleep } from '../../../test/test.helpers.js'
import { getFilter_agedx, getFilter_Hodgkin } from '../../../test/testdata/data'

/*******************
 Tests:
    protein mode
    genomic mode
    add variants track
    protein mode with global filter (state.termfilter.filter)
    protein mode with local filter (config.filter)
    protein mode with both global and local filter
    filter change triggers block recreation
********************/

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
		// Verify Variants tab is active after clicking
		const activeTabBeforeCheckbox = tabsDiv.select('button.sjpp-active').datum()
		test.ok(activeTabBeforeCheckbox, 'Should have an active tab')
		if (activeTabBeforeCheckbox) {
			test.equal(activeTabBeforeCheckbox.label, 'Variants', 'Variants tab should be active after clicking')
		}
		const variantsCheckbox = tabsDiv.select('input[type="checkbox"]').node()
		variantsCheckbox.click()
		await sleep(1000) // to allow mds3 tk to show
		const blockDiv = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
		test.ok(blockDiv, 'Should render block')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 4, 'Block has 4 tracks')
		const variantTk = tklst[3]
		const variants = await detectGt({ elem: variantTk, selector: '.sja_aa_discg' })
		test.ok(variants.length > 0, 'Should render variants in variants track')
		// Test for duplicate gene search box bug fix
		const geneSearchDivs = dom.geneSearchDiv.selectAll(':scope > div').nodes()
		test.equal(geneSearchDivs.length, 1, 'Should have only one gene search box (no duplicates)')
		// Test that Variants tab remains active after checking the checkbox
		const activeTabAfterCheckbox = tabsDiv.select('button.sjpp-active').datum()
		test.ok(activeTabAfterCheckbox, 'Should have an active tab after checkbox toggle')
		if (activeTabAfterCheckbox) {
			test.equal(activeTabAfterCheckbox.label, 'Variants', 'Variants tab should remain active after checkbox toggle')
		}
		if (test._ok) gb.Inner.app.destroy()
		test.end()
	}
})

tape('protein mode with global filter (state.termfilter.filter)', (test: any) => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			termfilter: { filter: getFilter_Hodgkin() },
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
		test.ok(blockDiv, 'Should render block with a global termfilter applied')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 3, 'Block has 3 tracks with global filter')
		// verify state was wired with the global filter
		const state = gb.Inner.app.getState()
		// just tvslst len is ok
		test.equal(state.termfilter.filter.lst.length, 2, 'state.termfilter.filter.lst.length=2')
		const proteinTk = tklst[2]
		const rects = await detectGt({ elem: proteinTk, selector: 'rect' })
		test.ok(rects, 'Should have rect elements in protein track when a global filter is set')
		if (test._ok) gb.Inner.app.destroy()
		test.end()
	}
})

tape('protein mode with local filter (config.filter)', (test: any) => {
	test.timeoutAfter(3000)
	const LF = getFilter_Hodgkin()
	runpp({
		state: {
			plots: [
				{
					chartType: 'genomeBrowser',
					geneSearchResult: { geneSymbol: 'TP53' },
					filter: LF
				}
			]
		},
		genomeBrowser: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(gb) {
		gb.on('postRender.test', null)
		const dom = gb.Inner.dom
		const blockDiv = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
		test.ok(blockDiv, 'Should render block with a local plot config.filter applied')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 3, 'Block has 3 tracks with local filter')
		// verify the plot config carried the local filter into app state
		const state = gb.Inner.app.getState()
		const plotConfig = state.plots.find(p => p.id === gb.Inner.id)
		test.ok(plotConfig, 'Should find plot config in app state')
		test.equal(plotConfig.filter.lst.length, LF.lst.length, 'plot config.filter.lst.length is as expected')
		const proteinTk = tklst[2]
		const rects = await detectGt({ elem: proteinTk, selector: 'rect' })
		test.ok(rects, 'Should have rect elements in protein track when a local filter is set')
		if (test._ok) gb.Inner.app.destroy()
		test.end()
	}
})

tape('protein mode with both global and local filter', (test: any) => {
	test.timeoutAfter(3000)

	const LF = getFilter_agedx(0)
	runpp({
		state: {
			termfilter: { filter: getFilter_Hodgkin() },
			plots: [
				{
					chartType: 'genomeBrowser',
					geneSearchResult: { geneSymbol: 'TP53' },
					filter: LF
				}
			]
		},
		genomeBrowser: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(gb) {
		gb.on('postRender.test', null)
		const dom = gb.Inner.dom
		const blockDiv = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
		test.ok(blockDiv, 'Should render block with both global and local filters applied')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 3, 'Block has 3 tracks with combined global+local filter')
		// verify both filters made it into app state
		const state = gb.Inner.app.getState()
		test.equal(state.termfilter.filter.lst.length, 2, 'state.termfilter.filter.lst.length=2')
		const plotConfig = state.plots.find(p => p.id === gb.Inner.id)
		test.ok(plotConfig, 'Should find plot config in app state')
		test.equal(plotConfig.filter.lst.length, LF.lst.length, 'plot config.filter should equal the supplied local filter')
		const proteinTk = tklst[2]
		const rects = await detectGt({ elem: proteinTk, selector: 'rect' })
		test.ok(rects, 'Should have rect elements in protein track when both filters are set')
		if (test._ok) gb.Inner.app.destroy()
		test.end()
	}
})

tape('filter change triggers block recreation', (test: any) => {
	test.timeoutAfter(6000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'genomeBrowser',
					geneSearchResult: { geneSymbol: 'TP53' }
				}
			]
		},
		genomeBrowser: { callbacks: { 'postRender.test': firstRender } }
	})

	async function firstRender(gb) {
		gb.on('postRender.test', null)
		const dom = gb.Inner.dom
		const blockDivBefore = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
		test.ok(blockDivBefore, 'Should render block before filter change')

		let ended = false
		function safeEnd() {
			if (!ended) {
				ended = true
				gb.Inner.app.destroy() // always destroy
				test.end()
			}
		}

		gb.on('postRender.test', async function secondRender(gb2) {
			gb2.on('postRender.test', null)
			const blockDivAfter = await detectOne({ elem: dom.blockHolder.node(), selector: '.sja_Block_div' })
			test.ok(blockDivAfter, 'Should render block after filter change')
			test.notEqual(
				blockDivBefore,
				blockDivAfter,
				'Block DOM node should be recreated (old node removed) after filter change'
			)
			const state = gb2.Inner.app.getState()
			test.ok(state.termfilter.filter.lst.length > 0, 'Global filter should be applied in state after dispatch')
			safeEnd()
		})

		await gb.Inner.app.dispatch({
			type: 'filter_replace',
			filter: getFilter_Hodgkin()
		})
	}
})
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
