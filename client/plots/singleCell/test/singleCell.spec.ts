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
	test.pass('-***- plots/singleCell/SingleCell -***-')
	test.end()
})

tape('Default single cell plot', test => {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'singleCell',
					sample: {
						Case: 'C3N-02784',
						Sample: 'C3N-02784-01',
						Project: 'CPTAC-3'
					},
					experimentID: 'c3afe982-7fff-4e6b-91f0-116d8e17d627',
					hiddenClusters: {}
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

		// test.true(true, 'singleCell rendered')

		// if (test['_ok']) singleCell.Inner.app.destroy()
		test.end()
	}
})
