import tape from 'tape'
import { termjson } from '../../test/testdata/termjson'
import * as helpers from '../../test/front.helpers.js'
import { sleep, detectLst, detectGte, detectOne } from '../../test/test.helpers.js'
import { getFilterItemByTag } from '../../filter/filter'
import * as vocabData from '../../termdb/test/vocabData'
import { hideCategory } from '../../plots/barchart.events.js'

/*
TODO cover all combinations

Tests:
	term1=categorical
	term1=categorical (no values)
	term1=categorical, term2=defaultbins
	term0=defaultbins, term1=categorical
	term1=geneVariant no group
	term1=geneVariant with groups
	term1=categorical, term2=geneVariant
	term1=geneExp, term2=geneVariant SKIPPED
	term2=geneExp, term1=geneVariant
	term1=geneExp
	term1=numeric term2=geneExp with default bins
	term1=geneExp, term2=categorical
	term1=condition, term2=gene exp with default bins
	term1=TP53 gene exp, term2=BCR gene exp, both terms with default bins
	term1=categorical, term0=gene exp with default bins
	series visibility - q.hiddenValue
	series visibility - numeric
	series visibility - condition

	single barchart, categorical filter
	single barchart, TP53 mutation dtTerm filter

	click non-group bar to add filter
	click custom categorical group bar to add filter
	single chart, genotype overlay
	numeric exclude range
	numeric filter - only special value
	custom vocab: categorical terms with numeric filter
	custom vocab: numeric terms with categorical filter
	max number of bins: exceeded
	no visible series data, no overlay
	all hidden + with overlay, legend click
	unhidden chart and legend
	customized bins
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			activeTab: 1
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
	test.comment('-***- plots/barchart -***-')
	test.end()
})

tape('term1=categorical', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'diaggrp'
					}
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
		barchart.on('postRender.test', null)
		testBarCount(barchart)
		testAxisDimension(barchart)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const minBars = 5
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} Diagnosis Group bars`)
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}

	function testAxisDimension(barchart) {
		const xAxis = barDiv.select('.sjpcb-bar-chart-x-axis').node()
		const seriesG = barDiv.select('.bars-series').node()
		test.true(xAxis.getBBox().width >= seriesG.getBBox().width, 'x-axis width should be >= series width')
	}
})

tape('term1=categorical (no values)', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'diaggrp_novalues'
					}
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
		barchart.on('postRender.test', null)
		testTw(barchart)
		testBarCount(barchart)
		testAxisDimension(barchart)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}

	function testTw(barchart) {
		// testing if term.values{} and term.samplecounts[] get filled
		const tw = barchart.Inner.config.term
		test.ok(tw.term.values && typeof tw.term.values == 'object', 'term.values{} should be an object')
		test.ok(Array.isArray(tw.term.categories.lst), 'term.categories.lst[] should be an array')
		test.equal(tw.term.categories.lst.length, 7, 'term.categories.lst[] should have 7 sample counts')
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const minBars = 5
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} Diagnosis Group bars`)
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}

	function testAxisDimension(barchart) {
		const xAxis = barDiv.select('.sjpcb-bar-chart-x-axis').node()
		const seriesG = barDiv.select('.bars-series').node()
		test.true(xAxis.getBBox().width >= seriesG.getBBox().width, 'x-axis width should be >= series width')
	}
})

tape('term1=categorical, term2=defaultbins', function (test) {
	test.timeoutAfter(5000)
	test.plan(4)
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'diaggrp' },
					term2: { id: 'agedx' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	async function runTests(barchart) {
		barchart.on('postRender.test', null)
		barDiv = barchart.Inner.dom.barDiv
		/*helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test', preserve: true })
			.run(testBarCount)
			.run(testOverlayOrder)
			.run(triggerUncomputableOverlay, 200)
			.run(clickLegendToHideOverlay, 1000)
			.run(testHiddenOverlayData, 2000)
			.done(test)*/

		await detectOne({ elem: barDiv.node(), selector: '.pp-bars-svg' })
		testBarCount()
		testOverlayOrder()
		await triggerUncomputableOverlay(barchart)
		clickLegendToHideOverlay(barchart)
		await testHiddenOverlayData(barchart)
		test.end()
	}

	function testBarCount() {
		// no need to await, the bar order will tested after the initial postRender event
		const minBars = 5
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > minBars, `should have more than ${minBars} Diagnosis Group bars`)
		test.true(numOverlays > numBars, 'number of overlays should be greater than bars')
	}

	function testOverlayOrder() {
		// no need to await, the bar order will tested after the initial postRender event
		const bars_grp = barDiv.selectAll('.bars-cell-grp')
		const legend_rows = barDiv.selectAll('.legend-row')
		//flag to indicate unordered bars
		let overlay_ordered = true
		const legend_ids = []
		legend_rows.each(d => legend_ids.push(d.dataId))
		//check if each stacked bar is in same order as legend
		bars_grp.each(d => {
			if (!overlay_ordered) return
			const bar_ids = d.visibleData.map(d => d.dataId)
			overlay_ordered = legend_ids
				.filter(id => bar_ids.includes(id))
				.reduce((bool, id, i) => bool && bar_ids[i] === id, overlay_ordered)
		})
		test.true(overlay_ordered, 'overlay order is same as legend')
	}

	async function triggerUncomputableOverlay(barchart) {
		//Await for legend rows to increase before moving on to the next function
		await detectLst({
			target: barchart.Inner.dom.legendDiv.node(),
			// avoid detecting legend entries for descriptive stats,
			// term legend items have a corresponding icon as the first div,
			// making the second div (even-numbered child) the relevant target/selector
			selector: '.sjpp-htmlLegend:nth-child(even)',
			count: 6,
			matchAs: '>=',
			trigger: () => {
				barchart.Inner.app.dispatch({
					type: 'plot_edit',
					id: 'diaggrp',
					config: {
						term2: {
							id: 'aaclassic_5',
							term: termjson['aaclassic_5'],
							q: termjson['aaclassic_5'].bins.default
						}
					}
				})
			}
		})
	}

	const legendDataId = 'not exposed'

	async function clickLegendToHideOverlay(barchart) {
		//await sleep(40)
		const legendDiv = barchart.Inner.dom.legendDiv
		const item = legendDiv
			.selectAll('.sjpp-htmlLegend')
			.filter(d => d.dataId == legendDataId)
			.node()
		hideCategory(item.__data__, barchart.Inner, true)
	}

	async function testHiddenOverlayData(barchart) {
		const legendDiv = barchart.Inner.dom.legendDiv
		//Fix for removing sleep()
		const item = await detectLst({ elem: legendDiv.node(), selector: '.sjpp-hidden-legend-item', matchAs: '>=' })
		// const item = legendDiv.selectAll('.legend-row').filter(function(d) {
		// 	return +this.style.opacity < 1 && d.dataId == legendDataId
		// })
		test.equal(item.length, 1, 'should hide a clicked uncomputable overlay legend')
	}
})

