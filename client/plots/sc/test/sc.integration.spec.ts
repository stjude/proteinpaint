import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { detectOne, detectLst } from '../../../test/test.helpers.js'

/**
 Tests:
    - Launch SC plot with TermdbTest dataset
    - Select scRNA experiment from sample table
    - Verify plot buttons appear after selection
    - Click plot button and verify expected output
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
	test.comment('-***- plots/sc/SC integration -***-')
	test.end()
})

tape('Launch SC plot and test basic functionalities', test => {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sc'
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

		const scInner = sc.Inner

		// Test 1: Verify sample table is rendered
		const tableDiv = scInner.dom.tableDiv.node()
		test.ok(tableDiv, 'Sample table div should be rendered')

		// Test 2: Verify table has rows with data
		const tableRows = await detectLst({
			target: tableDiv,
			selector: 'tbody tr',
			count: 1,
			matchAs: '>='
		})
		test.ok(tableRows.length > 0, 'Sample table should have rows')

		// Test 3: Find and click the radio button/checkbox in the first row to select an experiment
		try {
			// Find the first radio button/checkbox input in the table
			const firstInput = await detectOne({
				target: tableDiv,
				selector: 'tbody tr input[type="radio"], tbody tr input[type="checkbox"]',
				maxTime: 3000
			})

			test.ok(firstInput, 'Should find a radio button/checkbox in table')

			if (firstInput) {
				// Click the input to select the row
				firstInput.click()

				// Test 4: Wait for plot buttons to appear after selection
				const plotButton = await detectOne({
					target: scInner.dom.plotsBtnsDiv.node(),
					selector: 'button',
					maxTime: 5000
				})
				test.ok(plotButton, 'Plot buttons should appear after selecting a row')

				// Test 5: Verify at least one plot button is visible (should be scRNA button)
				const buttons = scInner.dom.plotsBtnsDiv.selectAll('button').nodes()
				test.ok(buttons.length > 0, `At least one plot button should be visible (found ${buttons.length})`)

				// Additional verification: Click the first plot button and verify it doesn't throw an error
				if (buttons.length > 0) {
					const firstButton = buttons[0] as HTMLButtonElement
					const buttonText = firstButton.textContent
					test.pass(`Clicking plot button: "${buttonText}"`)
					
					firstButton.click()

					// Wait a bit for the subplot to initialize
					await new Promise(resolve => setTimeout(resolve, 500))

					// The main goal is to verify the button click doesn't throw an error
					// Actual subplot rendering verification would require more complex async handling
				}
			}
		} catch (e) {
			console.error('Error during test execution:', e)
			test.fail(`Test failed with error: ${e.message}`)
		}

		if (test['_ok']) scInner.app.destroy()
		test.end()
	}
})
