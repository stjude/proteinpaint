const tape = require('tape')
const d3s = require('d3-selection')
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38',
		bar_click_menu: {
			add_filter: true,
			select_group_add_to_cart: true,
			select_to_gp: {
				group_compare_against: {
					is_population: true,
					key: 'gnomAD',
					allowto_adjust_race: true,
					adjust_race: true
				}
			}
		}
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
	test.pass('-***- termdb/filter -***-')
	test.end()
})

tape.only('filter term-value button', function(test) {
	test.timeoutAfter(2000)
	// test.plan(6)

	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
				values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
			}
		]
	}

	runpp({
		state: {
			dslabel: 'SJLife',
			genome: 'hg38',
			termfilter
		},
		filter: {
			callbacks: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(filter) {
		helpers
			.rideInit({ arg: filter })
			.run(testFilterDisplay, 200)
			.change({ bus: filter, eventType: 'postRender.test' })
			// .use(triggerAddFilter)
			// .to(testAddFilter)
			.done(test)
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').size(),
			filter.Inner.state.termfilter.terms.length,
			'should have 1 tvs filter'
		)
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html(),
			filter.Inner.state.termfilter.terms[0].values[0].label,
			'should change value from data'
		)
	}

	let numFilters

	function triggerAddFilter(filter) {
		const term = {
			term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
			values: [{ key: 'Acute myeloid leukemia', label: 'Acute myeloid leukemia' }]
		}
		filter.Inner.app.dispatch({ type: 'filter_add', term })
	}

	function testAddFilter(filter) {
		test.equal(filter.Inner.dom.holder.selectAll('.term_name_btn').size(), numFilters, 'should add 1 tvs filter')
	}
})