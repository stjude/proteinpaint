import tape from 'tape'
import { negateFilter, joinToFilterUiRoot, getCategoricalTermFilter, Filter } from '../filter.js'
import { termjson } from '../../test/testdata/termjson.js'
import * as d3s from 'd3-selection'

/**************
 test sections
**************

negateFilter
joinToFilterUiRoot

*/

tape('\n', test => {
	test.comment('-***- filter/unit -***-')
	test.end()
})

tape('negateFilter', test => {
	{
		const f = { tag: 'filterUiRoot', in: true }
		const f2 = negateFilter(f)
		test.equal(f2.in, false, 'f.in toggled to false')
		const f3 = negateFilter(f2)
		test.equal(f3.in, true, 'f.in toggled to true')
	}

	{
		const f = {
			type: 'tvslst',
			lst: [
				{ tag: 'othertag', in: true },
				{ tag: 'filterUiRoot', in: true }
			]
		}
		const f2 = negateFilter(f)
		test.equal(f2.lst[1].in, false, 'f.lst[1].in toggled to false')
		const f3 = negateFilter(f, 'othertag')
		test.equal(f3.lst[0].in, false, 'f.lst[0].in toggled to false (by custom tag)')
	}

	// tvslst with single tvs. this is from groups UI generating a custom term by a single group
	{
		const f = {
			type: 'tvslst',
			lst: [{ type: 'tvs', tvs: {} }]
		}
		const f2 = negateFilter(f)
		test.equal(f2.lst[0].tvs.isnot, true, 'f.lst[0].tvs.isnot toggled to true')
	}

	// tvslst with multiple tvs.
	{
		const f = {
			type: 'tvslst',
			in: true,
			lst: [{}, {}]
		}
		const f2 = negateFilter(f)
		test.equal(f2.in, false, 'f.in toggled to false')
	}

	test.throws(() => negateFilter({}), /cannot negate filter/, 'throws')

	test.end()
})

tape('joinToFilterUiRoot', test => {
	const sexTvs = { type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key: '1' }] } }
	const diaggrpTvs = { type: 'tvs', tvs: { term: { id: 'diaggrp', type: 'categorical' }, values: [{ key: 'ALL' }] } }
	const agedxTvs = { type: 'tvs', tvs: { term: { id: 'agedx', type: 'float' }, ranges: [{ start: 1, stop: 5 }] } }

	{
		const globalFilter = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{ type: 'tvslst', in: true, join: '', tag: 'cohortFilter', lst: [diaggrpTvs] },
				{ type: 'tvslst', in: true, join: '', tag: 'filterUiRoot', lst: [] }
			]
		}
		const globalFilterCopy = structuredClone(globalFilter)
		const filters = [{ type: 'tvslst', in: true, join: '', lst: [sexTvs] }]
		const filtersCopy = structuredClone(filters)
		test.deepEqual(
			joinToFilterUiRoot(globalFilter, filters),
			{ type: 'tvslst', in: true, join: '', tag: 'filterUiRoot', lst: [sexTvs] },
			'should join a filter to an empty filterUiRoot that is nested in the global filter, without the cohort filter'
		)
		test.deepEqual(globalFilter, globalFilterCopy, 'should not modify the global filter')
		test.deepEqual(filters, filtersCopy, 'should not modify the joined filters')
	}

	{
		const globalFilter = { type: 'tvslst', in: true, join: '', tag: 'filterUiRoot', lst: [sexTvs] }
		const filters = [
			{ type: 'tvslst', in: true, join: '', lst: [agedxTvs] },
			{ type: 'tvslst', in: true, join: 'or', lst: [diaggrpTvs, agedxTvs] }
		]
		test.deepEqual(
			joinToFilterUiRoot(globalFilter, filters),
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				tag: 'filterUiRoot',
				lst: [sexTvs, agedxTvs, { type: 'tvslst', in: true, join: 'or', lst: [diaggrpTvs, agedxTvs] }]
			},
			'should join multiple filters to a non-empty filterUiRoot under "and"'
		)
	}

	test.throws(
		() => joinToFilterUiRoot({ type: 'tvslst', in: true, join: '', lst: [] }, []),
		/missing filterUiRoot/,
		'should throw if the global filter does not have the filterUiRoot tag'
	)

	test.end()
})

