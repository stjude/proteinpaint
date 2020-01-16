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

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/filter -***-')
	test.end()
})

tape('control menu, 1 pill', async test => {
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
							id: 'diaggrp',
							name: 'Diagnosis Group',
							iscategorical: true
						},
						values: [
							{
								key: `Wilm's tumor`,
								label: `Wilm's tumor`
							}
						]
					}
				}
			]
		}
	})

	await sleep(150)
	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	await opts.filter.main(opts.filterData)

	const pill0 = opts.holder.select('.sja_pill_wrapper').node()
	pill0.click()
	await sleep(50)

	test.notEqual(tipd.node().style.display, 'none', 'should be dsplayed when clicking a pill')

	const editOpt = menuRows.filter(d => d.action == 'edit')
	test.equal(editOpt.size(), 1, 'should have an Edit option')
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

	const replaceOpt = menuRows.filter(d => d.action == 'replace')
	test.equal(replaceOpt.size(), 1, 'should have a Replace option')
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

	const joinOpt = menuRows.filter(d => d.action == 'join')
	test.equal(joinOpt.style('display'), 'none', 'should hide a join option for a single-pill root filter')

	const negateOpt = menuRows.filter(d => d.action == 'negate')
	test.equal(negateOpt.size(), 1, 'should have a Negate option')
	const isnotBeforeClick = opts.filter.Inner.filter.lst[0].tvs.isnot
	negateOpt.node().click()
	await sleep(30)
	test.equal(
		!isnotBeforeClick,
		opts.filter.Inner.filter.lst[0].tvs.isnot,
		`should reverse a pill's tvs.isnot value after clicking Negate`
	)

	const removeOpt = menuRows.filter(d => d.action == 'remove')
	test.equal(removeOpt.size(), 1, 'should have a remove option')
	opts.filter.Inner.dom.holder.node().click()
	test.end()
})

tape('control menu, 2 pills', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'diaggrp',
							name: 'Diagnosis Group',
							iscategorical: true
						},
						values: [
							{
								key: `Wilm's tumor`,
								label: `Wilm's tumor`
							}
						]
					}
				},
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'abc',
							name: 'ABC',
							iscategorical: true
						},
						values: [
							{
								key: `123`,
								label: `123`
							}
						]
					}
				}
			]
		}
	})

	await sleep(150)
	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	await opts.filter.main(opts.filterData)

	const pill0 = opts.holder.select('.sja_pill_wrapper').node()
	pill0.click()

	const joinOpt = menuRows.filter(d => d.action == 'join')
	test.notEqual(joinOpt.style('display'), 'none', 'should display a join option when clicking a pill')
	test.equal(
		joinOpt.node().querySelector('td:nth-child(2)').innerHTML,
		opts.filterData.join == 'or' ? 'AND' : 'OR',
		'should have a correctly-labeled join option'
	)
	joinOpt.node().click()
	test.equal(getHighlightedRowCount(menuRows, 'join'), 1, 'should highlight only the join-option row when clicked')
	test.deepEqual(
		normalizeActiveData(opts),
		{ item: opts.filterData.lst[0], filter: opts.filterData },
		'should set the expected +AND activeData'
	)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.style('display'),
		'none',
		'should display the tree tip when clicking the +AND option'
	)

	await addDemographicSexFilter(opts, joinOpt.node())
	const lst = opts.filter.Inner.filter.lst
	test.equal(
		lst[0] && lst[0].join,
		opts.filter.Inner.filter.join == 'and' ? 'or' : 'and',
		'should create a subnested filter.join != root filter.join'
	)
	test.equal(
		lst[0] && lst[0].type == 'tvslst' && lst[0].lst.length,
		2,
		'should create a subnested filter entry under the root filter.lst'
	)

	test.end()
})

