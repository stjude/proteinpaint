import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    - Render facet table
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
	test.pass('-***- plots/facet -***-')
	test.end()
})

tape.skip('Render facet table', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'facet',
					columnTw: {
						id: 'agedx'
					},
					rowTw: {
						id: 'diaggrp'
					}
				}
			]
		},
		facet: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(facet) {
		const table = facet.Inner.dom.mainDiv

		const headerNum = table.selectAll('th[data-testid="sjpp-facet-col-header"]').size()
		test.equal(headerNum, 5, 'Should render 5 headers')
		const rowNum = table.selectAll('td[data-testid="sjpp-facet-row-label"]').size()
		test.equal(rowNum, 10, 'Should render 10 rows')

		const prompt = table.select('div[data-testid="sjpp-facet-start-prompt"]')
		test.true(
			prompt && prompt.text() == 'Select samples to see data',
			'Should render prompt to select cells on render.'
		)

		const blankCells = await detectGte({
			elem: table.node(),
			selector: 'td.highlightable-cell'
		})
		test.equal(blankCells.length, 24, 'Should render over 20 blank, highlightable cells.')

		const clickableCells = await detectGte({
			elem: table.node(),
			selector: 'td.sja_menuoption'
		})
		test.equal(clickableCells.length, 26, 'Should render over 20 clickable cells.')

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})
