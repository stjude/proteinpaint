const tape = require('tape')
const d3s = require('d3-selection')
const termsettingInit = require('../termsetting').termsettingInit

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify termsetting.spec.js -o ../../../public/bin/spec.bundle.js -v

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
		.style('padding', '5px')
		.style('border', '1px solid #000')

	const opts = Object.assign({ holder }, _opts)

	opts.pill = termsettingInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		use_bins_less: opts.use_bins_less,
		disable_ReplaceRemove: opts.disable_ReplaceRemove,
		debug: true,
		callback: function(termsetting) {
			opts.tsData = termsetting
			opts.pill.main(opts.tsData)
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
	test.pass('-***- common/termsetting -***-')
	test.end()
})

tape.skip('menu', test => {})

tape.skip('disable_ReplaceRemove', async test => {
	const opts = getOpts({
		disable_ReplaceRemove: true,
		tsData: {
			term: {
				id: 'dummy',
				name: 'disable_ReplaceRemove',
				type: 'categorical',
				values: {
					cat1: { label: 'Cat 1' }
				}
			}
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	test.ok(pilldiv, 'a <div class=ts_pill> is created for the pill')
	pilldiv.click()
	const tipd = opts.pill.Inner.dom.tip.d
	test.equal(tipd.style('display'), 'block', 'tip is shown upon clicking pill')
	test.equal(
		tipd.node().childNodes[1].childNodes.length,
		0,
		'the second row of tip does not contain replace/remove buttons'
	)

	// delete the flag and click pill again to see if showing replace/remove buttons in tip
	// if pill.opts is frozen in future, just create a new pill
	delete opts.pill.Inner.opts.disable_ReplaceRemove
	pilldiv.click()
	test.equal(
		tipd.node().childNodes[1].childNodes.length,
		2,
		'the second row of tip now contains replace/remove buttons after deleting opts.disable_ReplaceRemove'
	)

	opts.pill.Inner.dom.tip.hide()
	test.end()
})

tape.skip('use_bins_less', async test => {
	const opts = getOpts({
		use_bins_less: true,
		tsData: {
			term: {
				id: 'dummy',
				name: 'use_bins_less',
				type: 'float',
				bins: {
					less: { bin_size: 10, first_bin: { start: 0 } },
					default: { bin_size: 1, first_bin: { start: 0 } }
				}
			}
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()
	await sleep(300)

	const tip = opts.pill.Inner.dom.tip.d.node()
	const bin_size_input = tip.querySelectorAll('input')[0]

	test.equal(bin_size_input.value, '10', 'has term.bins.less.bin_size as value')

	delete opts.pill.Inner.opts.use_bins_less
	//TODO: need to tweak timeout, UI reflects true value
	pilldiv.click()
	await sleep(300)
	const bin_size_input2 = tip.querySelectorAll('input')[0]
	test.equal(bin_size_input2.value, '1', 'has term.bins.default.bin_size as value')
	opts.pill.Inner.dom.tip.hide()
	test.end()
})

tape('Caterogical term', async test => {
	const opts = getOpts({
		tsData: {
			term: {
				id: 'diaggrp',
				name: 'Diagnosis Group',
				type: 'categorical',
				isleaf: true,
				graph: {
					barchart: {
						categorical: {}
					}
				},
				values: {
					'Acute lymphoblastic leukemia': { label: 'Acute lymphoblastic leukemia' },
					'Acute myeloid leukemia': { label: 'Acute myeloid leukemia' },
					'Blood disorder': { label: 'Blood disorder' },
					'Central nervous system (CNS)': { label: 'Central nervous system (CNS)' },
					'Wilms tumor': { label: 'Wilms tumor' }
				}
			}
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()
	const tip = opts.pill.Inner.dom.tip

	//check menu buttons on first menu
	test.equal(tip.d.selectAll('.group_btn').size(), 2, 'Should have 2 buttons for group config')
	// test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
	// test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')

	// check menu buttons on category menu
	tip.d.selectAll('.group_btn')._groups[0][1].click()
	test.equal(
		tip.d.selectAll('tr').size(),
		Object.keys(opts.tsData.term.values).length + 1,
		'Should have rows for each caterory'
	)
	test.equal(tip.d.selectAll('.apply_btn').size(), 1, 'Should have "Apply" button to apply group changes')
	test.equal(
		tip.d
			.selectAll('.group_edit_div')
			.selectAll('label')
			.html(),
		'#groups',
		'Should have "Groups" as first column group'
	)
	test.equal(
		tip.d
			.selectAll('.group_edit_div')
			.selectAll('select')
			.size(),
		1,
		'Should have dropdown for group count change'
	)
	test.true(
		d3s
			.select(tip.d.selectAll('tr')._groups[0][1])
			.selectAll('input')
			.size() >= 3,
		'Should have 3 or more radio buttons for first category'
	)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][4].innerText,
		'Acute lymphoblastic leukemia',
		'Should have first cateogry as "ALL"'
	)

	//devide categories to the groups
	d3s
		.select(tip.d.selectAll('tr')._groups[0][1])
		.selectAll('input')
		._groups[0][2].click()
	tip.d
		.selectAll('.apply_btn')
		.node()
		.click()

	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'Divided into 2 groups',
		'Should have blue pill changed from group select'
	)

	test.end()
})

tape.only('Numerical term', async test => {
	const opts = getOpts({
		tsData: {
			term: {
				id: 'agedx',
				name: 'Age at Cancer Diagnosis',
				unit: 'Years',
				type: 'float',
				bins: {
					default: {
						bin_size: 3,
						stopinclusive: true,
						first_bin: { startunbounded: true, stop: 2, stopinclusive: true }
					}
				},
				isleaf: true
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

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()
	const tip = opts.pill.Inner.dom.tip

	// test numeric bin menu
	// test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
	// test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	await sleep(800)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][0].innerText,
		'Bin Size',
		'Should have section for "bin size" edit'
	)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('td')._groups[0][0].innerText,
		'First Bin Stop',
		'Should have section for "First bin" edit'
	)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][3]).selectAll('td')._groups[0][0].innerText,
		'Last Bin Start',
		'Should have section for "Last bin" edit'
	)

	//trigger and test bin_size change
	const bin_size_input = d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('input')._groups[0][0]
	bin_size_input.value = 5

	//press 'Enter' to update bins
	bin_size_input.addEventListener('keyup', () => {})
	bin_size_input.dispatchEvent(enter_event)

	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('input')._groups[0][0].value,
		'5',
		'Should change "bin size" from input'
	)

	//trigger and test first_bin_change
	const first_bin_input = d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('input')._groups[0][0]
	first_bin_input.value = 7

	//press 'Enter' to update bins
	first_bin_input.addEventListener('keyup', () => {})
	first_bin_input.dispatchEvent(enter_event)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('input')._groups[0][0].value,
		'7',
		'Should change "first bin" from input'
	)

	test.end()
	return

	//trigger and test last_bin change
	const last_bin_select = d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('select')._groups[0][0]
	last_bin_select.selectedIndex = 1
	last_bin_select.dispatchEvent(new Event('change'))

	const last_bin_input = d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('input')._groups[0][0]

	last_bin_input.value = 20

	//press 'Enter' to update bins
	last_bin_input.addEventListener('keyup', () => {})
	last_bin_input.dispatchEvent(enter_event)

	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][2]).selectAll('input')._groups[0][0].value,
		'20',
		'Should change "last bin" from input'
	)

	// test 'reset' button
	const reset_btn = d3s.select(tip.d.selectAll('tr')._groups[0][4]).selectAll('.sja_menuoption')._groups[0][0]
	reset_btn.click()

	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('input')._groups[0][1].value,
		'2',
		'Should reset the bins by "Reset" button'
	)

	tip.hide()

	test.end()
})