tape('term0=defaultbins, term1=categorical', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'diaggrp' },
					term0: { id: 'agedx' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	function testNumCharts(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts > 2, 'should have more than 2 charts by Age at Cancer Diagnosis')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneVariant no group', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: { term: { type: 'geneVariant', gene: 'TP53' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	function testNumCharts(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts > 2, 'Should have more than 2 charts by TP53 as a gene variant term')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneVariant with groups', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: geneVariantTw
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	function testNumCharts(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts == 1, 'Should have 1 chart from gene variant term')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=categorical, term2=geneVariant', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'diaggrp' },
					term2: geneVariantTw
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	function testNumCharts(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts == 1, 'Should have 1 chart from gene variant term')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneExp, term2=geneVariant SKIPPED', function (test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					term2: geneVariantTw,
					// must set geneExp q.mode=discrete to show barchart, otherwise it will become violin and not trigger provied postRender for barchart
					term: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'discrete' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	function testNumCharts(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts == 1, 'Should have 1 chart from gene variant term')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term2=geneExp, term1=geneVariant', function (test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: geneVariantTw,
					term2: { term: { type: 'geneExpression', gene: 'TP53' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	function testNumCharts(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts == 1, 'Should have 1 chart from gene variant term')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneExp', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						term: { type: 'geneExpression', gene: 'TP53', name: 'TP53' },
						q: { mode: 'discrete' }
					}
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
		const barDiv = barchart.Inner.dom.barDiv

		const numBars = barDiv.selectAll('rect').size()
		test.ok(
			barDiv.selectAll('.pp-sbar-div').size() == 1 && barchart.Inner.config.term.bins.length && numBars,
			'Should correctly render a bar chart for a gene expression term = TP53'
		)

		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=numeric term2=geneExp with default bins', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: { id: 'agedx' },
					term2: {
						term: { type: 'geneExpression', gene: 'TP53' },
						q: { mode: 'discrete' }
					}
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
		const barDiv = barchart.Inner.dom.barDiv

		const numBarCalls = barDiv.selectAll('.bars-cell').size()
		const tableRows = barDiv.selectAll('tr').size()
		test.equal(
			numBarCalls,
			tableRows - 1,
			'Should display the correct number of bars and table rows when overlaid by gene expression term.'
		)

		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneExp, term2=categorical', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						term: { gene: 'TP53', type: 'geneExpression' },
						q: { mode: 'discrete' }
					},
					term2: {
						id: 'diaggrp'
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(barchart) {
		const barDiv = barchart.Inner.dom.barDiv

		const numBarCells = await detectGte({ elem: barDiv.node(), selector: '.bars-cell', count: 22 })
		const tableRows = await detectGte({ elem: barDiv.node(), selector: 'tr', count: 22 })
		test.ok(
			// table has one row for header
			numBarCells.length >= tableRows.length - 1,
			'Should display the correct number of cells and table rows when gene expression term is overlaid by a categorical term.'
		)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=condition, term2=gene exp with default bins', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'Hearing loss'
					},
					term2: {
						term: { gene: 'TP53', type: 'geneExpression' },
						q: { mode: 'discrete' }
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(barchart) {
		const barDiv = barchart.Inner.dom.barDiv

		const numBarCells = await detectGte({ elem: barDiv.node(), selector: '.bars-cell', count: 14 })
		const tableRows = await detectGte({ elem: barDiv.node(), selector: 'tr', count: 14 })
		test.ok(
			// table has one row for header
			numBarCells.length >= tableRows.length - 1,
			'Should display the correct number of cells and table rows when gene expression term is overlaid by a conditional term.'
		)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=TP53 gene exp, term2=BCR gene exp, both terms with default bins', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						term: { gene: 'TP53', type: 'geneExpression' },
						q: { mode: 'discrete' }
					},
					term2: {
						term: { gene: 'BCR', type: 'geneExpression' },
						q: { mode: 'discrete' }
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(barchart) {
		const barDiv = barchart.Inner.dom.barDiv

		const numBarCells = await detectGte({ elem: barDiv.node(), selector: '.bars-cell', count: 27 })
		const tableRows = await detectGte({ elem: barDiv.node(), selector: 'tr', count: 28 })
		test.ok(
			numBarCells.length == tableRows.length - 1,
			'Should display the correct number of cells and table rows when gene expression term is overlaid by a gene expression term.'
		)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=categorical, term0=gene exp with default bins', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'barchart',
					term: {
						id: 'diaggrp'
					},
					term0: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: { mode: 'discrete' }
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(barchart) {
		const barDiv = barchart.Inner.dom.barDiv

		const numBarchart = await detectGte({ elem: barDiv.node(), selector: '.pp-bars-svg', count: 8 })
		test.equal(
			numBarchart.length,
			8,
			'Should display the correct number of barcharts when a categorical term is overlaid by a gene expression term.'
		)
		// if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('series visibility - q.hiddenValues', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)

	const hiddenValues = { 1: true }
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'sex',
						q: {
							hiddenValues
						}
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testHiddenValues
			}
		}
	})

	function testHiddenValues(barchart) {
		const bar = barchart.Inner
		test.deepEqual(
			bar.settings.exclude.cols.sort(),
			Object.keys(hiddenValues).sort(),
			'should have the correct number of hidden bars by q.hiddenValues'
		)
		test.equal(
			bar.dom.holder.selectAll('.bars-cell').size(),
			bar.settings.cols.length - bar.settings.exclude.cols.length,
			'should render the correct number of visible bars'
		)
		if (test._ok) bar.app.destroy()
		test.end()
	}
})

