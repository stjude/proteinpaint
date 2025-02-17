import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
Tests:
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
	test.pass('-***- plots/DEanalysis -***-')
	test.end()
})

tape('Default DEanalysis ', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'DEanalysis2' //Will change to DEanalysis once draft is stable
				}
			]
		},
		DEanalysis: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(DEanalysis) {
		DEanalysis.on('postRender.test', null)

		if (test['_ok']) DEanalysis.Inner.app.destroy()
		test.end()
	}
})
