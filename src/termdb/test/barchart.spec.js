'use strict'
const tape = require('tape')
const termjson = require('../../../test/termdb/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38',
		termfilter: { show_top_ui: false }
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

tape.only('single barchart, filtered', function(test) {
	test.timeoutAfter(1000)

	runpp({
		state: {
			termfilter: {
				show_top_ui: true,
				filter: {
					type: 'tvslst',
					in: 1,
					join: 'and',
					lst: [
						{
							type: 'tvslst',
							in: 1,
							join: 'and',
							lst: [
								{
									type: 'tvs',
									tvs: {
										term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
										values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
									}
								},
								{
									type: 'tvs',
									tvs: {
										term: { id: 'sex', name: 'Sex', iscategorical: true },
										values: [{ key: 'Male', label: 'Male' }]
									}
								}
							]
						},
						{
							type: 'tvs',
							tvs: {
								term: { id: 'agedx', name: 'Age of Diagnosis', isfloat: true },
								ranges: [{ start: 1, stop: 5, label: '1-5 years old' }]
							}
						}
					]
				}
			},
			tree: {
				expandedTermIds: ['root', 'Demographics/health behaviors', 'sex'],
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
		test.pass('---  work in progress ---')
		test.end()
	}
})

tape('single chart, with overlay', function(test) {
	const termfilter = { show_top_ui: true, inclusions: [] }
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
		testBarCount(plot)
		testOverlayOrder(plot)
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
})

tape('multiple charts', function(test) {
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

tape('series visibility', function(test) {
	test.timeoutAfter(5000)
	test.plan(2)

	const hiddenValues = { Male: 1 }
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographics/health behaviors', 'sex'],
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
		const excluded = bar.settings.exclude.cols
		test.true(
			excluded.length == bar.settings.unannotatedLabels.term1.length + Object.keys(hiddenValues).length,
			'should have the correct number of hidden bars by q.hiddenValues'
		)
	}

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alklaying Agents'],
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
				'postRender.test': testExcluded
			}
		}
	})

	function testExcluded(plot) {
		const bar = plot.Inner.components.barchart.Inner
		const excluded = bar.settings.exclude.cols
		test.true(
			excluded.length > 1 && excluded.length == bar.settings.unannotatedLabels.term1.length,
			'should have the correct number of hidden bars by unannotatedLabels'
		)
	}

	const conditionHiddenValues = { '1: Mild': 1 }
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Outcomes', 'CTCAE Graded Events', 'Cardiovascular System', 'Arrhythmias'],
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
		return
		const bar = plot.Inner.components.barchart.Inner
		const excluded = bar.settings.exclude.cols
		test.true(
			excluded.length == bar.settings.unannotatedLabels.term1.length + Object.keys(hiddenValues).length,
			'should have the correct number of hidden bars by q.hiddenValues'
		)
	}
})

