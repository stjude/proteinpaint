import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import { TermTypes } from '#shared/terms.js'

/*
Tests:
	- Default gene expression diffAnalysis
	- Default single cell cell type diffAnalysis
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
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/DiffAnalysis/DifferentialAnalysis -***-')
	test.end()
})

tape('Default gene expression diffAnalysis', test => {
	test.timeoutAfter(5000)
	const group1Values = [
		{ sampleId: 105, sample: '17_patient' },
		{ sampleId: 129, sample: '2646_patient' },
		{ sampleId: 133, sample: '2702_patient' },
		{ sampleId: 134, sample: '2716_patient' },
		{ sampleId: 137, sample: '2758_patient' },
		{ sampleId: 138, sample: '2772_patient' },
		{ sampleId: 142, sample: '2828_patient' },
		{ sampleId: 143, sample: '2842_patient' },
		{ sampleId: 146, sample: '2884_patient' },
		{ sampleId: 147, sample: '2898_patient' },
		{ sampleId: 153, sample: '2982_patient' },
		{ sampleId: 155, sample: '3010_patient' },
		{ sampleId: 156, sample: '3024_patient' },
		{ sampleId: 157, sample: '3038_patient' },
		{ sampleId: 158, sample: '3052_patient' },
		{ sampleId: 159, sample: '3066_patient' },
		{ sampleId: 160, sample: '3080_patient' },
		{ sampleId: 165, sample: '3150_patient' },
		{ sampleId: 166, sample: '3164_patient' },
		{ sampleId: 167, sample: '3178_patient' },
		{ sampleId: 168, sample: '3192_patient' },
		{ sampleId: 169, sample: '3206_patient' },
		{ sampleId: 171, sample: '3234_patient' },
		{ sampleId: 172, sample: '3248_patient' },
		{ sampleId: 173, sample: '3262_patient' },
		{ sampleId: 174, sample: '3276_patient' },
		{ sampleId: 175, sample: '3290_patient' },
		{ sampleId: 176, sample: '3304_patient' },
		{ sampleId: 179, sample: '3346_patient' },
		{ sampleId: 180, sample: '3360_patient' },
		{ sampleId: 181, sample: '3374_patient' },
		{ sampleId: 182, sample: '3388_patient' },
		{ sampleId: 183, sample: '3402_patient' },
		{ sampleId: 184, sample: '3416_patient' },
		{ sampleId: 185, sample: '3430_patient' },
		{ sampleId: 188, sample: '3472_patient' }
	]

	const group2Values = [
		{ sampleId: 101, sample: '1_patient' },
		{ sampleId: 130, sample: '2660_patient' },
		{ sampleId: 131, sample: '2674_patient' },
		{ sampleId: 132, sample: '2688_patient' },
		{ sampleId: 135, sample: '2730_patient' },
		{ sampleId: 136, sample: '2744_patient' },
		{ sampleId: 139, sample: '2786_patient' },
		{ sampleId: 140, sample: '2800_patient' },
		{ sampleId: 141, sample: '2814_patient' },
		{ sampleId: 144, sample: '2856_patient' },
		{ sampleId: 145, sample: '2870_patient' },
		{ sampleId: 148, sample: '2912_patient' },
		{ sampleId: 149, sample: '2926_patient' },
		{ sampleId: 150, sample: '2940_patient' },
		{ sampleId: 151, sample: '2954_patient' },
		{ sampleId: 152, sample: '2968_patient' },
		{ sampleId: 154, sample: '2996_patient' },
		{ sampleId: 161, sample: '3094_patient' },
		{ sampleId: 162, sample: '3108_patient' },
		{ sampleId: 163, sample: '3122_patient' },
		{ sampleId: 164, sample: '3136_patient' },
		{ sampleId: 170, sample: '3220_patient' },
		{ sampleId: 177, sample: '3318_patient' },
		{ sampleId: 178, sample: '3332_patient' },
		{ sampleId: 186, sample: '3444_patient' },
		{ sampleId: 187, sample: '3458_patient' }
	]

	const groups = [
		{
			name: 'Female',
			in: true,
			values: group1Values
		},
		{
			name: 'Male',
			in: true,
			values: group2Values
		}
	]
	runpp({
		state: {
			plots: [
				{
					chartType: 'differentialAnalysis',
					childType: 'volcano',
					samplelst: {
						groups
					},
					termType: TermTypes.GENE_EXPRESSION,
					tw: {
						q: {
							groups
						},
						term: {
							name: 'Female vs Male',
							type: 'samplelst',
							values: {
								Female: {
									color: 'purple',
									key: 'Female',
									label: 'Female',
									list: group1Values
								},
								Male: {
									color: 'blue',
									key: 'Male',
									label: 'Male',
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

	async function runTests(differentialAnalysis: any) {
		differentialAnalysis.on('postRender.test', null)
		const dom = differentialAnalysis.Inner.dom
		const tabs = dom.tabsDiv
			.selectAll('div > div> button')
			.nodes()
			.filter(d => d.__data__.isVisible() == true)

		const plotTabs = ['volcano', 'gene set enrichment analysis']

		//test correct plot tabs exist
		let foundLabels = 0
		const notFoundLabels: any = []
		for (const tab of tabs) {
			if (plotTabs.some(d => d.toLowerCase() == tab.__data__.label.toLowerCase())) ++foundLabels
			else notFoundLabels.push(tab.__data__.label)
		}
		if (notFoundLabels.length) test.fail(`Should not render tab(s) = ${notFoundLabels}`)
		test.equal(plotTabs.length, foundLabels, `Should render tabs: ${plotTabs}`)

		//Test the correct default plot is rendered
		const plotsDiv = differentialAnalysis.Inner.plotsDiv
		test.true(plotsDiv.volcano.select('.sjpp-volcano-svg'), `Should render volcano plot by default`)

		if (test['_ok']) differentialAnalysis.Inner.app.destroy()
		test.end()
	}
})

/******** DO NOT ENABLE IN PROD ********
 * This test for development only. When data available in
 * termdbtest, will update runpp() call.*/
tape.skip('Default single cell cell type diffAnalysis', function (test) {
	test.timeoutAfter(5000)

	helpers.getRunPp('mass', {
		state: {
			nav: {
				header_mode: 'hidden'
			},
			vocab: {
				dslabel: 'GDC',
				genome: 'hg38'
			},
			plots: [
				{
					chartType: 'differentialAnalysis',
					childType: 'volcano',
					termType: 'singleCellCellType'
					//TODO: add config here
				}
			]
		},
		differentialAnalysis: {
			callbacks: {
				'postRender.test': runTests
			}
		},
		debug: 1
	})

	function runTests(differentialAnalysis: any) {
		differentialAnalysis.on('postRender.test', null)

		test.end()
	}
})
