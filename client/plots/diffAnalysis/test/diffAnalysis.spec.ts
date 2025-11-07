import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { TermTypes } from '#shared/terms.js'

/*
Tests:
    - Default single cell cell type diffAnalysis
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/DiffAnalysis/DifferentialAnalysis -***-')
	test.end()
})

/******** DO NOT ENABLE IN PROD ********
 * This test for development only. When data available in
 * termdbtest, will update runpp() call and move to integration file.*/
tape.only('Default single cell cell type diffAnalysis', function (test) {
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
					chartType: 'differentialAnalysis',
					childType: 'volcano',
					termType: TermTypes.SINGLECELL_CELLTYPE,
					categoryName: '2',
					columnName: 'Cluster',
					sample: '2c33dcbd-454a-468f-89fc-71fd20b5d30c'
				}
			]
		},
		differentialAnalysis: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(differentialAnalysis: any) {
		differentialAnalysis.on('postRender.test', null)
		// console.log('differentialAnalysis.Inner', differentialAnalysis.Inner)

		// if (test['_ok']) differentialAnalysis.Inner.app.destroy()
		test.end()
	}
})
