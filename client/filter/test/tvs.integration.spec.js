const tape = require('tape')
const d3s = require('d3')
const filterInit = require('../filter').filterInit
const {
	sleep,
	detectLst,
	detectOne,
	detectZero,
	detectGte,
	detectChildText,
	whenHidden,
	whenVisible
} = require('../../test/test.helpers')

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
	const vocab = _opts.vocab ? _opts.vocab : { route: 'termdb', genome: 'hg38-test', dslabel: 'TermdbTest' }

	opts.filter = filterInit({
		vocab,
		termdbConfig: {
			selectCohort: {
				term: { id: 'subcohort', type: 'categorical' },
				prompt: 'To get started with the Clinical Browser, select the survivor population you wish to browse.',
				values: [
					{
						keys: ['ABC'],
						label: 'ABC Lifetime Cohort (ABC)',
						shortLabel: 'ABC',
						isdefault: true,
						cssSelector: 'tbody > tr > td:nth-child(2)'
					},
					{
						keys: ['XYZ'],
						label: 'XYZ Cancer Survivor Study (XYZ)',
						shortLabel: 'XYZ',
						cssSelector: 'tbody > tr > td:nth-child(3)'
					},
					{
						keys: ['ABC', 'XYZ'],
						label: 'Combined ABC+XYZ',
						shortLabel: 'ABC+XYZ',
						cssSelector: 'tbody > tr > td:nth-child(2), tbody > tr > td:nth-child(3)'
					}
				],
				highlightCohortBy: 'cssSelector',
				htmlinfo:
					'<table>\n<thead>\n  <tr>\n    <td>Features</td>\n\t<td>St. Jude Lifetime Cohort Study (ABC)</td>\n\t<td>Childhood Cancer Survivor Study (XYZ)</td>\n  </tr>\n</thead>\n<tbody>\n  <tr>\n    <td>Survivors on Portal</td>\n\t<td>4528</td>\n\t<td>2641</td>\n  </tr>\n  <tr>\n\t<td>Years of cancer diagnosis</td>\n\t<td>1962-2012</td>\n\t<td>1987-1999 ("Expanded Cohort")</td>\n  </tr>\n  <tr>\n\t<td>Inclusion criteria</td>\n\t<td>Survived &ge; 5 years from diagnosis</td>\n\t<td>Survived &ge; 5 years from diagnosis</td>\n  </tr>\n  <tr>\n\t<td>Age at cancer diagnosis</td>\n\t<td><25 years</td>\n\t<td><21 years</td>\n  </tr>\n  <tr>\n\t<td>Cancer diagnosis</td>\n\t<td>All diagnoses</td>\n\t<td>Leukemia, CNS, HL, NHL, neuroblastoma, soft tissue sarcoma, Wilms, bone tumors</td>\n  </tr>\n  <tr>\n\t<td>Study design</td>\n\t<td>Retrospective cohort with prospective follow-up, hospital-based</td>\n\t<td>Retrospective cohort with prospective follow-up, hospital-based</td>\n  </tr>\n  <tr>\n\t<td>Methods of contact</td>\n\t<td>Clinic visits and surveys</td>\n\t<td>Surveys</td>\n  </tr>\n  <tr>\n\t<td>Source of sequenced germline DNA</td>\n\t<td>Blood</td>\n\t<td>Saliva or blood</td>\n  </tr>\n  <tr>\n\t<td>Therapeutic exposures</td>\n\t<td>Chemotherapy, radiation, surgery</td>\n\t<td>Chemotherapy, radiation, surgery</td>\n  </tr>\n  <tr>\n\t<td>Methods for ascertainment of outcomes</td>\n\t<td><span style="font-weight:bold;text-decoration:underline">Clinical assessments<span>, medical records, self-report, NDI</td>\n\t<td>Self-report, pathology reports (secondary neoplasm), NDI</td>\n  </tr>\n</tbody>\n</table>'
			}
		},
		btn: holder.append('div'),
		btnLabel: 'Filter',
		holder: holder.append('div'),
		debug: true,
		callback: function(filter) {
			let stop = false
			if (opts.testCallback) {
				stop = opts.testCallback(filter)
				delete opts.testCallback
			}
			if (stop) return
			opts.filterData = filter
			opts.filter.main(filter)
		},
		callbacks: opts.callbacks
	})

	opts.test = ({ callback, trigger }) => {
		opts.testCallback = callback
		trigger()
	}

	return opts
}

