/**
 * TableBase class is for rendering HTML tables with advanced features and interactions.
 * This is the follow up to renderTable() in ./table.ts. This should be a more sophisticated, 
 * maintainable solution for table rendering. 
 * 
 * Rationale: For use cases requiring advanced functions, another class can 
 * extended TableBase for specific advanced functionalities. This will prevent a main
 * class from becoming overly complex and difficult to maintain.
 * 
 * TODOs: 
 * Architecture and design consider actions:
 * 1. TableBase should be designed to be easily extendable for advanced functionalities.
 * 2. Consider separation of concerns to keep the core table logic independent from advanced features.
 * 
 * What to implement: 
 * - Clean and maintainable code. Encapsulation, optimization, and testing is key. 
 * - Data processing should be enforced for the caller but if required, encapsulated and tested. 
 * 
 * What to avoid: 
 * - Excessive code complexity. This is a constant struggle in this code base. I want something
 * clean, understandable, and maintainable. 
 * - Excessive feature bloat and by extension, excessive init options. This class should have the essential features
 * of the a table, but not overloaded with unnecessary features. 
 * - Guardrails from misuse or unintended side effects. A structure that will discourage developers from 
 * making additions rather than extending the class. 
 * - Excessive rerendering or updating. The CALLER is responsible for triggering updates when necessary but 
 * this code should make it easy for the caller to do so with some helper methods or hooks.
 * 
 * 
 * Features to implement: 
 * 1. Basic table structure and initialization
 * 2. Row and column management
 * 3. Cell editing and interaction, ad hoc. On columns denoted as editable.
 * 4. Sorting and filtering capabilities
 * 5. Pagination support
 * 6. Responsive design and layout adjustments
 * 7. Accessibility support (keyboard navigation, screen reader compatibility)
 * 8. Export and import functionality (CSV, Excel, etc.)
 * 9. Customizable cell rendering and formatting
 */


import type { Table, Th, Tr, Td } from '../types/d3'

export type TableBaseCell = {
	/** primary text/number content, rendered with .text() */
	value?: string | number
	/** renders the cell as an <a href>; used as the link text too when value is not set */
	url?: string
	/** raw html for the cell, rendered with .html(). caller is responsible for sanitizing */
	html?: string
	/** text color when value is set, else the cell's background color */
	color?: string
	dataTestId?: string
	/** attached after render so external/subclass code can reach the rendered <td> */
	__td?: Td
}

export type TableBaseRow = TableBaseCell[]

export type TableBaseColumn = {
	label: string
	width?: string
	align?: 'left' | 'center' | 'right'
	/** set white-space: nowrap on every <td> of this column */
	nowrap?: boolean
	headerTestId?: string
	tooltip?: string
	/** clicking the header label toggles ascending/descending sort on this column */
	sortable?: boolean
	/** renders a text input in the header; rows are kept only if this column's text contains the input (case-insensitive) */
	filterable?: boolean
}

type SortState = { colIdx: number; ascending: boolean }

/** Sorts rows in place by one column. A column of numeric strings (e.g. file names used as ids)
 * sorts numerically rather than lexically. Rows with a missing value keep their relative position. */
