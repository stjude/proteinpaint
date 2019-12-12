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

tape('tvs filter: caterogical term', function(test) {
	test.timeoutAfter(4000)
	test.plan(8)

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
			.run(triggerBluePill)
			.run(testGrpMenu, 500)
			.use(triggerAddFilter)
			.to(testAddFilter, { wait: 800 })
			.done(test)
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').size(),
			filter.Inner.state.termfilter.terms.length,
			'should have 1 tvs filter'
		)
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').html(),
			filter.Inner.state.termfilter.terms[0].values[0].label,
			'should change value from data'
		)
	}

	function triggerBluePill(filter) {
		filter.Inner.dom.holder
			.select('.term_name_btn')
			.node()
			.click()
	}

	function testGrpMenu(filter) {
		const tip = filter.Inner.pill.Inner.dom.tip
		test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
		test.equal(tip.d.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
		test.equal(tip.d.selectAll('.value_checkbox').size(), 27, 'Should have checkbox for each value')
		test.equal(
			tip.d
				.selectAll('.value_checkbox')
				.filter(function(d) {
					return this.checked == true
				})
				.size(),
			1,
			'Should have 1 box checked for Wilms tumor'
		)
	}

	function triggerAddFilter(filter) {
		const tip = filter.Inner.pill.Inner.dom.tip
		tip.d.selectAll('.value_checkbox')._groups[0][0].click()
		tip.d
			.selectAll('.apply_btn')
			.node()
			.click()
	}

	function testAddFilter(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').html(),
			filter.Inner.state.termfilter.terms[0].values.length + ' Groups',
			'should changed filter by selecting values from Menu'
		)
	}
})
