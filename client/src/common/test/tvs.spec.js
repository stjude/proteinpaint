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
	const vocab = _opts.vocab ? _opts.vocab : { route: 'termdb', genome: 'hg38', dslabel: 'TermdbTest' }

	opts.filter = filterInit({
		vocab,
		termdbConfig: {
			selectCohort: {
				term: { id: 'subcohort', type: 'categorical' },
				showMessageWhenNotSelected:
					'To get started with the Clinical Browser, select the survivor population you wish to browse.',
				values: [
					{
						keys: ['SJLIFE'],
						label: 'St. Jude Lifetime Cohort (SJLIFE)',
						shortLabel: 'SJLIFE',
						isdefault: true,
						cssSelector: 'tbody > tr > td:nth-child(2)'
					},
					{
						keys: ['CCSS'],
						label: 'Childhood Cancer Survivor Study (CCSS)',
						shortLabel: 'CCSS',
						cssSelector: 'tbody > tr > td:nth-child(3)'
					},
					{
						keys: ['SJLIFE', 'CCSS'],
						label: 'Combined SJLIFE+CCSS',
						shortLabel: 'SJLIFE+CCSS',
						cssSelector: 'tbody > tr > td:nth-child(2), tbody > tr > td:nth-child(3)'
					}
				],
				highlightCohortBy: 'cssSelector',
				htmlinfo:
					'<table>\n<thead>\n  <tr>\n    <td>Features</td>\n\t<td>St. Jude Lifetime Cohort Study (SJLIFE)</td>\n\t<td>Childhood Cancer Survivor Study (CCSS)</td>\n  </tr>\n</thead>\n<tbody>\n  <tr>\n    <td>Survivors on Portal</td>\n\t<td>4528</td>\n\t<td>2641</td>\n  </tr>\n  <tr>\n\t<td>Years of cancer diagnosis</td>\n\t<td>1962-2012</td>\n\t<td>1987-1999 ("Expanded Cohort")</td>\n  </tr>\n  <tr>\n\t<td>Inclusion criteria</td>\n\t<td>Survived &ge; 5 years from diagnosis</td>\n\t<td>Survived &ge; 5 years from diagnosis</td>\n  </tr>\n  <tr>\n\t<td>Age at cancer diagnosis</td>\n\t<td><25 years</td>\n\t<td><21 years</td>\n  </tr>\n  <tr>\n\t<td>Cancer diagnosis</td>\n\t<td>All diagnoses</td>\n\t<td>Leukemia, CNS, HL, NHL, neuroblastoma, soft tissue sarcoma, Wilms, bone tumors</td>\n  </tr>\n  <tr>\n\t<td>Study design</td>\n\t<td>Retrospective cohort with prospective follow-up, hospital-based</td>\n\t<td>Retrospective cohort with prospective follow-up, hospital-based</td>\n  </tr>\n  <tr>\n\t<td>Methods of contact</td>\n\t<td>Clinic visits and surveys</td>\n\t<td>Surveys</td>\n  </tr>\n  <tr>\n\t<td>Source of sequenced germline DNA</td>\n\t<td>Blood</td>\n\t<td>Saliva or blood</td>\n  </tr>\n  <tr>\n\t<td>Therapeutic exposures</td>\n\t<td>Chemotherapy, radiation, surgery</td>\n\t<td>Chemotherapy, radiation, surgery</td>\n  </tr>\n  <tr>\n\t<td>Methods for ascertainment of outcomes</td>\n\t<td><span style="font-weight:bold;text-decoration:underline">Clinical assessments<span>, medical records, self-report, NDI</td>\n\t<td>Self-report, pathology reports (secondary neoplasm), NDI</td>\n  </tr>\n</tbody>\n</table>'
			}
		},
		btn: holder.append('div'),
		btnLabel: 'Filter',
		holder: holder.append('div'),
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
	await sleep(100)
	// test common bluepill components
	test.equal(opts.holder.node().querySelectorAll('.tvs_pill').length, 1, 'should have one filter button')

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
	const tipd = opts.filter.Inner.dom.termSrcDiv
	tipd
		.node()
		.querySelector('input[name=sja_filter_isnot_input]')
		.click()
	opts.filter.Inner.dom.termSrcDiv
		.select('.apply_btn')
		.node()
		.click()
	await sleep(50)
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
	await sleep(100)
	//trigeer and check tip menu
	const pill = opts.holder.select('.tvs_pill').node()
	pill.click()
	await sleep(150)
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')
	editOpt.node().click()
	await sleep(1000)
	const tipd = opts.filter.Inner.dom.termSrcDiv

	test.equal(tipd.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
	test.equal(tipd.selectAll('.value_checkbox').size(), 10, 'Should have checkbox for each value')
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

tape('tvs: Numeric', async test => {
	test.timeoutAfter(20000)
	test.plan(19)

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
	await sleep(100)
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

	await sleep(350)
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')
	editOpt.node().click()

	await sleep(700)
	const tipd = opts.filter.Inner.dom.termSrcDiv

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
			.innerText.split(' ')
			.pop(),
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

	// hide the visible uncomputable bin
	tipd
		.node()
		.querySelectorAll('.value_checkbox')[0]
		.click()

	// test merging ranges by adding new range
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

	tipd
		.node()
		.querySelectorAll('.start_select')[1]
		.dispatchEvent(new Event('click'))
	const start_value_premerge = +tipd.node().querySelectorAll('.start_input')[0].value
	const stop_input = tipd.node().querySelectorAll('.stop_input')[0]
	tipd.node().querySelectorAll('.start_input')[1].value = +stop_input.value - 400
	tipd.node().querySelectorAll('.stop_input')[1].value = 5000
	//press 'Enter' to update bins
	stop_input.addEventListener('keyup', () => {})
	stop_input.dispatchEvent(enter_event)

	tipd.selectAll('.apply_btn')._groups[0][1].click()
	await sleep(800)

	test.true(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.includes(start_value_premerge + ' '),
		'should merge ranges into 1 range'
	)

	// test changing the <= option for start boundary
	pill.click()
	await sleep(150)
	editOpt.node().click()
	await sleep(300)
	const tr = tipd
		.node()
		.querySelector('table')
		.querySelector('.range_div')
	tr.querySelector('.edit_btn').click()
	tr.querySelector('.start_input').value = 0
	tr.querySelector('.start_input').dispatchEvent(
		new KeyboardEvent('keyup', {
			code: '0',
			key: '0',
			keyCode: 0
		})
	)
	await sleep(100)
	tr.querySelector('.stop_select').value = 'stopunbounded'
	d3s.select(tr.querySelector('.stop_select')).on('change')()
	await sleep(100)
	tr.querySelector('.stop_select').dispatchEvent(enter_event)
	tr.querySelector('.apply_btn').click()
	await sleep(300)
	test.true(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.includes('&gt; 0'),
		'should show a greater than pill value'
	)

	//const menuRows1 = controlTipd.selectAll('tr')
	//const editOpt1 = menuRows.filter(d => d.action == 'edit')
	pill.click()
	await sleep(30)
	editOpt.node().click()
	await sleep(500)
	const tr1 = tipd
		.node()
		.querySelector('table')
		.querySelector('.range_div')
	tr1.querySelector('.edit_btn').click()
	await sleep(10)
	tr1.querySelector('.start_select').value = 'startinclusive'
	d3s.select(tr1.querySelector('.start_select')).on('change')()
	await sleep(100)
	tr1.querySelector('.start_select').dispatchEvent(enter_event)
	tr1.querySelector('.apply_btn').click()
	await sleep(300)
	test.true(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.includes('≥ 0'),
		'should show a >= 0 in the pill value'
	)

	test.end()
})

tape('tvs: Condition', async test => {
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
	await sleep(100)
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
	await sleep(1200)
	const tipd = opts.filter.Inner.dom.termSrcDiv

	test.equal(tipd.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
	test.equal(tipd.selectAll('.value_checkbox').size(), 4, 'Should have checkbox for each value')
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

	tipd.node().querySelector('.grade_select').selectedIndex = 1
	tipd
		.node()
		.querySelector('.grade_select')
		.dispatchEvent(new Event('change'))
	await sleep(100)
	tipd
		.selectAll('.apply_btn')
		.node()
		.click()

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
							SJLIFE: { key: 'SJLIFE', label: 'SJLIFE', shortLabel: 'SJLIFE' },
							CCSS: { key: 'CCSS', label: 'CCSS', shortLabel: 'CCSS' },
							'SJLIFE,CCSS': { keys: ['SJLIFE', 'CCSS'], shortLabel: 'SJLIFE+CCSS' }
						}
					},
					values: [{ key: 'SJLIFE', label: 'SJLIFE', shortLabel: 'SJLIFE' }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'agedx',
						name: 'Age (year) at Cancer Diagnosis',
						unit: 'year',
						type: 'float',
						values: {}
					},
					ranges: [{ stopinclusive: true, start: 1, stop: 8 }]
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
	await sleep(400)
	// remember the density data for comparison later
	const sjlifeDensityData = opts.filter.Inner.pills[2].Inner.num_obj.density_data

	opts.filter.Inner.opts.activeCohort = 1
	const selectElem = opts.filter.Inner.dom.holder.select('select')
	selectElem
		.property('value', 1)
		.on('change')
		.call(selectElem.node())
	await sleep(400)
	// trigger fill-in of pill.num_obj.density_data
	pill.click()
	editOpt.node().click()
	await sleep(400)

	const sjcsDensityData = opts.filter.Inner.pills['2'].Inner.num_obj.density_data
	test.notDeepEqual(sjlifeDensityData, sjcsDensityData, 'should have different density data when changing the cohort')
	test.end()
})

tape('tvs: unbounded range', async test => {
	const filterData = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
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
					ranges: [{ startunbounded: true, stopunbounded: true }]
				}
			}
		]
	}
	const opts = getOpts({ filterData })
	await opts.filter.main(opts.filterData)
	await sleep(200)

	// remember the density data for comparison later
	/*const sjlifeDensityData = opts.filter.Inner.pills[2].Inner.num_obj.density_data

	opts.filter.Inner.opts.activeCohort = 1
	const selectElem = opts.filter.Inner.dom.holder.select('select')
	selectElem
		.property('value', 1)
		.on('change')
		.call(selectElem.node())
	await sleep(400)
	// trigger fill-in of pill.num_obj.density_data
	pill.click()
	editOpt.node().click()
	await sleep(400)

	const sjcsDensityData = opts.filter.Inner.pills['2'].Inner.num_obj.density_data*/
	const valLabel = opts.holder.select('.tvs_pill .value_btn').text()
	test.equal(valLabel, '﹣∞ < x < ﹢∞', 'should show an unbounded range label in the blue pill')
	test.end()
})
