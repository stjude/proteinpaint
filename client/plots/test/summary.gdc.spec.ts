import tape from 'tape'
import * as d3s from 'd3-selection'
import { runproteinpaint, getRunPp } from '../../test/front.helpers.js'
import { getCnv_categorical, getGdcDiseaseGroupsetting, getGenesetMutTw } from '../../test/testdata/data.ts'
import { detectOne } from '../../test/test.helpers'
import { testViolinByCount } from './violin.integration.spec.js'

/**********************
Tests for summary plots (barchart, violin, boxplot) in GDC

barchart - categorical
barchart - catGroupsetting
barchart - numerical
barchart - 1geneMutation
barchart - 2geneMutation
barchart - 1geneCnv
barchart - geneExpression
barchart - categorical/categorical
barchart - categorical/numerical
barchart - categorical/1geneMutation
barchart - categorical/2geneMutation
barchart - categorical/1geneCnv
barchart - categorical/geneExpression

barchart - catGroupsetting/categorical
barchart - catGroupsetting/numerical
barchart - catGroupsetting/1geneMutation
barchart - catGroupsetting/2geneMutation
barchart - catGroupsetting/1geneCnv
barchart - catGroupsetting/geneExpression

barchart - numerical/catGroupsetting
barchart - numerical/1geneMutation
barchart - numerical/2geneMutation
barchart - numerical/1geneCnv
barchart - numerical/geneExpression
barchart - 1geneMutation/geneExpression

violin - numeric
violin - geneExpression
violin - geneExpression/categorical
violin - geneExpression/geneVariant
boxplot - numeric
boxplot - geneExpression
boxplot - geneExpression/categorical
boxplot - geneExpression/geneVariant
***********************/

tape('\n', function (test) {
	test.comment('-***- summary.gdc -***-')
	test.end()
})

