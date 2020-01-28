const tape = require('tape')
const d3s = require('d3')
const filterInit = require('../filter').filterInit

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify tvs.spec.js -o ../../../public/bin/spec.bundle.js -v

*/

/*************************
 reusable helper functions
**************************/

function getOpts(_opts = {}) {
	const holder = d3s
		.select('body')
		.append('div')
		.style('position', 'relative')
		.style('margin', '20px')
		.style('border', '1px solid #000')

	const opts = Object.assign({ holder }, _opts)

	opts.filter = filterInit({
		btn: holder.append('div'),
		btnLabel: 'Filter',
		holder: holder.append('div'),
		genome: 'hg38',
		dslabel: 'SJLife',
		debug: true,
		callback: function(filter) {
			opts.filterData = filter
			opts.filter.main(opts.filterData)
		}
	})

	return opts
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/tvs -***-')
	test.end()
})

tape('tvs (common): buttons', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
						values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
					}
				}
			]
		}
	})

	await opts.filter.main(opts.filterData)

	// test common bluepill components
	test.equal(opts.holder.node().querySelectorAll('.tvs_pill').length, 1, 'should have one filter buttons')

	test.equal(
		opts.holder.node().querySelectorAll('.term_name_btn')[0].innerHTML,
		opts.filterData.lst[0].tvs.term.name,
		'should label the pill with the correct term name'
	)

	test.equal(
		opts.holder.node().querySelectorAll('.negate_btn')[0].innerHTML,
		'IS',
		'should label the pill with the correct negate value'
	)

	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split('<')[0],
			opts.filterData.lst[0].tvs.values[0].label,
		'should label the pill with the correct value label'
	)

	//trigger and check negate value change
	const pill = opts.holder.select('.tvs_pill').node()
	pill.click()
	await sleep(150)
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')
	editOpt.node().click()
	await sleep(700)
	const tipd = opts.filter.Inner.dom.treeHead
	tipd.node().querySelectorAll('input')[0].click()
	opts.filter.Inner.dom.treeBody
		.selectAll('.apply_btn')
		.node()
		.click()

	test.equal(
		opts.holder.node().querySelectorAll('.negate_btn')[0].innerHTML,
		'NOT',
		'should change the negate value of the pill'
	)
	test.end()
})

tape('tvs : Categorical', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
						values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
					}
				}
			]
		}
	})

	await opts.filter.main(opts.filterData)

	//trigeer and check tip menu
	const pill = opts.holder.select('.tvs_pill').node()
	pill.click()
	await sleep(150)
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')
	editOpt.node().click()
	await sleep(700)
	const tipd = opts.filter.Inner.dom.treeBody

	test.equal(tipd.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
	test.equal(tipd.selectAll('.value_checkbox').size(), 27, 'Should have checkbox for each value')
	test.equal(
		tipd
			.selectAll('.value_checkbox')
			.filter(function(d) {
				return this.checked == true
			})
			.size(),
		1,
		'Should have 1 box checked for Wilms tumor'
	)

	//trigger and test addition of new value
	tipd
		.node()
		.querySelectorAll('.value_checkbox')[0]
		.click()
	tipd
		.selectAll('.apply_btn')
		.node()
		.click()

	await sleep(800)
	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split('<')[0],
			opts.filterData.lst[0].tvs.values.length + ' Groups',
		'should change the pill value btn after adding value from menu'
	)

	test.end()
})

