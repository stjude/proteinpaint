import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { GENE_EXPRESSION /*SINGLECELL_CELLTYPE*/ } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { header_mode: 'hidden' },
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/GeneExpInput -***-')
	test.end()
})

tape('Test GeneExpInput rendering with GENE_EXPRESSION', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'GeneExpInput',
					termType: GENE_EXPRESSION
				}
			]
		},
		GeneExpInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(GeneExpInput) {
		console.log('Running GeneExpInput tests', GeneExpInput)
		// if (test['_ok']) GeneExpInput.Inner.app.destroy()
		test.end()
	}
})
