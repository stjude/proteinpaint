const tape = require('tape')
const d3s = require('d3-selection')
const filterInit = require('../filter').filterInit

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify filterControls.spec.js -o ../../../public/bin/spec.bundle.js -v

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

async function addDemographicSexFilter(opts, btn) {
	btn.click()
	await sleep(200)
	// termdiv[1] is assumed to be Demographics
	const termdiv1 = opts.filter.Inner.dom.treeTip.d.node().querySelectorAll('.termdiv')[1]
	termdiv1.querySelectorAll('.termbtn')[0].click()
	await sleep(200)

	const termdivSex = termdiv1.querySelectorAll('.termdiv')[2]
	termdivSex.querySelectorAll('.termview')[0].click()
	await sleep(800)

	termdivSex.querySelector('.bars-cell > rect').dispatchEvent(new Event('click', { bubbles: true }))
	await sleep(100)
}

function normalizeActiveData(opts) {
	let activeData = JSON.parse(JSON.stringify(opts.filter.Inner.activeData))
	// delete UI assigned tracking/binding values from activeData
	delete activeData.item.$id
	delete activeData.item.ancestry
	delete activeData.filter.$id
	delete activeData.filter.ancestry
	for (const item of activeData.filter.lst) {
		delete item.$id
	}
	return { item: activeData.item, filter: activeData.filter }
}

function getHighlightedRowCount(menuRows, action) {
	return menuRows
		.filter(function(d) {
			return (
				(d.action == action && this.style.backgroundColor != 'transparent') ||
				this.style.backgroundColor != 'transparent'
			)
		})
		.size()
}

function diaggrp(overrides = {}) {
	return Object.assign(
		{
			type: 'tvs',
			visibility: 'default',
			tvs: {
				term: {
					id: 'diaggrp',
					name: 'Diagnosis Group',
					iscategorical: true
				},
				values: [
					{
						key: `Wilms tumor`,
						label: `Wilms tumor`
					}
				]
			}
		},
		overrides
	)
}

function agedx(overrides = {}) {
	return Object.assign(
		{
			type: 'tvs',
			visibility: 'default',
			tvs: {
				term: { id: 'agedx', name: 'Age of diagnosis', isfloat: true },
				ranges: [{ start: 2, stop: 5, startinclusive: true }]
			}
		},
		overrides
	)
}

let i = 0
function gettvs(id, val = '', overrides = {}) {
	return Object.assign(
		{
			type: 'tvs',
			visibility: 'default',
			tvs: {
				term: {
					id,
					name: id.toUpperCase(),
					iscategorical: true
				},
				values: [
					{
						key: val ? val : i++,
						label: val ? val : i.toString()
					}
				]
			}
		},
		overrides
	)
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/filter -***-')
	test.end()
})

tape('empty filter: visible controls', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			join: '',
			lst: []
		}
	})

	await opts.filter.main(opts.filterData)
	test.notEqual(
		opts.holder.node().querySelector('.sja_new_filter_btn').style.display,
		'none',
		'should show the +NEW button'
	)
	test.equal(
		opts.holder.node().querySelector('.sja_filter_container').style.display,
		'none',
		'should hide the filter container div'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_add_transformer')
			.filter(function() {
				return this.style.display === 'none'
			})
			.size(),
		2,
		'should hide the add-transformer buttons'
	)

	test.end()
})

