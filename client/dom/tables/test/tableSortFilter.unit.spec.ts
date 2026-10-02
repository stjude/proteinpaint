import tape from 'tape'
import {
	MAX_FILTER_LENGTH,
	filterAndSort,
	makeColumnFilter,
	parseNumericFilter,
	rowMatchesFilters,
	sortRows
} from '../tableSortFilter'
import type { ColumnFilter, TableBaseRow } from '../tableTypes'

/*
Tests:
	sortRows: numbers, strings, numeric strings, descending, missing values, in place
	parseNumericFilter: comparisons, ranges, plain text
	parseNumericFilter: a long digit string with a bad ending does not hang
	makeColumnFilter: trims, lowercases, caps the length, empty means no filter
	rowMatchesFilters: substring, numeric expressions, urls, AND across columns
	filterAndSort: filters then sorts, never reorders or changes the input
*/

const rows = (...values: (string | number | undefined)[][]): TableBaseRow[] =>
	values.map(row => row.map(value => (value === undefined ? {} : { value })))
const column = (rowsToRead: TableBaseRow[], colIdx = 0) => rowsToRead.map(row => row[colIdx].value)

tape('\n', test => {
	test.comment('-***- dom/tables/tableSortFilter -***-')
	test.end()
})

tape('sortRows: numbers, strings, numeric strings, descending, missing values, in place', test => {
	test.deepEqual(column(sortRows(rows([3], [1], [2]), 0, true)), [1, 2, 3], 'numbers ascending')
	test.deepEqual(column(sortRows(rows([3], [1], [2]), 0, false)), [3, 2, 1], 'numbers descending')
	test.deepEqual(column(sortRows(rows(['b'], ['a'], ['c']), 0, true)), ['a', 'b', 'c'], 'strings ascending')
	test.deepEqual(column(sortRows(rows(['b'], ['a'], ['c']), 0, false)), ['c', 'b', 'a'], 'strings descending')
	test.deepEqual(
		column(sortRows(rows(['1000'], ['50'], ['5'], ['500']), 0, true)),
		['5', '50', '500', '1000'],
		'a column of numeric strings sorts by number'
	)
	test.deepEqual(
		column(sortRows(rows(['10'], ['9'], ['x']), 0, true)),
		['10', '9', 'x'].sort((a, b) => a.localeCompare(b)),
		'one non-numeric string makes the whole column sort as text'
	)
	const input = rows([2], [1])
	test.equal(sortRows(input, 0, true), input, 'sorts and returns the same array')
	test.end()
})

tape('sortRows: rows with no value keep their positions while the rest sort around them', test => {
	const order = (values: (string | number | undefined)[], ascending = true) =>
		column(sortRows(rows(...values.map(v => [v])), 0, ascending))

	test.deepEqual(
		order(['b', undefined, 'a']),
		['a', undefined, 'b'],
		'b, missing, a: sorted, missing stays in the middle'
	)
	test.deepEqual(order(['b', undefined, 'a'], false), ['b', undefined, 'a'], 'descending')
	test.deepEqual(order([undefined, 'b', undefined, 'a']), [undefined, 'a', undefined, 'b'], 'several missing stay put')
	test.deepEqual(order(['c', 'b', 'a', undefined]), ['a', 'b', 'c', undefined], 'missing at the end stays at the end')
	test.deepEqual(order([undefined, 'b', 'a']), [undefined, 'a', 'b'], 'missing at the start stays at the start')
	test.deepEqual(order([undefined, undefined]), [undefined, undefined], 'all missing')
	test.deepEqual(order([]), [], 'no rows')
	test.deepEqual(order([3, NaN, 1]), [1, NaN, 3], 'NaN counts as missing and stays in place')
	test.deepEqual(
		order(['10', undefined, '9']),
		['9', undefined, '10'],
		'numeric strings still sort by number around a missing value'
	)
	test.end()
})

tape('sortRows: the same result whatever order the rows start in, including mixed types', test => {
	const values: (string | number | undefined)[] = [3, 'b', undefined, 1, 'a']
	const permutations = (items: any[]): any[][] =>
		items.length <= 1
			? [items]
			: items.flatMap((item, i) =>
					permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest])
			  )

	for (const ascending of [true, false]) {
		// the slots that hold a value are fixed by where the missing value is, so compare the values in order
		const results = new Set(
			permutations(values).map(p =>
				JSON.stringify(column(sortRows(rows(...p.map((v: any) => [v])), 0, ascending)).filter(v => v !== undefined))
			)
		)
		test.equal(results.size, 1, `every starting order sorts the same way ${ascending ? 'ascending' : 'descending'}`)
		test.deepEqual(
			JSON.parse([...results][0]),
			ascending ? [1, 3, 'a', 'b'] : ['b', 'a', 3, 1],
			ascending ? 'numbers before text' : 'text before numbers when descending'
		)
	}
	test.end()
})

