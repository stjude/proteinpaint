import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'

/*
Tests:
    Default boxplot
    Boxplot with overlay term = sex
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
	test.pass('-***- plots/boxplot -***-')
	test.end()
})

tape('Default boxplot', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'boxplot',
					term: {
						id: 'agedx',
						q: { mode: 'continuous' }
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(summary) {
		summary.on('postRender.test', null)

		// if (test._ok) summary.Inner.app.destroy()
		test.end()
	}
})

tape('Boxplot with overlay term = sex', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'boxplot',
					term: {
						id: 'agedx',
						q: { mode: 'continuous' }
					},
					term2: {
						id: 'sex'
					}
				}
			]
		},
		summary: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(summary) {
		summary.on('postRender.test', null)

		// if (test._ok) summary.Inner.app.destroy()
		test.end()
	}
})
