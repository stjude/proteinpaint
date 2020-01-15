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
	delete activeData.filter.lst[0].$id
	delete activeData.filter.lst[0].ancestry
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

tape('control menu', async test => {
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

	const andOpt = menuRows.filter(d => d.action == 'join-and')
	test.equal(andOpt.size(), 1, 'should have a +AND option')
	test.equal(
		andOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function(d, i) {
				return i > 1 || this.innerHTML == ')'
			})
			.size(),
		0,
		'should have no higher level +AND join option in a one-pill root filter'
	)
	andOpt.node().click()
	test.equal(getHighlightedRowCount(menuRows, 'join-and'), 1, 'should highlight only the +AND row when clicked')
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

	const orOpt = menuRows.filter(d => d.action == 'join-or')
	test.equal(orOpt.size(), 1, 'should have a +OR option')
	test.equal(
		orOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function(d, i) {
				return i > 1 || this.innerHTML == ')'
			})
			.size(),
		0,
		'should have no higher level +OR join option in a one-pill root filter'
	)
	orOpt.node().click()
	test.equal(getHighlightedRowCount(menuRows, 'join-or'), 1, 'should highlight only the +OR row when clicked')
	test.deepEqual(
		normalizeActiveData(opts),
		{ item: opts.filterData.lst[0], filter: opts.filterData },
		'should set the expected +OR activeData'
	)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.style('display'),
		'none',
		'should display the tree tip when clicking the +OR option'
	)

	const negateOpt = menuRows.filter(d => d.action == 'negate')
	test.equal(negateOpt.size(), 1, 'should have a Negate option')
	test.equal(
		negateOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function() {
				return this.innerHTML == ')'
			})
			.size(),
		0,
		'should not have any clickable parenthesis in the negate option of a single pill filter'
	)
	const isnotBeforeClick = opts.filter.Inner.filter.lst[0].tvs.isnot
	negateOpt.node().firstChild.click()
	await sleep(30)
	test.equal(
		!isnotBeforeClick,
		opts.filter.Inner.filter.lst[0].tvs.isnot,
		`should reverse a pill's tvs.isnot value after clicking Negate`
	)

	const removeOpt = menuRows.filter(d => d.action == 'remove')
	test.equal(removeOpt.size(), 1, 'should have a remove option')
	test.equal(
		removeOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function() {
				return this.innerHTML == ')'
			})
			.size(),
		0,
		'should not have any clickable parenthesis in the remove option of a single pill filter'
	)

	pill0.click()
	await sleep(50)
	await addDemographicSexFilter(opts, andOpt.node())

	pill0.click()
	test.equal(
		andOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function(d, i) {
				return i > 1 || this.innerHTML == ')'
			})
			.size(),
		0,
		'should have no higher level +AND join option in a two-pill root filter with join=and'
	)
	test.equal(
		orOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function(d, i) {
				return i > 0 || this.innerHTML == ')'
			})
			.size(),
		2,
		'should have a clickable higher-level +OR option in a two-pill root filter with join=and'
	)
	test.equal(
		negateOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function() {
				return this.innerHTML == ')'
			})
			.size(),
		1,
		'should have 1 clickable parenthesis in the negate option of a two-pill filter'
	)
	test.equal(
		negateOpt
			.selectAll('td:nth-child(2) > span')
			.filter(function() {
				return this.innerHTML == ')'
			})
			.size(),
		1,
		'should have 1 clickable parenthesis in the remove option of a two-pill filter'
	)

	negateOpt.node().firstChild.click()
	test.end()
})

tape('empty root filter', async test => {
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

tape('root filter with a single-entry', async test => {
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

tape('root filter with nested filters', async test => {
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
