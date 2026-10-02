import type { ColumnFilter, SortState, TableBaseRow } from './tableTypes'

/** Longest filter text kept. A filter is matched against every row on each keystroke. */
export const MAX_FILTER_LENGTH = 100

/** Sorts rows in place by one column and returns them.
 *
 * Rows with no value in the column (undefined, null or NaN) keep the exact positions they hold. Only the
 * rows that have a value are sorted, and are written back into the positions that held a value. Returning
 * 0 from a comparator whenever a value is missing would make "equal" intransitive (b < a is false,
 * a == missing, missing == b), and the result of the sort would depend on the engine.
 *
 * A column whose values are all numeric strings (e.g. file names used as ids) sorts by number rather than
 * as text. In a column that mixes numbers and text, numbers come before text (after it when descending). */
export function sortRows(rows: TableBaseRow[], colIdx: number, ascending: boolean): TableBaseRow[] {
	const valueOf = (row: TableBaseRow) => row[colIdx]?.value
	const hasValue = (row: TableBaseRow) => {
		const v = valueOf(row)
		return v != null && !(typeof v === 'number' && Number.isNaN(v))
	}

	// the positions that hold a value, and the rows in them
	const slots: number[] = []
	const withValue: TableBaseRow[] = []
	rows.forEach((row, i) => {
		if (!hasValue(row)) return
		slots.push(i)
		withValue.push(row)
	})

	const allNumericStrings = withValue.every(row => {
		const v = valueOf(row)
		return typeof v === 'string' && Number.isFinite(+v)
	})
	withValue.sort((a, b) => {
		const aVal = valueOf(a)!
		const bVal = valueOf(b)!
		let order: number
		if (typeof aVal === 'number' && typeof bVal === 'number') order = aVal - bVal
		else if (allNumericStrings) order = +aVal - +bVal
		else if (typeof aVal === 'string' && typeof bVal === 'string') order = aVal.localeCompare(bVal)
		else order = typeof aVal === 'number' ? -1 : 1
		return ascending ? order : -order
	})

	slots.forEach((slot, k) => (rows[slot] = withValue[k]))
	return rows
}

// Written so that no digit can match two ways. The looser '\d+\.?\d*' backtracks quadratically on a long
// run of digits followed by a character that fails the match.
const NUM = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)'
const COMPARE = new RegExp(`^(>=|<=|>|<|=)\\s*(${NUM})$`)
const RANGE = new RegExp(`^(${NUM})\\s*-\\s*(${NUM})$`)

/** Reads >n, >=n, <n, <=n, =n and lo-hi (inclusive). Anything else is plain text and returns undefined,
 * so a number cell is still matched by substring, e.g. "3" keeps 30 and 35. */
export function parseNumericFilter(text: string): ((n: number) => boolean) | undefined {
	const compare = COMPARE.exec(text)
	if (compare) {
		const limit = Number(compare[2])
		switch (compare[1]) {
			case '>':
				return n => n > limit
			case '>=':
				return n => n >= limit
			case '<':
				return n => n < limit
			case '<=':
				return n => n <= limit
			default:
				return n => n === limit
		}
	}
	const range = RANGE.exec(text)
	if (range) {
		const a = Number(range[1])
		const b = Number(range[2])
		const [lo, hi] = a <= b ? [a, b] : [b, a]
		return n => n >= lo && n <= hi
	}
}

/** The filter for what a user typed, or undefined when it is empty and the column should not be filtered. */
export function makeColumnFilter(text: string): ColumnFilter | undefined {
	const trimmed = text.trim().slice(0, MAX_FILTER_LENGTH).toLowerCase()
	return trimmed ? { text: trimmed, test: parseNumericFilter(trimmed) } : undefined
}

/** True when the row passes every column filter. */
export function rowMatchesFilters(row: TableBaseRow, filters: Map<number, ColumnFilter>): boolean {
	for (const [colIdx, { text, test }] of filters) {
		const cell = row[colIdx]
		if (test && typeof cell.value === 'number') {
			if (!test(cell.value)) return false
			continue
		}
		const shown = cell.value ?? cell.url ?? ''
		if (!String(shown).toLowerCase().includes(text)) return false
	}
	return true
}

/** Filters first so the sort only handles the rows that remain. Never reorders or changes `rows`. */
export function filterAndSort(
	rows: TableBaseRow[],
	filters: Map<number, ColumnFilter>,
	sort?: SortState
): TableBaseRow[] {
	let visible = filters.size ? rows.filter(row => rowMatchesFilters(row, filters)) : rows
	if (sort) visible = sortRows(visible === rows ? visible.slice() : visible, sort.colIdx, sort.ascending)
	return visible
}
