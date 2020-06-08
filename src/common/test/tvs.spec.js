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
						term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical' },
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
	tipd
		.node()
		.querySelectorAll('input')[0]
		.click()
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

tape('tvs: Categorical', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical' },
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
	test.equal(tipd.selectAll('.value_checkbox').size(), 24, 'Should have checkbox for each value')
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
		opts.filterData.lst[0].tvs.values.length + ' groups',
		'should change the pill value btn after adding value from menu'
	)

	test.end()
})

tape('tvs: Numerical', async test => {
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
							type: 'float',
							values: {
								'0': { label: 'Not exposed', uncomputable: true },
								'-8888': { label: 'Exposed but dose unknown', uncomputable: true },
								'-9999': { label: 'Unknown treatment record', uncomputable: true }
							}
						},
						ranges: [{ stopinclusive: true, start: 1000, stop: 2000 }]
					}
				}
			]
		}
	})

	const enter_event = new KeyboardEvent('keyup', {
		code: 'Enter',
		key: 'Enter',
		keyCode: 13
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
	test.equal(tipd.node().querySelectorAll('.start_text')[0].innerHTML, '1000', 'Should match start value with data')
	test.equal(tipd.node().querySelectorAll('.stop_text')[0].innerHTML, '2000', 'Should match stop value with data')

	//trigeer and check range edit
	const brush = opts.filter.Inner.pills['1'].Inner.num_obj.brushes[0].d3brush
	d3s.select(tipd.node().querySelectorAll('.range_brush')[0]).call(brush.move, [15.9511, 30.9465])
	test.equal(
		tipd
			.selectAll('table')
			.selectAll('.apply_btn')
			.size(),
		1,
		'Should have button to apply value change'
	)
	test.equal(
		tipd
			.selectAll('table')
			.selectAll('.reset_btn')
			.size(),
		1,
		'Should have button to reset the range'
	)

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
			.innerHTML.split(' ')[5]
			.split('<')[0],
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
		'2 intervals',
		'should change value btn text after selecting unannotated value'
	)

	// //trigger and check adding new range
	pill.click()
	await sleep(150)
	editOpt.node().click()
	await sleep(700)

	tipd
		.node()
		.querySelectorAll('.add_range_btn')[0]
		.click()

	await sleep(1000)

	test.equal(
		tipd.node().querySelectorAll('.add_range_btn')[0].style.display,
		'none',
		'Should hide button to add new range'
	)

	test.equal(
		tipd
			.selectAll('table')
			.selectAll('.apply_btn')
			.size(),
		2,
		'Should have button to apply new range'
	)

	test.equal(
		tipd
			.selectAll('table')
			.selectAll('.delete_btn')
			.size(),
		2,
		'Should have buttons to delete the ranges'
	)

	test.equal(
		tipd
			.selectAll('table')
			.selectAll('.note_tr')
			.size(),
		1,
		'Should have note to select new range'
	)

	//delete new range without applying new range
	tipd
		.node()
		.querySelectorAll('.delete_btn')[1]
		.click()

	await sleep(800)

	test.equal(
		tipd
			.selectAll('table')
			.selectAll('.note_tr')
			.size(),
		0,
		'Should hide note to select new range'
	)

	test.equal(
		tipd.node().querySelectorAll('.add_range_btn')[0].style.display,
		'inline-block',
		'Should unhide button to add new range'
	)

	//test merging ranges by adding new range
	tipd
		.node()
		.querySelectorAll('.value_checkbox')[0]
		.click()

	tipd.selectAll('.apply_btn')._groups[0][1].click()
	await sleep(800)

	pill.click()
	await sleep(150)
	editOpt.node().click()
	await sleep(700)

	tipd
		.node()
		.querySelectorAll('.add_range_btn')[0]
		.click()
	await sleep(1000)

	tipd.node().querySelectorAll('.start_select')[1].selectedIndex = 2
	tipd
		.node()
		.querySelectorAll('.start_select')[1]
		.dispatchEvent(new Event('change'))

	const stop_input = tipd.node().querySelectorAll('.stop_input')[1]
	stop_input.value = 5000
	//press 'Enter' to update bins
	stop_input.addEventListener('keyup', () => {})
	stop_input.dispatchEvent(enter_event)

	tipd.selectAll('.apply_btn')._groups[0][1].click()
	await sleep(800)

	test.true(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.includes('≤ 5000'),
		'should merge ranges into 1 range'
	)

	test.end()
})

tape('tvs: Conditional', async test => {
	test.timeoutAfter(8000)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'Arrhythmias', name: 'Arrhythmias', type: 'condition' },
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
	await sleep(1000)
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

	await sleep(800)
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

tape('tvs: Cohort + Numerical', async test => {
	const filterData = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tag: 'cohortFilter',
				renderAs: 'htmlSelect',
				tvs: {
					term: {
						id: 'subcohort',
						name: 'subcohort',
						type: 'categorical',
						values: {
							SJLIFE: { key: 'SJLIFE' },
							CCSS: { key: 'CCSS' },
							'SJLIFE,CCSS': { keys: ['SJLIFE', 'CCSS'], shortLabel: 'SJLIFE+CCSS' }
						}
					},
					values: [{ key: 'SJLIFE' }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'yeardx',
						name: 'Year of Diagnosis',
						unit: 'year',
						type: 'float',
						values: {}
					},
					ranges: [{ stopinclusive: true, start: 1980, stop: 1985 }]
				}
			}
		]
	}
	const opts = getOpts({ filterData })
	await opts.filter.main(opts.filterData, { activeCohort: 0 })
	await sleep(200)

	// trigger fill-in of pill.num_obj.density_data
	const pill = opts.holder.select('.tvs_pill').node()
	pill.click()
	await sleep(150)
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')
	editOpt.node().click()
	await sleep(200)
	// remember the density data for comparison later
	const sjlifeDensityData = opts.filter.Inner.pills[2].Inner.num_obj.density_data

	opts.filter.Inner.opts.activeCohort = 2
	const selectElem = opts.filter.Inner.dom.holder.select('select')
	selectElem
		.property('value', 2)
		.on('change')
		.call(selectElem.node())
	await sleep(200)
	// trigger fill-in of pill.num_obj.density_data
	pill.click()
	editOpt.node().click()
	await sleep(200)

	const sjcsDensityData = opts.filter.Inner.pills['2'].Inner.num_obj.density_data
	test.notDeepEqual(sjlifeDensityData, sjcsDensityData, 'should have different density data when changing the cohort')
	test.end()
})
