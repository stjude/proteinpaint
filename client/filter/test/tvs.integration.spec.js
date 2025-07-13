import tape from 'tape'
import * as d3s from 'd3-selection'
import { filterInit } from '../filter'
import { vocabInit } from '#termdb/vocabulary'
import { parseRange } from '../../dom/numericRangeInput'
import { detectLst, detectOne, detectZero, detectGte, detectChildText, whenHidden } from '../../test/test.helpers'

/*********
Tests: 
	tvs (common): buttons
	tvs: Categorical
	tvs: Numeric
	tvs: Condition
	tvs: Cohort + Numeric
	tvs: unbounded range
	tvs: Gene Variant - SNV/indel
	tvs: Gene Variant - CNV - cateogrical
	tvs: Gene Variant - CNV - continuous
	tvs: Gene Variant - Fusion


the direct functional testing of the component, without the use of runpp()

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
	const arg = {
		termdbConfig: {
			selectCohort: {
				term: { id: 'subcohort', type: 'multivalue' },
				prompt: 'To get started with the Clinical Browser, select the survivor population you wish to browse.',
				values: [
					{
						keys: ['ABC'],
						label: 'ABC Lifetime Cohort (ABC)',
						shortLabel: 'ABC',
						isdefault: true
					},
					{
						keys: ['XYZ'],
						label: 'XYZ Cancer Survivor Study (XYZ)',
						shortLabel: 'XYZ'
					},
					{
						keys: ['ABC', 'XYZ'],
						label: 'Combined ABC+XYZ',
						shortLabel: 'ABC+XYZ'
					}
				]
			}
		},
		btn: holder.append('div'),
		btnLabel: 'Filter',
		holder: holder.append('div'),
		debug: true,
		callback: function (filter) {
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
	}

	// use vocabApi if supplied
	if (opts.vocabApi) arg.vocabApi = opts.vocabApi
	else arg.vocab = opts.vocab || { route: 'termdb', genome: 'hg38-test', dslabel: 'TermdbTest' }

	opts.filter = filterInit(arg)

	opts.test = ({ callback, trigger }) => {
		opts.testCallback = callback
		trigger()
	}

	return opts
}

async function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	await vocabApi.getTermdbConfig()
	return vocabApi
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- filter/tvs.integration -***-')
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
						term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical', groupsetting: { disabled: true } },
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
			opts.holder.node().querySelector('.value_btn').innerHTML.split('<')[0],
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
						term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical', groupsetting: { disabled: true } },
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
		test.equal(tipd.selectAll("input[name^='sjpp-input']").size(), 10, 'Should have a checkbox for each value')
		test.equal(
			tipd.selectAll("input[name^='sjpp-input']:checked").size(),
			1,
			'Should have 1 box checked for Wilms tumor'
		)

		//trigger and test addition of new value
		tipd.node().querySelectorAll("input[name^='sjpp-input']")[0].click()

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

tape.skip('tvs: Numeric', async test => {
	test.timeoutAfter(4000)
	// test.plan(16)

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
								0: { label: 'Not exposed', uncomputable: true },
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
			filternode.querySelector('.term_name_btn').querySelector('label').innerHTML.split(' ')[0],
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
		test.equal(
			tipnode.querySelector('input[name="rangeInput"]').value.trim(),
			'1000 < x <= 2000',
			'Should match range with data'
		)
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
				selector: `input[name^='sjpp-input']`,
				count: 3
			})
			selectInputs[0].click()
			const currentRanges = opts.filterData.lst[0].tvs.ranges
			// Option E: test against the data/API, not the UI display such as valueBtn label
			opts.test({
				callback: filter => {
					test.deepEqual(
						filter.lst[0].tvs.ranges.filter(r => 'value' in r && !currentRanges.find(d => d.value === r.value)),
						[{ value: 0, label: 'Not exposed' }],
						'should add an unannotated value to the tvs.ranges'
					)
				},
				trigger() {
					tipnode.querySelectorAll('.sjpp_apply_btn')[1].click()
				}
			})

			// for subsequent tests, hide the uncomputable bin again
			tipnode.querySelector("input[name^='sjpp-input']").click()
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

		const rangeInputs = tipnode.querySelectorAll('input[name="rangeInput"]')
		const range = parseRange(rangeInputs[0].value)
		rangeInputs[1].value = `${range.stop - 400} <= x <= 5000`
		const applybts = tipnode.querySelectorAll('table .sjpp_apply_btn')

		const valueBtn = await detectChildText({
			target: filternode,
			selector: '.value_btn',
			trigger() {
				applybts[1].click()
			}
		})
		test.true(
			valueBtn[0].innerHTML.includes(range.start) && valueBtn[0].innerHTML.includes('5000'),
			'should merge ranges into 1 range'
		)
	}

	//--- test changing to non-inclusive start boundary ---
	{
		pill.click()
		editOpt.click()
		const tr = await detectOne({ target: tipnode, selector: '.range_div' })
		const input = tr.querySelector('input[name="rangeInput"]')
		input.value = 'x > 0'
		input.dispatchEvent(enter_event)
		const valueBtn = await detectChildText({
			target: filternode,
			selector: '.value_btn',
			trigger() {
				tr.querySelector('.sjpp_apply_btn').click()
			}
		})
		// test.true(valueBtn3[0].innerText.includes(`> 0`), 'should show a greater than pill value')
		//Fix for displayed value changing to the lowest value, not '0'
		test.true(valueBtn[0].innerText.includes(`> 900`), 'should show a greater than pill value')
	}

	//********TODO: This test updated but not testing anything???

	// //--- test changing to inclusive start boundary ---
	// {
	// 	pill.click()
	// 	editOpt.click()
	// 	const tr1 = await detectOne({ target: tipnode, selector: 'table .range_div' })

	// 	const valueBtn4 = await detectChildText({
	// 		target: filternode,
	// 		selector: '.value_btn',
	// 		trigger() {
	// 			tr1.querySelector('.sjpp_apply_btn').click()
	// 		}
	// 	})

	// 	test.true(
	// 		/* HTML entity code does not work in this instance (like in the above .sjpp_apply_btn
	// 			test) for some reason. Test fails everytime. */
	// 		// .innerHTML.includes('&ge; 0'),
	// 		valueBtn4[0].innerHTML.includes('≥ 0'),
	// 		'should show a >= 0 in the pill value'
	// 	)
	// }

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

	// --- test common bluepill components ---
	{
		test.equal(
			filternode.querySelectorAll('.term_name_btn')[0].innerHTML,
			opts.filterData.lst[0].tvs.term.name,
			'should label the pill with the correct term name'
		)

		test.equal(
			opts.holder.node().querySelectorAll('.value_btn')[0].innerHTML.split('<')[0],
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
		const body = { term1_q: { bar_by_grade: 1, value_by_max_grade: 1 } }
		const termCat = await opts.filter.Inner.vocabApi.getCategories(opts.filterData.lst[0].tvs.term, '', body)
		test.equal(applyBtn.length, 1, 'Should have 1 button to apply value change')
		test.equal(
			tipd.selectAll("input[name^='sjpp-input']").size(),
			termCat.lst.length,
			'Should have checkbox for each value'
		)
		test.equal(tipd.selectAll("input[name^='sjpp-input']:checked").size(), 1, 'Should have 1 box checked for Grade 0')
	}

	// --- trigger and test grade change ---
	{
		tipd.node().querySelectorAll("input[name^='sjpp-input']")[1].click()

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
		.querySelectorAll("input[name^='sjpp-input']")[1]
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
						type: 'multivalue',
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
			selectElem.property('value', 1).on('change').call(selectElem.node())

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

tape('tvs: Gene Variant - SNV/indel', async test => {
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
							id: 'snvindel_somatic',
							query: 'snvindel',
							name: 'SNV/indel (somatic)',
							parent_id: null,
							isleaf: true,
							type: 'dtsnvindel',
							dt: 1,
							values: {
								M: { label: 'MISSENSE' },
								F: { label: 'FRAMESHIFT' },
								WT: { label: 'Wildtype' }
							},
							name_noOrigin: 'SNV/indel',
							origin: 'somatic',
							parentTerm: {
								kind: 'gene',
								id: 'TP53',
								gene: 'TP53',
								name: 'TP53',
								type: 'geneVariant'
							}
						},
						values: [{ key: 'M', label: 'MISSENSE', value: 'M', bar_width_frac: null }]
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
		test.equal(tipd.selectAll("input[name^='sjpp-input']").size(), 3, 'Should have a checkbox for each value')
		test.equal(tipd.selectAll("input[name^='sjpp-input']:checked").size(), 1, 'Should have 1 box checked')

		//trigger and test addition of new value
		tipd.node().querySelectorAll("input[name^='sjpp-input']")[1].click()

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

tape('tvs: Gene Variant - CNV - categorical', async test => {
	// generating vocabApi here in order to generate
	// a termdbConfig, which is needed for cnv tvs
	const vocabApi = await getVocabApi()
	const opts = getOpts({
		vocabApi,
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'cnv',
							query: 'cnv',
							name: 'CNV',
							parent_id: null,
							isleaf: true,
							type: 'dtcnv',
							dt: 4,
							values: {
								CNV_amp: { label: 'Copy number gain' },
								WT: { label: 'Wildtype' }
							},
							name_noOrigin: 'CNV',
							parentTerm: {
								kind: 'gene',
								id: 'TP53',
								gene: 'TP53',
								name: 'TP53',
								type: 'geneVariant'
							}
						},
						values: [{ key: 'CNV_amp', label: 'Copy number gain', value: 'CNV_amp', bar_width_frac: null }]
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
		test.equal(tipd.selectAll("input[name^='sjpp-input']").size(), 2, 'Should have a checkbox for each value')
		test.equal(tipd.selectAll("input[name^='sjpp-input']:checked").size(), 1, 'Should have 1 box checked')

		//trigger and test addition of new value
		tipd.node().querySelectorAll("input[name^='sjpp-input']")[1].click()

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

tape('tvs: Gene Variant - CNV - continuous', async test => {
	// generating vocabApi here in order to generate
	// a termdbConfig, which is needed for cnv tvs
	const vocabApi = await getVocabApi()
	// set cnv cutoffs
	// presence of these properties signals that cnv data is continuous
	vocabApi.termdbConfig.queries.cnv = {
		cnvMaxLength: 2000000,
		cnvGainCutoff: 0.1,
		cnvLossCutoff: -0.1
	}
	const opts = getOpts({
		vocabApi,
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'cnv',
							query: 'cnv',
							name: 'CNV',
							parent_id: null,
							isleaf: true,
							type: 'dtcnv',
							dt: 4,
							values: {
								CNV_amp: { label: 'Copy number gain' },
								WT: { label: 'Wildtype' }
							},
							name_noOrigin: 'CNV',
							parentTerm: {
								kind: 'gene',
								id: 'TP53',
								gene: 'TP53',
								name: 'TP53',
								type: 'geneVariant'
							}
						},
						values: [],
						cnvGainCutoff: 0.5,
						cnvLossCutoff: -0.5,
						cnvMaxLength: 4000000,
						continuousCnv: true,
						cnvWT: false
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

		let valueBtn = await detectOne({ target: pill, selector: '.value_btn' })
		test.equal(valueBtn.innerText, 'Altered', "Pill value button should be labeled 'Altered'")

		// --- trigger and check tip menu ---
		pill.click()
		editOpt.click()

		const cutoffsInputs = tipd.selectAll("input[type='number']").nodes()
		test.equal(cutoffsInputs.length, 3, 'Should have three numeric inputs')
		test.equal(
			Number(cutoffsInputs[0].value),
			opts.filterData.lst[0].tvs.cnvGainCutoff,
			'Value of first input should be gain cutoff'
		)
		test.equal(
			Number(cutoffsInputs[1].value),
			opts.filterData.lst[0].tvs.cnvLossCutoff,
			'Value of second input should be loss cutoff'
		)
		test.equal(
			Number(cutoffsInputs[2].value),
			opts.filterData.lst[0].tvs.cnvMaxLength,
			'Value of third input should be max length'
		)

		const wildtypeCheckbox = tipd.selectAll("input[type='checkbox']").node()
		test.ok(wildtypeCheckbox, 'Should have a wildtype checkbox')

		const applyBtn = await detectOne({ target: tipd.node(), selector: '.sjpp_apply_btn' })
		test.ok(applyBtn, 'Should have 1 button to apply changes')

		wildtypeCheckbox.click()
		valueBtn = await detectChildText({
			target: pill,
			selector: '.value_btn',
			trigger: () => applyBtn.click()
		})
		test.equal(valueBtn[0].innerText, 'Wildtype', "Pill value should change to 'Wildtype'")
	} catch (e) {
		test.fail('test error: ' + e)
	}
	test.end()
})

tape('tvs: Gene Variant - Fusion', async test => {
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
							id: 'fusion',
							query: 'svfusion',
							name: 'Fusion RNA',
							parent_id: null,
							isleaf: true,
							type: 'dtfusion',
							dt: 2,
							values: {
								Fuserna: { label: 'Fusion transcript' },
								WT: { label: 'Wildtype' }
							},
							name_noOrigin: 'Fusion RNA',
							parentTerm: {
								kind: 'gene',
								id: 'TP53',
								gene: 'TP53',
								name: 'TP53',
								type: 'geneVariant'
							}
						},
						values: [
							{
								key: 'Fuserna',
								label: 'Fusion transcript',
								value: 'Fuserna',
								bar_width_frac: null
							}
						]
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
		test.equal(tipd.selectAll("input[name^='sjpp-input']").size(), 2, 'Should have a checkbox for each value')
		test.equal(tipd.selectAll("input[name^='sjpp-input']:checked").size(), 1, 'Should have 1 box checked')

		//trigger and test addition of new value
		tipd.node().querySelectorAll("input[name^='sjpp-input']")[1].click()

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