/**************
 test sections
**************

tvs (common): buttons
tvs: Categorical
tvs: Numeric
tvs: Condition
tvs: Cohort + Numeric
tvs: unbounded range

*/

tape('\n', test => {
	test.pass('-***- filter/tvs -***-')
	test.end()
})

tape('tvs (common): buttons', async test => {
	test.timeoutAfter(10000)
	test.plan(5)
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
		},
		callbacks: {
			firstRender() {
				if (pendingTest) pendingTest()
			}
		}
	})

	let pendingTest, pendingResolve

	const filternode = opts.holder.node()
	await opts.filter.main(opts.filterData)
	try {
		/* 
			OPTION A: return a promise from .main() or an event callback function
				- will require more work in the component code, to track the rendering 
					status and when to trigger resolve() of the returned promise
		*/

		// test common bluepill components
		test.equal(filternode.querySelectorAll('.tvs_pill').length, 1, 'should have one filter button')

		test.equal(
			filternode.querySelector('.term_name_btn').innerHTML,
			opts.filterData.lst[0].tvs.term.name,
			'should label the pill with the correct term name'
		)

		test.equal(
			filternode.querySelectorAll('.negate_btn')[0].innerHTML,
			'IS',
			'should label the pill with the correct negate value'
		)

		test.equal(
			opts.holder
				.node()
				.querySelector('.value_btn')
				.innerHTML.split('<')[0],
			opts.filterData.lst[0].tvs.values[0].label,
			'should label the pill with the correct value label'
		)
	} catch (e) {
		test.fail('failed to render a pill: ' + e)
		test.end()
		return
	}

	try {
		// trigger and check negate value change
		const pill = await detectOne({ target: filternode, selector: '.tvs_pill' })
		const controlTipd = opts.filter.Inner.dom.controlsTip.d
		const menuRows = controlTipd.selectAll('tr')
		const editOpt = menuRows.filter(d => d.action == 'edit').node()
		const tipd = opts.filter.Inner.dom.termSrcDiv

		pill.click()
		editOpt.click()

		const isNotInput = await detectOne({ target: tipd.node(), selector: 'input[name=sja_filter_isnot_input]' })
		isNotInput.click()
		const applyBtn = await detectOne({ target: tipd.node(), selector: '.sjpp_apply_btn' })

		/*
			For DOM events, where the event listener/callback cannot be 
			directly awaited on due to hard-to-sequence serial input processing,
			OPTION A may be either impossible or very complicated to implement.
			In this case, options B, C, D, and E can be used.
			!!! OPTION E recommended since it is more reliable and simpler than all other options !!!
			    OPTION D is more reliable than B and simpler than C
		*/
		const option = 'E'
		if (option == 'E') {
			/*** OPTION E: test against the data API as much as possible, !!! BEST OPTION !!! ***/
			// 1. the UI rendered elements and labels will be tested elsewhere by supplying data/state/settings to the instance.main() or update(),
			// 2. then separately, each input change will be tested on how the data/state/settings argument compares to the
			//    current data/state/settings, and NOT against the UI elements and labels
			opts.test({
				// if there is no Illegal Invocation error, can simplify below as `trigger: applyBtn.click,`
				trigger: () => applyBtn.click(),
				callback: filter => {
					test.equal(filter.lst[0].tvs.isnot, !opts.filterData.lst[0].isnot, 'should negate the pill value')
				}
			})

			/*	
			// could also write as follows, but slightly more verbose, 
			// and it's not as obvious that the trigger and callback belong together
			opts.testCallback = filter => {
				test.equal(filter.lst[0].tvs.isnot, !opts.filterData.lst[0].isnot, 'should negate the pill value')
				delete testCallback
			}
			applyBtn.click()
			*/
		} else if (option == 'D') {
			/*** OPTION D: obtain the firstRender promise directly without using rx.Bus ***/
			applyBtn.click()
			await opts.filter.getPromise('firstRender')
			test.equal(filternode.querySelector('.negate_btn').innerHTML, 'NOT', 'should change the negate value of the pill')
			test.end()
		} else if (option == 'B') {
			// change to false to use the callback approach
			/*** OPTION B: await on rerendered element - assumes the applyBtn will be gone temporarily during update ***/
			applyBtn.click()
			const negateBtn = await detectOne({ target: tipd.node(), selector: '.negate_btn' })
			test.equal(negateBtn.innerHTML, 'NOT', 'should change the negate value of the pill')
			test.end()
		} else if (option == 'C') {
			/*** OPTION B: use a post-render callback, see opts.callbacks.firstRender above (uses the rx.Bus) ***/
			pendingTest = () => {
				test.equal(
					filternode.querySelector('.negate_btn').innerHTML,
					'NOT',
					'should change the negate value of the pill'
				)
				pendingResolve()
				test.end()
			}
			await new Promise((resolve, reject) => {
				pendingResolve = resolve
				try {
					applyBtn.click()
				} catch (e) {
					reject(e)
				}
			})
		} else {
			throw `unknown await option='${option}'`
		}
	} catch (e) {
		test.fail('test error: ' + e)
		test.end()
	}
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

	const filternode = opts.holder.node()
	await opts.filter.main(opts.filterData)

	try {
		const pill = await detectOne({ target: filternode, selector: '.tvs_pill' })
		const controlTipd = opts.filter.Inner.dom.controlsTip.d
		const menuRows = controlTipd.selectAll('tr')
		const editOpt = menuRows.filter(d => d.action == 'edit').node()
		const tipd = opts.filter.Inner.dom.termSrcDiv

		// --- trigger and check tip menu ---
		pill.click()
		editOpt.click()
		const applyBtn = await detectOne({ target: tipd.node(), selector: '.sjpp_apply_btn' })

		test.ok(applyBtn, 'Should have 1 button to apply value change')
		test.equal(tipd.selectAll("input[name^='select']").size(), 10, 'Should have a checkbox for each value')
		test.equal(tipd.selectAll("input[name^='select']:checked").size(), 1, 'Should have 1 box checked for Wilms tumor')

		//trigger and test addition of new value
		tipd
			.node()
			.querySelectorAll("input[name^='select']")[0]
			.click()

		// defer the execution of the next step to the next process loop "tick"
		const valueBtn = await detectChildText({
			target: filternode,
			selector: '.value_btn:nth-child(1n)',
			trigger: () => applyBtn.click()
		})
		test.equal(
			valueBtn[0].innerHTML.split('<')[0],
			opts.filterData.lst[0].tvs.values.length + ' groups',
			'should change the pill value btn after adding value from menu'
		)
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})

