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
			.use(triggerRemoveFilter)
			.to(testRemoveFilter, { wait: 600 })
			.use(triggerAddFilter)
			.to(testAddFilter)
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
				.html()
				.slice(0, -2),
			filter.Inner.state.termfilter.terms[0].values[0].label,
			'should change value from data'
		)
		test.true(
			filter.Inner.dom.holder.selectAll('.term_remove_btn').size() >= 1,
			"should have 'x' button to remove filter"
		)
		test.true(
			filter.Inner.dom.holder.selectAll('.add_term_btn').size() >= 1,
			"should have '+' button to add new term filter"
		)
	}

	let numFilters
	function triggerRemoveFilter(filter) {
		numFilters = filter.Inner.state.termfilter.terms.length
		filter.Inner.dom.holder
			.select('.term_remove_btn')
			.node()
			.click()
	}

	function testRemoveFilter(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').size(),
			numFilters - 1,
			"should remove tvs filter after clicking 'x'"
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
		test.equal(filter.Inner.dom.holder.selectAll('.term_name_btn').size(), numFilters, 'should add 1 tvs filter')
	}
})

tape('filter term-value button: categorical term', function(test) {
	test.timeoutAfter(3000)
	test.plan(7)
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
		debugName: 'tdb',
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
			.run(testFilterDisplay, 300)
			.change({ bus: filter, eventType: 'postRender.test' })
			.use(triggerChangeNegation)
			.to(testNegationBtnVal)
			.use(triggerChangeValue)
			.to(testChangeValue, { wait: 600 })
			.use(triggerAddValue)
			.to(testAddValue, { wait: 600 })
			.use(triggerRemoveValue)
			.to(testRemoveValue, { wait: 600 })
			.done(test)
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
			"should have 'IS' for negation button for categorical filter"
		)
		test.equal(
			filter.Inner.dom.holder.selectAll('.add_value_btn').size(),
			1,
			'should have ' + ' button to add category to filter'
		)
	}

	function triggerChangeNegation(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		filter.Inner.app.dispatch({ type: 'filter_negate', term })
	}

	function testNegationBtnVal(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.condition_btn').html(),
			'IS NOT',
			"should have 'IS NOT' for negation button after change"
		)
	}

	function triggerChangeValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const value = { key: 'Acute myeloid leukemia', label: 'Acute myeloid leukemia' }
		filter.Inner.app.dispatch({ type: 'filter_value_change', termId: term.id, value, valueId: 0 })
	}

	function testChangeValue(filter) {
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html()
				.slice(0, -2),
			filter.Inner.state.termfilter.terms[0].values[0].label,
			'should change value from data'
		)
	}

	function triggerAddValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const value = { key: 'Wilms tumor', label: 'Wilms tumor' }
		filter.Inner.app.dispatch({ type: 'filter_add', termId: term.id, value })
	}

	function testAddValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].values.length,
			'should add another value from data'
		)
	}

	function triggerRemoveValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		filter.Inner.app.dispatch({ type: 'filter_value_remove', termId: term.id, valueId: 1 })
	}

	function testRemoveValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].values.length,
			'should remove value from filter'
		)
	}
})