tape('1-entry root filter: visible controls', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)

	/******************
		holder elements
	*******************/
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 1, 'should display 1 pill')
	test.equal(
		opts.holder
			.selectAll('.sja_filter_add_transformer')
			.filter(function() {
				return this.style.display != 'none'
			})
			.size(),
		2,
		'should show 2 add-transformer buttons'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should hide all parentheses'
	)

	/********************
		pill menu elements
	*********************/
	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const pill0 = opts.holder.select('.sja_pill_wrapper').node()
	pill0.click()
	await sleep(50)

	test.notEqual(tipd.node().style.display, 'none', 'should be dsplayed when clicking a pill')

	const editOpt = menuRows.filter(d => d.action == 'edit')
	test.equal(editOpt.style('display'), 'table-row', 'should have an Edit option')

	const replaceOpt = menuRows.filter(d => d.action == 'replace')
	test.equal(replaceOpt.style('display'), 'table-row', 'should have a Replace option')

	const joinOpt = menuRows.filter(d => d.action == 'join')
	test.equal(joinOpt.style('display'), 'none', 'should not have a join option for a single-pill root filter')

	const negateOpt = menuRows.filter(d => d.action == 'negate')
	test.equal(negateOpt.style('display'), 'table-row', 'should have a Negate option')

	const removeOpt = menuRows.filter(d => d.action == 'remove')
	test.equal(removeOpt.size(), 1, 'should have a remove option')

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('2-entry root filter: visible controls', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [diaggrp(), gettvs('abc')]
		}
	})

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	await opts.filter.main(opts.filterData)

	/******************
		holder elements
	*******************/
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 2, 'should display 2 pills')
	test.equal(
		opts.holder
			.selectAll('.sja_filter_join_label')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		1,
		'should show 1 filter join label'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should hide parentheses for non-nested filters'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_add_transformer')
			.filter(function() {
				return this.style.display != 'none'
			})
			.size(),
		1,
		'should show 1 add-transformer button'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_add_transformer')
			.filter(function() {
				return this.style.display != 'none'
			})
			.node().innerHTML,
		opts.filterData.join == 'and' ? '+OR' : '+AND',
		'should show the correctly labeled add-transformer button'
	)

	/*********************
		pill menu elements
	**********************/
	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()

	const editOpt = menuRows.filter(d => d.action == 'edit')
	test.equal(editOpt.style('display'), 'table-row', 'should have a pill Edit option')

	const replaceOpt = menuRows.filter(d => d.action == 'replace')
	test.equal(replaceOpt.style('display'), 'table-row', 'should have a pill Replace option')

	const joinOpt = menuRows.filter(d => d.action == 'join')
	test.equal(joinOpt.style('display'), 'table-row', 'should display a join option')
	test.equal(
		joinOpt.node().querySelector('td:nth-child(2)').innerHTML,
		opts.filterData.join == 'or' ? 'AND' : 'OR',
		'should correctly label the pill join option'
	)

	const negateOpt = menuRows.filter(d => d.action == 'negate')
	test.equal(negateOpt.style('display'), 'table-row', 'should have a pill Negate option')

	const removeOpt = menuRows.filter(d => d.action == 'remove')
	test.equal(removeOpt.size(), 1, 'should have a pill Remove option')

	/***************** 
		join label menu 
	******************/
	const joinLabel = opts.filter.Inner.dom.holder.select('.sja_filter_join_label')
	joinLabel.node().click()
	test.notEqual(
		opts.holder.node().querySelector('.sja_filter_grp').style.backgroundColor,
		'transparent',
		'should highlight the clicked filter group'
	)
	test.equal(editOpt.style('display'), 'none', 'should not have a group Edit option')
	test.equal(replaceOpt.style('display'), 'none', 'should not have a group Replace option')
	test.equal(joinOpt.style('display'), 'table-row', 'should show a group append option')
	test.equal(
		joinOpt.node().querySelector('td:nth-child(2)').innerHTML,
		opts.filterData.join.toUpperCase(),
		'should correctly label the group append option'
	)
	test.equal(negateOpt.style('display'), 'table-row', 'should show a group Negate option')
	test.equal(removeOpt.style('display'), 'table-row', 'should show a group Remove option')

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.equal(
		opts.holder.node().querySelector('.sja_filter_grp').style.backgroundColor,
		'transparent',
		'should unhighlight the filter group after clicking elsewhere'
	)
	test.end()
})

tape('+NEW button interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			join: '',
			lst: []
		}
	})

	await opts.filter.main(opts.filterData)

	opts.holder
		.node()
		.querySelector('.sja_new_filter_btn')
		.click()
	await sleep(50)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.node().style.display,
		'none',
		'should display the tree menu when clicking the +NEW button'
	)

	// simulate creating the initial filter
	await addDemographicSexFilter(opts, opts.holder.node().querySelector('.sja_new_filter_btn'))
	test.equal(opts.filterData.lst.length, 1, 'should create a one-entry filter.lst[]')
	test.equal(
		opts.holder.select('.sja_new_filter_btn').style('display'),
		'none',
		'should hide the +NEW button when there is a filter.lst[] entry'
	)
	test.notEqual(
		opts.holder.select('.sja_filter_container').style('display'),
		'none',
		'should show the filter container div'
	)

	test.end()
})

tape('add-transformer button interaction, 1-pill', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)
	const adder = opts.holder
		.selectAll('.sja_filter_add_transformer')
		.filter(function() {
			return this.style.display !== 'none'
		})
		.node()
	adder.click()
	await sleep(50)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.node().style.display,
		'none',
		'should display the tree menu when clicking the add-transformer button'
	)
	const origFilter = JSON.parse(JSON.stringify(opts.filterData))
	await addDemographicSexFilter(opts, adder)
	const lst = opts.filterData.lst
	test.deepEqual(
		lst[0].type && lst[0].tvs && lst[0].tvs.term.id,
		origFilter.lst[0].type && origFilter.lst[0].tvs && origFilter.lst[0].tvs.term.id,
		'should not subnest the filter.lst[0] entry'
	)
	test.equal(lst[1] && lst[1].tvs && lst[1].tvs.term.id, 'sex', 'should append the new term to the root filter')
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 2, 'should display 2 pills')
	test.end()
})