tape('tvs : Numerical', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'aaclassic_5',
							name: 'Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)',
							unit: 'mg/m²',
							isfloat: true
						},
						ranges: [{ stopinclusive: true, start: 1000, stop: 2000 }]
					}
				}
			]
		}
	})

	await opts.filter.main(opts.filterData)

	// test common bluepill components
	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.term_name_btn')[0]
			.querySelectorAll('label')[0]
			.innerHTML.split(' ')[0],
		opts.filterData.lst[0].tvs.term.name.split(' ')[0],
		'should label the pill with the correct term name'
	)

	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split(' ')[0],
		String(opts.filterData.lst[0].tvs.ranges[0].start),
		'should label the pill with the correct range label'
	)

	//trigeer and check tip menu
	const pill = opts.holder.select('.tvs_pill').node()
	pill.click()

	await sleep(150)
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')
	editOpt.node().click()
	await sleep(700)
	const tipd = opts.filter.Inner.dom.treeBody

	test.equal(tipd.selectAll('.apply_btn').size(), 2, 'Should have 2 button to apply value change')
	test.equal(tipd.selectAll('.delete_btn').size(), 1, 'Should have 1 button to remove the range')
	test.equal(tipd.node().querySelectorAll('.start_input')[0].innerHTML, '1000', 'Should match start value with data')
	test.equal(tipd.node().querySelectorAll('.stop_input')[0].innerHTML, '2000', 'Should match stop value with data')

	//trigeer and check range edit
	const brush = opts.filter.Inner.pills['1'].Inner.brush
	d3s.select(tipd
		.node()
		.querySelectorAll('.range_brush')[0]).call(brush.move, [15.9511,30.9465])
	test.equal(tipd.selectAll('table').selectAll('.apply_btn').size(), 1, 'Should have button to apply value change')
	test.equal(tipd.selectAll('table').selectAll('.reset_btn').size(), 1, 'Should have button to reset the range')
	
	tipd
		.selectAll('table')
		.selectAll('.apply_btn')
		.node()
		.click()

	await sleep(800)
	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split(' ')[5].split('<')[0],
		String(opts.filterData.lst[0].tvs.ranges[0].stop),
		'should change range from the menu'
	)

	// //trigger and check adding unannotated categories
	pill.click()
	await sleep(150)
	editOpt.node().click()
	await sleep(700)

	tipd
		.node()
		.querySelectorAll('.value_checkbox')[0]
		.click()

	tipd.selectAll('.apply_btn')._groups[0][1].click()
	await sleep(800)

	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split('<')[0],
		'2 Intervals',
		'should change value btn text after selecting unannotated value'
	)

	test.end()
})

tape('tvs : Conditional', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'Arrhythmias', name: 'Arrhythmias', iscondition: true },
						values: [{ key: 0, label: '0: No condition' }],
						bar_by_grade: 1,
						value_by_max_grade: 1
					}
				}
			]
		}
	})
	
	await opts.filter.main(opts.filterData)

	// test common bluepill components
	test.equal(
		opts.holder.node().querySelectorAll('.term_name_btn')[0].innerHTML,
		opts.filterData.lst[0].tvs.term.name,
		'should label the pill with the correct term name'
	)

	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split('<')[0],
		opts.filterData.lst[0].tvs.values[0].label,
		'should label the pill with the correct value label'
	)

	test.equal(
		opts.holder.node().querySelectorAll('.grade_type_btn')[0].innerHTML,
		'[Max Grade]',
		'should have grade type text'
	)

	//trigeer and check tip menu
	const pill = opts.holder.select('.tvs_pill').node()
	pill.click()

	await sleep(150)
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')
	editOpt.node().click()
	await sleep(700)
	const tipd = opts.filter.Inner.dom.treeBody

	test.equal(tipd.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
	test.equal(tipd.selectAll('.value_checkbox').size(), 5, 'Should have checkbox for each value')
	test.equal(
		tipd
			.selectAll('.value_checkbox')
			.filter(function(d) {
				return this.checked == true
			})
			.size(),
		1,
		'Should have 1 box checked for Grade 0'
	)

	// trigger and test grade change
	tipd
		.node()
		.querySelectorAll('.value_checkbox')[1]
		.click()
	tipd
		.selectAll('.apply_btn')
		.node()
		.click()

	await sleep(800)
	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split('<')[0],
		opts.filterData.lst[0].tvs.values.length + ' Grades',
		'should change the pill value btn after adding value from menu'
	)

	// trigger and test grade type change
	pill.click()
	await sleep(150)
	editOpt.node().click()
	await sleep(1000)

	tipd.node().querySelectorAll('select')[1].selectedIndex = 1
	tipd
		.node()
		.querySelectorAll('select')[1]
		.dispatchEvent(new Event('change'))

	await sleep(800)

	test.equal(
		opts.holder.node().querySelectorAll('.grade_type_btn')[0].innerHTML,
		'[Most Recent Grade]',
		'should have grade type changed'
	)

	// trigger and test subcondition selection
	pill.click()
	await sleep(150)
	editOpt.node().click()
	await sleep(700)

	tipd.node().querySelectorAll('select')[0].selectedIndex = 1
	tipd
		.node()
		.querySelectorAll('select')[0]
		.dispatchEvent(new Event('change'))

	await sleep(500)

	tipd
		.node()
		.querySelectorAll('.value_checkbox')[1]
		.click()

	tipd
		.node()
		.querySelector('.apply_btn')
		.click()

	await sleep(800)
	test.equal(
		opts.holder
			.node()
			.querySelector('.value_btn')
			.innerHTML.split('<')[0],
		opts.filterData.lst[0].tvs.values[0].label,
		'should change pill value to subcondtion'
	)

	test.end()
})
