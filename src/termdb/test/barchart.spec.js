'use strict'
const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38',
		termfilter: { show_top_ui: true }
	},
	debug: 1,
	fetchOpts: {
		serverData: helpers.serverData
	}
})

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/barchart -***-')
	test.end()
})

tape('single barchart, categorical bars', function(test) {
	test.timeoutAfter(1000)

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
	test.timeoutAfter(4000)
	const termfilter = { show_top_ui: true, filter: [] }
	runpp({
		termfilter,
		state: {
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
	function runTests(plot) {
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			.run(testBarCount)
			.run(testOverlayOrder)
			.done(test)
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
		test.end()
	}
})

tape('series visibility - q.hiddenValues', function(test) {
	test.timeoutAfter(5000)

	const hiddenValues = { Male: 1 }
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
		test.equal(
			bar.settings.exclude.cols.length,
			Object.keys(hiddenValues).length,
			'should have the correct number of hidden bars by q.hiddenValues'
		)
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
			.filter(d => d.seriesId == 'Not exposed')
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
					return this.innerHTML.includes('Not exposed')
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
					'CTCAE Graded Events',
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
		test.end()
	}
})

tape('single barchart, filtered', function(test) {
	test.timeoutAfter(1000)

	runpp({
		state: {
			termfilter: {
				show_top_ui: true,
				filter: {
					type: 'tvslst',
					in: 1,
					join: 'or',
					lst: [
						{
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
										values: [{ key: 'Male', label: 'Male' }]
									}
								}
							]
						},
						{
							type: 'tvslst',
							in: 1,
							join: 'and',
							lst: [
								{
									type: 'tvs',
									tvs: {
										term: { id: 'agedx', name: 'Age of Diagnosis', type: 'float' },
										ranges: [{ start: 1, stop: 5, label: '1-5 years old' }]
									}
								},
								{
									type: 'tvs',
									tvs: {
										term: { id: 'wgs_sequenced', name: 'wgs_sequenced', type: 'categorical' },
										values: [{ key: '1', label: '1-yes' }]
									}
								}
							]
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
		test.equal(plot.Inner.dom.holder.node().querySelectorAll('.bars-cell-grp').length, 2, 'should show two bar series')
		test.equal(
			plot.Inner.dom.holder.node().querySelector('.bars-cell-grp').__data__.seriesId,
			'Male',
			'should show one bar series that matches filter value'
		)
		test.end()
	}
})

tape('click non-group bar to add filter', function(test) {
	test.timeoutAfter(3000)

	const termfilter = { show_top_ui: true, filter: [] }
	runpp({
		termfilter,
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
			.use(triggerMenuClick, { wait: 400 })
			.to(testTermValues, { wait: 100 })
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
			.click() //dispatchEvent(new Event('click', { bubbles: true }))
	}

	function testTermValues(plot) {
		const config = plot.Inner.state.config
		const termfilter = plot.Inner.app.Inner.state.termfilter
		const filter = termfilter.filter.lst[1]
		test.equal(
			termfilter.filter && termfilter.filter.lst.length,
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

	const termfilter = { show_top_ui: true, filter: [] }
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
		termfilter,
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
		const filter = termfilter.filter && termfilter.filter.lst[1] // lst[0] == cohort filter
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

	const termfilter = { show_top_ui: true, filter: [] }
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
		termfilter,
		state: {
			termfilter,
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'CTCAE Graded Events',
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
			.click()
	}

	function testTermValues(plot) {
		const config = plot.Inner.state.config
		const currData = plot.Inner.currData
		const termfilter = plot.Inner.app.Inner.state.termfilter
		const filter = termfilter.filter && termfilter.filter.lst[1] // lst[0] == cohort filter
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
		test.equal(numOverlays, 66, 'should have a total of 66 overlays')
		test.end()
	}
})
