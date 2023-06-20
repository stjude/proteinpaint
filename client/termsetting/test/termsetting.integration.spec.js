const tape = require('tape')
const d3s = require('d3-selection')
const vocabData = require('../../termdb/test/vocabData')
const vocabInit = require('../../termdb/vocabulary').vocabInit
const termjson = require('../../test/testdata/termjson').termjson
const { termsettingInit, termsetting_fill_q } = require('#termsetting')
const {
	sleep,
	detectLst,
	detectOne,
	detectZero,
	detectGte,
	whenGone,
	whenHidden,
	whenVisible,
	testAppInit
} = require('../../test/test.helpers')
/*
Tests:
	menuOptions
	Reuse option
	use_bins_less
	Categorical term
	Numerical term: range boundaries
	Numerical term: fixed bins
	Numerical term: float custom bins
	Numerical term: toggle menu - 4 options
	Numerical term: toggle menu - 2 options
	Numerical term: toggle menu - 1 options
	Numerical term: integer custom bins
	Conditional term
	Custom vocabulary
	noTermPromptOptions
	samplelst term
	geneVariant term

 */

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify termsetting.spec.js -o ../../../public/bin/spec.bundle.js -v

*/

/*************************
 reusable helper functions
**************************/

async function getOpts(_opts = {}, genome = 'hg38-test', dslabel = 'TermdbTest') {
	const holder = d3s
		.select('body')
		.append('div')
		.style('position', 'relative')
		.style('width', 'fit-content')
		.style('margin', '20px')
		.style('padding', '5px')
		.style('border', '1px solid #000')

	const opts = Object.assign({ holder }, _opts)
	const vocab = opts.vocab ? opts.vocab : { route: 'termdb', genome, dslabel }
	const state = {
		vocab,
		termfilter: {},
		reuse: {
			customTermQ: {
				byId: {},
				// non-dictionary terms do not have a term.id,
				// save by term.type + name?
				byName: {}
			}
		}
	}
	const app = Object.assign(_opts.app || {}, {
		getState() {
			return state
		},
		opts: { state }
	})

	opts.app = app
	opts.pill = termsettingInit({
		holder,
		vocab,
		vocabApi: vocabInit({ app, state }),
		use_bins_less: opts.use_bins_less,
		menuOptions: opts.menuOptions,
		disable_ReplaceRemove: opts.disable_ReplaceRemove,
		numericEditMenuVersion: opts.numericEditMenuVersion,
		debug: true,
		callback: function(termsetting) {
			opts.tsData = termsetting
			opts.pill.main(opts.tsData)
		}
	})

	opts.pillMenuClick = async optionLabel => {
		const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
		pilldiv.click()
		await sleep(300)
		const tip = opts.pill.Inner.dom.tip.d.node()
		{
			const editOption = [...tip.querySelectorAll('.sja_menuoption')].filter(o => o.__data__.label === optionLabel)[0]
			editOption.click()
			await sleep(300)
		}
	}

	return opts
}

/**************
 test sections
 **************/

tape('\n', test => {
	test.pass('-***- common/termsetting -***-')
	test.end()
})

