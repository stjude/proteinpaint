const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
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
	test.pass('-***- termdb/table -***-')
	test.end()
})

tape('default behavior', function(test) {
	test.timeoutAfter(6000)

	const termfilter = { terms: [] }
	runpp({
		termfilter,
		state: {
			nav: { header_mode: 'with_tabs' },
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
				'postRender.test': runTests
			}
		}
	})

	let table, tableDiv
	function runTests(plot) {
		table = plot.Inner.components.table.Inner
		tableDiv = table.dom.div
		helpers
			.rideInit({ arg: plot, eventType: 'postRender.test' })
			.run(testHiddenTable)
			.use(triggerViewTable)
			.to(testVisibleTable)
			.use(triggerTerm2Removal)
			.to(testTerm2Removal)
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

	function triggerTerm2Removal(plot) {
		plot.Inner.app.dispatch({
			type: 'plot_edit',
			id: plot.Inner.id,
			config: {
				term2: null
			}
		})
	}

	function testTerm2Removal(plot) {
		test.equal(tableDiv.style('display'), 'none', 'should be hidden when term2 is removed')
		test.deepEqual(
			plot.Inner.config.settings.currViews,
			['barchart'],
			'should switch to barchart view when term2 is removed'
		)
	}
})

tape('column and row labels', function(test) {
	test.timeoutAfter(3000)

	const termfilter = { terms: [] }
	runpp({
		termfilter,
		state: {
			tree: {
				expandedTermIds: ['root', 'Demographic Variables', 'Age (years)', 'agedx'],
				visiblePlotIds: ['agedx'],
				plots: {
					agedx: {
						settings: { currViews: ['table'] },
						term: { id: 'agedx' },
						term2: { id: 'sex' }
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
		const table = plot.Inner.components.table.Inner
		const tableDiv = table.dom.div
		await sleep(1000)
		test.deepEqual(
			[
				...tableDiv
					.select('table')
					.node()
					.querySelectorAll('th')
			].map(elem => elem.innerText),
			['Female', 'Male', '<5', '5 to 9', '10 to 14', '15 to 19', '≥20'],
			'should use term.values{key: {label}} as column labels, if available'
		)
		test.end()
	}
})
