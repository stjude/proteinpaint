import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { group1Values, group2Values } from '#plots/volcano/test/testData.js'

/* 

DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING 
AND MANUAL CHECKS ONLY

Tests:
    - gsea with .tw instead of .gsea_params
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
	test.pass('-***- plots/gsea -***-')
	test.end()
})

tape('Default gsea', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'gsea',
					//TODO: This isn't enough to return data
					gsea_params: {
						fold_change: [
							0.113097310076855, 0.157254679903013, -0.127936030474977, 0.16699322548421, 0.619875078541592,
							-0.0018770476364016, 0.486726850074203, 0.07540827279123, 0.0748731299596796, 0.0993776928538957,
							0.559956200188964
						],
						genes: [
							'SAMD11',
							'NOC2L',
							'KLHL17',
							'ISG15',
							'AGRN',
							'C1orf159',
							'SDF4',
							'B3GALT6',
							'UBE2J2',
							'SCNN1D',
							'ACAP3'
						],
						genome: 'hg38',
						genes_length: 10
					}
				}
			]
		},
		gsea: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(gsea) {
		gsea.on('postRender.test', null)
		// test.true(true, 'gsea rendered')

		// if (test['_ok']) gsea.Inner.app.destroy()
		test.end()
	}
})

tape('gsea with .tw instead of .gsea_params', test => {
	test.timeoutAfter(10000)

	const groups = [
		{
			name: 'Sensitive',
			in: true,
			values: group1Values
		},
		{
			name: 'Resistant',
			in: true,
			values: group2Values
		}
	]
	runpp({
		state: {
			plots: [
				{
					chartType: 'differentialAnalysis',
					childType: 'gsea',
					samplelst: {
						groups
					},
					termType: 'geneExpression',
					tw: {
						q: {
							groups
						},
						term: {
							name: 'Sensitive vs Resistant',
							type: 'samplelst',
							values: {
								Sensitive: {
									color: '#1b9e77',
									key: 'Sensitive',
									label: 'Sensitive',
									list: group1Values
								},
								Resistant: {
									color: '#d95f02',
									key: 'Resistant',
									label: 'Resistant',
									list: group2Values
								}
							}
						}
					}
				}
			]
		},
		differentialAnalysis: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(differentialAnalysis) {
		differentialAnalysis.on('postRender.test', null)

		// test.true(true, 'differentialAnalysis rendered')

		// if (test['_ok']) differentialAnalysis.Inner.app.destroy()
		test.end()
	}
})