tape('menuOptions', async test => {
	test.timeoutAfter(500)
	test.plan(6)

	{
		const message = `should throw on invalid menuOptions`
		try {
			const opts = await getOpts({
				menuOptions: 'xyz',
				tsData: {
					term: termjson['diaggrp'],
					q: { type: 'values' }
				}
			})
			test.fail(message)
		} catch (e) {
			test.pass(message)
		}
	}

	const opts = await getOpts({
		menuOptions: 'all',
		tsData: {
			term: termjson['diaggrp'],
			q: { type: 'values' }
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	test.ok(pilldiv, 'a <div class=ts_pill> is created for the pill')
	pilldiv.click()
	const tipd = opts.pill.Inner.dom.tip.d
	test.equal(tipd.style('display'), 'block', 'tip is shown upon clicking pill')
	test.equal(
		tipd.selectAll('.sja_menuoption').size(),
		4,
		`the menu should show 3 buttons for edit/replace/remove when menuOptions='all'`
	)

	// delete the flag and click pill again to see if hiding menu for replace/remove buttons in tip
	// if pill.opts is frozen in future, just create a new pill
	opts.pill.Inner.opts.menuOptions = 'edit'
	pilldiv.click()
	test.equal(tipd.selectAll('.sja_menuoption').size(), 1, `should show 1 menu options when menuOptions='edit'`)

	opts.pill.Inner.opts.menuOptions = ''
	opts.pill.Inner.validateMenuOptions(opts.pill.Inner.opts)
	pilldiv.click()
	test.equal(
		tipd.selectAll('.sja_menuoption').size(),
		2,
		`should show 2 menu options when menuOptions is empty/undefined`
	)

	opts.pill.Inner.dom.tip.hide()
	test.end()
})

tape('Reuse option', async test => {
	test.timeoutAfter(5000)
	test.plan(11)

	const app = {}
	const opts = await getOpts({
		app,
		menuOptions: 'all',
		tsData: {
			term: termjson['diaggrp'],
			q: { type: 'values' }
		}
	})

	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Reuse')
	const tipd = opts.pill.Inner.dom.tip.d
	const tipn = tipd.node()
	test.equal([...tipn.querySelectorAll('input')].length, 1, 'should have a name input')
	const saveBtns = [...tipn.querySelectorAll('button')].filter(td => td.innerHTML === 'Save')
	test.equal(saveBtns.length, 1, 'should have a save button')
	test.equal(
		[...tipn.querySelectorAll('td')].filter(td => td.innerHTML === 'Default').length,
		1,
		'should have a default setting entry'
	)

	const settingName = 'my setting'
	tipd.select('input').property('value', settingName)
	opts.app.dispatch = action => {
		test.equal(action.type, 'cache_termq', `should dispatch the correct action when saving a setting`)
	}
	saveBtns[0].click()

	opts.app.opts.state.reuse.customTermQ.byId['diaggrp'] = { 'Setting #1': opts.tsData.q }
	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Reuse')
	test.equal(
		tipn.querySelectorAll('tr').length,
		2,
		'should have 2 previously saved settings after clicking the save button'
	)
	test.equal(
		[...tipn.querySelectorAll('td')].filter(td => td.innerHTML === settingName).length,
		1,
		'should list the newly saved setting'
	)
	const defaultRow = [...tipn.querySelectorAll('tr')].filter(tr => tr.firstChild.innerHTML === 'Default')[0]
	test.equal(
		[...defaultRow.querySelectorAll('button')].filter(btn => btn.innerHTML === 'Delete').length,
		0,
		'should not have a delete button for the default setting'
	)

	await sleep(100)
	opts.tsData = {
		term: termjson['agedx'],
		q: {
			reuseId: `Setting #1`,
			type: 'custom-bin',
			mode: 'discrete',
			lst: [
				{
					label: '<5',
					startunbounded: true,
					stop: 5,
					startinclusive: true
				},
				{
					label: '≥5',
					start: 5,
					startinclusive: true,
					stopunbounded: true
				}
			]
		}
	}

	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Reuse')
	opts.app.dispatch = action => {
		if (action.type != 'cache_termq') test.fail(`should dispatch action.type='cache_termq'`)
		opts.app.opts.state.reuse.customTermQ.byId['agedx'] = {
			[action.q.reuseId]: action.q
		}
	}

	{
		const saveBtns = [...tipn.querySelectorAll('button')].filter(td => td.innerHTML === 'Save')
		saveBtns[0].click()
	}
	await sleep(100)
	test.equal(
		opts.holder.node().querySelector('.ts_summary_btn')?.innerHTML,
		opts.tsData.q.reuseId,
		`should display an active reuseId as pill status`
	)

	await opts.pillMenuClick('Edit')
	/*Fix. First div within the button should be text since 
	the border is on the bottom.*/
	test.equal(
		tipn.querySelector('.sjpp-active > div').innerHTML,
		`Varying bin sizes`,
		`should open the numeric edit menu to the correct tab of the reused q.mode`
	)

	await opts.pillMenuClick('Reuse')
	const inUseTd = [...tipn.querySelectorAll('td')].filter(td => td.innerHTML.startsWith('In use'))[0]
	test.equal(
		inUseTd?.parentNode.__data__.reuseId,
		opts.tsData.q.reuseId,
		`should show an 'In use' status for a non-default, active q.reuseId`
	)
	{
		const useBtn = [...tipn.querySelectorAll('button')].filter(td => td.innerHTML === 'Use')
		useBtn[0].click()
		await opts.pillMenuClick('Reuse')
		const inUseTd = [...tipn.querySelectorAll('td')].filter(td => td.innerHTML.startsWith('In use'))[0]
		test.equal(
			inUseTd?.parentNode.__data__.reuseId,
			'Default',
			`should show an 'In use' status for a non-default, active q.reuseId`
		)
	}

	opts.pill.Inner.dom.tip.hide()
	test.end()
})

tape('use_bins_less', async test => {
	const opts = await getOpts({
		use_bins_less: true,
		tsData: {
			term: termjson.agedx,
			q: termjson.agedx.bins.less
		}
	})

	await opts.pill.main(opts.tsData)

	await opts.pillMenuClick('Edit')

	const tip = opts.pill.Inner.dom.tip.d.node()
	const bin_size_input = tip.querySelectorAll('tr')[0].querySelectorAll('input')[0]
	test.equal(bin_size_input.value, '5', 'has term.bins.less.bin_size as value (is 5 not 3)')
	test.end()
})

tape('Categorical term', async test => {
	const opts = await getOpts({
		tsData: {
			q: {
				type: 'values'
			},
			term: termjson['diaggrp']
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()
	const tip = opts.pill.Inner.dom.tip

	//check menu buttons on first menu
	test.equal(tip.d.selectAll('.sja_menuoption.sja_sharp_border').size(), 2, 'Should have 2 buttons for group config')
	// test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
	// test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')

	// check menu buttons on category menu
	tip.d.selectAll('.sja_menuoption.sja_sharp_border')._groups[0][0].click()
	test.equal(
		tip.d.selectAll('.sj-drag-item').size(),
		Object.keys(opts.tsData.term.values).length,
		'Should have rows for each category'
	)
	test.equal(tip.d.selectAll('.sjpp_apply_btn').size(), 1, 'Should have "Apply" button to apply group changes')
	test.equal(
		tip.d.selectAll('.group_edit_div > label').html(),
		'Number of groups',
		'Should have "Number of groups" as dropdown label'
	)
	test.equal(tip.d.selectAll('.group_edit_div > select').size(), 1, 'Should have dropdown for group count change')

	test.equal(
		tip.d.selectAll('.sj-drag-item')._groups[0][0].innerText,
		'Acute lymphoblastic leukemia (n=44)',
		'Should have first cateogry as "ALL"'
	)

	//Test drag functionality
	const grpInputs = await detectLst({ elem: tip.d.node(), selector: '.group_edit_div > input', count: 2 })

	//Change group names
	grpInputs[0].value = 'Group 1'
	grpInputs[0].dispatchEvent(new KeyboardEvent('keyup'))
	grpInputs[1].value = 'Group 2'
	grpInputs[1].dispatchEvent(new KeyboardEvent('keyup'))

	test.notEqual(grpInputs[0].defaultValue, grpInputs[0].value, `Should display new 'Group 1' title`)
	test.notEqual(grpInputs[1].defaultValue, grpInputs[1].value, `Should display new 'Group 2' title`)

	const dragDivs = tip.d.selectAll('.sjpp-drag-drop-div').nodes()
	const dragItems = tip.d.selectAll('.sj-drag-item').nodes()

	//First item in list
	dragItems[0].dispatchEvent(new Event('dragstart'))

	//Second drag div
	dragDivs[1].dispatchEvent(new Event('drop'))
	dragItems[0].dispatchEvent(new Event('dragend'))

	test.equal(
		dragDivs[1].childNodes[2].childNodes[0].innerHTML,
		dragItems[0].innerHTML,
		`Should display the first item ('${dragItems[0].innerHTML}') as dragged to second group`
	)
	test.equal(dragDivs[1].childNodes.length, 3, `Should display only one item in second group`)

	test.end()
})

tape('Numerical term: range boundaries', async test => {
	test.timeoutAfter(3000)
	test.plan(5)

	const opts = await getOpts({
		tsData: {
			term: termjson['agedx'],
			q: termjson['agedx'].bins.default
		}
	})

	await opts.pill.main(opts.tsData)

	// create enter event to use for inputs of bin edit menu
	const enter_event = new KeyboardEvent('keyup', {
		code: 'Enter',
		key: 'Enter',
		keyCode: 13
	})

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	await opts.pillMenuClick('Edit')

	const tip = opts.pill.Inner.dom.tip.d.node()
	test.equal(tip.querySelectorAll('select').length, 1, 'Should have a select dropdown')
	test.equal(
		tip.querySelector('select').previousSibling.innerHTML.toLowerCase(),
		'boundary inclusion',
		'Should label the select dropdown as Boundary Inclusion'
	)
	test.equal(tip.querySelector('select').querySelectorAll('option').length, 2, 'Should have 2 select options')

	await sleep(50)
	const select1 = tip.querySelector('select')
	const option1 = select1.querySelectorAll('option')[1]
	select1.value = option1.value
	select1.dispatchEvent(new Event('change'))
	await sleep(50)
	const q1 = opts.pill.Inner.numqByTermIdModeType.agedx.discrete['regular-bin']
	test.equal(!q1.stopinclusive && q1.startinclusive, true, 'should set the range boundary to start inclusive')

	const select0 = tip.querySelector('select')
	const option0 = select0.querySelectorAll('option')[0]
	select0.value = option0.value
	select0.dispatchEvent(new Event('change'))
	await sleep(50)
	const q0 = opts.pill.Inner.numqByTermIdModeType.agedx.discrete['regular-bin']
	test.equal(q0.stopinclusive && !q0.startinclusive, true, 'should set the range boundary to stop inclusive')
	opts.pill.Inner.dom.tip.hide()
})

tape('Numerical term: fixed bins', async test => {
	test.timeoutAfter(3000)
	test.plan(9)

	const opts = await getOpts({
		tsData: {
			term: termjson['agedx'],
			q: termjson['agedx'].bins.default
		}
	})

	await opts.pill.main(opts.tsData)

	// create enter event to use for inputs of bin edit menu
	const enter_event = new KeyboardEvent('keyup', {
		code: 'Enter',
		key: 'Enter',
		keyCode: 13
	})

	await opts.pillMenuClick('Edit')
	const tip = opts.pill.Inner.dom.tip

	const lines = tip.d
		.select('.binsize_g')
		.node()
		.querySelectorAll('line')
	test.equal(lines.length, 8, 'should have 8 lines')
	// first line should be draggable
	// other lines should not be draggable if there is no q.last_bin

	// test numeric bin menu
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][0].innerText,
		'Bin Size',
		'Should have section for "bin size" edit'
	)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][0].innerText,
		'First Bin Stop',
		'Should have section for "First bin" edit'
	)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('td')._groups[0][0].innerText,
		'Last Bin Start',
		'Should have section for "Last bin" edit'
	)

	//trigger and test bin_size change
	const bin_size_input = d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('input')._groups[0][0]
	bin_size_input.value = 5

	//trigger 'change' to update bins
	bin_size_input.dispatchEvent(new Event('change'))

	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('input')._groups[0][0].value,
		'5',
		'Should change "bin size" from input'
	)

	//trigger and test first_bin_change
	const first_bin_input = d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('input')._groups[0][0]
	first_bin_input.value = 7

	//trigger 'change' to update bins
	first_bin_input.dispatchEvent(new Event('change'))

	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('input')._groups[0][0].value,
		'7',
		'Should change "first bin" from input'
	)

	//trigger and test last_bin change
	const last_bin_custom_radio = tip.d
		.node()
		.querySelectorAll('tr')[2]
		.querySelectorAll('div')[0]
		.querySelectorAll('input')[1]
	d3s.select(last_bin_custom_radio).property('checked', true)
	last_bin_custom_radio.dispatchEvent(new Event('change'))

	const last_bin_input = tip.d
		.node()
		.querySelectorAll('tr')[2]
		.querySelectorAll('div')[1]
		.querySelectorAll('input')[0]

	last_bin_input.value = 20

	//trigger 'change' to update bins
	last_bin_input.dispatchEvent(new Event('change'))

	test.equal(
		tip.d
			.node()
			.querySelectorAll('tr')[2]
			.querySelectorAll('div')[1]
			.querySelectorAll('input')[0].value,
		'20',
		'Should change "last bin" from input'
	)

	// test 'apply' button
	const apply_btn = tip.d
		.selectAll('button')
		.nodes()
		.find(b => b.innerHTML == 'Apply')
	apply_btn.click()
	await opts.pillMenuClick('Edit')

	test.equal(
		tip.d
			.node()
			.querySelectorAll('tr')[0]
			.querySelectorAll('input')[0].value,
		'5',
		'Should apply the change by "Apply" button'
	)

	// test 'reset' button
	const reset_btn = tip.d
		.selectAll('button')
		.nodes()
		.find(b => b.innerHTML == 'Reset')
	reset_btn.click()
	await sleep(100)
	apply_btn.click()
	await sleep(100)
	await opts.pillMenuClick('Edit')
	test.equal(
		tip.d
			.node()
			.querySelectorAll('tr')[0]
			.querySelectorAll('input')[0].value,
		'3',
		'Should reset the bins by "Reset" button'
	)

	/*** 
		TODO: FIX THIS UNRELIABLE TEST using 
		a termsetting.density component unit testing

		Because this test is triggered via the termdb app,
		and is not a component specific test, capturing the
		error is very difficult even with try-catch or window.onerror
		event listener, since the event handler may be buried in layers
		of nested function calls. Must use unit testing instead.
	***/
	/*const firstBinStopInput = d3s
		.select(tip.d.selectAll('tr')._groups[0][1])
		.selectAll('td')
		._groups[0][1].querySelector('input')
	d3s.select(firstBinStopInput).property('value', opts.pill.Inner.num_obj.density_data.maxvalue + 5)
	const firstBinStopMessage = 'UNRELIABLE TEST!!! should handle first_bin.stop > density_data.maxvalue'
	function detectFirstBinStopError(err) {
		console.log(468, err)
		if (err.includes(`Cannot read property 'scaledX' of undefined`)) {
			test.fail(firstBinStopMessage + ': ' + err)
		}
	}
	window.addEventListener('error.firstBinStopTest', detectFirstBinStopError)
	firstBinStopInput.dispatchEvent(new Event('change'))
	await sleep(500)
	window.removeEventListener('error.firstBinStopTest', detectFirstBinStopError)
	test.pass(firstBinStopMessage)*/
	tip.hide()
})

