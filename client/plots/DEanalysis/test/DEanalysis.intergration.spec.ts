import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING ONLY

Tests:
    - Default DE analysis
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
			//Eventually need to add data to TermdbTest
			//and switch dataset and genome
			dslabel: 'ALL-pharmacotyping',
			genome: 'hg38'
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

tape('Default DE analysis ', test => {
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

		test.true(true, 'DEanalysis rendered')

		// if (test['_ok']) DEanalysis.Inner.app.destroy()
		test.end()
	}
})
