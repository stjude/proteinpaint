import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING 
AND MANUAL CHECKS ONLY

Tests:
    - Default SC app
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
			dslabel: 'GDC',
			genome: 'hg38'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/SC -***-')
	test.end()
})

tape('Default SC app', test => {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'sc',
					settings: {
						sc: {
							columns: {
								sample: 'Case'
							}
						}
					}
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

		// test.true(true, 'sc rendered')

		// if (test['_ok']) sc.Inner.app.destroy()
		test.end()
	}
})