tape('filter term-value button: numerical term', function(test) {
	test.timeoutAfter(5000)
	test.plan(6)
	const div0 = d3s.select('body').append('div')
	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: {
					id: 'aaclassic_5',
					name: 'Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)',
					unit: 'mg/m²',
					isfloat: true
				},
				ranges: [{ stopinclusive: true, start: 1000, stop: 2000 }]
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
			.run(testFilterDisplay, 300)
			.change({ bus: filter, eventType: 'postRender.test' })
			.use(triggerChangeValue)
			.to(testChangeValue, { wait: 800 })
			.use(triggerAddValue)
			.to(testAddValue, { wait: 800 })
			.use(triggerRemoveValue)
			.to(testRemoveValue, { wait: 800 })
			.done(test)
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html()
				.split(' ')[0],
			termfilter.terms[0].ranges[0].start.toString(),
			'value button should match the data'
		)
		test.true(
			filter.Inner.dom.holder.selectAll('.add_value_btn').size() >= 1,
			"should have '+' button to add unannonated value to filter"
		)
	}

	function triggerChangeValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const range = { start: 3000, stop: 4000, startinclusive: false, stopinclusive: false }
		filter.Inner.app.dispatch({ type: 'filter_value_change', termId: term.id, value: range, valueId: 0 })
	}

	function testChangeValue(filter) {
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html()
				.split(' ')[0],
			filter.Inner.state.termfilter.terms[0].ranges[0].start.toString(),
			'should change value from data'
		)
	}

	function triggerAddValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const value = { is_unannotated: true, value: '-9999', label: 'Unknown treatment record' }
		filter.Inner.app.dispatch({ type: 'filter_add', termId: term.id, value })
	}

	function testAddValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].ranges.length,
			'should add another value from data'
		)
	}

	function triggerRemoveValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		filter.Inner.app.dispatch({ type: 'filter_value_remove', termId: term.id, valueId: 1 })
	}

	function testRemoveValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].ranges.length,
			'should remove value from filter'
		)
	}
})

tape('filter term-value button: conditional term (grade)', function(test) {
	test.timeoutAfter(5000)
	test.plan(8)
	const div0 = d3s.select('body').append('div')
	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: 'Arrhythmias', name: 'Arrhythmias', iscondition: true },
				values: [{ key: 0, label: '0: No condition' }],
				bar_by_grade: 1,
				value_by_max_grade: 1
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
			.run(testFilterDisplay, 300)
			.change({ bus: filter, eventType: 'postRender.test' })
			.use(triggerChangeValue)
			.to(testChangeValue, { wait: 800 })
			.use(triggerAddValue)
			.to(testAddValue, { wait: 600 })
			.use(triggerRemoveValue)
			.to(testRemoveValue, { wait: 800 })
			.use(triggerChangeGradeType)
			.to(testChangeGradeType, { wait: 600 })
			.done(test)
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)

		test.equal(
			filter.Inner.dom.holder.selectAll('.sja_filter_tag_btn')._groups[0][2].innerText.slice(0, -2),
			termfilter.terms[0].values[0].label,
			'grade value button should match the data'
		)

		test.true(
			filter.Inner.dom.holder
				.selectAll('.grade_type_btn')
				.html()
				.includes('Max'),
			'grade type button should match the data'
		)

		test.true(
			filter.Inner.dom.holder.selectAll('.add_value_btn').size() >= 1,
			"should have '+' button to add unannoated value to filter"
		)
	}

	function triggerChangeValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const value = { key: 1, label: '1: Mild' }
		filter.Inner.app.dispatch({ type: 'filter_value_change', termId: term.id, value: value, valueId: 0 })
	}

	function testChangeValue(filter) {
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html()
				.slice(0, -2),
			filter.Inner.state.termfilter.terms[0].values[0].label,
			'should change value from data'
		)
	}

	function triggerAddValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const value = { key: 2, label: '2: Moderate' }
		filter.Inner.app.dispatch({ type: 'filter_add', termId: term.id, value })
	}

	function testAddValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].values.length,
			'should add another value from data'
		)
	}

	function triggerRemoveValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		filter.Inner.app.dispatch({ type: 'filter_value_remove', termId: term.id, valueId: 1 })
	}

	function testRemoveValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].values.length,
			'should remove value from filter'
		)
	}

	function triggerChangeGradeType(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const updated_term = JSON.parse(JSON.stringify(term))
		updated_term.value_by_most_recent = true
		updated_term.value_by_max_grade = false
		filter.Inner.app.dispatch({ type: 'filter_grade_update', termId: term.id, updated_term })
	}

	function testChangeGradeType(filter) {
		test.true(
			filter.Inner.dom.holder
				.selectAll('.grade_type_btn')
				.html()
				.includes('recent'),
			'should change grade type from the data'
		)
	}
})