tape('getCategoricalTermFilter()', t => {
	const filterTWs = [
		termjson.Acountry,
		termjson.AWHO_region,
		termjson.AIncome_group,
		termjson.AFC_TypeofFacility,
		termjson.AFC_TeachingFacility
	]
	const countryTW = filterTWs.find(tw => tw.term.id === 'Acountry')
	const valuesCountry = { Acountry: 'Kenya' }
	const result1 = getCategoricalTermFilter(filterTWs, valuesCountry, countryTW)
	t.deepEqual(
		result1,
		{ type: 'tvslst', in: true, join: '', lst: [] },
		'Should filter out samples according to all the filter values except for the tw provided, as only one filter is provided and is for the tw passed there is no filter added'
	)

	const result2 = getCategoricalTermFilter(filterTWs, valuesCountry, null)
	const countryFilter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: countryTW.term,
					values: [
						{
							key: 'Kenya'
						}
					]
				}
			}
		]
	}
	t.deepEqual(
		result2,
		countryFilter,
		'If there is no tw provided build filter with all the terms specified in the values'
	)

	const valuesCountryType = { Acountry: 'Kenya', AFC_TypeofFacility: 'Cancer Hospital or Institute' }
	const facilityTypeTW = filterTWs.find(tw => tw.term.id === 'AFC_TypeofFacility')
	const result3 = getCategoricalTermFilter(filterTWs, valuesCountryType, facilityTypeTW)
	t.deepEqual(
		result3,
		countryFilter,
		`Create filter with the other values provided, therefore filter only by the country value specified.
         This allows to find the facilities for Kenya and build the dropdown with all the facility types found.`
	)
	const countrySiteFilter = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: countryTW.term,
					values: [
						{
							key: 'Kenya'
						}
					]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: facilityTypeTW.term,
					values: [
						{
							key: 'Cancer Hospital or Institute'
						}
					]
				}
			}
		]
	}
	const result4 = getCategoricalTermFilter(filterTWs, valuesCountryType, null)
	t.deepEqual(
		result4,
		countrySiteFilter,
		`We want to build the filter with all the filter values provided, as there are values for both country and facility type the filter should include both.
         terms and values should be the ones specified in the values object.`
	)

	t.end()
})

tape('getFilterExcludingPill()', async test => {
	const holder = d3s.select('body').append('div')
	const f0 = new Filter({ holder, vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' }, callback: () => {} })
	const root = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: termjson.sex, values: [{ key: '1' }] }, $id: 0 }]
	}
	await f0.main(JSON.stringify(root))

	{
		const f = f0.getFilterExcludingPill(root.lst[0].$id)
		test.deepEqual(
			f,
			{
				type: 'tvslst',
				join: '',
				in: true,
				lst: [],
				$id: 0,
				tag: 'filterUiRoot'
			},
			`should return a root filter copy without the pill tvs (empty lst[])`
		)
	}

	// simulate FilterRxComp by adding global state filter
	const cohortTvs = {
		tag: 'cohortFilter',
		type: 'tvs',
		tvs: { term: { id: 'subcohort', type: 'multivalue' }, values: [{ key: 'ABC', label: 'ABC' }] }
	}
	f0.state = {
		termfilter: {
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [structuredClone(cohortTvs)]
			}
		}
	}

	f0.app = {
		getState: () => f0.state
	}

	{
		const f = f0.getFilterExcludingPill(root.lst[0].$id)
		test.deepEqual(
			f,
			{ type: 'tvslst', in: true, join: '', lst: [structuredClone(cohortTvs)] },
			`should return a root filter copy without the pill tvs, but joined to global filter`
		)
	}

	if (test._ok) f0.destroy()
	test.end()
})

tape('getTreeFilter()', async test => {
	const holder = d3s.select('body').append('div')
	const app = {
		getState: () => f0.state
	}
	const f0 = new Filter({ app, holder, vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' }, callback: () => {} })
	const root = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: termjson.sex, values: [{ key: '1' }] } }]
	}
	await f0.main(JSON.stringify(root))

	// simulate FilterRxComp by adding global state filter
	const cohortTvs = {
		tag: 'cohortFilter',
		type: 'tvs',
		tvs: { term: { id: 'subcohort', type: 'multivalue' }, values: [{ key: 'ABC', label: 'ABC' }] }
	}
	f0.state = {
		termfilter: {
			filter: {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [structuredClone(cohortTvs)]
			}
		}
	}

	{
		const f = f0.getTreeFilter('or')
		test.deepEqual(
			f,
			{ type: 'tvslst', in: true, join: '', lst: [] },
			`should return a tree filter that is NOT joined to global filter if the first argument='or'`
		)
	}

	{
		const f = f0.getTreeFilter('and')
		const tvs = structuredClone(cohortTvs)

		test.deepEqual(
			f,
			{ type: 'tvslst', in: true, join: 'and', lst: [structuredClone(root.lst[0]), structuredClone(cohortTvs)] },
			`should return a tree filter that IS joined to global filter if the first argument='and'`
		)
	}

	if (test._ok) f0.destroy()
	test.end()
})
