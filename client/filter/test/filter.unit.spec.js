import tape from 'tape'
import { negateFilter, getCategoricalTermFilter } from '../filter.js'
import { termjson } from '../../test/testdata/termjson.js'

/**************
 test sections
**************

negateFilter

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
	const emptyFilter = { type: 'tvslst', in: true, join: '', lst: [] }
	const result1 = getCategoricalTermFilter(filterTWs, valuesCountry, countryTW)
	t.deepEqual(
		result1,
		emptyFilter,
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
