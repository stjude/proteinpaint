import tape from 'tape'
import * as d3s from 'd3-selection'
import {
	filterInit,
	filterRxCompInit,
	getNormalRoot,
	filterJoin,
	getFilterItemByTag,
	filterPromptInit
} from '../filter'
import { sleep, detectLst, detectOne, detectGte, whenVisible } from '../../test/test.helpers.js'

/*********
Tests:
	filterInit
		empty filter: visible controls
		1-entry root filter: visible controls
		2-entry root filter: visible controls
		+NEW button interaction
		add-transformer button interaction, 1-pill
		add-transformer button interaction, 2-pill
		pill Edit interaction
		pill Replace interaction
		pill menu-append interaction
		pill Negate interaction
		pill Remove interaction
		group menu-append interaction
		group Negate interaction
		group Remove interaction
		nested filters
		hidden filters
		renderAs: htmlSelect
		getNormalRoot()
		filterJoin()

	filterRxCompInit
		Rx filter state

	filterPromptInit

the direct functional testing of the component, without the use of runpp()
*/

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('position', 'relative')
		.style('margin', '20px')
		.style('border', '1px solid #000')
}

function getOpts(_opts = {}) {
	const holder = getHolder()

	const opts = Object.assign(
		{
			holder,
			activeCohort: 0,
			callback(filter) {
				opts.filterData = filter
				opts.filterUiRoot = getFilterItemByTag(filter, 'filterUiRoot')
				/*** filter.api.main() is already called in filter.refresh() before this callback ***/
				//opts.filter.main(opts.filterData)
			}
		},
		_opts
	)

	const vocab = _opts.vocab ? _opts.vocab : { route: 'termdb', genome: 'hg38-test', dslabel: 'TermdbTest' }

	opts.filter = filterInit({
		btn: holder.append('div'),
		btnLabel: 'Filter',
		holder: holder.append('div'),
		vocab,
		header_mode: opts.header_mode,
		termdbConfig: opts.termdbConfig,
		debug: true,
		callback: opts.callback
	})

	return opts
}

async function addDemographicSexFilter(opts, btn) {
	btn.click()
	const tipd = opts.filter.Inner.dom.treeTip.d.node()

	const termdiv1 = await detectLst({ elem: tipd, selector: '.termdiv', matchAs: '>=' })
	const demoPill = termdiv1.find(elem => elem.__data__.id === 'Demographic Variables')
	demoPill.querySelectorAll('.termbtn')[0].click()

	const termdivSex = await detectLst({ elem: tipd, selector: '.termdiv', count: 6, matchAs: '>=' })
	const sexPill = termdivSex.find(elem => elem.__data__.id === 'sex')
	sexPill.querySelectorAll('.termlabel')[0].click()
	const detectSelect = await detectLst({ elem: tipd, selector: "input[type='checkbox']", count: 1, matchAs: '>=' })
	detectSelect[0].click()
	const applyBtn = await detectOne({ elem: tipd, selector: '.sjpp_apply_btn' })
	applyBtn.click()
}

function normalizeActiveData(opts) {
	let activeData = JSON.parse(JSON.stringify(opts.filter.Inner.activeData))
	// delete UI assigned tracking/binding values from activeData
	delete activeData.item.$id
	delete activeData.item.ancestry
	delete activeData.item.tag
	delete activeData.filter.$id
	delete activeData.filter.ancestry
	delete activeData.filter.tag
	for (const item of activeData.filter.lst) {
		delete item.$id
	}
	return { item: activeData.item, filter: activeData.filter }
}

function getHighlightedRowCount(menuRows, action) {
	return menuRows
		.filter(function (d) {
			return this.style.backgroundColor != ''
		})
		.size()
}

