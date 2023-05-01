import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { select, selectAll } from 'd3-selection'
import { detectOne, detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    Linear: continuous outcome = "hrtavg", cat. independents = "sex" + "genetic_race"
    Logistic: binary outcome = "hrtavg", continuous independent = "agedx"
    Cox: graded outcome = "Arrhythmias", discrete independent = "agedx"
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hide_search',
			activeTab: 1
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

tape('\n', test => {
	test.pass('-***- plots/regression -***-')
	test.end()
})

tape.only('Linear: continuous outcome = "hrtavg", cat. independents = "sex" + "genetic_race"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: {
						id: 'hrtavg',
						isAtomic: true
					},
					independent: [{ id: 'sex' }, { id: 'genetic_race' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regression) {
		console.log(regression.Inner)

		//Test all dom elements present
		test.ok(
			regression.Inner.dom.inputs.node().querySelector('#sjpp-vp-violinDiv'),
			`Should render violin plot for outcome variable`
		)
		test.equal(
			regression.Inner.dom.inputs
				.selectAll('table')
				.nodes()
				.filter(t => t.childNodes.length > 1).length,
			2,
			`Should render two tables for independent variables`
		)

		test.end()
	}
})

tape.skip('Logistic: binary outcome = "hrtavg", continuous independent = "agedx"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					outcome: {
						id: 'hrtavg',
						isAtomic: true
					},
					independent: [{ id: 'agedx' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regression) {
		console.log(regression.Inner)

		test.end()
	}
})

tape.skip('Cox: graded outcome = "Arrhythmias", discrete independent = "agedx"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'cox',
					outcome: {
						id: 'Arrhythmias'
					},
					independent: [{ id: 'agedx' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regression) {
		console.log(regression.Inner)

		test.end()
	}
})