tape('series visibility - numeric', function (test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			nav: { activeTab: 1 },
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'aaclassic_5' }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runNumericExcludedTests
			}
		}
	})

	function runNumericExcludedTests(barchart) {
		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test' })
			.run(testHiddenByValuesAndOrder)
			.use(triggerHiddenLegendClick, { wait: 800 })
			.to(testRevealedBar, { wait: 100 })
			.use(triggerMenuClickToHide, { wait: 100 })
			.to(testHiddenLegendDisplay, { wait: 600 })
			.done(test)
	}

	function testHiddenByValuesAndOrder(barchart) {
		const bar = barchart.Inner
		const excluded = bar.settings.exclude.cols
		test.true(
			excluded.length > 1 && excluded.length == Object.keys(bar.config.term.q.hiddenValues).length,
			'should have the correct number of excluded numeric series by q.hiddenValues'
		)
		// console.log(bar.dom.legendDiv.selectAll('.legend-row').nodes())
		const foundHiddenLabels = bar.dom.legendDiv
			.selectAll('.sjpp-htmlLegend')
			.filter(d => d?.isHidden == true)
			.nodes()

		test.equal(
			foundHiddenLabels.length + 1,
			excluded.length,
			'should display the correct number of hidden legend labels'
		)

		const barOrder = [...bar.dom.holder.node().querySelectorAll('.bars-cell-grp')].sort(
			(a, b) => a.__data__.data[0].y - b.__data__.data[0].y
		)
		test.deepEqual(
			barOrder.map(d => d.__data__.seriesId),
			['<5000', '5000 to <10000', '10000 to <15000', '15000 to <20000', '20000 to <25000', '≥25000'],
			'should render the bars in the expected order'
		)
	}

	let numHiddenLegendBeforeClick
	function triggerHiddenLegendClick(barchart) {
		numHiddenLegendBeforeClick = barchart.Inner.settings.exclude.cols.length
		const node = barchart.Inner.dom.legendDiv
			.selectAll('.sjpp-htmlLegend')
			.filter(d => d?.isHidden == true)
			.node()
		hideCategory(node.__data__, barchart.Inner, false)
	}

	function testRevealedBar(barchart) {
		const bar = barchart.Inner
		const excluded = bar.settings.exclude.cols
		test.equal(excluded.length, numHiddenLegendBeforeClick - 1, 'should adjust the number of excluded series data')

		const foundHiddenLabels = bar.dom.legendDiv
			.selectAll('.legend-row')
			.filter(d => d?.isHidden == true)
			.nodes()
		test.equal(
			foundHiddenLabels.length + 1,
			excluded.length,
			'should adjust the number of hidden legend labels after clicking to reveal one'
		)
	}

	function triggerMenuClickToHide(barchart) {
		const node = barchart.Inner.dom.holder
			.selectAll('.bars-cell-grp')
			.filter(d => d.seriesId == 'not exposed')
			.node()
			.dispatchEvent(new Event('click', { bubbles: true }))
		barchart.Inner.app.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('Hide'))
			.node()
			.click()
	}

	function testHiddenLegendDisplay(barchart) {
		test.equal(
			barchart.Inner.dom.legendDiv
				.selectAll('.sjpp-htmlLegend')
				.filter(function () {
					return this.innerHTML.includes('not exposed')
				})
				.size(),
			1,
			'should hide a special numeric value by menu click'
		)
	}
})

tape('series visibility and order - condition', function (test) {
	test.timeoutAfter(5000)

	const conditionHiddenValues = { '1: Mild': 1 }
	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'Arrhythmias',
						q: {
							hiddenValues: conditionHiddenValues
						}
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testConditionHiddenValues
			}
		}
	})

	function testConditionHiddenValues(barchart) {
		const bar = barchart.Inner
		const excluded = bar.settings.exclude.cols
		// exclude "Unknown status" and "1: Mild"
		test.equal(excluded.length, 1, 'should have the correct number of hidden condition bars by q.hiddenValues')
		const barOrder = [...bar.dom.holder.node().querySelectorAll('.bars-cell-grp')].sort(
			(a, b) => a.__data__.data[0].y - b.__data__.data[0].y
		)
		test.deepEqual(
			barOrder.map(d => d.__data__.seriesId),
			['0: No condition', '2: Moderate', '3: Severe', '4: Life-threatening'],
			'should render the bars in the expected order'
		)
		if (test._ok) bar.app.destroy()
		test.end()
	}
})

