import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'

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

tape('Render facet table', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'facet',
					term: {
						id: 'agedx'
					},
					term2: {
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

	function runTests(facet) {
		const table = facet.Inner.dom.mainDiv

		const headerNum = table.selectAll('th[data-testid="sjpp-facet-col-header"]').size()
		test.equal(headerNum, 5, 'Should render 5 headers')
		const rowNum = table.selectAll('td[data-testid="sjpp-facet-row-label"]').size()
		test.equal(rowNum, 10, 'Should render 10 rows')

		const findSampleBtn = table.select('button').node()
		test.true(
			findSampleBtn && findSampleBtn.textContent == 'Show samples' && findSampleBtn.disabled,
			'Should render "Show samples" button that is disabled'
		)

		if (test['_ok']) facet.Inner.app.destroy()
		test.end()
	}
})