let barDiv
tape('click to add numeric, condition term filter', function(test) {
	test.timeoutAfter(3000)

	const termfilter = { show_top_ui: true, inclusions: [] }
	runpp({
		termfilter,
		state: {
			termfilter,
			tree: {
				expandedTermIds: ['root', 'Demographics/health behaviors', 'Age', 'agedx'],
				visiblePlotIds: ['agedx'],
				plots: {
					agedx: {
						term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'].bins.less },
						term2: {
							id: 'Arrhythmias',
							term: termjson['Arrhythmias']
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

	function runTests(plot) {
		if (barDiv) return //console.log(322, barDiv)
		barDiv = plot.Inner.components.barchart.Inner.dom.barDiv
		helpers
			.rideInit({ arg: plot, bus: plot, eventType: 'postRender.test' })
			.run(triggerBarClick, { wait: 500 })
			.use(triggerMenuClick, { wait: 400 })
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
		test.equal(
			termfilter.inclusions && termfilter.inclusions[0].length,
			2,
			'should create two tvslst filters when a numeric term overlay is clicked'
		)
		test.deepEqual(
			termfilter.inclusions[0][0],
			{
				term: config.term.term,
				ranges: [currData.refs.bins[1].find(d => d.label == clickedData.seriesId)]
			},
			'should create a numeric term-value filter with a ranges key'
		)
		// config.term2.q is frozen
		const q = JSON.parse(JSON.stringify(config.term2.q))
		const t2ValKey =
			config.term2 &&
			config.term2.term.values &&
			Object.keys(config.term2.term.values).filter(key => config.term2.term.values[key].label == clickedData.dataId)[0]
		delete q.hiddenValues
		test.deepEqual(
			termfilter.inclusions[0][1],
			Object.assign(
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
				/*** 
				 TODO: PENDING THE FILL-IN FOR TERM2 Q 
				***/
				q
			),
			'should create a condition term-value filter with bar_by_*, value_by_*, and other expected keys'
		)
	}
})

/*
tape('click to add condition child term filter', function(test) {
	const termfilter = { show_top_ui: true, inclusions: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: Object.assign({}, termjson['Arrhythmias'], { q: { bar_by_children: 1, value_by_computable_grade: 1 } }),
			settings: {
				currViews: ['barchart']
			}
		},
		plot: {
			callbacks: {
				postRender: triggerClick
			}
		},
		bar_click_menu: {
			add_filter: true
		}
	})

	function triggerClick(plot) {
		plot.bus.on('postRender', plot => testTermValues(plot, elem.datum()))
		const elem = plot.components.barchart.dom.barDiv.select('.bars-cell').select('rect')
		elem.node().dispatchEvent(new Event('click', { bubbles: true }))
		setTimeout(() => {
			plot.obj.tip.d
				.selectAll('.sja_menuoption')
				.filter(d => d.label.includes('filter'))
				.node()
				.dispatchEvent(new Event('click', { bubbles: true }))
		}, 200)
	}

	function testTermValues(plot, clickedData) {
		setTimeout(() => {
			test.equal(
				termfilter.inclusions && termfilter.inclusions.length,
				1,
				'should create one tvslst filter when a child bar is clicked'
			)
			test.equal(
				termfilter.inclusions[0].bar_by_children,
				1,
				'should create a tvslst filter with bar_by_children set to true'
			)
			test.equal(termfilter.inclusions[0].value_by_computable_grade, 1, 'filter should support value_by_computable_grade')
			test.end()
		}, 200)
	}
})

tape('click to add condition grade and child term filter', function(test) {
	const termfilter = { show_top_ui: true, inclusions: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: Object.assign({}, termjson['Arrhythmias'], { q: { bar_by_grade: 1, value_by_max_grade: 1 } }),
			term2: Object.assign({}, termjson['Arrhythmias'], { q: { bar_by_children: 1, value_by_max_grade: 1 } }),
			settings: {
				currViews: ['barchart']
			}
		},
		plot: {
			callbacks: {
				postRender: triggerClick
			}
		},
		bar_click_menu: {
			add_filter: true
		}
	})

	function triggerClick(plot) {
		plot.bus.on('postRender', plot => testTermValues(plot, elem.datum()))
		const elem = plot.components.barchart.dom.barDiv.select('.bars-cell').select('rect')
		elem.node().dispatchEvent(new Event('click', { bubbles: true }))
		setTimeout(() => {
			plot.obj.tip.d
				.selectAll('.sja_menuoption')
				.filter(d => d.label.includes('filter'))
				.node()
				.dispatchEvent(new Event('click', { bubbles: true }))
		}, 200)
	}

	function testTermValues(plot, clickedData) {
		setTimeout(() => {
			test.equal(
				termfilter.inclusions && termfilter.inclusions.length,
				1,
				'should create one tvslst filter when a grade and child bar/overlay is clicked'
			)
			test.true('grade_and_child' in termfilter.inclusions[0], 'should create a tvslst filter with a grade_and_child')
			test.true(Array.isArray(termfilter.inclusions[0].grade_and_child), 'filter term.grade_and_child should be an array')
			if (Array.isArray(termfilter.inclusions[0].grade_and_child)) {
				const filter = termfilter.inclusions[0].grade_and_child[0]
				test.notEqual(filter.grade, filter.child_id, 'filter grade and child_id should be different')
				test.equal(typeof filter.grade, 'number', 'filter grade should be a number')
				test.equal(typeof filter.child_id, 'string', 'filter grade should be a string')
			}
			test.end()
		}, 200)
	}
})
*/
/*
tape('single chart, genotype overlay', function(test) {
	const termfilter = { show_top_ui: true, inclusions: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: termjson['diaggrp'],
			term2: 'genotype',
			settings: {
				currViews: ['barchart']
			}
		},
		plot: {
			callbacks: {
				postRender: testBarCount
			}
		},
		bar_click_menu: {
			add_filter: true
		},
		modifier_ssid_barchart: {
			mutation_name: 'TEST',
			ssid: 'genotype-test.txt'
		}
	})

	function testBarCount(plot) {
		const numBars = plot.components.barchart.dom.barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = plot.components.barchart.dom.barDiv.selectAll('.bars-cell').size()
		test.true(numOverlays > 10, 'should have more than 10 Diagnosis Group bars')
		test.equal(numOverlays, 66, 'should have a total of 66 overlays')
		test.end()
	}
})
*/
