import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { SINGLECELL_CELLTYPE } from '#shared/terms.js'

/*
Tests:
    - Default single cell cell type gsea
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/gsea/gsea -***-')
	test.end()
})

/******** DO NOT ENABLE IN PROD ********
 * This test for development only. When data available in
 * termdbtest, will update runpp() call and create an
 * integration file.*/
tape('Default single cell cell type gsea', function (test) {
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
					childType: 'gsea',
					termType: SINGLECELL_CELLTYPE,
					categoryName: '2',
					termId: 'Cluster',
					sample: '2c33dcbd-454a-468f-89fc-71fd20b5d30c'
				}
			]
		},
		gsea: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(gsea: any) {
		gsea.on('postRender.test', null)
		// console.log('volcano.Inner', volcano.Inner)

		// if (test['_ok']) volcano.Inner.app.destroy()
		test.end()
	}
})