tape('Numerical term: float custom bins', async test => {
	test.timeoutAfter(3000)
	test.plan(1)

	const opts = await getOpts({
		tsData: {
			term: termjson['agedx'],
			q: {
				type: 'custom-bin',
				lst: [
					{
						startunbounded: true,
						startinclusive: false,
						stopinclusive: true,
						stop: 5,
						label: '<=5 years old'
					},
					{
						startinclusive: false,
						stopinclusive: true,
						start: 5,
						stop: 12,
						label: '5 to 12 years old'
					},
					{
						stopunbounded: true,
						startinclusive: false,
						stopinclusive: true,
						start: 12,
						label: '> 12 years old'
					}
				]
			}
		}
	})

	await opts.pill.main(opts.tsData)

	// create enter event to use for inputs of bin edit menu
	const enter_event = new KeyboardEvent('keyup', {
		code: 'Enter',
		key: 'Enter',
		keyCode: 13
	})

	await opts.pillMenuClick('Edit')
	const tip = opts.pill.Inner.dom.tip
	const lines = tip.d
		.select('.binsize_g')
		.node()
		.querySelectorAll('line')
	test.equal(lines.length, 2, 'should have 2 lines')
	tip.hide()
})

tape('Numerical term: toggle menu - 4 options', async test => {
	test.timeoutAfter(3000)
	test.plan(9)

	const opts = await getOpts({
		numericEditMenuVersion: ['continuous', 'discrete', 'spline', 'binary'],
		tsData: {
			term: termjson['agedx']
		}
	})
	opts.tsData.q = termjson['agedx'].bins.less

	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Edit')

	const tip = opts.pill.Inner.dom.tip
	const toggleButtons = tip.d.node().querySelectorAll('.sj-toggle-button')

	test.equal(toggleButtons.length, 4, 'Should have 4 toggle buttons for nuermic edit menu')

	test.equal(toggleButtons[0].innerText, 'Continuous', 'Should have title for first tab as Continuous')

	test.equal(
		tip.d
			.node()
			.querySelector('select')
			.querySelectorAll('option')[0].innerText,
		'No Scaling',
		'Should have rendered UI for Continuous menu'
	)

	toggleButtons[1].click()
	await sleep(300)

	test.equal(toggleButtons[1].innerText, 'Discrete', 'Should have title for 2nd tab as Discrete')

	test.equal(
		tip.d
			.node()
			.querySelector('tr')
			.querySelector('td').innerText,
		'Bin Size',
		'Should have rendered UI for Discrete menu'
	)

	toggleButtons[2].click()
	await sleep(300)

	test.equal(toggleButtons[2].innerText, 'Cubic spline', 'Should have title for 3nd tab as Cubic spline')

	test.equal(
		tip.d
			.node()
			.querySelector('textarea')
			.value.split('\n').length,
		parseInt(tip.d.node().querySelectorAll('select')[2].value),
		'Should have rendered UI for Continuous menu'
	)

	toggleButtons[3].click()
	await sleep(300)

	test.equal(toggleButtons[3].innerText, 'Binary', 'Should have title for 4nd tab as Binary')

	const binary_lines = tip.d
		.node()
		.querySelectorAll('.binsize_g')[2]
		.querySelectorAll('line')
	test.equal(binary_lines.length, 1, 'Should have rendered UI for Binary menu')
	tip.hide()
})

