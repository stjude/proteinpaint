const tape = require('tape')
const d3s = require('d3-selection')
const termjson = require('./termjson').termjson
const serverconfig = require('../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const helpers = require('../front.helpers.js')

tape('\n', function(test) {
	test.pass('-***- mds.termdb.controls filter -***-')
	test.end()
})

tape('filter term-value button', function(test) {
	test.timeoutAfter(3000)
	test.plan(6)
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
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: 'SJLife',
			genome: 'hg38',
			default_rootterm: {},
			termfilter,
			bar_click_menu: {
				add_filter: true
			},
			callbacks: {
				filter: {
					'postRender.test': runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		// more reliable test promise chain format
		// that is less likely to need timeouts
		helpers
			.rideInit({
				bus: obj.components.filter.bus,
				eventType: 'postRender.test',
				arg: obj
			})
			.run(testFilterDisplay, 300)
			.to(testFilterRemove, triggerFilterRemove)
			.to(testAddTerm, triggerFilterAdd)
			.done(() => test.end())
	}

	function testFilterDisplay(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter term-name and plot clicked from runpp() should be the same'
		)
		test.equal(
			obj.dom.termfilterdiv
				.selectAll('.value_btn')
				.html()
				.slice(0, -2),
			termfilter.terms[0].values[0].label,
			'filter value and value supplied from runpp() should be the same'
		)
		test.true(
			obj.dom.termfilterdiv.selectAll('.term_remove_btn').size() >= 1,
			"should have 'x' button to remove filter"
		)
		test.true(
			obj.dom.termfilterdiv.selectAll('.add_term_btn').size() >= 1,
			"should have '+' button to add new term filter"
		)
	}

	function triggerFilterRemove(obj) {
		obj.dom.termfilterdiv
			.select('.term_remove_btn')
			.node()
			.click()
	}

	function testFilterRemove(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.term_name_btn').size(),
			termfilter.terms.length,
			"should remove tvs filter after clicking 'x'"
		)
	}

	function triggerFilterAdd(obj) {
		termfilter.terms[0] = {
			term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
			values: [{ key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }]
		}
		obj.components.filter.main()
	}

	function testAddTerm(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.term_name_btn').size(),
			termfilter.terms.length,
			'should add filter from data'
		)
		obj.tip.hide()
	}
})

tape('filter term-value button: categorical term', function(test) {
	test.timeoutAfter(3000)
	test.plan(6)
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
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: 'SJLife',
			genome: 'hg38',
			default_rootterm: {},
			termfilter,
			bar_click_menu: {
				add_filter: true
			},
			callbacks: {
				filter: {
					'postRender.test': runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.rideInit({
				bus: obj.components.filter.bus,
				eventType: 'postRender.test',
				arg: obj
			})
			.run(testFilterDisplay, 300)
			.to(checkNegationBtnVal, triggerChangeNegation)
			.to(checkAddedCategory, triggerAddCategory)
			.to(checkRemovedCategory, triggerRemoveCategory)
			.done(() => test.end())
	}

	function testFilterDisplay(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.condition_btn').size(),
			1,
			'should have negation button for categorical filter'
		)
		test.equal(
			obj.dom.termfilterdiv.selectAll('.condition_btn').html(),
			'IS',
			"should have 'IS' for negation button for categorical filter"
		)
		test.equal(
			obj.dom.termfilterdiv.selectAll('.add_value_btn').size(),
			1,
			"should have '+' button to add category to filter"
		)
	}

	function triggerChangeNegation(obj) {
		obj.termfilter.terms[0].isnot = true
		obj.components.filter.main()
	}

	function checkNegationBtnVal(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.condition_btn').html(),
			'IS NOT',
			"should have 'IS NOT' for negation button after change"
		)
	}

	function triggerAddCategory(obj) {
		obj.termfilter.terms[0].values[1] = { key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }
		obj.components.filter.main()
	}

	function checkAddedCategory(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.value_btn').size(),
			termfilter.terms[0].values.length,
			'should add category from data'
		)
	}

	function triggerRemoveCategory(obj) {
		obj.termfilter.terms[0].values.pop()
		obj.components.filter.main()
	}

	function checkRemovedCategory(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.value_btn').size(),
			termfilter.terms[0].values.length,
			'should remove category from data'
		)
	}
})

