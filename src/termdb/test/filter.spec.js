const tape = require('tape')
const d3s = require('d3-selection')
const serverconfig = require('../../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const helpers = require('../../../test/front.helpers.js')

tape('\n', function(test) {
	test.pass('-***- tdb.filter -***-')
	test.end()
})

tape('filter term-value button', function(test) {
	test.timeoutAfter(2000)
	test.plan(6)

	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
				values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
			}
		]
	}

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {
				dslabel: 'SJLife',
				genome: 'hg38',
				termfilter,
			},
			callbacks: {
				filter: {
					'postInit.test': runTests
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		},
		serverData: helpers.serverData
	})

	function runTests(filter) {
		filter.on('postInit.test', null)
		helpers
			.rideInit({ arg: filter })
			.run(testFilterDisplay, 100)
			.run(triggerRemoveFilter)
			.run(testRemoveFilter, 600)
			.run(triggerAddFilter)
			.run(testAddFilter, 100)
			.done(() => test.end())
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').size(), 
			filter.Inner.app.state().termfilter.terms.length, 
			'should have 1 tvs filter'
		)
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html()
				.slice(0, -2),
			filter.Inner.app.state().termfilter.terms[0].values[0].label,
			'filter value and value supplied from data should be the same'
		)
		test.true(
			filter.Inner.dom.holder.selectAll('.term_remove_btn').size() >= 1,
			'should have \'x\' button to remove filter'
		)
		test.true(
			filter.Inner.dom.holder.selectAll('.add_term_btn').size() >= 1,
			'should have '+' button to add new term filter'
		)
	}

	function triggerRemoveFilter(filter) {
		filter.Inner.dom.holder
			.select('.term_remove_btn')
			.node()
			.click()
	}

	function testRemoveFilter(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').size(),
			filter.Inner.app.state().termfilter.terms.length,
			'should remove tvs filter after clicking \'x\''
		)
	}

	function triggerAddFilter(filter) {
		const term = {
			term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
			values: [{ key: 'Acute myeloid leukemia', label: 'Acute myeloid leukemia' }]
		}
		filter.Inner.app.dispatch({ type: 'filter_add', term })
	}

	function testAddFilter(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').size(), 
			filter.Inner.app.state().termfilter.terms.length, 
			'should add 1 tvs filter'
		)
	}
})

tape('filter term-value button: categorical term', function(test) {
	test.timeoutAfter(3000)
	test.plan(7)
	const div0 = d3s.select('body').append('div')
	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
				values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
			}
		]
	}

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {
				dslabel: 'SJLife',
				genome: 'hg38',
				termfilter,
			},
			callbacks: {
				filter: {
					'postInit.test': runTests
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})

	function runTests(filter) {
		filter.on('postInit.test', null)
		helpers
			.rideInit({ arg: filter })
			.run(testFilterDisplay, 100)
			.run(triggerChangeNegation)
			.run(checkNegationBtnVal, 100)
			.run(triggerChangeValue)
			.run(testChangeValue, 600)
			.run(triggerAddValue)
			.run(testAddValue, 600)
			.run(triggerRemoveValue)
			.run(testRemoveValue, 600)
			.done(() => test.end())
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.condition_btn').size(),
			1,
			'should have negation button for categorical filter'
		)
		test.equal(
			filter.Inner.dom.holder.selectAll('.condition_btn').html(),
			'IS',
			'should have \'IS\' for negation button for categorical filter'
		)
		test.equal(
			filter.Inner.dom.holder.selectAll('.add_value_btn').size(),
			1,
			'should have '+' button to add category to filter'
		)
	}

	function triggerChangeNegation(filter) {
		const term = filter.Inner.app.state().termfilter.terms[0]
		filter.Inner.app.dispatch({ type: 'filter_negate', term})
	}

	function checkNegationBtnVal(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.condition_btn').html(),
			'IS NOT',
			'should have \'IS NOT\' for negation button after change'
		)
	}

	function triggerChangeValue(filter) {
		const term = filter.Inner.app.state().termfilter.terms[0]
		const value = { key: 'Acute myeloid leukemia', label: 'Acute myeloid leukemia' }
		filter.Inner.app.dispatch({ type: 'filter_value_change', termId: term.id, value, valueId: 0 })
	}

	function testChangeValue(filter) {
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html()
				.slice(0, -2),
			filter.Inner.app.state().termfilter.terms[0].values[0].label,
			'filter value and value supplied from data should be the same'
		)
	}

	function triggerAddValue(filter) {
		const term = filter.Inner.app.state().termfilter.terms[0]
		const value = { key: 'Wilms tumor', label: 'Wilms tumor' }
		filter.Inner.app.dispatch({ type: 'filter_value_add', termId: term.id, value})
	}

	function testAddValue(filter) {
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.size(),
			filter.Inner.app.state().termfilter.terms[0].values.length,
			'should add another value from data'
		)
	}

	function triggerRemoveValue(filter) {
		const term = filter.Inner.app.state().termfilter.terms[0]
		filter.Inner.app.dispatch({ type: 'filter_value_remove', termId: term.id, valueId:1})
	}

	function testRemoveValue(filter) {
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.size(),
			filter.Inner.app.state().termfilter.terms[0].values.length,
			'should remove value from filter'
		)
	}
})