tape('Conditional term', async test => {
	const opts = getOpts({
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
			}
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()
	const tip = opts.pill.Inner.dom.tip

	//check menu buttons on first menu
	test.equal(tip.d.selectAll('select').size(), 1, 'Should have 1 dropdown to change grade setting')
	test.equal(tip.d.selectAll('.group_btn').size(), 3, 'Should have 3 buttons for group config')
	// test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
	// test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	test.true(
		tip.d.selectAll('.group_btn')._groups[0][0].innerText.includes('Using'),
		'Should have "default" group button be active'
	)

	//change grade type
	tip.d.select('select')._groups[0][0].selectedIndex = 1
	tip.d.select('select')._groups[0][0].dispatchEvent(new Event('change'))
	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'Most Recent Grade',
		'Should have bluepill summary btn changed to "By Most Recent Grade"'
	)

	// select 'Any condition vs normal'
	pilldiv.click()
	tip.d.selectAll('.group_btn')._groups[0][1].click()

	// check tvspill and group menu
	const groupset_idx = opts.pill.Inner.q.groupsetting.predefined_groupset_idx
	const groupset = opts.tsData.term.groupsetting.lst[groupset_idx]
	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		groupset.name,
		'Should have bluepill summary btn match group name'
	)

	pilldiv.click()
	test.equal(tip.d.selectAll('select')._groups[0][0].selectedIndex, 1, 'Should have "Most recent" option selected')
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][0].innerText,
		groupset.groups[0].name + ':',
		'Should have group 1 name same as predefined group1 name'
	)
	test.equal(
		d3s
			.select(d3s.select(tip.d.selectAll('tr')._groups[0][0]).selectAll('td')._groups[0][1])
			.selectAll('div')
			.size(),
		groupset.groups[0].values.length,
		'Should have same number of grades to group as predefined group1'
	)
	test.equal(
		d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][0].innerText,
		groupset.groups[1].name + ':',
		'Should have group 2 name same as predefined group2 name'
	)
	test.equal(
		d3s
			.select(d3s.select(tip.d.selectAll('tr')._groups[0][1]).selectAll('td')._groups[0][1])
			.selectAll('div')
			.size(),
		groupset.groups[1].values.length,
		'Should have same number of grades to group as predefined group2'
	)
	test.true(
		tip.d.selectAll('.group_btn')._groups[0][1].innerText.includes('Use'),
		'Should have "default" group button be inactive'
	)

	//chage to subcondition
	pilldiv.click()
	tip.d.selectAll('select')._groups[0][0].selectedIndex = 3
	tip.d.selectAll('select')._groups[0][0].dispatchEvent(new Event('change'))
	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'Sub-condition',
		'Should have bluepill summary btn changed to "By Subcondition"'
	)

	// devide into 2 groups
	pilldiv.click()
	tip.d.selectAll('.group_btn')._groups[0][2].click()
	d3s
		.select(tip.d.selectAll('tr')._groups[0][3])
		.selectAll('input')
		._groups[0][2].click()
	tip.d
		.selectAll('.apply_btn')
		.node()
		.click()

	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'2 groups of sub-conditions',
		'Should have blue pill summary changed by group change'
	)

	//change back subcondition to grade
	pilldiv.click()
	tip.d.selectAll('select')._groups[0][0].selectedIndex = 0
	tip.d.selectAll('select')._groups[0][0].dispatchEvent(new Event('change'))

	test.equal(
		opts.holder.selectAll('.term_name_btn')._groups[0][0].innerText,
		opts.tsData.term.name,
		'Should have 1 pill for overlay term'
	)
	test.equal(
		opts.holder.selectAll('.ts_summary_btn')._groups[0][0].innerText,
		'Max. Grade',
		'Should have bluepill summary btn "By Max Grade" as default'
	)

	test.end()
})
