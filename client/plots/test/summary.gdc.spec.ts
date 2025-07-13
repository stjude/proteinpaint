import tape from 'tape'
import * as d3s from 'd3-selection'
import { runproteinpaint } from '../../test/front.helpers.js'
import { detectOne } from '../../test/test.helpers'

/**********************
Tests for summary plots (barchart, violin, boxplot) in GDC

barchart - categorical
barchart - geneVariant
barchart - geneExpression
barchart - categorical/categorical
barchart - categorical/geneVariant
barchart - categorical/geneExpression
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
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// adding filter to reduce number of samples in order to reduce computation time
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.demographic.ethnicity', value: 'hispanic or latino' }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { id: 'case.disease_type' }
					}
				],
				nav: { activeTab: 1 }
			},
			barchart: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	function runTests(barchart) {
		testBarCount(barchart)
		testAxisDimension()
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const minBars = 5
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} bars`)
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}

	function testAxisDimension() {
		const xAxis = barDiv.select('.sjpcb-bar-chart-x-axis').node()
		const seriesG = barDiv.select('.bars-series').node()
		test.true(xAxis.getBBox().width >= seriesG.getBBox().width, 'x-axis width should be >= series width')
	}
})

tape('barchart - geneVariant', test => {
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
						term: { term: { type: 'geneVariant', gene: 'TP53' } }
					}
				],
				nav: { activeTab: 1 }
			},
			barchart: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	function runTests(barchart) {
		testNumCharts(barchart)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}

	function testNumCharts(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts > 1, 'Should have more than 1 chart by TP53 as a gene variant term')
	}
})

tape('barchart - geneExpression', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression barchart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
					}
				],
				nav: { activeTab: 1 }
			},
			barchart: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	function runTests(barchart) {
		testBarCount(barchart)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const minBars = 5
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} bars`)
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}
})

tape('barchart - categorical/categorical', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// adding filter to reduce number of samples in order to reduce computation time
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.demographic.ethnicity', value: 'hispanic or latino' }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { id: 'case.disease_type' },
						term2: { id: 'case.demographic.cause_of_death' }
					}
				],
				nav: { activeTab: 1 }
			},
			barchart: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	function runTests(barchart) {
		testBarCount(barchart)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const minBars = 5
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} bars`)
		test.true(numOverlays > numBars, 'number of overlays should be greater than bars')
	}
})

tape('barchart - categorical/geneVariant', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// adding filter to reduce number of samples in order to reduce computation time
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.demographic.ethnicity', value: 'hispanic or latino' }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { id: 'case.disease_type' },
						term2: { term: { type: 'geneVariant', gene: 'TP53' } }
					}
				],
				nav: { activeTab: 1 }
			},
			barchart: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	function runTests(barchart) {
		testBarCount(barchart)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const minBars = 5
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} bars`)
		test.true(numOverlays > numBars, 'number of overlays should be greater than bars')
	}
})

tape('barchart - categorical/geneExpression', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		mass: {
			state: {
				dslabel: 'GDC',
				genome: 'hg38',
				// TODO: geneExpression barchart will break without this filter, so need to determine why
				termfilter: {
					filter0: {
						op: 'in',
						content: { field: 'cases.disease_type', value: ['Gliomas'] }
					}
				},
				plots: [
					{
						chartType: 'summary',
						term: { id: 'case.demographic.ethnicity' },
						term2: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
					}
				],
				nav: { activeTab: 1 }
			},
			barchart: {
				callbacks: {
					'postRender.test': runTests
				}
			}
		}
	})

	function runTests(barchart) {
		testBarCount(barchart)
		if (test['_ok']) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const minBars = 2
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} bars`)
		test.true(numOverlays > numBars, 'number of overlays should be greater than bars')
	}
})

// TODO: will not skip this test when violin plot of dictionary term is supported
tape.skip('violin - numeric', test => {
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
						term: { id: 'case.diagnoses.age_at_diagnosis', q: { mode: 'continuous' } }
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
