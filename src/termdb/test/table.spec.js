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
	test.pass('-***- termdb/table -***-')
	test.end()
})

tape('default behavior', function(test) {
	test.timeoutAfter(2000)

	const termfilter = { show_top_ui: true, terms: [] }
	runpp({
		termfilter,
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						settings: { currViews: [] },
						term: { id: 'diaggrp' }
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})

	let table, tableDiv
	function runTests(plot) {
		table = plot.Inner.components.table.Inner
		tableDiv = table.dom.div
		helpers
			.rideInit({ arg: plot, eventType: 'postRender.test' })
			.run(testHiddenTable, { wait: 200 })
			.use(triggerViewTable, { wait: 400 })
			.to(testVisibleTable, { wait: 1000 })
			.done(test)
	}

	function testHiddenTable(plot) {
		test.equal(tableDiv.style('display'), 'none', 'should be HIDDEN when there is no overlay')
	}

	function triggerViewTable(plot) {
		plot.Inner.app.dispatch({
			type: 'plot_edit',
			id: plot.Inner.id,
			config: {
				term2: {
					id: 'agedx',
					term: termjson['agedx'],
					q: termjson['agedx'].bins.default
				},
				settings: {
					currViews: ['table']
				}
			}
		})
	}

	function testVisibleTable(plot) {
		test.equal(tableDiv.style('display'), 'inline-block', 'should be visible when there is an overlay')
		test.equal(
			tableDiv
				.select('table')
				.node()
				.querySelectorAll('tr').length,
			table.data.refs.cols.length + 1,
			'table rows should match the number of series entries plus 1 header row'
		)
		test.equal(
			tableDiv
				.select('table')
				.node()
				.firstChild.querySelectorAll('th').length,
			table.data.refs.rows.length,
			'table columns should match the number of series.data entries'
		)
	}
})