tape('tvs: Numeric', async test => {
	test.timeoutAfter(3000)
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

	const filternode = opts.holder.node()
	const tipd = opts.filter.Inner.dom.termSrcDiv
	const tipnode = tipd.node()
	const controlsTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlsTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit').node()
	const enter_event = new KeyboardEvent('keyup', {
		code: 'Enter',
		key: 'Enter',
		keyCode: 13
	})

	await opts.filter.main(opts.filterData)
	const pill = await detectOne({ target: filternode, selector: '.tvs_pill' })

	// --- test common bluepill components ---
	{
		test.equal(
			filternode
				.querySelector('.term_name_btn')
				.querySelector('label')
				.innerHTML.split(' ')[0],
			opts.filterData.lst[0].tvs.term.name.split(' ')[0],
			'should label the pill with the correct term name'
		)

		test.equal(
			filternode.querySelector('.value_btn').innerHTML.split(' ')[0],
			String(opts.filterData.lst[0].tvs.ranges[0].start),
			'should label the pill with the correct range label'
		)
	}

	// --- trigger and check tip menu ----
	{
		pill.click()
		editOpt.click()
		const applyBtn = await detectLst({ target: tipnode, selector: '.sjpp_apply_btn', count: 2 })
		test.equal(applyBtn.length, 2, 'Should have 2 button to apply value change')
		test.equal(tipd.selectAll('.sjpp_delete_btn').size(), 1, 'Should have 1 button to remove the range')
		test.equal(tipnode.querySelector('.start_text').innerHTML, '1000', 'Should match start value with data')
		test.equal(tipnode.querySelector('.stop_text').innerHTML, '2000', 'Should match stop value with data')
	}

	// --- trigger and check range edit ---
	{
		const brush = opts.filter.Inner.pills['1'].Inner.num_obj.brushes[0].d3brush
		d3s.select(tipnode.querySelector('.range_brush')).call(brush.move, [15.9511, 30.9465])

		// -- test available buttons --
		test.equal(tipd.selectAll('table .sjpp_apply_btn').size(), 1, 'Should have button to apply value change')
		test.equal(tipd.selectAll('table .reset_btn').size(), 1, 'Should have button to reset the range')

		// --- test range change and adding unannotated category ---
		{
			const valueBtn = await detectChildText({
				target: filternode,
				selector: '.value_btn',
				trigger() {
					tipnode.querySelector('table .sjpp_apply_btn').click()
				}
			})

			test.equal(
				valueBtn[0].innerText.split(' ').pop(),
				String(opts.filterData.lst[0].tvs.ranges[0].stop),
				'should change range from the menu'
			)
		}

		// --- test adding unannotated categories after applying brushed value ---
		{
			pill.click()
			editOpt.click()
			const selectInputs = await detectLst({
				target: tipnode,
				selector: `input[name^='select']`,
				count: 3
			})
			selectInputs[0].click()
			const currentRanges = opts.filterData.lst[0].tvs.ranges
			// Option E: test against the data/API, not the UI display such as valueBtn label
			opts.test({
				callback: filter => {
					test.deepEqual(
						filter.lst[0].tvs.ranges.filter(r => 'value' in r && !currentRanges.find(d => d.value === r.value)),
						[{ value: '0', label: 'Not exposed' }],
						'should add an unannotated value to the tvs.ranges'
					)
				},
				trigger() {
					tipnode.querySelectorAll('.sjpp_apply_btn')[1].click()
				}
			})

			// for subsequent tests, hide the uncomputable bin again
			tipnode.querySelector("input[name^='select']").click()
			tipnode.querySelector('.sjpp_apply_btn').click()
			await whenHidden(tipnode.parentNode)
		}
	}

	// --- test adding new range ---
	{
		pill.click()
		editOpt.click()
		const addRangeBtn = await detectOne({ target: tipnode, selector: `.add_range_btn:nth-child(1n)` })
		addRangeBtn.click()

		test.equal(addRangeBtn.style.display, 'none', 'Should hide button to add new range')
		test.equal(tipd.selectAll('table .sjpp_apply_btn').size(), 2, 'Should have button to apply new range')
		test.equal(tipd.selectAll('table .sjpp_delete_btn').size(), 2, 'Should have buttons to delete the ranges')
		test.equal(tipd.selectAll('table .note_tr').size(), 1, 'Should have note to select new range')
	}

	// --- delete new range without applying new range ---
	{
		await detectZero({
			target: tipnode,
			selector: `table .note_tr`,
			trigger() {
				tipnode.querySelectorAll('.sjpp_delete_btn')[1].click()
			}
		})

		test.equal(tipd.selectAll('table .note_tr').size(), 0, 'Should hide note to select new range')
		test.equal(
			tipnode.querySelector('.add_range_btn').style.display,
			'inline-block',
			'Should unhide button to add new range'
		)
	}

	// --- test merging ranges by adding new range ---
	{
		pill.click()
		editOpt.click()
		const addRangeBtn = await detectOne({ target: tipnode, selector: '.add_range_btn' })
		addRangeBtn.click()
		const start_value_premerge = +tipnode.querySelector('.start_input').value
		const stop_input = tipnode.querySelector('.stop_input')
		tipnode.querySelectorAll('.start_input')[1].value = +stop_input.value - 400
		tipnode.querySelectorAll('.stop_input')[1].value = 5000
		stop_input.dispatchEvent(enter_event)
		const valueBtn = await detectChildText({
			target: filternode,
			selector: '.value_btn',
			trigger() {
				tipd.selectAll('.sjpp_apply_btn')._groups[0][1].click()
			}
		})
		test.true(valueBtn[0].innerHTML.includes(start_value_premerge + ' '), 'should merge ranges into 1 range')
	}

	// --- test changing to non-inclusive start boundary ---
	{
		pill.click()
		editOpt.click()
		const tr = await detectOne({ target: tipnode, selector: '.range_div' })
		tr.querySelector('.edit_btn').click()
		tr.querySelector('.start_input').value = 0
		tr.querySelector('.stop_select').value = 'stopunbounded'
		d3s.select(tr.querySelector('.stop_select')).on('change')()
		//await sleep(100)
		tr.querySelector('.stop_select').dispatchEvent(enter_event)
		const valueBtn = await detectChildText({
			target: filternode,
			selector: '.value_btn',
			trigger() {
				tr.querySelector('.sjpp_apply_btn').click()
			}
		})
		//await sleep(10)
		test.true(valueBtn[0].innerHTML.includes('&gt; 0'), 'should show a greater than pill value')
	}

	// --- test changing to inclusive start boundary ---
	{
		pill.click()
		editOpt.click()
		const tr1 = await detectOne({ target: tipnode, selector: 'table .range_div' })
		tr1.querySelector('.edit_btn').click()
		//await sleep(10)
		tr1.querySelector('.start_select').value = 'startinclusive'
		d3s.select(tr1.querySelector('.start_select')).on('change')()
		//await sleep(100)
		tr1.querySelector('.start_select').dispatchEvent(enter_event)

		const valueBtn = await detectChildText({
			target: filternode,
			selector: '.value_btn',
			trigger() {
				tr1.querySelector('.sjpp_apply_btn').click()
			}
		})
		test.true(
			/* HTML entity code does not work in this instance (like in the above .sjpp_apply_btn 
				test) for some reason. Test fails everytime. */
			// .innerHTML.includes('&ge; 0'),
			valueBtn[0].innerHTML.includes('≥ 0'),
			'should show a >= 0 in the pill value'
		)
	}

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
	const filternode = opts.holder.node()
	const pill = await detectOne({ target: filternode, selector: '.tvs_pill' })
	const controlTipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = controlTipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit').node()
	const tipd = opts.filter.Inner.dom.termSrcDiv

	// await sleep(100)
	// --- test common bluepill components ---
	{
		test.equal(
			filternode.querySelectorAll('.term_name_btn')[0].innerHTML,
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
			filternode.querySelectorAll('.grade_type_btn')[0].innerHTML,
			'[Max Grade]',
			'should have grade type text'
		)
	}

	// --- trigger and check tip menu ---
	{
		pill.click()
		editOpt.click()
		const applyBtn = await detectGte({ target: tipd.node(), selector: '.sjpp_apply_btn' })

		test.equal(applyBtn.length, 1, 'Should have 1 button to apply value change')
		test.equal(tipd.selectAll("input[name^='select']").size(), 4, 'Should have checkbox for each value')
		test.equal(tipd.selectAll("input[name^='select']:checked").size(), 1, 'Should have 1 box checked for Grade 0')
	}

	// --- trigger and test grade change ---
	{
		tipd
			.node()
			.querySelectorAll("input[name^='select']")[1]
			.click()

		const applyBtn = await detectGte({ target: tipd.node(), selector: '.sjpp_apply_btn' })
		const valueBtn = await detectChildText({
			target: filternode,
			selector: '.value_btn',
			trigger() {
				applyBtn[0].click()
			}
		})
		test.equal(
			valueBtn[0].innerHTML.split('<')[0],
			opts.filterData.lst[0].tvs.values.length + ' Grades',
			'should change the pill value btn after adding value from menu'
		)
	}

	// --- trigger and test grade type change ---
	{
		pill.click()
		editOpt.click()

		const gradeSelect = await detectOne({ target: tipd.node(), selector: '.grade_select' })
		gradeSelect.selectedIndex = 1
		const applyBtn = await detectOne({ target: tipd.node(), selector: '.sjpp_apply_btn' })
		applyBtn.click()
		test.equal(gradeSelect.value, 'recent', 'should have grade type changed')
	}

	/* Do not test the inactivated subcondition option, may reactivate later
	// trigger and test subcondition selection
	pill.click()
	await sleep(150)
	editOpt.click()
	await sleep(700)

	tipd.node().querySelectorAll('select')[0].selectedIndex = 1
	tipd
		.node()
		.querySelectorAll('select')[0]
		.dispatchEvent(new Event('change'))

	await sleep(800)
	tipd
		.node()
		.querySelectorAll("input[name^='select']")[1]
		.click()

	tipd
		.node()
		.querySelector('.sjpp_apply_btn')
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
	*/
	test.end()
})

