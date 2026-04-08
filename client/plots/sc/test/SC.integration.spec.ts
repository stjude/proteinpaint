import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
Tests:
    - Test initial SC app rendering
 */

/*************************
 reusable helper functions
**************************/

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
	test.comment('-***- plots/sc/SC -***-')
	test.end()
})

tape('Test initial SC app rendering', test => {
	test.timeoutAfter(5000)
	const sampleColumnLabel = 'Test Column Label'

	runpp({
		state: {
			plots: [
				{
					chartType: 'sc',
					settings: {
						sc: {
							columns: {
								sample: sampleColumnLabel
							}
						}
					}
				}
			]
		},
		sc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(sc) {
		sc.on('postRender.test', null)

		const holder = sc.Inner.dom.div.node().parentNode

		// Test: Select button is shown
		const selectBtn = holder.querySelector('[data-testid="sjpp-sc-item-table-select-btn"]')
		test.ok(selectBtn, 'Select button is rendered')

		// Test: Item table div is visible with a table
		const tableDiv = holder.querySelector('#sjpp-sc-item-table')
		test.ok(tableDiv, 'Item table div exists')
		const table = tableDiv.querySelector('table')
		test.ok(table, 'Table is rendered inside item table div')

		// Test: Header row has the sample column label as the second cell
		const headerRow = table.querySelector('thead tr')
		test.ok(headerRow, 'Table has a header row')
		const headerCells = headerRow.querySelectorAll('th')
		test.ok(headerCells.length >= 1, 'Header row has at least one th cell')
		test.equal(
			headerCells[0].innerText.toLowerCase(),
			`${sampleColumnLabel.toLowerCase()}⇵`,
			`First th in header row equals the settings.sc.columns.sample value`
		)

		// Test: Table body has one row with 1_patient under the sample column
		const bodyRows = table.querySelectorAll('tbody tr')
		test.ok(bodyRows.length >= 1, 'Table has at least one data row')
		const firstRowCells = bodyRows[0].querySelectorAll('td')
		// The sample value is in the 3rd cell (after line number and radio button)
		const sampleCell = firstRowCells[2]
		test.equal(sampleCell.innerText, '1_patient', 'First data row has 1_patient as the sample value')

		if (test['_ok']) sc.Inner.app.destroy()
		test.end()
	}
})