tape('barchart - categorical', test => {
	runpp({
		state: {
			// adding filter to reduce number of samples in order to reduce computation time
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.disease_type' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5) // expects more than 5 categories
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - catGroupsetting', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: getGdcDiseaseGroupsetting()
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 10) // showing additional disease types not included in groupsetting
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - numerical', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.diagnoses.age_at_diagnosis' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 3) // agedx is hardcoded to have 3 bins in gdc dict
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('barchart - 1geneMutation', test => {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					term: { term: { type: 'geneVariant', gene: 'KRAS' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(barchart) {
		testBarchart(test, barchart, 1, 2) // 2 bars, mutated vs wt
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - 2geneMutation', test => {
	runpp({
		state: {
			plots: [{ chartType: 'summary', term: getGenesetMutTw() }]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(barchart) {
		testBarchart(test, barchart, 1, 2) // 2 bars, mutated vs wt
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - 1geneCnv', test => {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					term: getCnv_categorical()
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('barchart - geneExpression', test => {
	runpp({
		state: {
			termfilter: getfilter('gliomas'),
			plots: [
				{
					chartType: 'summary',
					term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('barchart - categorical/categorical', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.disease_type' },
					term2: { id: 'case.demographic.cause_of_death' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - categorical/numerical', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.disease_type' },
					term2: { id: 'case.diagnoses.age_at_diagnosis' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('barchart - categorical/1geneMutation', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.disease_type' },
					term2: { term: { type: 'geneVariant', gene: 'KRAS' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('barchart - categorical/2geneMutation', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.disease_type' },
					term2: getGenesetMutTw()
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - categorical/1geneCnv', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.disease_type' },
					term2: getCnv_categorical()
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('barchart - categorical/geneExpression', test => {
	runpp({
		state: {
			termfilter: getfilter('gliomas'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.demographic.ethnicity' },
					term2: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('barchart - catGroupsetting/categorical', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: getGdcDiseaseGroupsetting(),
					term2: { id: 'case.demographic.cause_of_death' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - catGroupsetting/numerical', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: getGdcDiseaseGroupsetting(),
					term2: { id: 'case.diagnoses.age_at_diagnosis' }
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - catGroupsetting/1geneMutation', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: getGdcDiseaseGroupsetting(),
					term2: { term: { type: 'geneVariant', gene: 'KRAS' } }
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - catGroupsetting/2geneMutation', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: getGdcDiseaseGroupsetting(),
					term2: getGenesetMutTw()
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - catGroupsetting/1geneCnv', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: getGdcDiseaseGroupsetting(),
					term2: getCnv_categorical()
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - catGroupsetting/geneExpression', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: getGdcDiseaseGroupsetting(),
					term2: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 5)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - numerical/catGroupsetting', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.diagnoses.age_at_diagnosis' },
					term2: getGdcDiseaseGroupsetting()
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 3)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - numerical/1geneMutation', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.diagnoses.age_at_diagnosis' },
					term2: { term: { type: 'geneVariant', gene: 'KRAS' } }
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 3)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - numerical/2geneMutation', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.diagnoses.age_at_diagnosis' },
					term2: getGenesetMutTw()
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 3)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - numerical/1geneCnv', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.diagnoses.age_at_diagnosis' },
					term2: getCnv_categorical()
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 3)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - numerical/geneExpression', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.diagnoses.age_at_diagnosis' },
					term2: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 3)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})
tape('barchart - 1geneMutation/geneExpression', test => {
	runpp({
		state: {
			termfilter: getfilter('latino'),
			plots: [
				{
					chartType: 'summary',
					term: { term: { type: 'geneVariant', gene: 'KRAS' } },
					term2: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
				}
			]
		},
		barchart: { callbacks: { 'postRender.test': runTests } }
	})
	function runTests(barchart) {
		testBarchart(test, barchart, 1, 2)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}
})

tape.only('violin - numeric', test => {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					term: { id: 'case.diagnoses.age_at_diagnosis', q: { mode: 'continuous' } }
				}
			]
		},
		violin: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		//if (test['_ok']) violin.Inner.app.destroy()
		test.end()
	}
})

tape('violin - geneExpression', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression chart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'continuous' } }
					}
				],
				nav: { activeTab: 1 }
			},
			violin: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinPath(violinDiv)
		if (test['_ok']) violin.Inner.app.destroy()
		test.end()
	}

	async function testViolinPath(violinDiv) {
		await detectOne({ elem: violinDiv.node(), selector: 'svg' })
		const noPlotNum = 0
		const actualPlotNum = violinDiv.selectAll('.sjpp-violinG').size()
		test.true(
			noPlotNum < actualPlotNum,
			`should have more than ${noPlotNum} plots, actual plot no. is ${actualPlotNum}`
		)
	}
})

tape('violin - geneExpression/categorical', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression chart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'continuous' } },
						term2: { id: 'case.demographic.ethnicity' }
					}
				],
				nav: { activeTab: 1 }
			},
			violin: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinPath(violinDiv)
		if (test['_ok']) violin.Inner.app.destroy()
		test.end()
	}

	async function testViolinPath(violinDiv) {
		await detectOne({ elem: violinDiv.node(), selector: 'svg' })
		const noPlotNum = 0
		const actualPlotNum = violinDiv.selectAll('.sjpp-violinG').size()
		test.true(
			noPlotNum < actualPlotNum,
			`should have more than ${noPlotNum} plots, actual plot no. is ${actualPlotNum}`
		)
	}
})

tape('violin - geneExpression/geneVariant', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression chart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'continuous' } },
						term2: { term: { type: 'geneVariant', gene: 'TP53' } }
					}
				],
				nav: { activeTab: 1 }
			},
			violin: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinPath(violinDiv)
		if (test['_ok']) violin.Inner.app.destroy()
		test.end()
	}

	async function testViolinPath(violinDiv) {
		await detectOne({ elem: violinDiv.node(), selector: 'svg' })
		const noPlotNum = 0
		const actualPlotNum = violinDiv.selectAll('.sjpp-violinG').size()
		test.true(
			noPlotNum < actualPlotNum,
			`should have more than ${noPlotNum} plots, actual plot no. is ${actualPlotNum}`
		)
	}
})