tape('single barchart, categorical filter', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			termfilter: {
				filter: {
					type: 'tvslst',
					in: 1,
					join: 'and',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical' },
								values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
							}
						},
						{
							type: 'tvs',
							tvs: {
								term: { id: 'sex', name: 'Sex', type: 'categorical' },
								values: [{ key: '1', label: 'Male' }]
							}
						}
					]
				}
			},
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'sex'
					}
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
		barchart.on('postRender.test', null)
		test.equal(
			barchart.Inner.dom.holder.node().querySelectorAll('.bars-cell-grp').length,
			1,
			'should show one bar series'
		)
		test.equal(
			barchart.Inner.dom.holder.node().querySelector('.bars-cell-grp').__data__.seriesId,
			'1',
			'should show one bar series that matches filter value'
		)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('single barchart, TP53 mutation dtTerm filter', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			termfilter: { filter: tp53dtTermFilter },
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'agedx' }
					// since p53 mutation filter is applied at sample level, barchart term must be sample-level (agedx)
					// patient-level term (sex) won't show data
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
		barchart.on('postRender.test', null)
		test.equal(
			barchart.Inner.dom.holder.node().querySelectorAll('.bars-cell-grp').length,
			2,
			'should show two bar series'
		)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('click non-group bar to add filter', function (test) {
	test.timeoutAfter(8000)
	test.plan(3)

	const termfilter = { filter: [] }
	runpp({
		state: {
			nav: {
				activeCohort: 0
			},
			termfilter,
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'].bins.less },
					term2: {
						id: 'Arrhythmias',
						term: termjson['Arrhythmias'],
						q: {
							hiddenValues: {
								'Unknown status': 1
							}
						}
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	async function runTests(barchart) {
		barchart.on('postRender.test', null)
		if (barDiv) return
		barchart.Inner.bus.on('postRender.test', null)
		barDiv = barchart.Inner.dom.barDiv
		triggerBarClick(barchart)
		await detectLst({ elem: barchart.Inner.app.tip.d.node(), selector: '.sja_menuoption', count: 1, matchAs: '>=' })
		triggerMenuClick(barchart)
		await detectLst({
			elem: barchart.Inner.app.Inner.dom.holder.node(),
			selector: '.sja_filter_item',
			count: 1,
			matchAs: '>='
		})
		testTermValues(barchart)
		//test.end()
	}

	let clickedData, currData
	function triggerBarClick(barchart) {
		const elem = barDiv.node().querySelector('.bars-cell').querySelector('rect')
		clickedData = elem.__data__
		currData = barchart.Inner.currServerData
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(barchart) {
		barchart.Inner.app.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('filter'))
			.node()
			.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testTermValues(barchart) {
		const config = barchart.Inner.state.config
		const termfilter = barchart.Inner.app.Inner.state.termfilter
		const filter = getFilterItemByTag(termfilter.filter, 'filterUiRoot')
		test.equal(
			filter && filter.lst.length,
			2,
			'should create two tvslst filters when a numeric term overlay is clicked'
		)
		test.deepEqual(
			filter.lst[0],
			{
				type: 'tvs',
				tvs: {
					term: config.term.term,
					ranges: [currData.refs.bins[1].find(d => d.label == clickedData.seriesId)]
				}
			},
			'should create a numeric term-value filter with a ranges key'
		)
		// config.term2.q is frozen
		const q = JSON.parse(JSON.stringify(config.term2.q))
		const t2ValKey =
			config.term2 &&
			config.term2.term.values &&
			Object.keys(config.term2.term.values).filter(key => config.term2.term.values[key].label == clickedData.dataId)[0]
		test.deepEqual(
			filter.lst[1],
			{
				type: 'tvs',
				tvs: Object.assign(
					{
						term: config.term2.term,
						values: [
							{
								key: t2ValKey !== undefined ? t2ValKey : clickedData.dataId,
								label:
									clickedData.dataId in config.term2.term.values
										? config.term2.term.values[clickedData.dataId].label
										: clickedData.dataId
							}
						]
					},
					q
				)
			},
			'should create a condition term-value filter with bar_by_*, value_by_*, and other expected keys'
		)
	}
})

tape('click custom categorical group bar to add filter', function (test) {
	test.timeoutAfter(3000)

	const termfilter = { filter: [] }
	const customset = {
		name: 'A versus B',
		groups: [
			{
				name: 'Test A',
				type: 'values',
				values: [
					{
						key: 'Acute lymphoblastic leukemia',
						label: 'Acute lymphoblastic leukemia'
					},
					{
						key: 'Acute myeloid leukemia',
						label: 'Acute myeloid leukemia'
					}
				]
			},
			{
				name: 'Test B',
				type: 'values',
				values: [
					{
						key: 'Central nervous system (CNS)',
						label: 'Central nervous system (CNS)'
					},
					{
						key: 'Wilms tumor',
						label: 'Wilms tumor'
					}
				]
			}
		]
	}
	runpp({
		state: {
			termfilter,
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'diaggrp',
						term: termjson['diaggrp'],
						q: {
							type: 'custom-groupset',
							customset
						}
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	function runTests(barchart) {
		barchart.on('postRender.test', null)
		if (barDiv) return
		barchart.Inner.bus.on('postRender.test', null)
		barDiv = barchart.Inner.dom.barDiv
		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test' })
			.run(triggerBarClick, { wait: 600 })
			.use(triggerMenuClick, { wait: 500 })
			.to(testTermValues, { wait: 100 })
			.done(test)
	}

	let clickedData
	function triggerBarClick(barchart) {
		const elem = barDiv.node().querySelector('.bars-cell').querySelector('rect')
		clickedData = elem.__data__
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(barchart) {
		barchart.Inner.app.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('filter'))
			.node()
			.click() //dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testTermValues(barchart) {
		const config = barchart.Inner.state.config
		const currData = barchart.Inner.currServerData
		const termfilter = barchart.Inner.app.Inner.state.termfilter
		const filter = getFilterItemByTag(termfilter.filter, 'filterUiRoot')
		test.equal(
			filter && filter.lst.length,
			1,
			'should create one tvslst filters when a numeric term overlay is clicked'
		)
		test.deepEqual(
			filter.lst[0],
			{
				type: 'tvs',
				tvs: {
					term: config.term.term,
					values: customset.groups[0].values,
					groupset_label: customset.groups[0].name
				}
			},
			'should create a customset filter with the clicked group.values array'
		)
	}
})

/* bar_by_children handling has been inactivated
tape.skip('click custom subcondition group bar to add filter', function(test) {
	test.timeoutAfter(3000)

	const termfilter = { filter: [] }
	const customset = {
		name: 'A vs. B vs. C',
		groups: [
			{
				name: 'Test A',
				type: 'values',
				values: [
					{
						key: 'Sinus tachycardia',
						label: 'Sinus tachycardia'
					},
					{
						key: 'Sinus bradycardia',
						label: 'Sinus bradycardia'
					}
				]
			},
			{
				name: 'Test B',
				type: 'values',
				values: [
					{
						key: 'Conduction abnormalities',
						label: 'Conduction abnormalities'
					},
					{
						key: 'Atrioventricular heart block',
						label: 'Atrioventricular heart block'
					}
				]
			},
			{
				name: 'Test C',
				type: 'values',
				values: [
					{
						key: 'Prolonged QT interval',
						label: 'Prolonged QT interval'
					},
					{
						key: 'Cardiac dysrhythmia',
						label: 'Cardiac dysrhythmia'
					}
				]
			}
		]
	}
	runpp({
		state: {
			termfilter,
			plots: [{
				chartType: 'barchart',
				term: {
					id: 'Arrhythmias',
					term: termjson['Arrhythmias'],
					q: {
						bar_by_children: true,
						value_by_max_grade: 1,
						groupsetting: {
							disabled: false,
							inuse: true,
							//predefined_groupset_idx: INT,
							customset
						}
					}
				}
			}]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	function runTests(barchart) {
		barchart.on('postRender.test', null)
		if (barDiv) return
		barchart.Inner.bus.on('postRender.test', null)
		barDiv = barchart.Inner.dom.barDiv
		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test' })
			.run(triggerBarClick, { wait: 600 })
			.use(triggerMenuClick, { wait: 500 })
			.to(testTermValues, { wait: 100 })
			.done(test)
	}

	let clickedData
	function triggerBarClick(barchart) {
		const elem = barDiv
			.selectAll('.bars-cell')
			.selectAll('rect')
			.filter(d => d.colId == 'Test A')
			.node()
		clickedData = elem.__data__
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(barchart) {
		barchart.Inner.app.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('filter'))
			.node()
			.click()
	}

	function testTermValues(barchart) {
		const config = barchart.Inner.state.config
		const currData = barchart.Inner.currServerData
		const termfilter = barchart.Inner.app.Inner.state.termfilter
		const filter = getFilterItemByTag(termfilter.filter, 'filterUiRoot')
		test.equal(
			filter && filter.lst.length,
			1,
			'should create one tvslst filters when a numeric term overlay is clicked'
		)
		test.deepEqual(
			filter.lst[0],
			{
				type: 'tvs',
				tvs: {
					term: config.term.term,
					values: customset.groups[0].values,
					groupset_label: customset.groups[0].name,
					bar_by_children: true,
					value_by_max_grade: 1
				}
			},
			'should create a customset filter with the clicked group.values array'
		)
	}
})
*/

tape('numeric exclude range', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'aaclassic_5', term: termjson['aaclassic_5'] },
					term2: { id: 'sex' }
				}
			],
			termfilter: {
				filter: {
					type: 'tvslst',
					join: 'and',
					in: true,
					lst: [
						{
							type: 'tvs',
							tag: 'cohortFilter',
							tvs: {
								term: { id: 'subcohort', type: 'multivalue' },
								values: [
									{ key: 'ABC', label: 'ABC' }
									//{key:'XYZ',label:'XYZ'},
								]
							}
						},
						{
							type: 'tvslst',
							tag: 'filterUiRoot',
							join: '',
							in: true,
							lst: [
								{
									type: 'tvs',
									tvs: {
										term: termjson['aaclassic_5'],
										ranges: [{ start: 10000, stopunbounded: true, startinclusive: false, stopinclusive: true }],
										isnot: true
									}
								}
							]
						}
					]
				}
			},
			nav: {
				header_mode: 'with_tabs'
			},
			activeCohort: -1
		},
		barchart: {
			callbacks: {
				'postRender.test': testBarCount
			}
		}
	})

	function testBarCount(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 8, 'should have 8 bars')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape.skip('numeric filter - only special value', function (test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: { id: 'aaclassic_5' }
				}
			],
			termfilter: {
				filter: {
					type: 'tvslst',
					in: 1,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: termjson['aaclassic_5'],
								ranges: [{ value: -8888, label: 'test' }]
							}
						}
					]
				}
			}
		},
		barchart: {
			callbacks: {
				'postRender.test': runNumericValueTests
			}
		}
	})

	function runNumericValueTests(barchart) {
		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test' })
			//.run(testNoBar, { wait: 300 })
			//.use(triggerHiddenLegendClick, { wait: 300 })
			.run(testHasBar, { wait: 300 })
			.done(test)
	}

	function testNoBar(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 0, 'should have 0 bar')
	}

	function triggerHiddenLegendClick(barchart) {
		barchart.Inner.dom.legendDiv.node().querySelector('.legend-row').click()
	}

	function testHasBar(barchart) {
		const barDiv = barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(
			numBars,
			1,
			'should have 1 bar, forced to be visible on first render to avoid confusion with a blank barchart'
		)
	}
})

