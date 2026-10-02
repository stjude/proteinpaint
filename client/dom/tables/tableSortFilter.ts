import type { ColumnFilter, SortState, TableBaseRow } from './tableTypes'

/** Longest filter text kept. A filter is matched against every row on each keystroke. */
export const MAX_FILTER_LENGTH = 100

/** Sorts rows in place by one column. A column of numeric strings (e.g. file names used as ids)
 * sorts numerically rather than lexically. Rows with a missing value keep their relative position. */
export function sortRows(rows: TableBaseRow[], colIdx: number, ascending: boolean): TableBaseRow[] {
	const allNumericStrings = rows.every(row => {
		const v = row[colIdx]?.value
		return typeof v === 'string' && Number.isFinite(+v)
	})
	return rows.sort((a, b) => {
		const aVal = a[colIdx]?.value
		const bVal = b[colIdx]?.value
		if (aVal == null || bVal == null) return 0
		if (typeof aVal === 'number' && typeof bVal === 'number') return ascending ? aVal - bVal : bVal - aVal
		if (allNumericStrings) return ascending ? +aVal - +bVal : +bVal - +aVal
		if (typeof aVal === 'string' && typeof bVal === 'string') {
			return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
		}
		return 0
	})
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
export function filterAndSort(rows: TableBaseRow[], filters: Map<number, ColumnFilter>, sort?: SortState): TableBaseRow[] {
	let visible = filters.size ? rows.filter(row => rowMatchesFilters(row, filters)) : rows
	if (sort) visible = sortRows(visible === rows ? visible.slice() : visible, sort.colIdx, sort.ascending)
	return visible
}