tape('parseNumericFilter: comparisons, ranges, plain text', test => {
	const accepts = (text: string, n: number) => parseNumericFilter(text)!(n)
	test.ok(accepts('>30', 31) && !accepts('>30', 30), '>')
	test.ok(accepts('>=30', 30) && !accepts('>=30', 29), '>=')
	test.ok(accepts('<30', 29) && !accepts('<30', 30), '<')
	test.ok(accepts('<=30', 30) && !accepts('<=30', 31), '<=')
	test.ok(accepts('=30', 30) && !accepts('=30', 31), '=')
	test.ok(accepts('<= 30', 30), 'spaces after the operator')
	test.equal(parseNumericFilter('30'), undefined, 'a bare number is plain text, so it matches by substring')
	test.ok(accepts('20-30', 20) && accepts('20-30', 30) && !accepts('20-30', 31), 'inclusive range')
	test.ok(accepts('30-20', 25), 'a reversed range works')
	test.ok(accepts('-5--2', -3) && !accepts('-5--2', 0), 'negative ends')
	test.ok(accepts('>1.5', 2) && !accepts('>1.5', 1.5), 'decimals')
	test.ok(accepts('>.5', 1), 'a leading decimal point')
	for (const text of ['', 'abc', '>', '>abc', '>1.2.3', '1-', '--5', '>>5', '5-2-1']) {
		test.equal(parseNumericFilter(text), undefined, `${JSON.stringify(text)} is plain text`)
	}
	test.end()
})

tape('parseNumericFilter: a long digit string with a bad ending does not hang', test => {
	for (const hostile of [
		'>' + '1'.repeat(200000) + 'x',
		'1'.repeat(100000) + '-' + '1'.repeat(100000) + 'x',
		'-'.repeat(200000)
	]) {
		const start = performance.now()
		parseNumericFilter(hostile)
		test.ok(performance.now() - start < 500, `returns promptly for ${hostile.length} characters`)
	}
	test.end()
})

tape('makeColumnFilter: trims, lowercases, caps the length, empty means no filter', test => {
	test.equal(makeColumnFilter(''), undefined, 'empty')
	test.equal(makeColumnFilter('   '), undefined, 'blank')
	test.equal(makeColumnFilter('  AbC ')!.text, 'abc', 'trimmed and lowercased')
	test.equal(makeColumnFilter('x'.repeat(MAX_FILTER_LENGTH + 50))!.text.length, MAX_FILTER_LENGTH, 'capped')
	test.equal(typeof makeColumnFilter('>5')!.test, 'function', 'a numeric expression gets a test')
	test.equal(makeColumnFilter('abc')!.test, undefined, 'plain text does not')
	test.end()
})

tape('rowMatchesFilters: substring, numeric expressions, urls, AND across columns', test => {
	const filters = (entries: [number, string][]) =>
		new Map<number, ColumnFilter>(entries.map(([colIdx, text]) => [colIdx, makeColumnFilter(text)!]))
	const row: TableBaseRow = [{ value: 'Alice' }, { value: 30 }, { url: 'https://example.com/x' }]

	test.ok(rowMatchesFilters(row, filters([])), 'no filters keeps the row')
	test.ok(rowMatchesFilters(row, filters([[0, 'ALI']])), 'case-insensitive substring')
	test.notOk(rowMatchesFilters(row, filters([[0, 'bob']])), 'no match')
	test.ok(rowMatchesFilters(row, filters([[1, '>=30']])), 'numeric expression on a number')
	test.notOk(rowMatchesFilters(row, filters([[1, '>30']])), 'numeric expression excludes')
	test.ok(rowMatchesFilters(row, filters([[1, '3']])), 'plain digits match a number by substring')
	test.ok(rowMatchesFilters(row, filters([[2, 'example']])), 'a url-only cell matches on its url')
	test.notOk(rowMatchesFilters([{ value: '30' }], filters([[0, '>40']])), 'an expression is text for a string cell')
	test.ok(
		rowMatchesFilters(
			row,
			filters([
				[0, 'a'],
				[1, '<40']
			])
		),
		'every filter must pass: both do'
	)
	test.notOk(
		rowMatchesFilters(
			row,
			filters([
				[0, 'a'],
				[1, '<20']
			])
		),
		'every filter must pass: one fails'
	)
	test.end()
})

tape('filterAndSort: filters then sorts, never reorders or changes the input', test => {
	const input = rows(['Charlie', 35], ['Alice', 30], ['Bob', 25])
	const snapshot = [...input]
	const filters = new Map<number, ColumnFilter>()

	test.equal(filterAndSort(input, filters), input, 'nothing to do returns the input itself')
	const sorted = filterAndSort(input, filters, { colIdx: 1, ascending: true })
	test.deepEqual(column(sorted), ['Bob', 'Alice', 'Charlie'], 'sorted')
	test.deepEqual(input, snapshot, 'the input array keeps its order')
	test.notEqual(sorted, input, 'sorting works on a copy')

	filters.set(0, makeColumnFilter('li')!)
	test.deepEqual(
		column(filterAndSort(input, filters, { colIdx: 1, ascending: false })),
		['Charlie', 'Alice'],
		'filter then sort'
	)
	test.deepEqual(input, snapshot, 'still unchanged')
	test.end()
})