function diaggrp(overrides = {}) {
	return Object.assign(
		{
			type: 'tvs',
			tvs: {
				term: {
					type: 'categorical',
					id: 'diaggrp',
					name: 'Diagnosis Group',
					groupsetting: { disabled: true }
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
			tvs: {
				term: { id: 'agedx', name: 'Age of diagnosis', type: 'float' },
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
			tvs: {
				term: {
					id,
					name: id.toUpperCase(),
					iscategorical: true,
					type: 'categorical'
				},
				values: [
					{
						key: val ? val : (i++).toString(),
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
	test.comment('-***- filter/filter.integration -***-')
	test.end()
})

tape('\n', test => {
	test.comment('-***- filterInit() tests-***-')
	test.end()
})

tape('empty filter: visible controls', async test => {
	test.timeoutAfter(3000)
	test.plan(3)
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
			.filter(function () {
				return this.style.display === 'none'
			})
			.size(),
		2,
		'should hide the add-transformer buttons'
	)

	test.end()
})

tape('1-entry root filter: visible controls', async test => {
	test.timeoutAfter(3000)
	test.plan(9)
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
			.filter(function () {
				return this.style.display != 'none'
			})
			.size(),
		2,
		'should show 2 add-transformer buttons'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function () {
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

	await whenVisible(tipd.node())
	test.pass('filter controlsTip should be displayed when clicking a pill')

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
	test.timeoutAfter(5000)
	test.plan(21)
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
			.filter(function () {
				return this.style.display !== 'none'
			})
			.size(),
		1,
		'should show 1 filter join label'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function () {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should hide parentheses for non-nested filters'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_add_transformer')
			.filter(function () {
				return this.style.display != 'none'
			})
			.size(),
		1,
		'should show 1 add-transformer button'
	)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_add_transformer')
			.filter(function () {
				return this.style.display != 'none'
			})
			.node().innerHTML,
		opts.filterData.join == 'and' ? '+OR' : '+AND',
		'should show the correctly labeled add-transformer button'
	)

	/*********************
		pill menu elements
	**********************/
	opts.holder.select('.sja_pill_wrapper').node().click()

	const editOpt = menuRows.filter(d => d.action == 'edit')
	test.equal(editOpt.style('display'), 'table-row', 'should have a pill Edit option')

	const replaceOpt = menuRows.filter(d => d.action == 'replace')
	test.equal(replaceOpt.style('display'), 'table-row', 'should have a pill Replace option')

	const joinOpt = menuRows.filter(d => d.action == 'join')
	test.equal(joinOpt.style('display'), 'table-row', 'should display a join option')

	const switchOpt = menuRows.filter(d => d.action == 'switch')
	test.equal(switchOpt.style('display'), 'none', 'should NOT display a switch option')

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
	test.equal(switchOpt.style('display'), 'table-row', 'should NOT display a switch option')
	test.equal(
		switchOpt.node().querySelector('td:nth-child(2)').innerHTML,
		opts.filterData.join == 'or' ? 'Switch to AND' : 'Switch to OR',
		'should correctly label the switch option'
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
	test.timeoutAfter(5000)
	test.plan(4)
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			join: '',
			lst: []
		}
	})

	await opts.filter.main(opts.filterData)
	const filterBtn = await detectOne({ elem: opts.holder.node(), selector: '.sja_new_filter_btn' })
	filterBtn.click()
	const termdiv = await detectLst({
		elem: opts.filter.Inner.dom.treeTip.d.node(),
		selector: '.termdiv',
		count: 1,
		matchAs: '>='
	})
	test.true(
		opts.filter.Inner.dom.treeTip.d.node().style.display != 'none' && termdiv.length > 2,
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
	test.timeoutAfter(3000)
	test.plan(5)

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
		.filter(function () {
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
	test.equal(
		opts.holder.node().querySelectorAll('.sja_filter_blank_pill').length,
		1,
		'should create one blank pill when clicking on a one-pill root add-transformer'
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
	test.timeoutAfter(3000)
	test.plan(6)

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
		.filter(function () {
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
	test.equal(
		opts.holder.node().querySelectorAll('.sja_filter_blank_pill').length,
		1,
		'should create exactly 1 blank pill when clicking on a two-pill root add-transformer'
	)
	test.equal(
		opts.holder.node().querySelector('.sja_filter_blank_pill').firstChild.innerHTML,
		'OR',
		'should correctly label the join label between the potentially subnested root and blank pill'
	)

	const origFilter = JSON.parse(JSON.stringify(opts.filterData))
	await addDemographicSexFilter(opts, adder)
	test.deepEqual(
		opts.filter.Inner.filter.lst[0].lst.map(d => d.tvs.term.id),
		origFilter.lst.map(d => d.tvs.term.id),
		'should subnest the original filter tvslst'
	)
	test.equal(opts.filterData.lst[1].tvs.term.id, 'sex', 'should append the new term to the re-rooted filter')
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 3, 'should display 3 pills')
	test.end()
})

tape('add-transformer button interaction, NEGATED 2-pill', async test => {
	test.timeoutAfter(3000)
	test.plan(6)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: false,
			join: 'and',
			lst: [diaggrp(), agedx()]
		}
	})

	await opts.filter.main(opts.filterData)
	const adder = opts.holder
		.selectAll('.sja_filter_add_transformer')
		.filter(function () {
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
	test.equal(
		opts.holder.node().querySelectorAll('.sja_filter_blank_pill').length,
		1,
		'should create exactly 1 blank pill when clicking on a two-pill root add-transformer'
	)
	test.equal(
		opts.holder.node().querySelector('.sja_filter_blank_pill').firstChild.innerHTML,
		'AND',
		'should correctly label the join label between the potentially subnested root and blank pill'
	)

	const origFilter = JSON.parse(JSON.stringify(opts.filterData))
	await addDemographicSexFilter(opts, adder)
	test.deepEqual(
		opts.filter.Inner.filter.lst[0].lst.map(t => t.tvs.term.id),
		origFilter.lst.map(t => t.tvs.term.id),
		'should subnest the original filter tvslst'
	)
	test.equal(opts.filterData.lst[1]?.tvs.term.id, 'sex', 'should append the new term to the re-rooted filter')
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 3, 'should display 3 pills')
	test.end()
})

tape('pill Edit interaction', async test => {
	test.timeoutAfter(3000)
	test.plan(4)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder.select('.sja_pill_wrapper').node().click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const editOpt = menuRows.filter(d => d.action == 'edit')

	editOpt.node().click()
	test.equal(getHighlightedRowCount(menuRows, 'edit'), 1, 'should highlight only the edit row when clicked')
	const expected = { item: opts.filterData.lst[0], filter: opts.filterData }
	delete expected.item.$id
	delete expected.filter.$id
	delete test.deepEqual(normalizeActiveData(opts), expected, 'should set the expected edit activeData')
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.style('display'),
		'none',
		'should display the tree tip when clicking the edit option'
	)
	const applyBtn = await detectOne({ elem: opts.filter.Inner.dom.treeTip.d.node(), selector: '.sjpp_apply_btn' })
	test.ok(applyBtn, 'should display an apply button in the edit menu')

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('pill Replace interaction', async test => {
	test.timeoutAfter(3000)
	test.plan(3)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder.select('.sja_pill_wrapper').node().click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const replaceOpt = menuRows.filter(d => d.action == 'replace')

	replaceOpt.node().click()
	test.equal(getHighlightedRowCount(menuRows, 'replace'), 1, 'should highlight only the replace row when clicked')
	const expected = { item: opts.filterData.lst[0], filter: opts.filterData }
	delete expected.item.$id
	delete expected.filter.$id
	test.deepEqual(normalizeActiveData(opts), expected, 'should set the expected replace activeData')
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.style('display'),
		'none',
		'should display the tree tip when clicking the replace option'
	)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('pill menu-append interaction', async test => {
	test.timeoutAfter(3000)
	test.plan(5)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [diaggrp(), gettvs('abc')]
		}
	})

	await opts.filter.main(opts.filterData)
	const pillWrapper = opts.holder.select('.sja_pill_wrapper').node()
	pillWrapper.click()
	await sleep(50)
	{
		const tipd = opts.filter.Inner.dom.controlsTip.d
		const menuRows = tipd.selectAll('tr')
		const joinOpt = menuRows.filter(d => d.action == 'join')
		joinOpt.node().click()
		test.equal(
			opts.holder.node().querySelectorAll('.sja_filter_blank_pill').length,
			1,
			'should create exactly one blank pill when clicking a pill-menu append option'
		)
		test.equal(
			pillWrapper.querySelectorAll('.sja_filter_paren_open, .sja_filter_paren_close').length,
			2,
			'should show parentheses to indicate that a newly selected term-value will be placed in a subnested pill group'
		)

		menuRows
			.filter(d => d.action == 'replace')
			.node()
			.click()
		test.equal(
			opts.holder.node().querySelectorAll('.sja_filter_blank_pill').length,
			0,
			'should remove the blank pill when clicking away from a pill menu-append option'
		)
	}

	pillWrapper.click()
	await sleep(50)
	{
		const tipd = opts.filter.Inner.dom.controlsTip.d
		const menuRows = tipd.selectAll('tr')
		const joinOpt = menuRows.filter(d => d.action == 'join')
		//const origLstLength = opts.filterData.lst.length
		await addDemographicSexFilter(opts, joinOpt.node())
		await sleep(200)
		const lst = opts.filter.Inner.filter.lst
		test.equal(lst[0].type, 'tvslst', 'should create a subnested filter')
		test.equal(
			lst[0].join,
			opts.filter.Inner.filter.join == 'or' ? 'and' : 'or',
			'should set the correct join value for the subnested filter'
		)
	}

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('pill Negate interaction', async test => {
	test.timeoutAfter(3000)
	test.plan(1)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder.select('.sja_pill_wrapper').node().click()
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
	test.timeoutAfter(3000)
	test.plan(3)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [diaggrp()]
		}
	})

	await opts.filter.main(opts.filterData)
	opts.holder.select('.sja_pill_wrapper').node().click()
	await sleep(50)

	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const removeOpt = menuRows.filter(d => d.action == 'remove')
	test.notEqual(removeOpt.style('display'), 'none', `should have a visible pill remove menu option`)
	removeOpt.node().click()
	await sleep(30)
	test.equal(opts.filter.Inner.filter.lst.length, 0, `should remove the corresponding filter.lst[] entry when clicked`)
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 0, `should remove a pill when clicked`)

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('group menu-append interaction', async test => {
	test.timeoutAfter(9000)
	test.plan(5)

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
	joinOpt.node().click()
	test.equal(
		opts.holder.node().querySelectorAll('.sja_filter_blank_pill').length,
		1,
		'should create exactly one blank pill when clicking a group-menu append option'
	)
	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.sja_pill_wrapper > .sja_filter_paren_open, .sja_pill_wrapper > .sja_filter_paren_close')
			.length,
		0,
		'should not show parentheses to indicate no subnesting'
	)
	const childNodes = joinLabel.node().parentNode.parentNode.childNodes
	test.equal(
		childNodes[childNodes.length - 2].className,
		'sja_filter_blank_pill',
		'should create a blank pill to indicate that a newly selected term-value will be placed at the end of the filter group'
	)

	const origLstLength = opts.filterData.lst.length
	await addDemographicSexFilter(opts, joinOpt.node())
	const lst = opts.filter.Inner.filter.lst
	test.equal(lst.filter(f => f.type != 'tvs').length, 0, 'should not create a subnested filter')
	test.equal(lst.length, origLstLength + 1, 'should append one item to the root filter.lst[]')

	document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('group Negate interaction', async test => {
	test.timeoutAfter(3000)
	test.plan(4)

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

	test.equal(
		opts.holder
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function () {
				return this.style.display === 'none'
			})
			.size(),
		0,
		'should show parentheses for non-nested filters'
	)
	test.end()
})

tape('group Remove interaction', async test => {
	test.timeoutAfter(3000)
	test.plan(3)

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
	test.notEqual(removeOpt.style('display'), 'none', `should have a visible group remove menu option`)
	removeOpt.node().click()
	await sleep(30)
	test.equal(opts.filter.Inner.filter.lst.length, 0, `should remove the tvslst corresponding to the clicked group`)
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 0, `should remove a group's pills when clicked`)

	//document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.end()
})

tape('group Switch join interaction', async test => {
	test.timeoutAfter(3000)
	test.plan(2)

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
	const switchOpt = menuRows.filter(d => d.action == 'switch')
	const expectedLabel = 'Switch to AND'
	test.equal(
		switchOpt.select('td:nth-child(2)').text(),
		expectedLabel,
		`should display the menu option as ${expectedLabel}`
	)
	switchOpt.node().click()
	await sleep(30)
	test.equal(
		opts.filter.Inner.filter.join,
		'and',
		`should switch a group's filter.join value after clicking ${expectedLabel}`
	)
	test.end()
})

tape('nested filters', async test => {
	test.timeoutAfter(6000)
	test.plan(10)

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
							tvs: {
								term: {
									id: 'Arrhythmias',
									name: 'Arrhythmias',
									iscondition: true,
									type: 'condition'
								},
								bar_by_grade: true,
								value_by_max_grade: true,
								values: [{ key: 2, label: '2' }]
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
			.filter(function () {
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
			.filter(function () {
				return this.style.display !== 'none'
			})
			.size(),
		2,
		'should show parentheses around a filter with >1 terms'
	)

	const pillWrapper1 = await detectLst({
		elem: opts.holder.node(),
		selector: '.sja_pill_wrapper',
		count: 2,
		matchAs: '>='
	})
	pillWrapper1[2].click()

	const menuOpts = await detectLst({ elem: tipd.node(), selector: '.sja_menuoption', matchAs: '>=' })
	const removeTr = menuOpts.filter(d => d.__data__.action == 'remove')
	removeTr[0].click()

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
	await sleep(50)
	test.equal(
		opts.holder
			.selectAll('.sja_filter_item')
			.selectAll('.sja_filter_paren_open, .sja_filter_paren_close')
			.filter(function () {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should not show parentheses around any single-item groups'
	)

	const pillWrapper2 = await detectLst({
		elem: opts.holder.node(),
		selector: '.sja_pill_wrapper',
		count: 1,
		matchAs: '>='
	})
	pillWrapper2[0].click()
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
			.filter(function () {
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
			.filter(function () {
				return this.style.display !== 'none'
			})
			.size(),
		0,
		'should not show parentheses around the second (1-item) group of the root filter'
	)

	test.end()
})

tape('hidden filters', async test => {
	test.timeoutAfter(9000)
	test.plan(9)

	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				agedx(),
				{
					tag: 'filterUiRoot',
					type: 'tvslst',
					join: '',
					in: true,
					lst: [diaggrp()]
				}
			]
		},
		callback(filter) {
			opts.filterData.lst[1] = filter
			/*** filter.api.main() is already called in filter.refresh() before this callback ***/
			//opts.filter.main(opts.filterData)
		}
	})

	const tipd = opts.filter.Inner.dom.controlsTip.d
	await opts.filter.main(opts.filterData)
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 1, 'should display 1 pill')

	const adder = opts.holder
		.selectAll('.sja_filter_add_transformer')
		.filter(function (d) {
			return this.style.display !== 'none' && d == 'and'
		})
		.node()
	adder.click()
	await sleep(150)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.node().style.display,
		'none',
		'should display the tree menu when clicking the add-transformer button'
	)
	const origFilter = JSON.parse(JSON.stringify(opts.filterData))
	await addDemographicSexFilter(opts, adder)
	const origLst = origFilter.lst[1].lst
	const lst = opts.filterData.lst[1] && opts.filterData.lst[1].lst
	test.deepEqual(
		lst[0].type && lst[0].tvs && lst[0].tvs.term.id,
		origLst[0].type && origLst[0].tvs && origLst[0].tvs.term.id,
		'should not subnest the filter.lst[0] entry'
	)
	test.equal(lst[1] && lst[1].tvs && lst[1].tvs.term.id, 'sex', 'should append the new term to the root filter')
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 2, 'should display 2 pills')

	const adderOr = opts.holder
		.selectAll('.sja_filter_add_transformer')
		.filter(function (d) {
			return this.style.display !== 'none' && d == 'or'
		})
		.node()
	adderOr.click()
	await sleep(50)
	test.notEqual(
		opts.filter.Inner.dom.treeTip.d.node().style.display,
		'none',
		'should display the tree menu when clicking the add-transformer button'
	)
	await addDemographicSexFilter(opts, adderOr)
	const lstOr = opts.filterData.lst[1] && opts.filterData.lst[1].lst
	test.deepEqual(
		lstOr[0] && lstOr[0].lst && lstOr[0].lst.map(d => d.tvs.id),
		lst.map(d => d.tvs.id),
		'should subnest the original filter tvslst'
	)
	test.equal(lstOr[1].tvs.term.id, 'sex', 'should append the new term to the re-rooted filter')
	test.equal(opts.holder.selectAll('.sja_pill_wrapper').size(), 3, 'should display 3 pills')
	test.end()
})

tape('renderAs: htmlSelect', async test => {
	test.timeoutAfter(1000)
	test.plan(5)

	const termdbConfig = {
		selectCohort: {
			// wrap term.id into a term json object so as to use it in tvs;
			// the term is not required to exist in termdb
			// term.id is specific to this dataset, should not use literally in client/server code but always through a variable
			term: {
				id: 'subcohort',
				type: 'multivalue'
			},
			values: [
				{
					keys: ['ABC'],
					label: 'St. Jude Lifetime Cohort (ABC)',
					shortLabel: 'ABC',
					isdefault: true
				},
				{
					keys: ['XYZ'],
					label: 'Childhood Cancer Survivor Study (XYZ)',
					shortLabel: 'XYZ'
				},
				{
					keys: ['ABC', 'XYZ'],
					label: 'Combined ABC+XYZ',
					shortLabel: 'ABC+XYZ',
					note: 'The combined cohorts are limited to those variables that are comparable between the two populations. For example, selecting this category does not allow browsing of clinically-ascertained variables, which are only available in ABC.'
				}
			]
		}
	}
	const opts = getOpts({
		termdbConfig,
		filterData: {
			type: 'tvslst',
			tag: 'filterUiRoot',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tag: 'cohortFilter',
					renderAs: 'htmlSelect',
					selectOptionsFrom: 'selectCohort',
					tvs: {
						term: termdbConfig.selectCohort.term,
						values: [
							{
								key: 'ABC',
								label: 'ABC'
							}
						]
					}
				}
			]
		},
		callback(filter) {
			opts.filterData = filter
			/*** filter.api.main() is already called in filter.refresh() before this callback ***/
			//opts.filter.main(opts.filterData)
		}
	})

	const rootAndOr = opts.filter.Inner.dom.holder.selectAll('.sja_filter_add_transformer')

	await opts.filter.main(opts.filterData)
	test.equal(opts.filter.Inner.dom.holder.selectAll('select').size(), 1, 'should have an HTML select element')
	const orBtn = rootAndOr.filter(d => d === 'or').node()
	test.equal(orBtn && orBtn.style.display, 'none', 'should hide the OR button to add root filter items')
	const andBtn = rootAndOr.filter(d => d === 'and').node()
	test.notEqual(andBtn && andBtn.style.display, 'none', 'should show the AND button to add root filter items')

	opts.filterData.join = 'and'
	opts.filterData.lst.push(agedx())
	await opts.filter.main(opts.filterData)
	test.equal(
		rootAndOr
			.filter(function () {
				return this.style.display === 'none'
			})
			.size(),
		2,
		'should not offer an AND or OR button to subnest the root filter'
	)

	const joinLabel = opts.filter.Inner.dom.holder.select('.sja_filter_join_label')
	joinLabel.node().click()
	const tipd = opts.filter.Inner.dom.controlsTip.d
	const menuRows = tipd.selectAll('tr')
	const removeOpt = menuRows.filter(d => d.action == 'remove').node()
	test.equal(removeOpt && removeOpt.style.display, 'none', 'should hide the Remove option')
	opts.filter.Inner.dom.controlsTip.hide()

	test.end()
})

