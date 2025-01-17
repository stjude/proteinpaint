import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING ONLY

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
	test.pass('-***- plots/correlationVolcano -***-')
	test.end()
})

tape('Default correlation volcano', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'correlationVolcano',
					featureTw: {
						term: {
							type: 'geneExpression',
							gene: 'KRAS'
						}
					}
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
