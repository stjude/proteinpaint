import tape from 'tape'
import { profilePlot } from '../profilePlot.js'

/*
Tests for the filter legend row count that the profile charts use to size their svg when the
legend is stacked under the plot in comparison mode. The count must agree with what
addFilterLegendItem() actually draws, so both read the same hasFilterValue() predicate.

  • title row is always counted, even with no filters applied
  • one row per filter holding a value; unset/empty filters are skipped
  • an empty array and an empty string both count as unset
  • the count matches the number of rows addFilterLegendItem() draws for the same settings
*/

const FILTER_TWS = [
	{ term: { id: 'region', name: 'Region' } },
	{ term: { id: 'country', name: 'Country' } },
	{ term: { id: 'income', name: 'Income Group' } }
]

const { hasFilterValue, getFilterLegendRowCount, addFilterLegendItem } = profilePlot.prototype as any

/* getFilterLegendRowCount() only reads config.filterTWs and settings, so a bare context suffices. */
const rowCount = (settings: any) =>
	getFilterLegendRowCount.call({ config: { filterTWs: FILTER_TWS }, settings, hasFilterValue })

tape('\n', function (test) {
	test.comment('-***- profile/filterLegendRows -***-')
	test.end()
})

tape('counts the title row when no filter is applied', function (test) {
	test.equal(rowCount({}), 1, 'no filters set → title row only')
	test.equal(rowCount({ region: undefined, country: null }), 1, 'undefined/null values are not rows')
	test.end()
})

tape('counts one row per filter holding a value', function (test) {
	test.equal(rowCount({ region: ['AFR'] }), 2, 'title + one array filter')
	test.equal(rowCount({ region: ['AFR'], country: 'Kenya' }), 3, 'title + array + string filter')
	test.equal(rowCount({ region: ['AFR', 'EMR'], country: 'Kenya', income: ['Low'] }), 4, 'title + all three filters')
	test.end()
})

tape('treats an empty array and an empty string as unset', function (test) {
	test.equal(rowCount({ region: [] }), 1, 'empty array is not a row')
	test.equal(rowCount({ region: '' }), 1, 'empty string is not a row')
	test.equal(rowCount({ region: [], country: ['Kenya'] }), 2, 'only the populated filter counts')
	test.end()
})

tape('count matches the rows addFilterLegendItem() draws', function (test) {
	const settings = { region: ['AFR'], country: '', income: ['Low', 'Lower-middle'] }

	// Stand-in for the d3 filterG: records an append() per row addFilterLegendItem() decides to draw.
	let drawn = 0
	const stubText: any = { append: () => stubText, attr: () => stubText, text: () => stubText }
	const ctx: any = {
		hasFilterValue,
		filtersCount: 0,
		filterG: {
			append: () => {
				drawn++
				return { attr: () => stubText }
			}
		}
	}
	for (const tw of FILTER_TWS) addFilterLegendItem.call(ctx, tw.term.name, settings[tw.term.id])

	test.equal(drawn, 2, 'two filters hold values, so two rows are drawn')
	test.equal(rowCount(settings), drawn + 1, 'row count is the drawn rows plus the title')
	test.end()
})