tape('filter term-value button: conditional term (subcondition)', function(test) {
	test.timeoutAfter(5000)
	test.plan(8)
	const div0 = d3s.select('body').append('div')
	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: 'Arrhythmias', name: 'Arrhythmias', iscondition: true },
				values: [{ key: 'Sinus bradycardia', label: 'Sinus bradycardia' }],
				bar_by_children: 1,
				value_by_computable_grade: 1
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
			.run(testFilterDisplay, 300)
			.change({ bus: filter, eventType: 'postRender.test' })
			.use(triggerChangeValue)
			.to(testChangeValue, { wait: 800 })
			.use(triggerAddValue)
			.to(testAddValue, { wait: 600 })
			.use(triggerRemoveValue)
			.to(testRemoveValue, { wait: 800 })
			.use(triggerChangeGradeType)
			.to(testChangeGradeType, { wait: 600 })
			.done(test)
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)

		test.equal(
			filter.Inner.dom.holder.selectAll('.sja_filter_tag_btn')._groups[0][2].innerText.slice(0, -2),
			termfilter.terms[0].values[0].label,
			'grade value button should match the data'
		)

		test.true(
			filter.Inner.dom.holder
				.selectAll('.grade_type_btn')
				.html()
				.includes('Any'),
			'grade type button should match the data'
		)

		test.true(
			filter.Inner.dom.holder.selectAll('.add_value_btn').size() >= 1,
			"should have '+' button to add unannoated value to filter"
		)
	}

	function triggerChangeValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const value = { key: 'Cardiac dysrhythmia', label: 'Cardiac dysrhythmia' }
		filter.Inner.app.dispatch({ type: 'filter_value_change', termId: term.id, value: value, valueId: 0 })
	}

	function testChangeValue(filter) {
		test.equal(
			filter.Inner.dom.holder
				.selectAll('.value_btn')
				.html()
				.slice(0, -2),
			filter.Inner.state.termfilter.terms[0].values[0].label,
			'should change value from data'
		)
	}

	function triggerAddValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const value = { key: 'Prolonged QT interval', label: 'Prolonged QT interval' }
		filter.Inner.app.dispatch({ type: 'filter_add', termId: term.id, value })
	}

	function testAddValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].values.length,
			'should add another value from data'
		)
	}

	function triggerRemoveValue(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		filter.Inner.app.dispatch({ type: 'filter_value_remove', termId: term.id, valueId: 1 })
	}

	function testRemoveValue(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.terms[0].values.length,
			'should remove value from filter'
		)
	}

	function triggerChangeGradeType(filter) {
		const term = filter.Inner.state.termfilter.terms[0]
		const updated_term = JSON.parse(JSON.stringify(term))
		updated_term.value_by_most_recent = true
		updated_term.value_by_max_grade = false
		filter.Inner.app.dispatch({ type: 'filter_grade_update', termId: term.id, updated_term })
	}

	function testChangeGradeType(filter) {
		test.true(
			filter.Inner.dom.holder
				.selectAll('.grade_type_btn')
				.html()
				.includes('recent'),
			'should change grade type from the data'
		)
	}
})

tape('filter term-value button: conditional term (grade and child)', function(test) {
	test.timeoutAfter(3000)
	test.plan(3)
	const div0 = d3s.select('body').append('div')
	const termfilter = {
		show_top_ui: true,
		terms: [
			{
				term: { id: 'Arrhythmias', name: 'Arrhythmias', iscondition: true },
				grade_and_child: [
					{ grade: 0, grade_label: '0: No condition', child_id: 'Sinus bradycardia', child_label: 'Sinus bradycardia' }
				],
				bar_by_children: 1,
				value_by_max_grade: 1
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
			.run(testFilterDisplay, 300)
			.done(test)
	}

	function testFilterDisplay(filter) {
		test.equal(
			filter.Inner.dom.holder.selectAll('.term_name_btn').html(),
			filter.Inner.state.termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)

		test.equal(
			filter.Inner.dom.holder.selectAll('.grade_btn').html(),
			filter.Inner.state.termfilter.terms[0].grade_and_child[0].grade_label,
			'should grade value button match the data'
		)

		test.equal(
			filter.Inner.dom.holder.selectAll('.child_btn').html(),
			filter.Inner.state.termfilter.terms[0].grade_and_child[0].child_label,
			'should sub-condition value button match the data'
		)
	}
})