tape('filter term-value button: Numerical term', function(test) {
	test.timeoutAfter(4000)
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

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: 'SJLife',
			genome: 'hg38',
			default_rootterm: {},
			termfilter,
			callbacks: {
				filter: {
					'postRender.test': runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.rideInit({
				bus: obj.components.filter.bus,
				eventType: 'postRender.test',
				arg: obj
			})
			.run(testFilterDisplay, 300)
			.to(checkRangeBtn, triggerChangeRange)
			.to(checkUnannotatedValBtn, triggerAddUnannotatedRange)
			.to(checkRemovedRange, triggerRemoveRange)
			.done(() => test.end())
	}

	function testFilterDisplay(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)
		test.equal(
			obj.dom.termfilterdiv
				.selectAll('.value_btn')
				.html()
				.split(' ')[0],
			termfilter.terms[0].ranges[0].start.toString(),
			'value button should match the data'
		)
		test.true(
			obj.dom.termfilterdiv.selectAll('.add_value_btn').size() >= 1,
			"should have '+' button to add unannonated value to filter"
		)
	}

	function triggerChangeRange(obj) {
		obj.termfilter.terms[0].ranges[0] = { stopinclusive: true, start: 3000, stop: 4000 }
		obj.components.filter.main()
	}

	function checkRangeBtn(obj) {
		test.equal(
			obj.dom.termfilterdiv
				.selectAll('.value_btn')
				.html()
				.split(' ')[0],
			termfilter.terms[0].ranges[0].start.toString(),
			'should have value button changed from data'
		)
	}

	function triggerAddUnannotatedRange(obj) {
		obj.termfilter.terms[0].ranges[1] = { is_unannotated: true, value: '-9999', label: 'Unknown treatment record' }
		obj.components.filter.main()
	}

	function checkUnannotatedValBtn(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.value_btn')._groups[0][1].innerText,
			termfilter.terms[0].ranges[1].label,
			'should have unannotated value button added from data'
		)
	}

	function triggerRemoveRange(obj) {
		obj.termfilter.terms[0].ranges.pop()
		obj.components.filter.main()
	}

	function checkRemovedRange(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.value_btn').size(),
			termfilter.terms[0].ranges.length,
			'should remove value button altered by data'
		)
	}
})

tape('filter term-value button: Conditional term (grade)', function(test) {
	test.timeoutAfter(4000)
	test.plan(7)
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

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: 'SJLife',
			genome: 'hg38',
			default_rootterm: {},
			termfilter,
			callbacks: {
				filter: {
					'postRender.test': runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.rideInit({
				bus: obj.components.filter.bus,
				eventType: 'postRender.test',
				arg: obj
			})
			.run(testFilterDisplay, 500)
			.to(checkGradeBtn, triggerChangeGrade, { wait: 350 })
			.to(checkGradeTypeBtn, triggerGradeType, { wait: 350 })
			.to(checkAddedGradeBtn, triggerAddGrade, { wait: 350 })
			.done(() => test.end())
	}

	function testFilterDisplay(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)

		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][2].innerText.slice(0, -2),
			termfilter.terms[0].values[0].label,
			'grade value button should match the data'
		)

		test.true(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][3].innerText.includes('Max'),
			'grade type button should match the data'
		)

		test.true(
			obj.dom.termfilterdiv.selectAll('.add_value_btn').size() >= 1,
			"should have '+' button to add unannoated value to filter"
		)
	}

	function triggerChangeGrade(obj) {
		obj.termfilter.terms[0].values[0] = { key: 1, label: '1: Mild' }
		obj.components.filter.main()
	}

	function checkGradeBtn(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][2].innerText.slice(0, -2),
			termfilter.terms[0].values[0].label,
			'should have grade value button changed from data'
		)
	}

	function triggerGradeType(obj) {
		obj.termfilter.terms[0].value_by_max_grade = false
		obj.termfilter.terms[0].value_by_most_recent = true
		obj.components.filter.main()
	}

	function checkGradeTypeBtn(obj) {
		test.true(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][3].innerText.includes('recent'),
			'should match grade type button to the data'
		)
	}

	function triggerAddGrade(obj) {
		obj.termfilter.terms[0].values[1] = { key: 2, label: '2: Moderate' }
		obj.components.filter.main()
	}

	function checkAddedGradeBtn(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][3].innerText.slice(0, -2),
			termfilter.terms[0].values[1].label,
			'should add grade from the data'
		)
	}
})