tape('Numerical term: toggle menu - 2 options', async test => {
	test.timeoutAfter(3000)
	test.plan(1)

	const opts = await getOpts({
		numericEditMenuVersion: ['continuous', 'discrete'],
		tsData: {
			term: termjson['agedx']
		}
	})

	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Edit')
	const tip = opts.pill.Inner.dom.tip
	test.equal(
		tip.d.node().querySelectorAll('.sj-toggle-button').length,
		2,
		'Should have 2 toggle buttons for nuermic edit menu'
	)
	tip.hide()
})

tape('Numerical term: toggle menu - 1 option', async test => {
	test.timeoutAfter(3000)
	test.plan(1)

	const opts = await getOpts({
		numericEditMenuVersion: ['continuous'],
		tsData: {
			term: termjson['agedx']
		}
	})

	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Edit')
	const tip = opts.pill.Inner.dom.tip
	test.equal(
		tip.d.node().querySelectorAll('.sj-toggle-button').length,
		0,
		'Should not have any toggle buttons for nuermic edit menu'
	)
	tip.hide()
})

tape('Numerical term: integer custom bins', async test => {
	test.timeoutAfter(3000)
	test.plan(3)

	const opts = await getOpts({
		tsData: {
			term: termjson['agedx'],
			q: {
				type: 'custom-bin',
				lst: [
					{
						startunbounded: true,
						startinclusive: false,
						stopinclusive: true,
						stop: 3,
						label: '<=3'
					},
					{
						startinclusive: false,
						stopinclusive: true,
						start: 3,
						stop: 6,
						label: '4 to 6'
					},
					{
						stopunbounded: true,
						startinclusive: false,
						stopinclusive: true,
						start: 6,
						label: '>6'
					}
				],
				results: {
					summary: {
						min: 3,
						max: 15
					}
				}
			}
		}
	})

	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Edit')

	await sleep(300)
	const tip = opts.pill.Inner.dom.tip
	const lines = tip.d
		.select('.binsize_g')
		.node()
		.querySelectorAll('line')
	test.equal(lines.length, 2, 'should have 2 lines')
	const tickTexts = tip.d
		.select('svg')
		.selectAll('.tick')
		.selectAll('text')
	test.equal(
		tickTexts
			.filter(function() {
				return this.innerHTML.includes('.')
			})
			.size(),
		0,
		'should not have dots in the x-axis tick labels'
	)
	test.equal(
		tickTexts
			.filter(function() {
				return this.innerHTML.includes(',')
			})
			.size(),
		0,
		'should not have commas in the x-axis tick labels'
	)
	tip.hide()
})

