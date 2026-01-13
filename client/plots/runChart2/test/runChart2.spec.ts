import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/************************
 * FOR DEVELOPMENT ONLY
 * DO NOT ENABLE IN PROD
 ***********************/

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
	test.comment('-***- plots/runChart2/RunChart2 -***-')
	test.end()
})

tape('runChart2', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'runChart2'
				}
			]
		},
		runChart2: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(runChart2) {
		runChart2.on('postRender.test', null)

		// if (test['_ok']) runChart2.Inner.app.destroy()
		test.end()
	}
})