function sortRows(rows: TableBaseRow[], colIdx: number, ascending: boolean): TableBaseRow[] {
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

export type TableBaseOpts = {
	/** d3 selection to render the table into */
	div: any
	columns: TableBaseColumn[]
	rows: TableBaseRow[]
	/** alternate row background color. default true */
	striped?: boolean
	/** show a left-hand line-number column. default false */
	showLines?: boolean
	maxWidth?: string
	maxHeight?: string
	dataTestId?: string
}

/**
 * Minimal, extendable table renderer. Holds only what every table needs -
 * structure, columns, rows, cell rendering - and exposes protected extension
 * points (renderHeader/renderHeaderCell/renderBody/renderRow/renderCell) for
 * subclasses to override when they need sorting, pagination, selection,
 * editing, etc. Add those features by extending this class, not by adding
 * options here.
 */
export class TableBase {
	protected div: any
	protected columns: TableBaseColumn[]
	/** the caller's rows in their original order. Never reordered or filtered; sort/filter work on copies */
	protected originalRows: TableBaseRow[]
	/** original index of each row object, built once, so callbacks can report indexes into the caller's array */
	protected originalIndex: Map<TableBaseRow, number>
	/** the rows currently displayed, after filtering and sorting */
	protected rows: TableBaseRow[]
	protected sortState?: SortState
	/** active column filters: column index -> text the cell must contain */
	protected filters = new Map<number, string>()
	protected sortIndicators = new Map<number, any>()
	protected striped: boolean
	protected showLines: boolean
	protected maxWidth: string
	protected maxHeight: string
	protected dataTestId?: string

	protected wrapper?: any
	protected table?: Table
	protected thead?: any
	protected tbody?: any

	constructor(opts: TableBaseOpts) {
		TableBase.validate(opts)
		this.div = opts.div
		this.columns = opts.columns
		this.originalRows = opts.rows
		this.originalIndex = new Map(opts.rows.map((row, i) => [row, i]))
		this.rows = opts.rows
		this.striped = opts.striped ?? true
		this.showLines = opts.showLines ?? false
		this.maxWidth = opts.maxWidth || '90vw'
		this.maxHeight = opts.maxHeight || '40vh'
		this.dataTestId = opts.dataTestId
	}

	protected static validate(opts: TableBaseOpts) {
		if (!opts.div) throw new Error('TableBase: missing div')
		if (!opts.columns?.length) throw new Error('TableBase: missing columns')
		if (!opts.rows) throw new Error('TableBase: missing rows')
		TableBase.validateRows(opts.rows, opts.columns)
	}

	protected static validateRows(rows: TableBaseRow[], columns: TableBaseColumn[]) {
		const badLines: number[] = []
		for (const [i, row] of rows.entries()) {
			if (row.length !== columns.length) badLines.push(i + 1)
		}
		if (badLines.length) throw new Error(`TableBase: row length does not match column count at line(s) ${badLines}`)
	}

	/** Builds the table from scratch. Safe to call again: removes any previously rendered table first. */
	render(): this {
		this.remove()
		this.wrapper = this.createWrapper()
		this.table = this.createTable()
		this.thead = this.table.append('thead')
		this.tbody = this.table.append('tbody')
		this.renderHeader()
		this.update()
		return this
	}

	/** Removes the rendered table from the DOM, if present. */
	remove(): void {
		this.wrapper?.remove()
		this.wrapper = undefined
	}

	getColumns(): TableBaseColumn[] {
		return this.columns
	}

	getRows(): TableBaseRow[] {
		return this.rows
	}

	/** Index of a row in the array the caller passed in, regardless of the current sort/filter. -1 if unknown.
	 * Use this, not the displayed position, when reporting rows back to the caller. */
	getOriginalIndex(row: TableBaseRow): number {
		return this.originalIndex.get(row) ?? -1
	}

	/** Redraws the body only; the header (and any filter input focus) is untouched.
	 * With no argument, shows the caller's rows filtered and sorted by the current state.
	 * With rows, shows exactly those rows instead (an override for subclasses, e.g. pagination). */
	update(rows?: TableBaseRow[]): this {
		const next = rows ?? this.computeVisibleRows()
		TableBase.validateRows(next, this.columns)
		this.rows = next
		this.renderBody()
		return this
	}

	/** Sorts by a sortable column. Repeat calls on the same column toggle ascending/descending. */
	sortByColumn(colIdx: number): this {
		if (!this.columns[colIdx]?.sortable) return this
		const ascending = this.sortState?.colIdx === colIdx ? !this.sortState.ascending : true
		this.sortState = { colIdx, ascending }
		this.updateSortIndicators()
		return this.update()
	}

	/** Keeps only rows whose cell in this column contains text (case-insensitive). Empty text clears the filter. */
	setColumnFilter(colIdx: number, text: string): this {
		const trimmed = text.trim().toLowerCase()
		if (trimmed) this.filters.set(colIdx, trimmed)
		else this.filters.delete(colIdx)
		return this.update()
	}

	/** Filters first so the sort only handles the rows that remain. Never mutates originalRows. */
	protected computeVisibleRows(): TableBaseRow[] {
		let visible = this.originalRows
		if (this.filters.size) visible = visible.filter(row => this.matchesFilters(row))
		if (this.sortState) {
			visible = sortRows(visible === this.originalRows ? visible.slice() : visible, this.sortState.colIdx, this.sortState.ascending)
		}
		return visible
	}

	protected matchesFilters(row: TableBaseRow): boolean {
		for (const [colIdx, text] of this.filters) {
			const cell = row[colIdx]
			const shown = cell.value ?? cell.url ?? ''
			if (!String(shown).toLowerCase().includes(text)) return false
		}
		return true
	}

	protected updateSortIndicators(): void {
		for (const [colIdx, indicator] of this.sortIndicators) {
			const sorted = this.sortState?.colIdx === colIdx
			indicator.text(!sorted ? '' : this.sortState!.ascending ? '▲' : '▼')
		}
	}

	/** Extension point: customize the outer scrollable wrapper. */
	protected createWrapper() {
		return this.div
			.append('div')
			.attr('class', 'sjpp-table-base sjpp_show_scrollbar')
			.style('display', 'inline-block')
			.style('background-color', 'white')
			.style('max-width', this.maxWidth)
			.style('max-height', this.maxHeight)
	}

	/** Extension point: customize the <table> element itself. */
	protected createTable(): Table {
		const table = this.wrapper.append('table').style('width', '100%')
		if (this.dataTestId) table.attr('data-testid', this.dataTestId)
		return table
	}

	/** Extension point: rebuilds the header row. Only runs from render(), never on update(). */
	protected renderHeader(): void {
		this.thead.selectAll('tr').remove()
		this.sortIndicators.clear()
		const tr: Tr = this.thead.append('tr')
		if (this.showLines) tr.append('th').style('width', '1vw')
		this.columns.forEach((column, colIdx) => this.renderHeaderCell(tr, column, colIdx))
		this.updateSortIndicators()
	}

	/** Extension point: render a single header cell, including its sort and filter controls. */
	protected renderHeaderCell(tr: Tr, column: TableBaseColumn, colIdx: number): Th {
		const th: Th = tr.append('th').attr('class', 'sjpp_table_header')
		if (column.width) th.style('width', column.width)
		if (column.headerTestId) th.attr('data-testid', column.headerTestId)
		if (column.tooltip) th.attr('title', column.tooltip)

		const label = th.append('span').attr('class', 'sjpp-table-header-label').text(column.label)
		if (column.sortable) {
			const indicator = th.append('span').attr('class', 'sjpp-table-sort-indicator').style('margin-left', '4px')
			for (const clickable of [label, indicator]) {
				clickable.style('cursor', 'pointer').on('click', () => this.sortByColumn(colIdx))
			}
			this.sortIndicators.set(colIdx, indicator)
		}
		if (column.filterable) {
			th.append('input')
				.attr('type', 'text')
				.attr('placeholder', 'Filter')
				.attr('class', 'sjpp-table-filter-input')
				.attr('data-testid', `sjpp-table-filter-${colIdx}`)
				.attr('value', this.filters.get(colIdx) ?? '')
				.style('display', 'block')
				.style('width', '90%')
				.style('font-weight', 'normal')
				.on('input', (event: Event) => this.setColumnFilter(colIdx, (event.target as HTMLInputElement).value))
		}
		return th
	}

	/** Extension point: rebuilds all body rows. Called by render() and update(). */
	protected renderBody(): void {
		this.tbody.selectAll('tr').remove()
		this.rows.forEach((row, rowIdx) => this.renderRow(row, rowIdx))
	}

	/** Extension point: render a single row. Subclasses adding selection/click
	 * behavior should override this. */
	protected renderRow(row: TableBaseRow, rowIdx: number): Tr {
		const tr: Tr = this.tbody.append('tr').attr('class', 'sjpp_row_wrapper')
		if (this.striped && rowIdx % 2 === 1) tr.style('background-color', 'rgb(245,245,245)')
		if (this.showLines) {
			tr.append('td')
				.text(rowIdx + 1)
				.style('text-align', 'center')
				.style('width', '1vw')
				.style('font-size', '0.8rem')
		}
		row.forEach((cell, colIdx) => this.renderCell(tr, cell, colIdx, /*rowIdx*/))
		return tr
	}

	/** Extension point: render a single cell. Subclasses adding editing,
	 * barplots, buttons, etc. should override this. */
	protected renderCell(tr: Tr, cell: TableBaseCell, colIdx: number, /*rowIdx: number*/): Td {
		const column = this.columns[colIdx]
		const td: Td = tr.append('td').attr('class', 'sjpp_table_item')
		if (cell.dataTestId) td.attr('data-testid', cell.dataTestId)
		if (column.width) td.style('width', column.width)
		if (column.align) td.style('text-align', column.align)
		if (column.nowrap) td.style('white-space', 'nowrap')

		if (cell.url) {
			td.append('a')
				.text(cell.value != null ? cell.value : cell.url)
				.attr('href', cell.url)
				.attr('target', '_blank')
				// prevent reverse tabnabbing: the opened page must not get window.opener, nor the referrer
				.attr('rel', 'noopener noreferrer')
		} else if (cell.html) {
			td.html(cell.html)
		} else if (cell.value != null) {
			td.text(cell.value)
			if (cell.color) td.style('color', cell.color)
		} else if (cell.color) {
			td.style('background-color', cell.color)
		}

		cell.__td = td
		return td
	}
}