tape('tvs: Cohort + Numeric', async test => {
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
							ABC: { key: 'ABC', label: 'ABC', shortLabel: 'ABC' },
							XYZ: { key: 'XYZ', label: 'XYZ', shortLabel: 'XYZ' },
							'ABC,XYZ': { keys: ['ABC', 'XYZ'], shortLabel: 'ABC+XYZ' }
						}
					},
					values: [{ key: 'ABC', label: 'ABC', shortLabel: 'ABC' }]
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
	const filternode = opts.holder.node()
	await opts.filter.main(opts.filterData, { activeCohort: 0 })

	try {
		// trigger fill-in of pill.num_obj.density_data
		const pill = await detectOne({ target: filternode, selector: '.tvs_pill' })
		const controlTipd = opts.filter.Inner.dom.controlsTip.d
		const menuRows = controlTipd.selectAll('tr')
		const editOpt = menuRows.filter(d => d.action == 'edit').node()
		const termSrc = opts.filter.Inner.dom.termSrcDiv.node()

		// -- test changing the cohort-related density data --
		{
			pill.click()
			editOpt.click()
			// Wait for density plot to appear
			await detectOne({ target: termSrc, selector: 'svg' })
			// remember the density data for comparison later
			const sjlifeDensityData = opts.filter.Inner.pills[2].Inner.num_obj.density_data

			// change the cohort
			const selectElem = opts.filter.Inner.dom.holder.select('select')
			selectElem
				.property('value', 1)
				.on('change')
				.call(selectElem.node())

			await whenHidden(controlTipd.node())
			pill.click()
			editOpt.click()
			await detectOne({ target: termSrc, selector: 'svg' })
			const sjcsDensityData = opts.filter.Inner.pills['2'].Inner.num_obj.density_data
			test.notDeepEqual(
				sjlifeDensityData,
				sjcsDensityData,
				'should have different density data when changing the cohort'
			)
			opts.filter.Inner.dom.controlsTip.hide()
		}

		test.end()
	} catch (e) {
		test.fail('test error: ' + e)
		test.end()
	}
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
	const valLabel = await detectOne({ target: opts.holder.select('.tvs_pill').node(), selector: '.value_btn' })
	test.equal(valLabel.textContent, '﹣∞ < x < ﹢∞', 'should show an unbounded range label in the blue pill')
	test.end()
})