tape.skip('custom vocab: categorical terms with numeric filter', test => {
	test.timeoutAfter(3000)

	const custom_runpp = helpers.getRunPp('termdb', {
		debug: 1,
		state: {
			nav: {
				header_mode: 'search_only'
			},
			vocab: vocabData.getExample()
		}
	})

	custom_runpp({
		state: {
			termfilter: {
				filter: {
					type: 'tvslst',
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: vocabData.terms.find(t => t.id == 'd'),
								ranges: [{ start: 0.1, startinclusive: false, stopunbounded: true }]
							}
						}
					]
				}
			},
			plots: [
				{
					chartType: 'barchart',
					term: {
						term: vocabData.terms.find(t => t.id == 'c')
					}
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
		barchart.on('postRender.test', null)
		testBarCount(barchart)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numBars, 2, 'should have 2 bars')
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}
})

tape.skip('custom vocab: numeric terms with categorical filter', test => {
	test.timeoutAfter(3000)
	const vocab = vocabData.getExample()
	const custom_runpp = helpers.getRunPp('termdb', {
		debug: 1,
		state: {
			nav: {
				header_mode: 'search_only'
			},
			vocab
		}
	})

	const dterm = vocab.terms.find(t => t.id == 'd')
	custom_runpp({
		state: {
			termfilter: {
				filter: {
					type: 'tvslst',
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: vocab.terms.find(t => t.id == 'c'),
								values: [{ key: 1 }]
							}
						}
					]
				}
			},
			plots: [
				{
					chartType: 'barchart',
					term: {
						term: dterm,
						q: dterm.bins.default
					}
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
		barchart.on('postRender.test', null)
		testBarCount(barchart)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numBars, 5, 'should have 5 bars')
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}
})

