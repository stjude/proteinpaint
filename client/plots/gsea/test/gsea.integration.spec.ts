import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
// import { SINGLECELL_CELLTYPE } from '#shared/terms.js'
import { getMockGSEAConfig } from './mockData.js'

/*
Tests:
	- Default gene expression GSEA
 */

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hidden'
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/gsea/GSEA -***-')
	test.end()
})

tape('Default gene expression GSEA', function (test) {
	test.timeoutAfter(100000)

	const config = getMockGSEAConfig()
	const plots = [config]

	runpp({
		state: { plots },
		gsea: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(gsea: any) {
		gsea.on('postRender.test', null)
		const dom = gsea.Inner.dom
		const foundPrompt = dom.actionsDiv.select('span[data-testid="sjpp-gsea-pathway"]')
		test.true(foundPrompt.size() === 1 && foundPrompt.text() === 'Select a gene set group:', 'Should render pathway prompt')
		const foundSelect = dom.actionsDiv.select('select')
		test.equals(foundSelect.size(), 1, 'Should render pathway select dropdown')
		const options = foundSelect.selectAll('option').nodes()
		test.true(options.length > 0, 'Rendered pathway select dropdown should have options')
		test.equals(options[0].textContent, 'H: hallmark gene sets', 'First option should be H: hallmark gene sets')
		const foundTable = dom.tableDiv.select('table')
		test.equals(foundTable.size(), 1, 'Should render results table')
		const foundTableRows = foundTable.selectAll('tbody tr').nodes()
		test.true(foundTableRows.length > 0, 'Results table should have rows')
		const foundTableHeaders = foundTable.selectAll('thead th').nodes()
		test.true(foundTableHeaders.length > 0, 'Results table should have headers')
		test.true(foundTableHeaders[0].textContent.startsWith('Gene Set'), 'First table header should be "Gene Set"')
		test.true(foundTableHeaders[3].textContent.startsWith('Total Gene Set Size'), 'Fourth table header should be "Total Gene Set Size"')

		if (test['_ok']) gsea.Inner.app.destroy()
		test.end()
	}
})
