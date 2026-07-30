import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING ONLY

Tests:
	- Default aggregate matrix
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
			//as well as make e2e tests for aggregate matrix
			dslabel: 'MMRF',
			genome: 'hg38'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/aggregateMatrix -***-')
	test.end()
})

tape('Default aggregate matrix', async function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'aggregateMatrix',
					entries: {
						genes: [
							{ name: 'TP53', id: 'TP53', type: 'geneExpression' },
							{ name: 'KRAS', id: 'KRAS', type: 'geneExpression' },
							{ name: 'EGFR', id: 'EGFR', type: 'geneExpression' },
							{ name: 'XBP1', id: 'XBP1', type: 'geneExpression' },
							{ name: 'CD138', id: 'CD138', type: 'geneExpression' },
							{ name: 'MZB1', id: 'MZB1', type: 'geneExpression' },
						]
					},
					categories: {
						'Cell type': [
							{ name: 'B', id: 'B', type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' },
							{ name: 'CD4', id: 'CD4', type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' }
						]
					},
					settings: {
						gradientMethod: 'mean',
						sizeMethod: 'percent'
					}
				}
			]
		},
		aggregateMatrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(aggregateMatrix: any) {
		aggregateMatrix.on('postRender.test', null)
		//TODO

		// if (test['_ok']) aggregateMatrix.Inner.app.destroy()
		test.end()
	}
})