tape('max number of bins: exceeded', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'barchart',
					term: {
						term: termjson['aaclassic_5'],
						q: {
							type: 'regular-bin',
							bin_size: 1000,
							stopinclusive: true,
							first_bin: { startunbounded: true, stop: 1, stopinclusive: true, bin: 'first' },
							numDecimals: 1,
							last_bin: { start: 30000, bin: 'last', stopunbounded: true },
							startinclusive: false
						}
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	async function runTests(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		testBarCount(barchart)
		triggerExceedMaxBin(barchart)
		await testExceedMaxBin(barchart)
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}

	function testBarCount(barchart) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 22, 'should have 22 age bars')
	}

	function triggerExceedMaxBin(barchart) {
		barchart.Inner.app.dispatch({
			type: 'plot_edit',
			id: 'aaclassic_5',
			config: {
				term: {
					id: 'aaclassic_5',
					term: barchart.Inner.config.term.term,
					q: {
						type: 'regular-bin',
						bin_size: 100,
						stopinclusive: true,
						first_bin: { startunbounded: true, stop: 1, stopinclusive: true, bin: 'first' },
						numDecimals: 1,
						last_bin: { start: 30000, bin: 'last', stopunbounded: true },
						startinclusive: false
					}
				}
			}
		})
	}

	async function testExceedMaxBin(barchart) {
		//Fix for removing sleep()
		const numBars = await detectLst({ elem: barDiv.node(), selector: '.bars-cell-grp', count: 22, matchAs: '>=' })
		test.equal(numBars.length, 22, 'should still have 22 age bars and not re-render on error')
		const errorbar = await detectOne({ elem: barchart.Inner.app.Inner.dom.holder.node(), selector: '.sja_errorbar' })
		test.true(errorbar && errorbar.innerText.includes('max_num_bins_reached'), 'should show a max number of bins error')
	}
})

tape.skip('no visible series data, no overlay', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'cisplateq_5'
					}
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
		barchart.on('postRender.test', null)

		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test' })
			.run(testBarCount)
			.use(triggerHideBar, { wait: 1000 })
			.to(testEmptyChart, { wait: 100 })
			.use(triggerUnhideBar, { wait: 1100 })
			.to(testUnhiddenChart, { wait: 100 })
			.done(test)
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const numBars = barDiv.node().querySelectorAll('.bars-cell-grp').length
		test.equal(
			numBars,
			1,
			'should have 1 visible bar on first render when Object.keys(q.hiddenValues).length > chart.serieses.length'
		)
		test.equal(
			barchart.Inner.dom.banner.style('display'),
			'none',
			'should hide the banner when at least one chart is visible'
		)
	}

	function triggerHideBar(barchart) {
		barDiv
			.node()
			.querySelector('.bars-rowlabels text')
			.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testEmptyChart(barchart) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 0, 'should have 0 visible bars when the only visible row label is clicked')
		test.equal(
			barchart.Inner.dom.banner.style('display'),
			'block',
			'should display a banner when no charts are visible'
		)
		test.true(barchart.Inner.dom.banner.text().includes('No visible'), 'should label the banner with no visible data')
	}

	function triggerUnhideBar(barchart) {
		barchart.Inner.dom.legendDiv
			.node()
			.querySelector('.legend-row')
			.firstChild.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testUnhiddenChart(barchart) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar1 when the hidden row legend is clicked')
		/*test.equal(
			barchart.Inner.dom.banner.style("display"),
			'none',
			'should hide the banner when the chart is unhidden'
		)*/
	}
})

tape.skip('all hidden + with overlay, legend click', function (test) {
	test.timeoutAfter(9000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			plots: [
				{
					chartType: 'barchart',
					term: {
						id: 'cisplateq_5'
					},
					term2: {
						id: 'sex'
					}
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
		barchart.on('postRender.test', null)

		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test' })
			.run(testBarCount)
			.run(triggerBarClick)
			.use(triggerMenuClick, { wait: 1100 })
			.to(testRemovedOverlayByMenu, { wait: 100 })
			.use(triggerUnhideOverlay, { wait: 1100 })
			.to(testUnhiddenOverlay, { wait: 100 })
			.use(triggerOverlayHideByLegendClick, { wait: 1000 })
			.to(testhiddenOverlayByLegendClick, { wait: 100 })
			.done(test)
	}

	let barDiv
	function testBarCount(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(
			numBars,
			1,
			'should have 1 visible bar on first render when Object.keys(q.hiddenValues).length > chart.serieses.length'
		)
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(
			numOverlays,
			2,
			'should have 2 visible overlays on first render when Object.keys(q.hiddenValues).length > chart.serieses.length'
		)
		test.equal(
			barchart.Inner.dom.banner.style('display'),
			'none',
			'should hide the banner when at least one chart is visible'
		)
	}

	let clickedData
	function triggerBarClick(barchart) {
		const elem = barDiv.node().querySelector('.bars-cell').querySelector('rect')
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(barchart) {
		barchart.Inner.app.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('Hide "Female"'))
			.node()
			.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testRemovedOverlayByMenu(barchart) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar after hiding an overlay')
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numOverlays, 1, 'should have 1 visible overlay left after hiding an overlay')
	}

	function triggerUnhideOverlay(barchart) {
		barchart.Inner.dom.legendDiv
			.selectAll('.legend-row')
			.filter(d => d.dataId == '2')
			.node()
			.firstChild.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testUnhiddenOverlay(barchart) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar after unhiding an overlay')
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numOverlays, 2, 'should have 2 visible overlays after unhiding an overlay')
	}

	function triggerOverlayHideByLegendClick(barchart) {
		barchart.Inner.dom.legendDiv
			.select('.legend-row')
			.node()
			.firstChild.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testhiddenOverlayByLegendClick(barchart) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar after hiding an overlay by legend click')
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numOverlays, 1, 'should have 1 visible overlays after hiding an overlay by legend click')
	}
})

