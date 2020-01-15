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

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/filter -***-')
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
	await addDemographicSexFilter(
		opts,
		tipd
			.selectAll('tr')
			.filter(d => d.action == 'join-and')
			.node()
	)
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
	tipd
		.selectAll('tr')
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