tape('add-transformer button interaction, 2-pill', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [diaggrp(), agedx()]
		}
	})

	await opts.filter.main(opts.filterData)
	const adder = opts.holder
		.selectAll('.sja_filter_add_transformer')
		.filter(function() {
			return this.style.display !== 'none'
		})
		.node()
	adder.click()
	await sleep(50)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.node().style.display,
		'none',
		'should display the tree menu when clicking the add-transformer button'
	)
	const origFilter = JSON.parse(JSON.stringify(opts.filterData))
	test.end()
	return
	await addDemographicSexFilter(opts, adder)
	test.deepEqual(
		opts.filter.Inner.filter.lst[0].lst.map(d => d.tvs.id),
		origFilter.lst.map(d => d.tvs.id),
		'should subnest the original filter tvslst'
	)
	test.equal(opts.filterData.lst[1].tvs.term.id, 'sex', 'should append the new term to the re-rooted filter')
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 3, 'should display 3 pills')
	test.end()
})

tape('pill Edit interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()],
			visibility: 'default'
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')

	editOpt.node().click()
	test.equal(getHighlightedRowCount(menuRows, 'edit'), 1, 'should highlight only the edit row when clicked')
	test.deepEqual(
		normalizeActiveData(opts),
		{ item: opts.filterData.lst[0], filter: opts.filterData },
		'should set the expected edit activeData'
	)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.style('display'),
		'none',
		'should display the tree tip when clicking the edit option'
	)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('pill Replace interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()],
			visibility: 'default'
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const replaceOpt = menuRows.filter(d => d.action == 'replace')

	replaceOpt.node().click()
	test.equal(getHighlightedRowCount(menuRows, 'replace'), 1, 'should highlight only the replace row when clicked')
	test.deepEqual(
		normalizeActiveData(opts),
		{ item: opts.filterData.lst[0], filter: opts.filterData },
		'should set the expected replace activeData'
	)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.style('display'),
		'none',
		'should display the tree tip when clicking the replace option'
	)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('pill menu-append interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [diaggrp(), gettvs('abc')]
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const joinOpt = menuRows.filter(d => d.action == 'join')
	const origLstLength = opts.filterData.lst.length
	await addDemographicSexFilter(opts, joinOpt.node())
	const lst = opts.filter.Inner.filter.lst
	test.equal(lst[0].type, 'tvslst', 'should create a subnested filter')
	test.equal(
		lst[0].join,
		opts.filter.Inner.filter.join == 'or' ? 'and' : 'or',
		'should set the correct join value for the subnested filter'
	)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('pill Negate interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const negateOpt = menuRows.filter(d => d.action == 'negate')
	const isnotBeforeClick = opts.filter.Inner.filter.lst[0].tvs.isnot
	negateOpt.node().click()
	await sleep(30)
	test.equal(
		opts.filter.Inner.filter.lst[0].tvs.isnot,
		!isnotBeforeClick,
		`should reverse a pill's tvs.isnot value after clicking pill Negate`
	)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('pill Remove interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const removeOpt = menuRows.filter(d => d.action == 'remove')
	removeOpt.node().click()
	await sleep(30)
	test.equal(opts.filter.Inner.filter.lst.length, 0, `should remove the corresponding filter.lst[] entry when clicked`)
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 0, `should remove a pill when clicked`)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('group menu-append interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [diaggrp(), gettvs('abc')]
		}
	})

	await opts.filter.main(opts.filterData)
	const joinLabel = opts.filter.Inner.dom.holder.select('.sja_filter_join_label')
	joinLabel.node().click()

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const joinOpt = menuRows.filter(d => d.action == 'join')
	const origLstLength = opts.filterData.lst.length
	await addDemographicSexFilter(opts, joinOpt.node())
	const lst = opts.filter.Inner.filter.lst
	test.equal(lst.filter(f => f.type != 'tvs').length, 0, 'should not create a subnested filter')
	test.equal(lst.length, origLstLength + 1, 'should append one item to the root filter.lst[]')

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('group Negate interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [diaggrp(), gettvs('abc')]
		}
	})

	await opts.filter.main(opts.filterData)
	test.equal(
		opts.holder.node().querySelector('.sja_filter_clause_negate').style.display,
		'none',
		`should not show a NOT() label around the non-negated group`
	)

	const joinLabel = opts.filter.Inner.dom.holder.select('.sja_filter_join_label')
	joinLabel.node().click()

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const negateOpt = menuRows.filter(d => d.action == 'negate')
	negateOpt.node().click()
	await sleep(30)
	test.equal(opts.filter.Inner.filter.in, false, `should reverse a group's filter.in value after clicking pill Negate`)
	test.equal(
		opts.holder.node().querySelector('.sja_filter_clause_negate').style.display,
		'inline-block',
		`should show a NOT() label around the negated group`
	)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('group Remove interaction', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [diaggrp(), gettvs('abc')]
		}
	})

	await opts.filter.main(opts.filterData)
	const joinLabel = opts.filter.Inner.dom.holder.select('.sja_filter_join_label')
	joinLabel.node().click()

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const removeOpt = menuRows.filter(d => d.action == 'remove')
	removeOpt.node().click()
	await sleep(30)
	test.equal(opts.filter.Inner.filter.lst.length, 0, `should remove the tvslst corresponding to the clicked group`)
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 0, `should remove a group's pills when clicked`)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('nested filters', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				agedx(),
				{
					type: 'tvslst',
					in: true,
					join: 'or',
					lst: [
						diaggrp(),
						{
							type: 'tvs',
							visibility: 'default',
							tvs: {
								term: {
									id: 'Arrhythmias',
									name: 'Arrhythmias',
									iscondition: true
								},
								value: {
									bar_by_grade: true,
									values: [{ key: 2, label: '2' }],
									value_by_max_grade: true
								}
							}
						}
					]
				}
			]
		}
	})

	const tipd = opts.filter.Inner.dom.controlsTip.d
	await opts.filter.main(opts.filterData)
	//test.equal(opts.holder.select('.sja_new_filter_btn').style('display'), 'none', 'should hide the +NEW button')
	test.notEqual(
		opts.holder.select('.sja_filter_container').style('display'),
		'none',
		'should show the filter container div'
	)
	const joinLabelsA = opts.holder.node().querySelectorAll('.sja_filter_join_label')
	test.notEqual(joinLabelsA[0].style.display, 'none', 'should show the join label after the first item')
	test.equal(
		joinLabelsA[joinLabelsA.length - 1].style.display,
		'none',
		'should hide the join label after the last item'
	)

	const grpDivsA = opts.holder.node().querySelectorAll('.sja_filter_item')
	test.equal(
		d3s
			.select(grpDivsA[0])
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should not show parentheses around the root-level group'
	)
	test.equal(
		d3s
			.select(grpDivsA[1])
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		2,
		'should show parentheses around a filter with >1 terms'
	)

	opts.holder
		.node()
		.querySelectorAll('.sja_pill_wrapper')[2]
		.click()
	await sleep(100)
	tipd
		.selectAll('tr')
		.filter(d => d.action == 'remove')
		.node()
		.click()
	await sleep(300)

	test.equal(
		opts.filterData.lst.length,
		2,
		'should create a two-entry root filter.lst[] after editing the nested group to one-item'
	)
	test.equal(
		opts.filterData.lst.filter(d => !('lst' in d)).length,
		2,
		'should create tvs-only items in root filter.lst[]'
	)

	test.equal(
		opts.holder
			.selectAll('.sja_filter_item')
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should not show parentheses around any single-item groups'
	)

	opts.holder
		.node()
		.querySelectorAll('.sja_pill_wrapper')[0]
		.click()
	await sleep(100)
	await addDemographicSexFilter(
		opts,
		tipd
			.selectAll('tr')
			.filter(d => d.action == 'join')
			.node().firstChild
	)

	const grpDivsB = opts.holder.node().querySelectorAll('.sja_filter_item')
	test.equal(
		d3s
			.select(grpDivsB[0])
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		2,
		'should show parentheses around the first (2-item) group of the root filter'
	)
	test.equal(
		d3s
			.select(grpDivsB[1])
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should not show parentheses around the second (1-item) group of the root filter'
	)

	test.end()
})

tape('hidden filters', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [agedx({ visibility: 'hidden' }), gettvs('abc', '123', { visibility: 'hidden' }), diaggrp()]
		}
	})

	const tipd = opts.filter.Inner.dom.controlsTip.d
	await opts.filter.main(opts.filterData)
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 1, 'should display 1 pill')
	test.end()
})