tape('Conditional term', async test => {
	const opts = await getOpts({
		tsData: {
			term: {
				id: 'Arrhythmias',
				name: 'Arrhythmias',
				type: 'condition',
				values: {
					0: { label: '0: No condition' },
					1: { label: '1: Mild' },
					2: { label: '2: Moderate' },
					3: { label: '3: Severe' },
					4: { label: '4: Life-threatening' },
					5: { label: '5: Death' },
					9: { label: 'Unknown status', uncomputable: true }
				},
				subconditions: {
					'Atrioventricular heart block': { label: 'Atrioventricular heart block' },
					'Conduction abnormalities': { label: 'Conduction abnormalities' },
					'Prolonged QT interval': { label: 'Prolonged QT interval' },
					'Cardiac dysrhythmia': { label: 'Cardiac dysrhythmia' },
					'Sinus bradycardia': { label: 'Sinus bradycardia' },
					'Sinus tachycardia': { label: 'Sinus tachycardia' }
				},
				groupsetting: {
					useIndex: -1,
					lst: [
						{
							name: 'Any condition vs normal',
							is_grade: true,
							groups: [
								{
									name: 'No condition',
									values: [{ key: '0', label: 'No condition' }]
								},
								{
									name: 'Has condition',
									values: [
										{ key: '1', label: '1: Mild' },
										{ key: '2', label: '2: Moderate' },
										{ key: '3', label: '3: Severe' },
										{ key: '4', label: '4: Life-threatening' },
										{ key: '5', label: '5: Death' }
									]
								}
							]
						}
					]
				}
			},
			q: {
				mode: 'discrete',
				breaks: [],
				value_by_max_grade: true,
				groupsetting: { inuse: false }
			}
		}
	})

	await opts.pill.main(opts.tsData)
	await opts.pillMenuClick('Edit')
	const tip = opts.pill.Inner.dom.tip

	//check menu buttons on first menu
	test.equal(tip.d.selectAll('select').size(), 1, 'Should have 1 dropdown to change grade setting')

	// select 'Most recent grade'
	tip.d.select('select')._groups[0][0].selectedIndex = 1
	tip.d.select('select')._groups[0][0].dispatchEvent(new Event('change'))
	await sleep(50)
	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'Most Recent Grade',
		'Should have bluepill summary btn changed to "By Most Recent Grade"'
	)

	// select 'Any condition vs normal'
	await opts.pillMenuClick('Edit')
	tip.d.select('select')._groups[0][0].selectedIndex = 2
	tip.d.select('select')._groups[0][0].dispatchEvent(new Event('change'))
	await sleep(50)
	// check tvspill and group menu
	// **** q.groupsetting does not contain predefined_groupset_idx
	// const groupset_idx = opts.pill.Inner.q.groupsetting.predefined_groupset_idx
	// const groupset = opts.tsData.term.groupsetting.lst[groupset_idx]

	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'Any Grade',
		'Should have bluepill summary btn changed to "Any Grade"'
	)

	// change to subcondition
	tip.d.selectAll('select')._groups[0][0].selectedIndex = 3
	tip.d.selectAll('select')._groups[0][0].dispatchEvent(new Event('change'))
	await sleep(50)
	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'Sub-condition',
		'Should have bluepill summary btn changed to "Sub-condition"'
	)

	// pilldiv.click()
	// test.equal(tip.d.selectAll('select')._groups[0][0].selectedIndex, 1, 'Should have "Most recent" option selected')
	// test.equal(
	// 	d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][0].innerText,
	// 	groupset.groups[0].name + ':',
	// 	'Should have group 1 name same as predefined group1 name'
	// )
	// test.equal(
	// 	d3s
	// 		.select(d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][1])
	// 		.selectAll('div')
	// 		.size(),
	// 	groupset.groups[0].values.length,
	// 	'Should have same number of grades to group as predefined group1'
	// )
	// test.equal(
	// 	d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][0].innerText,
	// 	groupset.groups[1].name + ':',
	// 	'Should have group 2 name same as predefined group2 name'
	// )
	// test.equal(
	// 	d3s
	// 		.select(d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][1])
	// 		.selectAll('div')
	// 		.size(),
	// 	groupset.groups[1].values.length,
	// 	'Should have same number of grades to group as predefined group2'
	// )
	// test.true(
	// 	tip.d.selectAll('.group_btn')._groups[0][1].innerText.includes('Use'),
	// 	'Should have "default" group button be inactive'
	// )

	// //TODO: detect draggable divs and change groupset by dragging divs

	// // devide into 2 groups
	// pilldiv.click()
	// tip.d.selectAll('.group_btn')._groups[0][2].click()
	// tip.d.selectAll('input')._groups[0][1].innerText = '1'
	// tip.d
	// 	.selectAll('.sjpp_apply_btn')
	// 	.node()
	// 	.click()
	// await sleep(50)
	// test.equal(
	// 	opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
	// 	'2 groups of grades',
	// 	'Should have blue pill summary changed by group change'
	// )

	// pilldiv.click()
	// tip.d.selectAll('select')._groups[0][0].selectedIndex = 0
	// tip.d.selectAll('select')._groups[0][0].dispatchEvent(new Event('change'))
	// tip.d.selectAll('.group_btn')._groups[0][1].click()
	// await sleep(50)

	// test.equal(
	// 	opts.holder.selectAll('.term_name_btn')._groups[0][0].innerText,
	// 	opts.tsData.term.name,
	// 	'Should have 1 pill for overlay term'
	// )
	// test.equal(
	// 	opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
	// 	'Max. Grade',
	// 	'Should have bluepill summary btn "By Max Grade" as default'
	// )

	// tip.hide()
	test.end()
})