tape.skip('unhidden chart and legend', test => {
	test.timeoutAfter(8000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			plots: [
				{
					chartType: 'barchart',
					term: {
						term: termjson['aaclassic_5'],
						q: {
							type: 'regular-bin',
							bin_size: 10000,
							stopinclusive: true,
							first_bin: { startunbounded: true, stop: 1, stopinclusive: true, bin: 'first' },
							numDecimals: 1,
							last_bin: { start: 30000, bin: 'last', stopunbounded: true },
							startinclusive: false
						}
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(barchart) {
		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test', preserve: true })
			.run(testVisibleChart)
			.run(triggerHideChart, 300)
			.run(testHiddenChart, 300)
			.run(triggerShowChart, 300)
			.run(testReshownChart, 300)
			.done(test)
	}

	function testVisibleChart(barchart) {
		test.notEqual(
			barchart.Inner.dom.holder.node().style.display,
			'none',
			'should start with both visible and not overlapping'
		)
	}

	function triggerHideChart(barchart) {
		barchart.Inner.app.dispatch({
			type: 'plot_hide',
			id: 'aaclassic_5'
		})
	}

	function testHiddenChart(barchart) {
		test.equal(barchart.Inner.dom.holder.node().style.display, 'none', 'should trigger hiding both chart and legend')
	}

	function triggerShowChart(barchart) {
		// issue to fix: clicking the view button will cause the stat table
		// to overlap from the bottom of the chart
		barchart.Inner.dom.holder.node().parentNode.querySelector('.termview').click()

		// same result when using dispatch
		/*barchart.Inner.app.dispatch({
			type: 'plot_show',
			id: 'aaclassic_5'
		})*/
	}

	function testReshownChart(barchart) {
		test.true(
			+barchart.Inner.dom.holder.select('svg').property('height').baseVal.value > 100,
			'should not have a small barchart svg when reshowing a barchart, not overlap with legend'
		)
	}
})

tape.skip('customized bins', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			plots: [
				{
					chartType: 'barchart',
					term: {
						term: termjson['aaclassic_5']
					}
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(barchart) {
		helpers
			.rideInit({ arg: barchart, bus: barchart, eventType: 'postRender.test', preserve: true })
			.run(triggerCustomBins, 400)
			.run(triggerSearch, 300)
			// .run(testReversion, 1000)
			.done(test)
	}

	const q1 = {
		type: 'regular-bin',
		bin_size: 10000,
		stopinclusive: true,
		first_bin: { startunbounded: true, stop: 1, stopinclusive: true, bin: 'first' },
		numDecimals: 1,
		last_bin: { start: 30000, bin: 'last', stopunbounded: true },
		startinclusive: false
	}

	function triggerCustomBins(barchart) {
		barchart.Inner.app.dispatch({
			type: 'plot_edit',
			id: 'aaclassic_5',
			config: {
				term: {
					id: 'aaclassic_5',
					term: barchart.Inner.config.term.term,
					q: q1
				}
			}
		})
	}

	async function triggerSearch(barchart) {
		const dom = barchart.Inner.app.getComponents('nav.search').Inner.dom
		dom.input.property('value', 'Cumulative Alkylating Agents (Cyclophosphamide Equivalent Dose)')
		dom.input.on('input')()
		await sleep(500)
		dom.holder.select('.sja_menuoption').node().dispatchEvent(new Event('click'))
	}

	function testReversion(barchart) {
		test.deepEqual(barchart.Inner.config.term.q, q1, 'should not be reverted when using a searched term')
	}
})

// to make or update following config, on the browser build/modify the tw or filter, apply to chart, at Session > Share > Open link, open the session file and locate the record and copy it here:
// for geneVariant tw, search for string "geneVariant"
// for filter, search for "termfilter"
const geneVariantTw = {
	term: {
		kind: 'gene',
		id: 'TP53',
		gene: 'TP53',
		name: 'TP53',
		type: 'geneVariant',
		groupsetting: { disabled: false },
		childTerms: [
			{
				id: 'snvindel_somatic',
				query: 'snvindel',
				name: 'SNV/indel (somatic)',
				parent_id: null,
				isleaf: true,
				type: 'dtsnvindel',
				dt: 1,
				values: {
					M: { label: 'MISSENSE' },
					F: { label: 'FRAMESHIFT' },
					WT: { label: 'Wildtype' }
				},
				name_noOrigin: 'SNV/indel',
				origin: 'somatic',
				parentTerm: {
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant',
					groupsetting: { disabled: false }
				}
			},
			{
				id: 'snvindel_germline',
				query: 'snvindel',
				name: 'SNV/indel (germline)',
				parent_id: null,
				isleaf: true,
				type: 'dtsnvindel',
				dt: 1,
				values: {
					M: { label: 'MISSENSE' },
					F: { label: 'FRAMESHIFT' },
					WT: { label: 'Wildtype' }
				},
				name_noOrigin: 'SNV/indel',
				origin: 'germline',
				parentTerm: {
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant',
					groupsetting: { disabled: false }
				}
			},
			{
				id: 'cnv',
				query: 'cnv',
				name: 'CNV',
				parent_id: null,
				isleaf: true,
				type: 'dtcnv',
				dt: 4,
				values: {
					CNV_amp: { label: 'Copy number gain' },
					WT: { label: 'Wildtype' }
				},
				name_noOrigin: 'CNV',
				parentTerm: {
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant',
					groupsetting: { disabled: false }
				}
			},
			{
				id: 'fusion',
				query: 'svfusion',
				name: 'Fusion RNA',
				parent_id: null,
				isleaf: true,
				type: 'dtfusion',
				dt: 2,
				values: {
					Fuserna: { label: 'Fusion transcript' },
					WT: { label: 'Wildtype' }
				},
				name_noOrigin: 'Fusion RNA',
				parentTerm: {
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant',
					groupsetting: { disabled: false }
				}
			}
		]
	},
	q: {
		isAtomic: true,
		type: 'custom-groupset',
		hiddenValues: {},
		customset: {
			groups: [
				{
					name: 'Excluded categories',
					type: 'filter',
					uncomputable: true,
					filter: { type: 'tvslst', in: true, join: '', lst: [] }
				},
				{
					name: 'SNV/indel',
					type: 'filter',
					uncomputable: false,
					filter: {
						type: 'tvslst',
						in: true,
						join: 'or',
						lst: [
							{
								type: 'tvs',
								tvs: {
									term: {
										id: 'snvindel_somatic',
										query: 'snvindel',
										name: 'SNV/indel (somatic)',
										parent_id: null,
										isleaf: true,
										type: 'dtsnvindel',
										dt: 1,
										values: {
											M: { label: 'MISSENSE' },
											F: { label: 'FRAMESHIFT' },
											WT: { label: 'Wildtype' }
										},
										name_noOrigin: 'SNV/indel',
										origin: 'somatic',
										parentTerm: {
											kind: 'gene',
											id: 'TP53',
											gene: 'TP53',
											name: 'TP53',
											type: 'geneVariant',
											groupsetting: { disabled: false }
										}
									},
									values: [
										{
											key: 'M',
											label: 'MISSENSE',
											value: 'M',
											bar_width_frac: null
										},
										{
											key: 'F',
											label: 'FRAMESHIFT',
											value: 'F',
											bar_width_frac: null
										}
									]
								}
							},
							{
								type: 'tvs',
								tvs: {
									term: {
										id: 'snvindel_germline',
										query: 'snvindel',
										name: 'SNV/indel (germline)',
										parent_id: null,
										isleaf: true,
										type: 'dtsnvindel',
										dt: 1,
										values: {
											M: { label: 'MISSENSE' },
											F: { label: 'FRAMESHIFT' },
											WT: { label: 'Wildtype' }
										},
										name_noOrigin: 'SNV/indel',
										origin: 'germline',
										parentTerm: {
											kind: 'gene',
											id: 'TP53',
											gene: 'TP53',
											name: 'TP53',
											type: 'geneVariant',
											groupsetting: { disabled: false }
										}
									},
									values: [
										{
											key: 'M',
											label: 'MISSENSE',
											value: 'M',
											bar_width_frac: null
										},
										{
											key: 'F',
											label: 'FRAMESHIFT',
											value: 'F',
											bar_width_frac: null
										}
									]
								}
							}
						]
					}
				},
				{
					name: 'Wildtype',
					type: 'filter',
					uncomputable: false,
					filter: {
						type: 'tvslst',
						in: true,
						join: 'and',
						lst: [
							{
								type: 'tvs',
								tvs: {
									term: {
										id: 'snvindel_somatic',
										query: 'snvindel',
										name: 'SNV/indel (somatic)',
										parent_id: null,
										isleaf: true,
										type: 'dtsnvindel',
										dt: 1,
										values: {
											M: { label: 'MISSENSE' },
											F: { label: 'FRAMESHIFT' },
											WT: { label: 'Wildtype' }
										},
										name_noOrigin: 'SNV/indel',
										origin: 'somatic',
										parentTerm: {
											kind: 'gene',
											id: 'TP53',
											gene: 'TP53',
											name: 'TP53',
											type: 'geneVariant',
											groupsetting: { disabled: false }
										}
									},
									values: [
										{
											key: 'WT',
											label: 'Wildtype',
											value: 'WT',
											bar_width_frac: null
										}
									]
								}
							},
							{
								type: 'tvs',
								tvs: {
									term: {
										id: 'snvindel_germline',
										query: 'snvindel',
										name: 'SNV/indel (germline)',
										parent_id: null,
										isleaf: true,
										type: 'dtsnvindel',
										dt: 1,
										values: {
											M: { label: 'MISSENSE' },
											F: { label: 'FRAMESHIFT' },
											WT: { label: 'Wildtype' }
										},
										name_noOrigin: 'SNV/indel',
										origin: 'germline',
										parentTerm: {
											kind: 'gene',
											id: 'TP53',
											gene: 'TP53',
											name: 'TP53',
											type: 'geneVariant',
											groupsetting: { disabled: false }
										}
									},
									values: [
										{
											key: 'WT',
											label: 'Wildtype',
											value: 'WT',
											bar_width_frac: null
										}
									]
								}
							}
						]
					}
				}
			]
		}
	},
	isAtomic: true,
	type: 'GvCustomGsTW',
	bins: []
}

const tp53dtTermFilter = {
	type: 'tvslst',
	in: true,
	join: '',
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'snvindel_somatic',
					query: 'snvindel',
					name: 'SNV/indel (somatic)',
					parent_id: null,
					isleaf: true,
					type: 'dtsnvindel',
					dt: 1,
					values: {
						M: { label: 'MISSENSE' },
						F: { label: 'FRAMESHIFT' },
						WT: { label: 'Wildtype' }
					},
					name_noOrigin: 'SNV/indel',
					origin: 'somatic',
					parentTerm: {
						kind: 'gene',
						id: 'TP53',
						gene: 'TP53',
						name: 'TP53',
						type: 'geneVariant'
					}
				},
				values: [
					{
						key: 'M',
						label: 'MISSENSE',
						value: 'M',
						bar_width_frac: null
					}
				]
			}
		}
	],
	tag: 'filterUiRoot'
}
