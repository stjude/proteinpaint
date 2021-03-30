'use strict'
const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')
const getFilterItemByTag = require('../../common/filter').getFilterItemByTag
const vocabData = require('./vocabData')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		vocab: {
			dslabel: 'SJLife',
			genome: 'hg38'
		},
		nav: { header_mode: 'with_tabs' }
	},
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/barchart -***-')
	test.end()
})

tape('single barchart, categorical bars', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: {
							id: 'diaggrp'
						},
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(plot) {
		plot.on('postRender.test', null)
		testBarCount(plot)
		testAxisDimension(plot)
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > 5, 'should have more than 10 Diagnosis Group bars')
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}

	function testAxisDimension(plot) {
		const xAxis = barDiv.select('.sjpcb-bar-chart-x-axis').node()
		const seriesG = barDiv.select('.bars-series').node()
		test.true(xAxis.getBBox().width >= seriesG.getBBox().width, 'x-axis width should be >= series width')
	}
})

tape('single chart, with overlay', function(test) {
	test.timeoutAfter(5000)
	test.plan(4)
	const termfilter = { filter: [] }
	runpp({
		state: {
			termfilter,
			nav: {
				header_mode: 'search_only'
			},
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: { id: 'diaggrp' },
						term2: { id: 'agedx' },
						settings: {
							currViews: ['barchart'],
							controls: {
								term2: { id: 'agedx', term: termjson['agedx'] }
							},
							barchart: {
								overlay: 'tree'
							}
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	async function runTests(plot) {
		plot.on('postRender.test', null)
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		/*helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test', preserve: true })
			.run(testBarCount)
			.run(testOverlayOrder)
			.run(triggerUncomputableOverlay, 200)
			.run(clickLegendToHideOverlay, 1000)
			.run(testHiddenOverlayData, 2000)
			.done(test)*/

		testBarCount(plot)
		await sleep(100)
		testOverlayOrder(plot)
		await sleep(1000)
		triggerUncomputableOverlay(plot)
		await sleep(1000)
		clickLegendToHideOverlay(plot)
		await sleep(1200)
		testHiddenOverlayData(plot)
		test.end()
	}

	function testBarCount(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > 10, 'should have more than 10 Diagnosis Group bars')
		test.true(numOverlays > numBars, 'number of overlays should be greater than bars')
	}

	function testOverlayOrder(plot) {
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
		test.true(overlay_ordered, 'overlays order is same as legend')
	}

	function triggerUncomputableOverlay(plot) {
		plot.Inner.app.dispatch({
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

	async function clickLegendToHideOverlay(plot) {
		const legendDiv = plot.Inner.components.barchart.Inner.dom.legendDiv
		const item = legendDiv
			.selectAll('.legend-row')
			.filter(d => d.dataId == 'unknown exposure')
			.node()
		item.dispatchEvent(new Event('click', { bubbles: true }))
	}

	async function testHiddenOverlayData(plot) {
		const legendDiv = plot.Inner.components.barchart.Inner.dom.legendDiv
		const item = legendDiv.selectAll('.legend-row').filter(function(d) {
			return +this.style.opacity < 1 && d.dataId == 'unknown exposure'
		})
		test.equal(item.size(), 1, 'should hide a clicked uncomputable overlay legend')
	}
})

tape('multiple charts', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: { id: 'diaggrp' },
						term0: { id: 'agedx' },
						settings: {
							currViews: ['barchart'],
							barchart: {
								divideBy: 'tree'
							},
							controls: {
								term0: { id: 'agedx', term: termjson['agedx'] }
							}
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testNumCharts
			}
		}
	})

	let barDiv
	function testNumCharts(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numCharts = barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts > 2, 'should have more than 2 charts by Age at Cancer Diagnosis')
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}
})

tape('series visibility - q.hiddenValues', function(test) {
	test.timeoutAfter(5000)

	const hiddenValues = { 1: 1 }
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographic Variables', 'sex'],
				visiblePlotIds: ['sex'],
				plots: {
					sex: {
						term: {
							id: 'sex',
							q: {
								hiddenValues
							}
						},
						settings: { currViews: ['barchart'] }
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testHiddenValues
			}
		}
	})

	function testHiddenValues(plot) {
		const bar = plot.Inner.components.barchart.Inner
		test.deepEqual(
			bar.settings.exclude.cols.sort(),
			Object.keys(hiddenValues).sort(),
			'should have the correct number of hidden bars by q.hiddenValues'
		)
		test.equal(
			plot.Inner.dom.viz.selectAll('.bars-cell').size(),
			bar.settings.cols.length - bar.settings.exclude.cols.length,
			'should render the correct number of visible bars'
		)
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}
})