tape('getNormalRoot()', async test => {
	test.timeoutAfter(3000)
	test.plan(8)

	{
		// direct testing of getNormalRoot
		const A = { type: 'tvs', tvs: { term_A: true } }
		const B = { type: 'tvs', tvs: { term_B: true } }
		const C = { type: 'tvs', tvs: { term_C: true } }
		const D = { type: 'tvs', tvs: { term_D: true } }
		const input = {
			type: 'tvslst',
			//in:true, // cannot set in=true here. output.lst[0].type becomes "tvslst". see if this is issue
			join: 'and',
			lst: [
				{
					type: 'tvslst',
					join: 'and',
					lst: [A, B]
				},
				{
					type: 'tvslst',
					join: 'and',
					lst: [C, D]
				}
			]
		}
		const output = getNormalRoot(input)
		const expectedOutput = {
			type: 'tvslst',
			//in:true,
			join: 'and',
			lst: [A, B, C, D]
		}
		test.deepEqual(output, expectedOutput, 'should flatten (A && B) && (C && D) into A && B && C && D')
		test.notEqual(output.lst[0], A, 'should not output original filter data')
	}

	{
		// allow negating tvslst of single tvs (needed for single-group-based custom term...)
		const A = { type: 'tvs', tvs: { term_A: true } }
		const input = {
			type: 'tvslst',
			join: 'and',
			lst: [
				{
					type: 'tvslst',
					in: false,
					lst: [A]
				}
			]
		}
		const output = getNormalRoot(structuredClone(input))
		const Acopy = structuredClone(A)
		Acopy.tvs.isnot = true // negate the tvs based on input.lst[0].in === false
		const expectedOutput = {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [Acopy] // since the nested tvslst with negation was removed, the 'hoisted' tvs must be negated
		}
		test.deepEqual(output, expectedOutput, 'should allow tvslst of single-tvs to be negated')
	}

	const hidden = {
		// HIDDEN static filters
		// not accessible to users
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [diaggrp(), agedx()]
	}
	const opts = getOpts({
		filterData: {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [
				{
					type: 'tvslst',
					in: true,
					join: 'and',
					lst: [
						{
							tag: 'filterUiRoot',
							type: 'tvslst',
							in: true,
							join: '',
							lst: []
						},
						hidden
					]
				},
				{
					type: 'tvslst',
					in: true,
					join: '',
					lst: []
				}
			]
		}
	})

	await opts.filter.main(opts.filterData)
	test.deepEqual(
		// optional to supply a filterData argument
		// otherwise the filter UI will use its own rawFilter
		opts.filter.getNormalRoot(opts.filterData),
		hidden,
		'should return only the hidden parts when the user configurable parts are empty'
	)

	const singleUserConfig = gettvs('abc', 123)
	await opts.filter.main({
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						tag: 'filterUiRoot',
						type: 'tvslst',
						in: true,
						join: '',
						lst: [singleUserConfig]
					},
					hidden
				]
			},
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: []
			}
		]
	})

	test.deepEqual(
		opts.filter.getNormalRoot(),
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [singleUserConfig, ...hidden.lst]
		},
		'should return only the hidden -AND- one additional restriction'
	)

	const twoEntryLst = [gettvs('abc', 123), gettvs('xyz', '999')]
	const userConfiguredFilters = {
		tag: 'filterUiRoot',
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: twoEntryLst
	}
	await opts.filter.main({
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [userConfiguredFilters, hidden]
			},
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: []
			}
		]
	})

	test.deepEqual(
		opts.filter.getNormalRoot(),
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [...userConfiguredFilters.lst, ...hidden.lst]
		},
		'should return only the hidden -AND- two-entry tvslst restrictions'
	)

	const filterData2 = {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [userConfiguredFilters, hidden]
			},
			{
				type: 'tvslst',
				in: true,
				join: 'or',
				lst: [gettvs('def', '444'), gettvs('rst', '555')]
			}
		]
	}
	await opts.filter.main(filterData2)
	test.deepEqual(
		opts.filter.getNormalRoot(),
		{
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [
				{
					type: 'tvslst',
					in: true,
					join: 'and',
					lst: [...userConfiguredFilters.lst, ...hidden.lst]
				},
				gettvs('def', '444'),
				gettvs('rst', '555')
			]
		},
		'should return the hidden plus all user configured options'
	)

	const filterData3 = {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvslst',
						tag: 'filterUiRoot',
						in: true,
						join: '',
						lst: []
					},
					hidden
				]
			},
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [gettvs('def', '444'), gettvs('rst', '555')]
			}
		]
	}
	await opts.filter.main(filterData3)
	test.deepEqual(
		opts.filter.getNormalRoot(),
		{
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [
				hidden,
				{
					type: 'tvslst',
					in: true,
					join: 'and',
					lst: [gettvs('def', '444'), gettvs('rst', '555')]
				}
			]
		},
		'should return the hidden plus user configured options after removing empty tvslst'
	)

	test.end()
})

