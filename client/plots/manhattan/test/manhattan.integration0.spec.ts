import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/**
 * DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING
 * AND MANUAL CHECKS ONLY. Only enable on CI when
 * data is available in TermdbTest.
 *
 * Test:
 *   - Example integration test
 */

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hidden'
		},
		vocab: {
			dslabel: 'GDC',
			genome: 'hg38'
		}
	},
	debug: 1
})

tape('\n', function (test) {
	test.comment('-***- plots/manhattan/Manhattan -***-')
	test.end()
})

// Example integration test
//.only run only this test
tape.only('Init plot from runpp()', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'manhattan'
				}
			]
		},
		manhattan: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(manhattan) {
		test.comment(`Example integration test message: Should init a manhattan plot from runpp(). ${manhattan}`)
	}

	test.end()
})