tape('series visibility - numeric', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alkylating Agents'],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						term: { id: 'aaclassic_5' },
						settings: { currViews: ['barchart'] }
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runNumericExcludedTests
			}
		}
	})

	function runNumericExcludedTests(plot) {
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			.run(testHiddenByValues)
			.use(triggerHiddenLegendClick, { wait: 800 })
			.to(testRevealedBar, { wait: 100 })
			.use(triggerMenuClickToHide, { wait: 100 })
			.to(testHiddenLegendDisplay, { wait: 600 })
			.done(test)
	}

	function testHiddenByValues(plot) {
		const bar = plot.Inner.components.barchart.Inner
		const excluded = bar.settings.exclude.cols
		test.true(
			excluded.length > 1 && excluded.length == Object.keys(bar.config.term.q.hiddenValues).length,
			'should have the correct number of excluded numeric series by q.hiddenValues'
		)
		test.equal(
			plot.Inner.components.barchart.Inner.dom.legendDiv.selectAll('.legend-row').size(),
			excluded.length,
			'should display the correct number of hidden legend labels'
		)
	}

	let numHiddenLegendBeforeClick
	function triggerHiddenLegendClick(plot) {
		numHiddenLegendBeforeClick = plot.Inner.components.barchart.Inner.settings.exclude.cols.length
		plot.Inner.components.barchart.Inner.dom.legendDiv
			.node()
			.querySelector('.legend-row')
			.click()
	}

	function testRevealedBar(plot) {
		const bar = plot.Inner.components.barchart.Inner
		const excluded = bar.settings.exclude.cols
		test.equal(excluded.length, numHiddenLegendBeforeClick - 1, 'should adjust the number of excluded series data')
		test.equal(
			plot.Inner.components.barchart.Inner.dom.legendDiv.selectAll('.legend-row').size(),
			excluded.length,
			'should adjust the number of hidden legend labels after clicking to reveal one'
		)
	}

	function triggerMenuClickToHide(plot) {
		plot.Inner.components.barchart.Inner.dom.holder
			.selectAll('.bars-cell-grp')
			.filter(d => d.seriesId == 'not treated')
			.node()
			.dispatchEvent(new Event('click', { bubbles: true }))

		plot.Inner.app.Inner.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('Hide'))
			.node()
			.click()
	}

	function testHiddenLegendDisplay(plot) {
		test.equal(
			plot.Inner.components.barchart.Inner.dom.legendDiv
				.selectAll('.legend-row')
				.filter(function() {
					return this.innerHTML.includes('exposed, dose unknown')
				})
				.size(),
			1,
			'should hide a special numeric value by menu click'
		)
	}
})

tape('series visibility - condition', function(test) {
	test.timeoutAfter(5000)

	const conditionHiddenValues = { '1: Mild': 1 }
	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'ctcae_graded',
					'Cardiovascular System',
					'Arrhythmias'
				],
				visiblePlotIds: ['Arrhythmias'],
				plots: {
					Arrhythmias: {
						term: {
							id: 'Arrhythmias',
							q: {
								hiddenValues: conditionHiddenValues
							}
						},
						settings: { currViews: ['barchart'] }
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testConditionHiddenValues
			}
		}
	})

	function testConditionHiddenValues(plot) {
		const bar = plot.Inner.components.barchart.Inner
		const excluded = bar.settings.exclude.cols
		// exclude "Unknown status" and "1: Mild"
		test.equal(excluded.length, 2, 'should have the correct number of hidden condition bars by q.hiddenValues')
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}
})