tape('filterJoin()', test => {
	test.timeoutAfter(3000)
	test.plan(7)

	const abc = Object.freeze({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [Object.freeze(gettvs('abc', 123))]
	})

	test.notEqual(
		filterJoin([abc]),
		abc,
		'should return a copy of any filter in the argument instead of modifying the original'
	)

	test.deepEqual(filterJoin([abc]), abc, 'should return an only-filter of the lst argument')

	test.deepEqual(
		filterJoin([
			abc,
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [gettvs('xyz', 444)]
			}
		]),
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [gettvs('abc', 123), gettvs('xyz', 444)]
		},
		'should combine two single-entry filters into one filter with join="and"'
	)

	test.equal(abc.join, '', 'should not modify any filter in the argument')

	test.deepEqual(
		filterJoin([
			{
				type: 'tvslst',
				in: true,
				join: 'or',
				lst: [gettvs('abc', 123), gettvs('def', 'test')]
			},
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [gettvs('xyz', 444)]
			}
		]),
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					type: 'tvslst',
					in: true,
					join: 'or',
					lst: [gettvs('abc', 123), gettvs('def', 'test')]
				},
				gettvs('xyz', 444)
			]
		},
		'should subnest an or-joined filter when combining with another under a parent filter joined by "and"'
	)

	const mssg1 = 'should throw with a non-empty filter.join value when filter.lst.length < 2'
	try {
		filterJoin([
			{
				type: 'tvslst',
				in: true,
				join: 'and', // should be empty since there is only one .lst[] item
				lst: [gettvs('abc', 123)]
			},
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [gettvs('xyz', 444)]
			}
		])
		test.fail(mssg1)
	} catch (e) {
		test.pass(mssg1)
	}

	{
		const singleTvs = {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [gettvs('aaa', 11)]
		}
		test.deepEqual(
			filterJoin([{ type: 'tvslst', in: true, join: '', lst: [] }, singleTvs]),
			singleTvs,
			'joining single tvs into empty filter should yield join=""'
		)
	}

	test.end()
})

