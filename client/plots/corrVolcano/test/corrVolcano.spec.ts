import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
Tests:
    - Default correlation volcano plot
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
	test.pass('-***- plots/correlationVolcano -***-')
	test.end()
})

tape('Default correlation volcano', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'correlationVolcano'
				}
			]
		},
		correlationVolcano: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(correlationVolcano) {
		correlationVolcano.on('postRender.test', null)

		// if (test['_ok']) correlationVolcano.Inner.app.destroy()
		test.end()
	}
})