// TODO: will not skip this test when boxplot of dictionary term is supported
tape.skip('boxplot - numeric', test => {
	test.timeoutAfter(70000)
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				plots: [
					{
						chartType: 'summary',
						childType: 'boxplot',
						term: { id: 'case.diagnoses.age_at_diagnosis', q: { mode: 'continuous' } }
					}
				],
				nav: { activeTab: 1 }
			},
			boxplot: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	async function runTests(boxplot) {
		const dom = boxplot.Inner.dom
		test.true(dom.axis.select('path'), 'Should render y axis')
		test.equal(dom.boxplots.selectAll("g[id^='sjpp-boxplot-']").size(), 1, 'Should render 1 boxplot')
		if (test['_ok']) boxplot.Inner.app.destroy()
		test.end()
	}
})

tape('boxplot - geneExpression', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression chart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						childType: 'boxplot',
						term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'continuous' } }
					}
				],
				nav: { activeTab: 1 }
			},
			boxplot: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	async function runTests(boxplot) {
		const dom = boxplot.Inner.dom
		test.true(dom.axis.select('path'), 'Should render y axis')
		test.equal(dom.boxplots.selectAll("g[id^='sjpp-boxplot-']").size(), 1, 'Should render 1 boxplot')
		if (test['_ok']) boxplot.Inner.app.destroy()
		test.end()
	}
})

tape('boxplot - geneExpression/categorical', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression chart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						childType: 'boxplot',
						term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'continuous' } },
						term2: { id: 'case.demographic.ethnicity' }
					}
				],
				nav: { activeTab: 1 }
			},
			boxplot: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	async function runTests(boxplot) {
		const dom = boxplot.Inner.dom
		test.true(dom.axis.select('path'), 'Should render y axis')
		test.true(dom.boxplots.selectAll("g[id^='sjpp-boxplot-']").size() > 1, 'Should render more than 1 boxplot')
		if (test['_ok']) boxplot.Inner.app.destroy()
		test.end()
	}
})

tape('boxplot - geneExpression/geneVariant', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression chart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						childType: 'boxplot',
						term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'continuous' } },
						term2: { term: { type: 'geneVariant', gene: 'TP53' } }
					}
				],
				nav: { activeTab: 1 }
			},
			boxplot: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	async function runTests(boxplot) {
		const dom = boxplot.Inner.dom
		test.true(dom.axis.select('path'), 'Should render y axis')
		test.true(dom.boxplots.selectAll("g[id^='sjpp-boxplot-']").size() > 1, 'Should render more than 1 boxplot')
		if (test['_ok']) boxplot.Inner.app.destroy()
		test.end()
	}
})

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

/*************************
 reusable helper functions
**************************/

const runpp = getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hidden'
			//activetab: 1
		},
		vocab: {
			dslabel: 'GDC',
			genome: 'hg38'
		}
	},
	debug: 1
})

/*
test:
barchart:
chartCount: expected number of charts
minBars: minimum number of bars to be found
*/
function testBarchart(test, barchart, chartCount, minBars) {
	const bd = barchart.Inner.dom.barDiv

	test.equal(bd.selectAll('.pp-sbar-div').size(), chartCount, `Should have ${chartCount} charts`)

	const numBars = bd.selectAll('.bars-cell-grp').size()
	test.true(numBars >= minBars, `should have at least ${minBars} bars`)

	// TODO detect if using term2 and verify
	//const numOverlays = bd.selectAll('.bars-cell').size()
	//test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')

	// axis dimension
	const xAxis = bd.select('.sjpcb-bar-chart-x-axis').node()
	const seriesG = bd.select('.bars-series').node()
	test.true(xAxis.getBBox().width >= seriesG.getBBox().width, 'x-axis width should be >= series width')
}

function getfilter(k) {
	if (k == 'latino') {
		return {
			filter0: {
				op: 'in',
				content: { field: 'cases.demographic.ethnicity', value: 'hispanic or latino' }
			}
		}
	}
	if (k == 'gliomas') {
		return {
			filter0: {
				op: 'in',
				content: { field: 'cases.disease_type', value: ['Gliomas'] }
			}
		}
	}
}