tape('\n', test => {
	test.comment('-***- filterRxCompInit() tests-***-')
	test.end()
})

tape('Rx filter state inputs', async test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	/* Manually created app for this test
	
	TODO: Write a helper function to test rx components 
	independent of apps */

	let filterData = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [],
		$id: 'fake'
	}
	const opts = {
		holder
	}

	const app = {
		opts,
		state: {
			activeCohort: 0,
			vocab: {
				genome: 'hg38-test',
				dslabel: 'TermdbTest'
			},
			termfilter: {
				filter: filterData
			}
		},
		callback(filter) {
			filterData = filter
		},
		dispatch(action) {
			console.log(action)
		}
	}

	const filterApi = await filterRxCompInit({
		app,
		holder,
		state: app.state,
		vocab: app.state.vocab,
		debug: true,
		hideLabel: true,
		callback: filter => {
			app.dispatch({
				type: 'filter_replace',
				filter
			})
		}
	})

	const filter = filterApi.Inner
	filter.state = filter.getState(app.state)
	filter.main(filterData)

	test.equal(typeof filter.state.activeCohort, 'number', 'Should include .activeCohort int in filter.state')
	test.equal(typeof filter.state.termfilter, 'object', 'Should include .termfilter object in filter.state')

	const message = `Should throw for null state`

	try {
		filter.state = filter.getState(null)
		filter.main(filterData)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

tape('\n', test => {
	test.comment('-***- filterPromptInit() tests-***-')
	test.end()
})

tape('filterPromptInit()', async test => {
	test.timeoutAfter(3000)

	const holder = getHolder()
	const opts = {
		//Create opts for filterPrompt
		filterData: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: []
		},
		vocab: {
			genome: 'hg38-test',
			dslabel: 'TermdbTest'
		},
		callback(filter) {
			opts.filterData = filter
			opts.filterUiRoot = getFilterItemByTag(filter, 'filterUiRoot')
		}
	}

	opts.filter = await filterPromptInit({
		//Attach filter prompt to opts
		holder,
		emptyLabel: 'Filter Prompt',
		vocab: opts.vocab,
		debug: true,
		callback: opts.callback
	})

	await opts.filter.main(opts.filterData)
	const filter = opts.filter.Inner
	const btn = filter.dom.holder.select('.sja_new_filter_btn.sja_menuoption').node()
	btn.click()

	//Click first parent term
	const parentTerms = await detectGte({ elem: filter.dom.termSrcDiv.node(), selector: '.termbtn' })
	parentTerms[0].click()

	//Click the first and only leaf term
	const leafTerm = await detectOne({ elem: filter.dom.termSrcDiv.node(), selector: '.sja_tree_click_term.termlabel' })
	leafTerm.click()

	//Test all the relevant dom elements are present
	test.equal(filter.dom.treeTip.dnode.style.display, 'block', `Should display variable selection menu`)
	const backBtn = await detectOne({ elem: filter.dom.treeTip.dnode, selector: 'div> div> span' })
	test.ok(backBtn.innerText.includes('Back to variable selection'), `Should display back button`)
	const inputs = await detectGte({ elem: filter.dom.treeTip.dnode, selector: 'input', count: 3 })
	test.ok(
		inputs.find(i => i.id == 'checkboxHeader'),
		`Should display 'Check/Uncheck All' checkbox`
	)
	test.ok(inputs.length > 2, `Should show checkbox for at least one variable`)

	backBtn.click()
	const findTree = filter.dom.termSrcDiv.node().querySelectorAll('.termbtn')
	test.ok(findTree.length > 1, `Should display tree after clicking back button`)

	test.end()
})
