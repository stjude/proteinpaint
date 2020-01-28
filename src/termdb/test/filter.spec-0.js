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

tape('filter buttons', function(test) {
	const termfilter = {
		show_top_ui: true,
		inclusions: [
			[
				{
					term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
					values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
				}
			]
		],
		exclusions: []
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
		test.equal(
			filter.Inner.dom.holder.node().querySelectorAll('.sja_filter_btn').length,
			2,
			'should have two filter buttons'
		)

		test.equal(
			filter.Inner.dom.holder.node().querySelectorAll('.term_name_btn')[0].innerHTML,
			'Diagnosis Group',
			'should label the inclusions button with the number of applied criteria'
		)

		test.equal(
			filter.Inner.dom.holder
				.node()
				.querySelectorAll('.sja_filter_btn')[1]
				.querySelectorAll('div')[1].innerHTML,
			'+ click to add',
			'should label the exclusions button with the number of applied criteria'
		)

		test.end()
	}
})

tape('tvs filter: caterogical term', function(test) {
	test.timeoutAfter(4000)

	const termfilter = {
		show_top_ui: true,
		inclusions: [
			[
				{
					term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
					values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
				}
			]
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
				'postRender.test': runTests
			}
		}
	})

	let inclusionsBtn
	function runTests(filter) {
		inclusionsBtn = filter.Inner.dom.holder.select('.sja_filter_btn').node()
		helpers
			.rideInit({ arg: filter, bus: filter, eventType: 'postRender.test' })
			.run(testFilterDisplay, 300)
			.run(triggerBluePill)
			.run(testEditMenu, 500)
			.use(triggerAddFilter)
			.to(testAddFilter, { wait: 800 })
			.done(test)
	}

	function testFilterDisplay(filter) {
		inclusionsBtn.click()
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.term_name_btn').size(),
			filter.Inner.state.termfilter.inclusions.length,
			'should have 1 tvs filter'
		)
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.value_btn').html(),
			filter.Inner.state.termfilter.inclusions[0][0].values[0].label,
			'should change value from data'
		)
	}

	function triggerBluePill(filter) {
		inclusionsBtn.click()
		filter.Inner.dom.inclusionsDiv
			.select('.term_name_btn')
			.node()
			.click()
	}

	function testEditMenu(filter) {
		inclusionsBtn.click()
		const pills = filter.Inner.inclusions.Inner.pills
		const div = pills[Object.keys(pills)[0]].Inner.dom.tip.d
		test.equal(div.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(div.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
		test.equal(div.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
		test.equal(div.selectAll('.value_checkbox').size(), 27, 'Should have checkbox for each value')
		test.equal(
			div
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
		inclusionsBtn.click()
		const pills = filter.Inner.inclusions.Inner.pills
		const div = pills[Object.keys(pills)[0]].Inner.dom.tip.d
		div.selectAll('.value_checkbox')._groups[0][0].click()
		div
			.selectAll('.apply_btn')
			.node()
			.click()
	}

	function testAddFilter(filter) {
		inclusionsBtn.click()
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.value_btn').html(),
			filter.Inner.state.termfilter.inclusions[0][0].values.length + ' Groups',
			'should change filter by selecting values from Menu'
		)
	}
})

tape('tvs filter: Numerical term', function(test) {
	test.timeoutAfter(6000)

	const termfilter = {
		show_top_ui: true,
		inclusions: [
			[
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
		],
		exclusions: []
	}

	runpp({
		state: {
			dslabel: 'SJLife',
			genome: 'hg38',
			termfilter
		},
		filter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let inclusionsBtn
	function runTests(filter) {
		inclusionsBtn = filter.Inner.dom.holder.select('.sja_filter_btn').node()
		helpers
			.rideInit({ arg: filter, bus: filter, eventType: 'postRender.test' })
			.run(testFilterDisplay, 600)
			.run(triggerBluePill)
			.run(testEditMenu, 500)
			.use(triggerRangeEdit)
			.to(testRangeEdit, { wait: 800 })
			.done(test)
	}

	function testFilterDisplay(filter) {
		inclusionsBtn.click()
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.term_name_btn').size(),
			filter.Inner.state.termfilter.inclusions.length,
			'should have 1 tvs filter'
		)
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.inclusions[0][0].ranges.length,
			'should change value from data'
		)
	}

	function triggerBluePill(filter) {
		inclusionsBtn.click()
		filter.Inner.dom.inclusionsDiv
			.select('.term_name_btn')
			.node()
			.click()
	}

	function testEditMenu(filter) {
		inclusionsBtn.click()
		const pills = filter.Inner.inclusions.Inner.pills
		const tip = filter.Inner.inclusions.Inner.pills[Object.keys(pills)[0]].Inner.dom.tip
		test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
		test.true(tip.d.selectAll('.apply_btn').size() >= 1, 'Should have 1 button to apply range change')
		test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove range')
		test.true(tip.d.selectAll('input').size() >= 2, 'Should have at least 2 inputs for range start and end')
		test.equal(tip.d.selectAll('input')._groups[0][0].value, '1000', 'Should match start value with data')
		test.true(tip.d.selectAll('select').size() >= 2, 'Should have at least 2 selects for range start and end')
	}

	function triggerRangeEdit(filter) {
		inclusionsBtn.click()
		const pills = filter.Inner.inclusions.Inner.pills
		const tip = filter.Inner.inclusions.Inner.pills[Object.keys(pills)[0]].Inner.dom.tip
		tip.d.select('input').property('value', 1500)
		tip.d
			.selectAll('.apply_btn')
			.node()
			.click()
	}

	function testRangeEdit(filter) {
		inclusionsBtn.click()
		test.equal(
			parseInt(
				filter.Inner.dom.inclusionsDiv
					.selectAll('.value_btn')
					.html()
					.split(' ')[0]
			),
			filter.Inner.state.termfilter.inclusions[0][0].ranges[0].start,
			'should change value from data'
		)
	}
})

tape('tvs filter: : conditional term (grade)', function(test) {
	test.timeoutAfter(7000)

	const termfilter = {
		show_top_ui: true,
		inclusions: [
			[
				{
					term: { id: 'Arrhythmias', name: 'Arrhythmias', iscondition: true },
					values: [{ key: 0, label: '0: No condition' }],
					bar_by_grade: 1,
					value_by_max_grade: 1
				}
			]
		],
		exclusions: []
	}

	runpp({
		state: {
			dslabel: 'SJLife',
			genome: 'hg38',
			termfilter
		},
		filter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let inclusionsBtn
	function runTests(filter) {
		inclusionsBtn = filter.Inner.dom.holder.select('.sja_filter_btn').node()
		helpers
			.rideInit({ arg: filter, bus: filter, eventType: 'postRender.test' })
			.run(testFilterDisplay, 600)
			.run(triggerBluePill)
			.run(testEditMenu, 500)
			.use(triggerAddFilter)
			.to(testAddFilter, { wait: 800 })
			.run(triggerBluePill)
			.run(triggerGradeChanage)
			.run(testGradeChanage, 800)
			.run(triggerBluePill)
			.run(triggerValueTypeChanage)
			.run(triggerSubSelect, 800)
			.run(testSubSelelct, 800)
			.done(test)
	}

	function testFilterDisplay(filter) {
		inclusionsBtn.click()
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.term_name_btn').size(),
			filter.Inner.state.termfilter.inclusions.length,
			'should have 1 tvs filter'
		)
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.value_btn').size(),
			filter.Inner.state.termfilter.inclusions[0][0].values.length,
			'should change value from data'
		)

		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.grade_type_btn').html(),
			'[Max Grade]',
			'should have grade type text'
		)
	}

	function triggerBluePill(filter) {
		inclusionsBtn.click()
		filter.Inner.dom.inclusionsDiv
			.select('.term_name_btn')
			.node()
			.click()
	}

	function testEditMenu(filter) {
		const pills = filter.Inner.inclusions.Inner.pills
		const div = pills[Object.keys(pills)[0]].Inner.dom.tip.d
		test.equal(div.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
		test.equal(div.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
		test.equal(div.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
		test.equal(div.selectAll('.value_checkbox').size(), 5, 'Should have checkbox for each value')
		test.equal(
			div
				.selectAll('.value_checkbox')
				.filter(function(d) {
					return this.checked == true
				})
				.size(),
			1,
			'Should have 1 box checked for 0 grade'
		)
	}

	function triggerAddFilter(filter) {
		const pills = filter.Inner.inclusions.Inner.pills
		const div = pills[Object.keys(pills)[0]].Inner.dom.tip.d
		div.selectAll('.value_checkbox')._groups[0][1].click()
		div
			.selectAll('.apply_btn')
			.node()
			.click()
	}

	function testAddFilter(filter) {
		test.equal(
			filter.Inner.dom.inclusionsDiv
				.selectAll('.value_btn')
				.html()
				.split('<')[0],
			filter.Inner.state.termfilter.inclusions[0][0].values.length + ' Grades',
			'should change filter by selecting values from Menu'
		)
	}

	function triggerGradeChanage(filter) {
		const pills = filter.Inner.inclusions.Inner.pills
		const div = pills[Object.keys(pills)[0]].Inner.dom.tip.d
		div.selectAll('select')._groups[0][1].selectedIndex = 1
		div.selectAll('select')._groups[0][1].dispatchEvent(new Event('change'))
	}

	function testGradeChanage(filter) {
		test.equal(
			filter.Inner.dom.inclusionsDiv.selectAll('.grade_type_btn').html(),
			'[Most Recent Grade]',
			'should have grade type text'
		)
	}

	function triggerValueTypeChanage(filter) {
		const pills = filter.Inner.inclusions.Inner.pills
		const div = pills[Object.keys(pills)[0]].Inner.dom.tip.d
		div.selectAll('select')._groups[0][0].selectedIndex = 1
		div.selectAll('select')._groups[0][0].dispatchEvent(new Event('change'))
	}

	function triggerSubSelect(filter) {
		const pills = filter.Inner.inclusions.Inner.pills
		const div = pills[Object.keys(pills)[0]].Inner.dom.tip.d
		div.selectAll('.value_checkbox')._groups[0][5].click()
		div.selectAll('.apply_btn')._groups[0][1].click()
	}

	function testSubSelelct(filter) {
		test.equal(
			filter.Inner.dom.inclusionsDiv
				.selectAll('.value_btn')
				.html()
				.split('<')[0],
			filter.Inner.state.termfilter.inclusions[0][0].values[0].label,
			'should change to subcondition'
		)
	}
})