tape('Custom vocabulary', async test => {
	test.timeoutAfter(5000)
	test.plan(6)
	const vocab = vocabData.getExample()
	const opts = await getOpts(
		{
			menuOptions: 'all',
			tsData: {
				term: vocab.terms.find(d => d.id === 'c'),
				disable_terms: ['c'],
				q: { type: 'values' } // assumes the test term 'c' is a categorical term
			},
			vocab
		},
		null,
		null
	)

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	test.ok(pilldiv, 'a <div class=ts_pill> is created for the pill')
	pilldiv.click()
	const tipd = opts.pill.Inner.dom.tip.d
	test.equal(tipd.style('display'), 'block', 'tip is shown upon clicking pill')
	test.equal(tipd.selectAll('.sja_menuoption').size(), 4, 'the menu should show 4 buttons for edit/replace/remove')

	const replaceBtn = tipd
		.selectAll('.sja_menuoption')
		.filter(function() {
			return this.innerText.toLowerCase() == 'replace'
		})
		.node()
	test.equal(replaceBtn instanceof HTMLElement, true, 'should have a Replace menu option')

	replaceBtn.click()
	const termDivs = await detectLst({ target: tipd.node(), selector: '.termdiv', matchAs: '>=' })
	test.equal(
		termDivs.length,
		vocab.terms.filter(d => d.parent_id === null).length,
		'should display the correct number of custom root terms'
	)

	tipd
		.selectAll('.termbtn')
		.filter(d => d.id === 'a')
		.node()
		.click()

	const clickTerm = await detectGte({ target: tipd.node(), selector: '.sja_tree_click_term', count: 2 })
	clickTerm.find(d => d.__data__.id === 'd').click()
	await whenGone({
		target: tipd.node(),
		selector: '.sja_menu_div'
	})

	await sleep(1000)
	const pilldiv1 = opts.holder.node().querySelector('.term_name_btn ')
	test.equal(
		pilldiv1.innerText,
		'DDD',
		`should change the termsetting pill label to '${vocab.terms.find(d => d.id === 'd').name}'`
	)

	opts.pill.Inner.dom.tip.hide()
	test.end()
})

