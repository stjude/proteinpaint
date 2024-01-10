'use strict'
const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
const helpers = require('../../test/front.helpers.js')
const { sleep, detectLst, detectOne } = require('../../test/test.helpers.js')
const getFilterItemByTag = require('../../filter/filter').getFilterItemByTag
const vocabData = require('../../termdb/test/vocabData')
const hideCategory = require('../../plots/barchart.events.js').hideCategory

/*
TODO cover all combinations

Tests:
	term1=categorical
	term1=categorical, term2=defaultbins
	term0=defaultbins, term1=categorical
	term1=geneVariant
	series visibility - q.hiddenValue
	series visibility - numeric
	series visibility - condition
	single barchart, filtered
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
	test.pass('-***- plots/barchart -***-')
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

	let barDiv
	function testNumCharts(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts > 2, 'should have more than 2 charts by Age at Cancer Diagnosis')
		if (test._ok) barchart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneVariant', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary', // cannot use 'barchart', breaks
					term: { term: { type: 'geneVariant', name: 'TP53' } }
				}
			]
		},
		barchart: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	let barDiv
	function testNumCharts(barchart) {
		barDiv = barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts > 2, 'should have more than 2 charts by TP53')
		if (test._ok) barchart.Inner.app.destroy()
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

tape('single barchart, filtered', function (test) {
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
					q,
					{ groupsetting: {} }
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
							groupsetting: {
								type: 'values',
								disabled: false,
								inuse: true,
								//predefined_groupset_idx: INT,
								customset
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
								term: { id: 'subcohort', type: 'categorical' },
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
