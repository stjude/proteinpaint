const tape = require('tape')
const d3s = require('d3-selection')
const TvsLstInit = require('../tvslst').TvsLstInit

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify tvslst.spec.js -o ../../../public/bin/spec.bundle.js -v

*/

/*************************
 reusable helper functions
**************************/

let id = 0
function getCallback(opts) {
	for (const grp of opts.filterGrps) {
		grp.id = id++
	}
	return function(tvslst) {
		//console.log(22, tvslst)
		opts.filterGrps = tvslst
		opts.filter.main(opts.filterGrps)
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/tvslst -***-')
	test.end()
})

tape('rendered filter', async test => {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '20px')
		.style('border', '1px solid #000')
		.style('max-width', '300px')

	const opts = {
		filterGrps: [
			[
				{
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
			],
			[
				{
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
				},
				{
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
			]
		]
	}

	opts.filter = TvsLstInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		callback: getCallback(opts)
	})

	await opts.filter.main(opts.filterGrps)
	const filterDiv = holder.node().querySelectorAll('.tvs_pill_grp')
	test.equal(filterDiv.length, opts.filterGrps.length, 'a <div class=tvs_pill_grp> is created each term group entry')
	let mismatchedNumTerms = 0
	holder.selectAll('.tvs_pill_grp').each(function(d) {
		if (d.length != this.querySelectorAll('.tvs_pill_wrapper').length) mismatchedNumTerms++
	})
	test.true(
		mismatchedNumTerms < 1,
		'should have the same number of pill divs in a pill group as terms in a filter group'
	)
	//test.true(mismatchedNumTerms < 1, 'should have the same number of pill divs in a pill group as terms in a filter group')
	test.end()
})

tape('filter removal', async test => {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '20px')
		.style('border', '1px solid #000')
		.style('max-width', '300px')

	const opts = {
		filterGrps: [
			[
				{
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
			],
			[
				{
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
				},
				{
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
			]
		]
	}

	opts.filter = TvsLstInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		callback: getCallback(opts)
	})

	await opts.filter.main(opts.filterGrps)
	const grp2pill1label = opts.filterGrps[1][0].term.name

	const removers1 = holder.node().querySelectorAll('.tvs_pill_term_remover')
	removers1[removers1.length - 1].click()
	const filterDiv1 = holder.node().querySelectorAll('.tvs_pill_grp') //[0]
	test.equal(
		filterDiv1.length,
		opts.filterGrps.length,
		'should have the same number of pill groups after removing a pill from a multi-pill group'
	)
	test.equal(
		holder
			.node()
			.querySelectorAll('.tvs_pill_grp')[1]
			.querySelectorAll('.term_name_btn')[0].innerHTML,
		grp2pill1label,
		'should remove the second pill of the second group'
	)
	let mismatchedNumTerms1 = 0
	holder.selectAll('.tvs_pill_grp').each(function(d) {
		if (d.length != this.querySelectorAll('.tvs_pill_wrapper').length) mismatchedNumTerms1++
	})
	test.true(mismatchedNumTerms1 < 1, 'should update to have fewer number of pill divs in the affected pill group')

	const prevNumGrps = filterDiv1.length
	const removers2 = holder.node().querySelectorAll('.tvs_pill_term_remover')
	removers2[removers2.length - 1].click()

	const filterDiv2 = holder.node().querySelectorAll('.tvs_pill_grp')
	test.equal(
		prevNumGrps - 1,
		opts.filterGrps.length,
		'should have one less pill group after removing a pill from a single-pill group'
	)
	let mismatchedNumTerms2 = 0
	holder.selectAll('.tvs_pill_grp').each(function(d) {
		if (d.length != this.querySelectorAll('.tvs_pill_wrapper').length) mismatchedNumTerms1++
	})
	test.true(mismatchedNumTerms2 < 1, 'should have the correct number of pills')

	test.end()
})

tape('filter addition', async test => {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '20px')
		.style('border', '1px solid #000')
		.style('max-width', '300px')

	const opts = {
		filterGrps: [
			[
				{
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
			]
		]
	}

	opts.filter = TvsLstInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		debug: true,
		callback: getCallback(opts)
	})

	await opts.filter.main(opts.filterGrps)
	const adders1 = holder.node().querySelectorAll('.sja_filter_term_join_label')
	const adder1 = adders1[adders1.length - 1]
	adder1.click()
	await sleep(200)

	// termdiv[1] is assumed to be Demographics
	const termdiv1 = opts.filter.Inner.dom.tip.d.node().querySelectorAll('.termdiv')[1]
	termdiv1.querySelectorAll('.termbtn')[0].click()
	await sleep(200)

	const termdivSex = termdiv1.querySelectorAll('.termdiv')[2]
	termdivSex.querySelectorAll('.termview')[0].click()
	await sleep(600)

	const origGrp0Len = opts.filterGrps[0].length
	termdivSex.querySelector('.bars-cell > rect').dispatchEvent(new Event('click', { bubbles: true }))
	test.equal(origGrp0Len + 1, opts.filterGrps[0].length, '+term should increase a filter group by one term')
	test.equal(opts.filterGrps.length, 1, '+term should not change the number of groups')

	const adders2 = holder.node().querySelectorAll('.add_grp_btn')
	const adder2 = adders2[adders2.length - 1]
	adder2.click()
	await sleep(200)

	// termdiv[1] is assumed to be Demographics
	const termdiv2 = opts.filter.Inner.dom.tip.d.node().querySelectorAll('.termdiv')[1]
	termdiv2.querySelectorAll('.termbtn')[0].click()
	await sleep(200)

	const termdivSex2 = termdiv2.querySelectorAll('.termdiv')[2]
	termdivSex2.querySelectorAll('.termview')[0].click()
	await sleep(600)

	const origLstLen = opts.filterGrps.length
	termdivSex2.querySelector('.bars-cell > rect').dispatchEvent(new Event('click', { bubbles: true }))
	test.equal(origLstLen + 1, opts.filterGrps.length, '+grp should increase the number of filter groups by one')
	test.equal(opts.filterGrps[0].length, 2, '+grp should not change the number of terms in preceding groups')
	test.end()
})
