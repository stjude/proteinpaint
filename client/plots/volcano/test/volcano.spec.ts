import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { TermTypes } from '#shared/terms.js'

/*
Tests:
    - Default single cell cell type volcano
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano/Volcano -***-')
	test.end()
})

/******** DO NOT ENABLE IN PROD ********
 * This test for development only. When data available in
 * termdbtest, will update runpp() call and create an
 * integration file.*/
tape('Default single cell cell type volcano', function (test) {
	test.timeoutAfter(100000)

	const gdc_runpp = helpers.getRunPp('mass', {
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

	gdc_runpp({
		state: {
			plots: [
				{
					chartType: 'volcano',
					termType: TermTypes.SINGLECELL_CELLTYPE,
					categoryName: '2',
					columnName: 'Cluster',
					sample: '2c33dcbd-454a-468f-89fc-71fd20b5d30c'
				}
			]
		},
		volcano: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(volcano: any) {
		volcano.on('postRender.test', null)
		// console.log('volcano.Inner', volcano.Inner)

		// if (test['_ok']) volcano.Inner.app.destroy()
		test.end()
	}
})
