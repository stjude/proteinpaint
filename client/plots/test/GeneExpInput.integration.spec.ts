import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION } from '#types'
import { select } from 'd3-selection'

/**
 * Tests
 *   - Test GeneExpInput rendering with GENE_EXPRESSION
 *   - Test GeneExpInput rendering with SINGLECELL_GENE_EXPRESSION
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { header_mode: 'hidden' },
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/GeneExpInput -***-')
	test.end()
})

tape('Test GeneExpInput rendering with GENE_EXPRESSION', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'GeneExpInput',
					termType: GENE_EXPRESSION
				}
			]
		},
		GeneExpInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(GeneExpInput) {
		const dom = GeneExpInput.Inner.dom
		test.equal(dom.header.plot.text(), 'GENE EXPRESSION', 'Header text should render with termtype.')
		const visibleTabs = GeneExpInput.Inner.tabs.filter(tab => tab?.isVisible).map(tab => tab.label)
		const tabs = dom.tabs
			.selectAll('button')
			.nodes()
			.map(n => n.textContent.trim())
		test.deepEqual(tabs, visibleTabs, 'Should display the correct number of tabs with correct labels.')

		const self = GeneExpInput.Inner
		const twoGenes = dom.tabs
			.selectAll('button')
			.nodes()
			.find(n => n.textContent.trim() == 'Two genes')
		twoGenes.click()
		test.equal(self.geneSearchMenus.length, 3, 'Should own the one-gene and two-gene search menus')
		const oldMenus = [...self.geneSearchMenus]
		await self.renderTermTypeUI(self.state)
		for (const menu of oldMenus) {
			test.notOk(menu.d.node().isConnected, 'Should remove old search menus when rebuilding the picker')
			test.notOk(
				select(document.body).on('mousedown.menu' + menu.typename),
				'Should remove old search menu body listeners'
			)
		}
		const menus = [...self.geneSearchMenus]
		GeneExpInput.destroy()
		self.app.destroy()
		for (const menu of menus) {
			test.notOk(menu.d.node().isConnected, 'Should remove search menus when the input is destroyed')
			test.notOk(
				select(document.body).on('mousedown.menu' + menu.typename),
				'Should remove search menu body listeners when the input is destroyed'
			)
		}
		test.end()
	}
})

tape('Test GeneExpInput rendering with SINGLECELL_GENE_EXPRESSION', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'GeneExpInput',
					termType: SINGLECELL_GENE_EXPRESSION
				}
			]
		},
		GeneExpInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(GeneExpInput) {
		const dom = GeneExpInput.Inner.dom
		test.equal(dom.header.plot.text(), 'SINGLE-CELL GENE EXPRESSION', 'Header text should render with termtype.')
		const visibleTabs = GeneExpInput.Inner.tabs.filter(tab => tab?.isVisible).map(tab => tab.label)
		const tabs = dom.tabs
			.selectAll('button')
			.nodes()
			.map(n => n.textContent.trim())
		test.deepEqual(tabs, visibleTabs, 'Should display the correct number of tabs with correct labels.')

		if (test['_ok']) GeneExpInput.Inner.app.destroy()
		test.end()
	}
})