tape('control menu, join label', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'diaggrp',
							name: 'Diagnosis Group',
							iscategorical: true
						},
						values: [
							{
								key: `Wilm's tumor`,
								label: `Wilm's tumor`
							}
						]
					}
				},
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'abc',
							name: 'ABC',
							iscategorical: true
						},
						values: [
							{
								key: `123`,
								label: `123`
							}
						]
					}
				}
			]
		}
	})

	await sleep(150)
	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	await opts.filter.main(opts.filterData)

	const joinLabel = opts.filter.Inner.dom.holder.select('.sja_filter_join_label')
	joinLabel.node().click()

	const editOpt = menuRows.filter(d => d.action == 'edit')
	test.equal(editOpt.style('display'), 'none', 'should hide the Edit option')

	const replaceOpt = menuRows.filter(d => d.action == 'replace')
	test.equal(replaceOpt.style('display'), 'none', 'should hide the Replace option')

	const joinOpt = menuRows.filter(d => d.action == 'join')
	test.notEqual(joinOpt.style('display'), 'none', 'should show the join option')
	test.equal(
		joinOpt.node().querySelector('td:nth-child(2)').innerHTML,
		opts.filterData.join.toUpperCase(),
		'should correctly label the join option'
	)

	const negateOpt = menuRows.filter(d => d.action == 'negate')
	test.notEqual(negateOpt.style('display'), 'none', 'should show the Negate option')

	const removeOpt = menuRows.filter(d => d.action == 'remove')
	test.notEqual(removeOpt.style('display'), 'none', 'should show the Remove option')

	const origLstLength = opts.filterData.lst.length
	await addDemographicSexFilter(opts, joinOpt.node())
	const lst = opts.filter.Inner.filter.lst
	test.equal(lst.filter(f => f.type != 'tvs').length, 0, 'should not create a subnested filter')
	test.equal(lst.length, origLstLength + 1, 'should append one item to the root filter.lst[]')

	test.end()
})

tape.skip('empty root filter', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			join: '',
			lst: []
		}
	})

	const tipd = opts.filter.Inner.dom.controlsTip.d
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
	// behavioral repeat of the data-only test for
	// a single-entry root filter test
	//test.equal(opts.holder.select('.sja_new_filter_btn').style('display'), 'none', 'should hide the +NEW button')
	test.notEqual(
		opts.holder.select('.sja_filter_container').style('display'),
		'none',
		'should show the filter container div'
	)

	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()
	await sleep(50)

	test.notEqual(tipd.node().style.display, 'none', 'should display the control menu when clicking a pill')
	// remove the only entry from root filter.lst[]
	tipd
		.selectAll('tr')
		.filter(d => d.action == 'remove')
		.node()
		.click()

	await sleep(200)
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

	test.end()
})

tape.skip('root filter with a single-entry', async test => {
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
							id: 'abc',
							name: 'ABC',
							iscategorical: true
						},
						values: [
							{
								key: 'cat1',
								label: 'val 1'
							}
						]
					}
				}
			]
		}
	})

	await sleep(150)
	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	await opts.filter.main(opts.filterData)

	test.equal(opts.holder.select('.sja_new_filter_btn').style('display'), 'none', 'should hide the +NEW button')
	test.notEqual(
		opts.holder.select('.sja_filter_container').style('display'),
		'none',
		'should show the filter container div'
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

	opts.holder
		.select('.sja_pill_wrapper')
		.node()
		.click()

	// simulate appending another tvs to the root filter.lst[]
	await addDemographicSexFilter(opts, menuRows.filter(d => d.action == 'join-and').node())
	test.equal(opts.filterData.lst.length, 2, 'should create a two-entry filter.lst[]')
	test.equal(opts.holder.select('.sja_new_filter_btn').style('display'), 'none', 'should hide the +NEW button')
	test.notEqual(
		opts.holder.select('.sja_filter_container').style.display,
		'none',
		'should show the filter container div'
	)
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
		'should hide all parentheses'
	)

	await sleep(100)
	opts.holder
		.node()
		.querySelectorAll('.sja_pill_wrapper')[1]
		.click()
	await sleep(100)
	menuRows
		.filter(d => d.action == 'remove')
		.node()
		.click()

	test.equal(opts.holder.select('.sja_new_filter_btn').style('display'), 'none', 'should hide the +NEW button')
	test.notEqual(
		opts.holder.select('.sja_filter_container').style('display'),
		'none',
		'should show the filter container div'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_join_label')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should show no filter join label'
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

	test.end()
})

tape.skip('root filter with nested filters', async test => {
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'abc',
							name: 'ABC',
							iscategorical: true
						},
						values: [
							{
								key: 'cat1',
								label: 'val 1'
							}
						]
					}
				},
				{
					type: 'tvslst',
					in: true,
					join: 'or',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: {
									id: 'abc',
									name: 'ABC',
									iscategorical: true
								},
								values: [
									{
										key: 'cat2',
										label: 'val 2'
									}
								]
							}
						},
						{
							type: 'tvs',
							tvs: {
								term: {
									id: 'xyz',
									name: 'XYZ',
									iscategorical: true
								},
								values: [
									{
										key: 'catx',
										label: 'Cat X'
									}
								]
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

	await sleep(100)
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

	await sleep(100)
	opts.holder
		.node()
		.querySelectorAll('.sja_pill_wrapper')[0]
		.click()
	await sleep(100)
	await addDemographicSexFilter(
		opts,
		tipd
			.selectAll('tr')
			.filter(d => d.action == 'join-or')
			.node().firstChild
	)
	await sleep(500)

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
