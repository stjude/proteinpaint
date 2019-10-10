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
				expandedTerms: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				plots: {
					diaggrp: {
						term: termjson['diaggrp'],
						settings: {
							currViews: ['barchart']
						}
					}
				}
			}
		},
		callbacks: {
			plot: {
				postRender: runTests
			}
		}
	})

	function runTests(plot) {
		testBarCount(plot)
		testAxisDimension(plot)
		test.end()
		/*
		helpers.rideInit({arg: plot, bus: plot, eventType: 'postRender.test'})
			.to(testBarCount)
			.to(testAxisDimension)
			.done(test)
		*/
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

/*
tape('single chart, with overlay', function(test) {
	const termfilter = { show_top_ui: true, terms: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: termjson['diaggrp'],
			term2: termjson['agedx'],
			settings: {
				currViews: ['barchart']
			}
		},
		callbacks: {
			plot: {
				postRender: [testBarCount, testOverlayOrder]
			}
		},
		bar_click_menu: {
			add_filter: true
		}
	})

	function testBarCount(plot) {
		const numBars = plot.components.barchart.dom.barDiv.selectAll('.bars-cell-grp').size()
		const numOverlays = plot.components.barchart.dom.barDiv.selectAll('.bars-cell').size()
		test.true(numBars > 10, 'should have more than 10 Diagnosis Group bars')
		test.true(numOverlays > numBars, 'number of overlays should be greater than bars')
	}

	function testOverlayOrder(plot) {
		const bars_grp = plot.components.barchart.dom.barDiv.selectAll('.bars-cell-grp')
		const legend_rows = plot.components.barchart.dom.barDiv.selectAll('.legend-row')
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
		test.end()
	}
})

tape('single chart, genotype overlay', function(test) {
	const termfilter = { show_top_ui: true, terms: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: termjson['diaggrp'],
			term2: 'genotype',
			settings: {
				currViews: ['barchart']
			}
		},
		callbacks: {
			plot: {
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

tape('click to add numeric, condition term filter', function(test) {
	const termfilter = { show_top_ui: true, terms: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: termjson['agedx'],
			term2: Object.assign(termjson['Arrhythmias'], {
				q: {
					bar_by_grade: 1,
					value_by_max_grade: 1
				}
			}),
			settings: {
				currViews: ['barchart']
			}
		},
		callbacks: {
			plot: {
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
				termfilter.terms && termfilter.terms.length,
				2,
				'should create two tvslst filters when a numeric term overlay is clicked'
			)
			test.deepEqual(
				termfilter.terms[0],
				{
					term: plot.term.term,
					ranges: [plot.term.bins.find(d => d.label == clickedData.seriesId)]
				},
				'should create a numeric term-value filter with a ranges key'
			)
			test.deepEqual(
				termfilter.terms[1],
				Object.assign(
					{
						term: plot.term2.term,
						values: [
							{
								key: clickedData.dataId,
								label: plot.term2.term.values[clickedData.dataId].label
							}
						]
					},
					plot.term2.q
				),
				'should create a condition term-value filter with bar_by_*, value_by_*, and other expected keys'
			)

			test.end()
		}, 200)
	}
})

tape('click to add condition child term filter', function(test) {
	const termfilter = { show_top_ui: true, terms: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: Object.assign({}, termjson['Arrhythmias'], { q: { bar_by_children: 1, value_by_computable_grade: 1 } }),
			settings: {
				currViews: ['barchart']
			}
		},
		callbacks: {
			plot: {
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
				termfilter.terms && termfilter.terms.length,
				1,
				'should create one tvslst filter when a child bar is clicked'
			)
			test.equal(
				termfilter.terms[0].bar_by_children,
				1,
				'should create a tvslst filter with bar_by_children set to true'
			)
			test.equal(termfilter.terms[0].value_by_computable_grade, 1, 'filter should support value_by_computable_grade')
			test.end()
		}, 200)
	}
})

tape('click to add condition grade and child term filter', function(test) {
	const termfilter = { show_top_ui: true, terms: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: Object.assign({}, termjson['Arrhythmias'], { q: { bar_by_grade: 1, value_by_max_grade: 1 } }),
			term2: Object.assign({}, termjson['Arrhythmias'], { q: { bar_by_children: 1, value_by_max_grade: 1 } }),
			settings: {
				currViews: ['barchart']
			}
		},
		callbacks: {
			plot: {
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
				termfilter.terms && termfilter.terms.length,
				1,
				'should create one tvslst filter when a grade and child bar/overlay is clicked'
			)
			test.true('grade_and_child' in termfilter.terms[0], 'should create a tvslst filter with a grade_and_child')
			test.true(Array.isArray(termfilter.terms[0].grade_and_child), 'filter term.grade_and_child should be an array')
			if (Array.isArray(termfilter.terms[0].grade_and_child)) {
				const filter = termfilter.terms[0].grade_and_child[0]
				test.notEqual(filter.grade, filter.child_id, 'filter grade and child_id should be different')
				test.equal(typeof filter.grade, 'number', 'filter grade should be a number')
				test.equal(typeof filter.child_id, 'string', 'filter grade should be a string')
			}
			test.end()
		}, 200)
	}
})

tape('multiple charts', function(test) {
	const termfilter = { show_top_ui: true, terms: [] }
	runpp({
		termfilter,
		plot2restore: {
			term: termjson['diaggrp'],
			term0: termjson['agedx'],
			settings: {
				currViews: ['barchart']
			}
		},
		callbacks: {
			plot: {
				postRender: testNumCharts
			}
		}
	})

	function testNumCharts(plot) {
		const numCharts = plot.components.barchart.dom.barDiv.selectAll('.pp-sbar-div').size()
		test.true(numCharts > 2, 'should have more than 2 charts by Age at Cancer Diagnosis')
		test.end()
	}
})

tape('series visibility', function(test) {
	runpp({
		plot2restore: {
			term: termjson['aaclassic_5'],
			settings: {
				currViews: ['barchart']
			}
		},
		callbacks: {
			plot: {
				postRender: [testExcluded]
			}
		}
	})

	function testExcluded(plot) {
		const excluded = plot.components.barchart.settings.exclude.cols
		test.true(
			excluded.length > 1 && excluded.length == plot.components.barchart.settings.unannotatedLabels.term1.length,
			'should have more than 2 charts by Age at Cancer Diagnosis'
		)

		test.end()
	}
})
*/