tape('noTermPromptOptions', async test => {
	test.timeoutAfter(1000)

	let opts, message
	const testText = 'Custom Label'

	//Test menu with custom label appears
	opts = await getOpts({
		tsData: {
			q: {
				type: 'values'
			},
			noTermPromptOptions: [{ isDictionary: true, text: testText }]
		}
	})

	await opts.pill.main(opts.tsData)

	const pill = opts.pill.Inner
	pill.dom.nopilldiv.node().click()

	test.equal(pill.dom.tip.dnode.innerText, testText, `Should display label = ${testText}`)

	pill.dom.tip.dnode.querySelector('.sja_menuoption').click()
	const termBtns = await detectGte({ elem: pill.dom.tip.dnode, selector: '.termbtn' })
	test.ok(termBtns.length > 0, `Should display the dictionary term tree`)

	//Tests for missing arguments
	message = 'Should throw for missing .noTermPromptOptions array'
	try {
		opts = await getOpts({
			tsData: {
				q: {
					type: 'values'
				},
				noTermPromptOptions: {}
			}
		})
		await opts.pill.main(opts.tsData)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = 'Should throw for missing .noTermPromptOptions[0].text'
	try {
		opts = await getOpts({
			tsData: {
				q: {
					type: 'values'
				},
				noTermPromptOptions: [{ isDictionary: true }]
			}
		})
		await opts.pill.main(opts.tsData)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = 'Should throw for missing isDictionary and .termtype'
	try {
		opts = await getOpts({
			tsData: {
				q: {
					type: 'values'
				},
				noTermPromptOptions: [{ text: testText }]
			}
		})
		await opts.pill.main(opts.tsData)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = 'Should throw for missing .q{}'
	try {
		opts = await getOpts({
			tsData: {
				q: 'fake',
				noTermPromptOptions: [{ isDictionary: true, text: testText }]
			}
		})
		await opts.pill.main(opts.tsData)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

tape('samplelst term', async test => {
	test.timeoutAfter(1000)

	const opts = await getOpts({
		tsData: {
			term: {
				name: 'Custom Label',
				type: 'samplelst',
				values: {
					'Group 1': {
						key: 'Group 1',
						label: 'Test 1',
						inuse: true,
						list: [{ sampleId: 1, sample: 1 }, { sampleId: 2, sample: 2 }]
					},
					'Group 2': {
						key: 'Group 2',
						label: 'Test 2',
						inuse: false,
						list: [{ sampleId: 3, sample: 3 }, { sampleId: 4, sample: 4 }, { sampleId: 5, sample: 5 }]
					},
					'Group 3': { key: 'Group 3', label: 'Test 3', inuse: false, list: [{ sampleId: 6, sample: 6 }] }
				}
			},
			q: {
				mode: 'custom-groupsetting',
				groups: [
					{
						name: 'Group 1',
						in: true,
						values: [{ sampleId: 1, sample: 1 }, { sampleId: 2, sample: 2 }]
					},
					{
						name: 'Group 2',
						in: false,
						values: [{ sampleId: 3, sample: 3 }, { sampleId: 4, sample: 4 }, { sampleId: 5, sample: 5 }]
					},
					{
						name: 'Group 3',
						in: false,
						values: [{ sampleId: 6, sample: 6 }]
					}
				]
			}
		}
	})

	//Open group selection menu
	await opts.pill.main(opts.tsData)
	const pill = opts.pill.Inner
	const pillDiv = pill.dom.pilldiv.node().querySelector('.ts_pill')
	test.equal(pillDiv.innerText, opts.tsData.term.name, `Should display custom name for button label`)
	pillDiv.click()
	await opts.pillMenuClick('Edit')

	//Test if dom elements display properly
	const tip = pill.dom.tip.dnode
	const groupDivs = tip.childNodes
	test.equal(
		groupDivs.length - 1,
		Object.keys(opts.tsData.term.values).length,
		`Should show checkbox selection for each group`
	)

	let index = 0
	const missingSamples = []
	for (const [i, child] of groupDivs.entries()) {
		if (i === groupDivs.length - 1) continue //Ignore div for apply button

		//Test the rows displaying properly
		const sampleSelect = child.querySelectorAll('.sjpp_table_item')
		test.equal(
			sampleSelect.length - 1,
			opts.tsData.q.groups[index].values.length,
			`Should display ${opts.tsData.q.groups[index].values.length} row(s) for ${opts.tsData.q.groups[index].name}`
		)

		for (const [i, row] of sampleSelect.entries()) {
			if (i === 0) {
				test.equal(
					row.innerText,
					'Check/Uncheck All',
					`Should display 'Check/Uncheck All' for ${opts.tsData.q.groups[index].name}`
				)
			} else {
				const findSample = opts.tsData.q.groups[index].values.find(r => r.sample == row.innerText)
				if (!findSample) missingSamples.push(`sample: ${row.innerText}, group: ${opts.tsData.q.groups[index].name}`)
			}
		}
		++index
	}
	//Test all samples properly appear in table
	if (missingSamples.length == 0) test.pass(`Should display all sample values for all groups`)
	else test.fail(`Missing the following samples from group table = ${missingSamples}`)

	test.end()
})

tape.skip('geneVariant term', async test => {
	test.timeoutAfter(1000)

	//On hold. A geneVariant term is not in TermdbTest

	test.end()
})