tape('filter term-value button: Conditional term (sub-condition)', function(test) {
	test.timeoutAfter(4000)
	test.plan(5)
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

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: 'SJLife',
			genome: 'hg38',
			default_rootterm: {},
			termfilter,
			callbacks: {
				filter: {
					'postRender.test': runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.rideInit({
				bus: obj.components.filter.bus,
				eventType: 'postRender.test',
				arg: obj
			})
			.run(testFilterDisplay, 300)
			.to(checkSubBtn, triggerChangeSub, 100)
			.to(checkAddedSubBtn, triggerAddSub, 100)
			.done(() => test.end())
	}

	function testFilterDisplay(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)

		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][2].innerText.slice(0, -2),
			termfilter.terms[0].values[0].label,
			'should sub-condition value button match the data'
		)

		test.true(
			obj.dom.termfilterdiv.selectAll('.add_value_btn').size() >= 1,
			"should have '+' button to add unannoated value to filter"
		)
	}

	function triggerChangeSub(obj) {
		obj.termfilter.terms[0].values[0] = { key: 'Cardiac dysrhythmia', label: 'Cardiac dysrhythmia' }
		obj.components.filter.main()
	}

	function checkSubBtn(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][2].innerText.slice(0, -2),
			termfilter.terms[0].values[0].label,
			'should have sub-condition value button changed from data'
		)
	}

	function triggerAddSub(obj) {
		obj.termfilter.terms[0].values[1] = { key: 'Prolonged QT interval', label: 'Prolonged QT interval' }
		obj.components.filter.main()
	}

	function checkAddedSubBtn(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][3].innerText.slice(0, -2),
			termfilter.terms[0].values[1].label,
			'should add sub-condition value button from data'
		)
	}
})

tape('filter term-value button: Conditional term (grade and child)', function(test) {
	test.timeoutAfter(4000)
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

	runproteinpaint({
		host,
		holder: div0.node(),
		noheader: 1,
		nobox: true,
		display_termdb: {
			dslabel: 'SJLife',
			genome: 'hg38',
			default_rootterm: {},
			termfilter,
			callbacks: {
				filter: {
					'postRender.test': runTests
				}
			},
			serverData: helpers.serverData
		}
	})

	function runTests(obj) {
		helpers
			.rideInit({
				bus: obj.components.filter.bus,
				eventType: 'postRender.test',
				arg: obj
			})
			.run(testFilterDisplay, 300)
			.done(() => test.end())
	}

	function testFilterDisplay(obj) {
		test.equal(
			obj.dom.termfilterdiv.selectAll('.term_name_btn').html(),
			termfilter.terms[0].term.name,
			'filter btn and term-name from runpp() should be the same'
		)

		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][2].innerText,
			termfilter.terms[0].grade_and_child[0].grade_label,
			'should grade value button match the data'
		)

		test.equal(
			obj.dom.termfilterdiv.selectAll('.sja_filter_tag_btn')._groups[0][3].innerText,
			termfilter.terms[0].grade_and_child[0].child_label,
			'should sub-condition value button match the data'
		)
	}
})
