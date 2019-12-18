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
function getCallbacks(opts) {
	for (const grp of opts.filterGrps) {
		grp.id = id++
	}
	return {
		addGrp(data) {
			const grp = [data.term]
			grp.id = id++
			opts.filterGrps.push(grp)
			opts.filter.main(opts.filterGrps)
		},
		removeGrp(id) {
			const i = opts.filterGrps.findIndex(grp => grp.id === id)
			if (i == -1) return
			opts.filterGrps.splice(i, 1)
			opts.filter.main(opts.filterGrps)
		},
		addTerm: data => {
			const grp = opts.filterGrps.filter(grp => grp.id === data.id)[0]
			if (!grp) return
			grp.push(data.term)
			opts.filter.main(opts.filterGrps)
		}
	}
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/tvslst -***-')
	test.end()
})

tape('rendered pill groups', async test => {
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
		callback: getCallbacks(opts)
	})

	await opts.filter.main(opts.filterGrps)
	const filterDiv = holder.node().querySelectorAll('.tvs_pill_grp') //[0]
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

tape('group update', async test => {
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

	const callback = getCallbacks(opts)
	opts.filter = TvsLstInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		callback
	})

	await opts.filter.main(opts.filterGrps)
	callback.removeGrp(opts.filterGrps[1].id)

	const filterDiv1 = holder.node().querySelectorAll('.tvs_pill_grp') //[0]
	test.equal(filterDiv1.length, opts.filterGrps.length, 'should update to have less term group entries and pills')
	let mismatchedNumTerms1 = 0
	holder.selectAll('.tvs_pill_grp').each(function(d) {
		if (d.length != this.querySelectorAll('.tvs_pill_wrapper').length) mismatchedNumTerms1++
	})
	test.true(
		mismatchedNumTerms1 < 1,
		'should update to have fewer number of pill divs in a pill group as terms in a filter group'
	)
	test.end()
})
