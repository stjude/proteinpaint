import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING 
AND MANUAL CHECKS ONLY

Tests:
    - Default single cell plot 
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
	test.comment('-***- plots/singleCell/SingleCell -***-')
	test.end()
})

tape('Default single cell plot', test => {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'singleCell'
				}
			]
		},
		singleCell: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(singleCell) {
		singleCell.on('postRender.test', null)

		// if (test['_ok']) singleCell.Inner.app.destroy()
		test.end()
	}
})