tape('single barchart, filtered', function(test) {
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
			tree: {
				expandedTermIds: ['root', 'Demographic Variables', 'sex'],
				visiblePlotIds: ['sex'],
				plots: {
					sex: {
						term: {
							id: 'sex'
						},
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(plot) {
		plot.on('postRender.test', null)
		test.equal(plot.Inner.dom.holder.node().querySelectorAll('.bars-cell-grp').length, 1, 'should show one bar series')
		test.equal(
			plot.Inner.dom.holder.node().querySelector('.bars-cell-grp').__data__.seriesId,
			'1',
			'should show one bar series that matches filter value'
		)
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}
})

tape('click non-group bar to add filter', function(test) {
	test.timeoutAfter(8000)

	const termfilter = { filter: [] }
	runpp({
		state: {
			nav: {
				activeCohort: 0
			},
			termfilter,
			tree: {
				expandedTermIds: ['root', 'Demographic Variables', 'Age', 'agedx'],
				visiblePlotIds: ['agedx'],
				plots: {
					agedx: {
						term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'].bins.less },
						term2: {
							id: 'Arrhythmias',
							term: termjson['Arrhythmias'],
							q: {
								hiddenValues: {
									'Unknown status': 1
								}
							}
						},
						settings: { currViews: ['barchart'] }
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	function runTests(plot) {
		if (barDiv) return
		plot.Inner.bus.on('postRender.test', null)
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			.run(triggerBarClick, { wait: 500 })
			.use(triggerMenuClick, { wait: 300 })
			.to(testTermValues, { wait: 1000 })
			.done(test)
	}

	let clickedData, currData
	function triggerBarClick(plot) {
		const elem = barDiv
			.node()
			.querySelector('.bars-cell')
			.querySelector('rect')
		clickedData = elem.__data__
		currData = plot.Inner.currData
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(plot) {
		plot.Inner.app.Inner.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('filter'))
			.node()
			.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testTermValues(plot) {
		const config = plot.Inner.state.config
		const termfilter = plot.Inner.app.Inner.state.termfilter
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

tape('click custom categorical group bar to add filter', function(test) {
	test.timeoutAfter(3000)

	const termfilter = { filter: [] }
	const customset = {
		name: 'A versus B',
		groups: [
			{
				name: 'Test A',
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
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: {
							id: 'diaggrp',
							term: termjson['diaggrp'],
							q: {
								groupsetting: {
									disabled: false,
									inuse: true,
									//predefined_groupset_idx: INT,
									customset
								}
							}
						},
						settings: { currViews: ['barchart'] }
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	function runTests(plot) {
		if (barDiv) return
		plot.Inner.bus.on('postRender.test', null)
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			.run(triggerBarClick, { wait: 600 })
			.use(triggerMenuClick, { wait: 500 })
			.to(testTermValues, { wait: 100 })
			.done(test)
	}

	let clickedData
	function triggerBarClick(plot) {
		const elem = barDiv
			.node()
			.querySelector('.bars-cell')
			.querySelector('rect')
		clickedData = elem.__data__
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(plot) {
		plot.Inner.app.Inner.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('filter'))
			.node()
			.click() //dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testTermValues(plot) {
		const config = plot.Inner.state.config
		const currData = plot.Inner.currData
		const termfilter = plot.Inner.app.Inner.state.termfilter
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

tape('click custom subcondition group bar to add filter', function(test) {
	test.timeoutAfter(3000)

	const termfilter = { filter: [] }
	const customset = {
		name: 'A vs. B vs. C',
		groups: [
			{
				name: 'Test A',
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
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'ctcae_graded',
					'Cardiovascular System',
					'Arrhythmias'
				],
				visiblePlotIds: ['Arrhythmias'],
				plots: {
					Arrhythmias: {
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
						},
						settings: { currViews: ['barchart'] }
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	function runTests(plot) {
		if (barDiv) return
		plot.Inner.bus.on('postRender.test', null)
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			.run(triggerBarClick, { wait: 600 })
			.use(triggerMenuClick, { wait: 500 })
			.to(testTermValues, { wait: 100 })
			.done(test)
	}

	let clickedData
	function triggerBarClick(plot) {
		const elem = barDiv
			.selectAll('.bars-cell')
			.selectAll('rect')
			.filter(d => d.colId == 'Test A')
			.node()
		clickedData = elem.__data__
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(plot) {
		plot.Inner.app.Inner.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('filter'))
			.node()
			.click()
	}

	function testTermValues(plot) {
		const config = plot.Inner.state.config
		const currData = plot.Inner.currData
		const termfilter = plot.Inner.app.Inner.state.termfilter
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

tape('single chart, genotype overlay', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: { id: 'diaggrp', term: termjson['diaggrp'] },
						term2: 'genotype',
						settings: { currViews: ['barchart'] }
					}
				}
			},
			ssid: {
				mutation_name: 'TEST',
				ssid: 'genotype-test.txt',
				groups: {
					Heterozygous: { color: 'red' },
					'Homozygous reference': { color: 'blue' },
					'Homozygous alternative': { color: 'green' }
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testBarCount
			}
		}
	})

	function testBarCount(plot) {
		const barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.true(numBars > 10, 'should have more than 10 Diagnosis Group bars')
		test.equal(numOverlays, 67, 'should have a total of 67 overlays')
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}
})

tape('numeric exclude range', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Cancer-related Variables',
					'Treatment',
					'Chemotherapy',
					'Anthracyclines',
					'idarubicin_5'
				],
				visiblePlotIds: ['idarubicin_5'],
				plots: {
					idarubicin_5: {
						term: { id: 'idarubicin_5', term: termjson['idarubicin_5'] },
						term2: 'genotype',
						settings: { currViews: ['barchart'] }
					}
				}
			},
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
									{ key: 'SJLIFE', label: 'SJLIFE' }
									//{key:'CCSS',label:'CCSS'},
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
										term: termjson['idarubicin_5'],
										ranges: [{ start: 10, stopunbounded: true, startinclusive: false, stopinclusive: true }],
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
		plot: {
			callbacks: {
				'postRender.test': testBarCount
			}
		}
	})

	function testBarCount(plot) {
		const barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 bar')
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}
})

tape('numeric filter - only special value', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alkylating Agents'],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						term: { id: 'aaclassic_5' },
						settings: { currViews: ['barchart'] }
					}
				}
			},
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
		plot: {
			callbacks: {
				'postRender.test': runNumericValueTests
			}
		}
	})

	function runNumericValueTests(plot) {
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			//.run(testNoBar, { wait: 300 })
			//.use(triggerHiddenLegendClick, { wait: 300 })
			.run(testHasBar, { wait: 300 })
			.done(test)
	}

	function testNoBar(plot) {
		const barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 0, 'should have 0 bar')
	}

	function triggerHiddenLegendClick(plot) {
		plot.Inner.components.barchart.Inner.dom.legendDiv
			.node()
			.querySelector('.legend-row')
			.click()
	}

	function testHasBar(plot) {
		const barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(
			numBars,
			1,
			'should have 1 bar, forced to be visible on first render to avoid confusion with a blank plot'
		)
	}
})

tape('custom vocab: categorical terms with numeric filter', test => {
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
			tree: {
				expandedTermIds: ['root', 'a'],
				visiblePlotIds: ['c'],
				plots: {
					c: {
						term: {
							term: vocabData.terms.find(t => t.id == 'c')
						},
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(plot) {
		plot.on('postRender.test', null)
		testBarCount(plot)
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numBars, 2, 'should have 2 bars')
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}
})

tape('custom vocab: numeric terms with categorical filter', test => {
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
			tree: {
				expandedTermIds: ['root', 'a'],
				visiblePlotIds: ['d'],
				plots: {
					d: {
						term: {
							term: dterm,
							q: dterm.bins.default
						},
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(plot) {
		plot.on('postRender.test', null)
		testBarCount(plot)
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}

	let barDiv
	function testBarCount(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numBars, 3, 'should have 3 bars')
		test.equal(numBars, numOverlays, 'should have equal numbers of bars and overlays')
	}
})

tape('max number of bins: exceeded', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Cancer-related Variables',
					'Treatment',
					'Chemotherapy',
					'Alkylating Agents',
					'aaclassic_5'
				],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						term: {
							term: {
								id: 'aaclassic_5'
							},
							q: {
								type: 'regular',
								bin_size: 1000,
								stopinclusive: true,
								first_bin: { startunbounded: true, stop: 1, stopinclusive: true, bin: 'first' },
								numDecimals: 1,
								last_bin: { start: 30000, bin: 'last', stopunbounded: true },
								startinclusive: false
							}
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let barDiv
	async function runTests(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		testBarCount(plot)
		triggerExceedMaxBin(plot)
		await sleep(1000)
		testExceedMaxBin(plot)
		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}

	function testBarCount(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 31, 'should have 31 age bars')
	}

	function triggerExceedMaxBin(plot) {
		plot.Inner.app.dispatch({
			type: 'plot_edit',
			id: 'aaclassic_5',
			config: {
				term: {
					id: 'aaclassic_5',
					term: plot.Inner.config.term.term,
					q: {
						type: 'regular',
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

	function testExceedMaxBin(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 31, 'should still have 31 age bars and not re-render on error')
		const errorbar = plot.Inner.app.Inner.dom.holder.node().querySelector('.sja_errorbar')
		test.true(errorbar && errorbar.innerText.includes('max_num_bins_reached'), 'should show a max number of bins error')
	}
})

tape('no visible series data, no overlay', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			tree: {
				expandedTermIds: [
					'root',
					'Cancer-related Variables',
					'Treatment',
					'Chemotherapy',
					'Platinum Agent',
					'cisplateq_5'
				],
				visiblePlotIds: ['cisplateq_5'],
				plots: {
					cisplateq_5: {
						term: {
							id: 'cisplateq_5'
						},
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(plot) {
		plot.on('postRender.test', null)

		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			.run(testBarCount)
			.use(triggerHideBar, { wait: 1000 })
			.to(testEmptyChart, { wait: 100 })
			.use(triggerUnhideBar, { wait: 1100 })
			.to(testUnhiddenChart, { wait: 100 })
			.done(test)
	}

	let barDiv
	function testBarCount(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		const numBars = barDiv.node().querySelectorAll('.bars-cell-grp').length
		test.equal(
			numBars,
			1,
			'should have 1 visible bar on first render when Object.keys(q.hiddenValues).length > chart.serieses.length'
		)
		test.equal(
			plot.Inner.components.barchart.Inner.dom.banner.style('display'),
			'none',
			'should hide the banner when at least one chart is visible'
		)
	}

	function triggerHideBar(plot) {
		barDiv
			.node()
			.querySelector('.bars-rowlabels text')
			.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testEmptyChart(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 0, 'should have 0 visible bars when the only visible row label is clicked')
		test.equal(
			plot.Inner.components.barchart.Inner.dom.banner.style('display'),
			'block',
			'should display a banner when no charts are visible'
		)
		test.true(
			plot.Inner.components.barchart.Inner.dom.banner.text().includes('No visible'),
			'should label the banner with no visible data'
		)
	}

	function triggerUnhideBar(plot) {
		plot.Inner.components.barchart.Inner.dom.legendDiv
			.node()
			.querySelector('.legend-row')
			.firstChild.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testUnhiddenChart(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar1 when the hidden row legend is clicked')
		/*test.equal(
			plot.Inner.components.barchart.Inner.dom.banner.style("display"),
			'none',
			'should hide the banner when the chart is unhidden'
		)*/
	}
})

tape('all hidden + with overlay, legend click', function(test) {
	test.timeoutAfter(9000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			tree: {
				expandedTermIds: [
					'root',
					'Cancer-related Variables',
					'Treatment',
					'Chemotherapy',
					'Platinum Agent',
					'cisplateq_5'
				],
				visiblePlotIds: ['cisplateq_5'],
				plots: {
					cisplateq_5: {
						term: {
							id: 'cisplateq_5'
						},
						term2: {
							id: 'sex'
						},
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(plot) {
		plot.on('postRender.test', null)

		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
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
	function testBarCount(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
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
			plot.Inner.components.barchart.Inner.dom.banner.style('display'),
			'none',
			'should hide the banner when at least one chart is visible'
		)
	}

	let clickedData
	function triggerBarClick(plot) {
		const elem = barDiv
			.node()
			.querySelector('.bars-cell')
			.querySelector('rect')
		elem.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function triggerMenuClick(plot) {
		plot.Inner.app.Inner.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('Hide "Male"'))
			.node()
			.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testRemovedOverlayByMenu(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar after hiding an overlay')
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numOverlays, 1, 'should have 1 visible overlay left after hiding an overlay')
	}

	function triggerUnhideOverlay(plot) {
		plot.Inner.components.barchart.Inner.dom.legendDiv
			.select('.legend-row')
			.node()
			.firstChild.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testUnhiddenOverlay(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar after unhiding an overlay')
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numOverlays, 2, 'should have 2 visible overlays after unhiding an overlay')
	}

	function triggerOverlayHideByLegendClick(plot) {
		plot.Inner.components.barchart.Inner.dom.legendDiv
			.select('.legend-row')
			.node()
			.firstChild.dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testhiddenOverlayByLegendClick(plot) {
		const numBars = barDiv.selectAll('.bars-cell-grp').size()
		test.equal(numBars, 1, 'should have 1 visible bar after hiding an overlay by legend click')
		const numOverlays = barDiv.selectAll('.bars-cell').size()
		test.equal(numOverlays, 1, 'should have 1 visible overlays after hiding an overlay by legend click')
	}
})

tape('unhidden chart and legend', test => {
	test.timeoutAfter(8000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			tree: {
				expandedTermIds: [
					'root',
					'Cancer-related Variables',
					'Treatment',
					'Chemotherapy',
					'Alkylating Agents',
					'aaclassic_5'
				],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						term: {
							term: {
								id: 'aaclassic_5'
							},
							q: {
								type: 'regular',
								bin_size: 10000,
								stopinclusive: true,
								first_bin: { startunbounded: true, stop: 1, stopinclusive: true, bin: 'first' },
								numDecimals: 1,
								last_bin: { start: 30000, bin: 'last', stopunbounded: true },
								startinclusive: false
							}
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(plot) {
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test', preserve: true })
			.run(testVisibleChart)
			.run(triggerHideChart, 300)
			.run(testHiddenChart, 300)
			.run(triggerShowChart, 300)
			.run(testReshownChart, 300)
			.done(test)
	}

	function testVisibleChart(plot) {
		test.notEqual(
			plot.Inner.dom.holder.node().style.display,
			'none',
			'should start with both visible and not overlapping'
		)
	}

	function triggerHideChart(plot) {
		plot.Inner.app.dispatch({
			type: 'plot_hide',
			id: 'aaclassic_5'
		})
	}

	function testHiddenChart(plot) {
		test.equal(plot.Inner.dom.holder.node().style.display, 'none', 'should trigger hiding both chart and legend')
	}

	function triggerShowChart(plot) {
		// issue to fix: clicking the view button will cause the stat table
		// to overlap from the bottom of the chart
		plot.Inner.dom.holder
			.node()
			.parentNode.querySelector('.termview')
			.click()

		// same result when using dispatch
		/*plot.Inner.app.dispatch({
			type: 'plot_show',
			id: 'aaclassic_5'
		})*/
	}

	function testReshownChart(plot) {
		test.true(
			+plot.Inner.dom.holder.select('svg').property('height').baseVal.value > 100,
			'should not have a small barchart svg when reshowing a plot, not overlap with legend'
		)
	}
})

tape('customized bins', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			nav: {
				header_mode: 'search_only'
			},
			tree: {
				expandedTermIds: [
					'root',
					'Cancer-related Variables',
					'Treatment',
					'Chemotherapy',
					'Alkylating Agents',
					'aaclassic_5'
				],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						term: {
							term: {
								id: 'aaclassic_5'
							}
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(plot) {
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test', preserve: true })
			.run(triggerCustomBins, 400)
			.run(triggerSearch, 300)
			.run(testReversion, 1000)
			.done(test)
	}

	const q1 = {
		type: 'regular',
		bin_size: 10000,
		stopinclusive: true,
		first_bin: { startunbounded: true, stop: 1, stopinclusive: true, bin: 'first' },
		numDecimals: 1,
		last_bin: { start: 30000, bin: 'last', stopunbounded: true },
		startinclusive: false
	}

	function triggerCustomBins(plot) {
		plot.Inner.app.dispatch({
			type: 'plot_edit',
			id: 'aaclassic_5',
			config: {
				term: {
					id: 'aaclassic_5',
					term: plot.Inner.config.term.term,
					q: q1
				}
			}
		})
	}

	async function triggerSearch(plot) {
		const dom = plot.Inner.app.getComponents('nav.search').Inner.dom
		dom.input.property('value', 'Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)')
		dom.input.on('input')()
		await sleep(500)
		dom.holder
			.select('.sja_menuoption')
			.node()
			.dispatchEvent(new Event('click'))
	}

	function testReversion(plot) {
		test.deepEqual(plot.Inner.config.term.q, q1, 'should not be reverted when using a searched term')
	}
})
