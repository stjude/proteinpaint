import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'

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
        test.equal(dom.header.text(), 'Gene Expression', 'Header text should render with termtype.')
        const visibleTabs = GeneExpInput.Inner.tabs.filter(tab => tab?.isVisible).map(tab => tab.label)
        const tabs = dom.tabs.selectAll('button').nodes().map(n => n.textContent.trim())
        test.deepEqual(tabs, visibleTabs, 'Should display the correct number of tabs with correct labels.')
		
		if (test['_ok']) GeneExpInput.Inner.app.destroy()
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
        test.equal(dom.header.text(), 'Single-cell Gene Expression', 'Header text should render with termtype.')
		const visibleTabs = GeneExpInput.Inner.tabs.filter(tab => tab?.isVisible).map(tab => tab.label)
        const tabs = dom.tabs.selectAll('button').nodes().map(n => n.textContent.trim())
        test.deepEqual(tabs, visibleTabs, 'Should display the correct number of tabs with correct labels.')

		if (test['_ok']) GeneExpInput.Inner.app.destroy()
		test.end()
	}
})
