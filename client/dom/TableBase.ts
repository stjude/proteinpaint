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
	/** renders a text input in the header; rows are kept only if this column's text contains the input (case-insensitive).
	 * Number cells also accept >n, >=n, <n, <=n, =n and lo-hi */
	filterable?: boolean
	/** clicking a text cell in this column turns it into an input. Enter or blur commits, Escape cancels.
	 * Cells with a url or html are not editable. Changes are reported through opts.onEdit */
	editable?: boolean
	/** Allowlist check on edited text in an editable column, e.g. text => /^[\w .-]+$/.test(text).
	 * An edit it rejects is reverted and onEdit is not called. Cells that hold a number only accept numbers regardless */
	validate?: (text: string) => boolean
}

/** Longest text an edit may commit. Keeps an oversized paste from reaching whatever handles onEdit */
const MAX_EDIT_LENGTH = 500

/** WARNING: cell.value is raw user input. The table rejects obviously bad edits (see TableBaseColumn.validate)
 * but cannot make a value safe for a query, file path or shell. If it is sent to a server, the server must
 * validate it and use parameterized queries. Never build SQL or commands by string concatenation. */
export type TableBaseEdit = {
	/** index of the edited row in the array the caller passed in, regardless of sort/filter */
	rowIdx: number
	colIdx: number
	/** the cell, with cell.value already updated */
	cell: TableBaseCell
}

/** incremented id plus a random suffix: unique on the page even with several tables or other code using the same prefix */
let idIncr = 0
const randomSuffix = Math.random()
function uniqueId(str: string) {
	return `sjpp-${str}-${idIncr++}-${randomSuffix}`
}

type SortState ={ colIdx: number; ascending: boolean }

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

type ColumnFilter = {
	/** lowercased text the user typed */
	text: string
	/** set when the text is a numeric expression such as >30, <=5 or 20-30; applied to number cells only */
	test?: (n: number) => boolean
}

const NUM = '-?(?:\\d+\\.?\\d*|\\.\\d+)'
const COMPARE = new RegExp(`^(>=|<=|>|<|=)\\s*(${NUM})$`)
const RANGE = new RegExp(`^(${NUM})\\s*-\\s*(${NUM})$`)

/** Reads >n, >=n, <n, <=n, =n and lo-hi (inclusive). Anything else is plain text and returns undefined,
 * so a number cell is still matched by substring, e.g. "3" keeps 30 and 35. */
function parseNumericFilter(text: string): ((n: number) => boolean) | undefined {
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

/** Appearance only. Anything that changes how the table looks rather than what it does belongs here. */
export type TableBaseStyles = {
	/** alternate row background color. default true */
	striped?: boolean
	/** show a left-hand line-number column. default false */
	showLines?: boolean
	/** default 90vw */
	maxWidth?: string
	/** default 40vh */
	maxHeight?: string
}

export type TableBaseOpts = {
	/** d3 selection to render the table into */
	div: any
	columns: TableBaseColumn[]
	rows: TableBaseRow[]
	styles?: TableBaseStyles
	dataTestId?: string
	/** accessible name for the table, read by screen readers. Recommended: say what the table contains */
	ariaLabel?: string
	/** called after the user commits an edit in an editable column */
	onEdit?: (edit: TableBaseEdit) => void
	/** Makes rows selectable. Called whenever the user selects or deselects a row, however they do it:
	 * the input, a click anywhere on the row, or Enter/Space on the focused row. There is one code path,
	 * so the callback is identical in single and multiple mode.
	 * idx is the row's index in the array the caller passed in, regardless of sort/filter.
	 * node is the row's <input>; read node.checked for the new state. Without this, no selection column is rendered. */
	onSelect?: (idx: number, node: HTMLInputElement) => void
	/** radio buttons, one row selected at a time. Default is checkboxes, any number of rows */
	singleMode?: boolean
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
	/** active column filters, by column index */
	protected filters = new Map<number, ColumnFilter>()
	protected sortIndicators = new Map<number, any>()
	protected striped: boolean
	protected showLines: boolean
	protected maxWidth: string
	protected maxHeight: string
	protected dataTestId?: string
	protected ariaLabel?: string
	protected onEdit?: (edit: TableBaseEdit) => void
	protected onSelect?: (idx: number, node: HTMLInputElement) => void
	protected singleMode: boolean
	/** shared by every selection input so radios group and checkboxes post together */
	protected inputName = uniqueId('input')
	/** selected row objects. Keyed by row, not by position or DOM, so it survives sort, filter and redraws.
	 * Rows hidden by a filter stay selected */
	protected selected = new Set<TableBaseRow>()

	protected wrapper?: any
	protected table?: Table
	protected thead?: any
	protected tbody?: any
	protected status?: any

	constructor(opts: TableBaseOpts) {
		TableBase.validate(opts)
		this.div = opts.div
		this.columns = opts.columns
		this.originalRows = opts.rows
		this.originalIndex = new Map(opts.rows.map((row, i) => [row, i]))
		this.rows = opts.rows
		const styles = opts.styles || {}
		this.striped = styles.striped ?? true
		this.showLines = styles.showLines ?? false
		this.maxWidth = styles.maxWidth || '90vw'
		this.maxHeight = styles.maxHeight || '40vh'
		this.dataTestId = opts.dataTestId
		this.ariaLabel = opts.ariaLabel
		this.onEdit = opts.onEdit
		this.onSelect = opts.onSelect
		this.singleMode = opts.singleMode ?? false
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
		this.status = this.createStatus()
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

	/** Original indexes of the selected rows, ascending, including rows a filter is currently hiding. */
	getSelectedIndexes(): number[] {
		return [...this.selected].map(row => this.getOriginalIndex(row)).sort((a, b) => a - b)
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
		this.update()
		this.announce(`Sorted by ${this.columns[colIdx].label}, ${ascending ? 'ascending' : 'descending'}`)
		return this
	}

	/** Tells screen readers about a change they cannot see. The status element is created in render(). */
	protected announce(message: string): void {
		this.status?.text(message)
	}

	/** Keeps only rows whose cell in this column contains text (case-insensitive). Number cells also accept
	 * >n, >=n, <n, <=n, =n and lo-hi. Empty text clears the filter. */
	setColumnFilter(colIdx: number, text: string): this {
		const trimmed = text.trim().toLowerCase()
		if (trimmed) this.filters.set(colIdx, { text: trimmed, test: parseNumericFilter(trimmed) })
		else this.filters.delete(colIdx)
		this.update()
		this.announce(`Showing ${this.rows.length} of ${this.originalRows.length} rows`)
		return this
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
		for (const [colIdx, { text, test }] of this.filters) {
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

	protected updateSortIndicators(): void {
		for (const [colIdx, indicator] of this.sortIndicators) {
			const sorted = this.sortState?.colIdx === colIdx
			indicator.text(!sorted ? '' : this.sortState!.ascending ? '▲' : '▼')
			const th = (indicator.node() as HTMLElement).closest('th')
			th?.setAttribute('aria-sort', !sorted ? 'none' : this.sortState!.ascending ? 'ascending' : 'descending')
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
		if (this.ariaLabel) table.attr('aria-label', this.ariaLabel)
		return table
	}

	/** Extension point: a visually hidden live region for screen reader announcements. */
	protected createStatus() {
		return this.wrapper
			.append('div')
			.attr('role', 'status')
			.attr('aria-live', 'polite')
			.attr('class', 'sjpp-table-status')
			.style('position', 'absolute')
			.style('width', '1px')
			.style('height', '1px')
			.style('overflow', 'hidden')
			.style('clip', 'rect(0 0 0 0)')
			.style('white-space', 'nowrap')
	}

	/** Extension point: rebuilds the header row. Only runs from render(), never on update(). */
	protected renderHeader(): void {
		this.thead.selectAll('tr').remove()
		this.sortIndicators.clear()
		const tr: Tr = this.thead.append('tr')
		if (this.showLines) tr.append('th').attr('scope', 'col').attr('aria-label', 'Row number').style('width', '1vw')
		if (this.onSelect) {
			tr.append('th')
				.attr('scope', 'col')
				.attr('aria-label', this.singleMode ? 'Select a row' : 'Select rows')
				.style('width', '1.5vw')
		}
		this.columns.forEach((column, colIdx) => this.renderHeaderCell(tr, column, colIdx))
		this.updateSortIndicators()
	}

	/** Extension point: render a single header cell, including its sort and filter controls. */
	protected renderHeaderCell(tr: Tr, column: TableBaseColumn, colIdx: number): Th {
		const th: Th = tr.append('th').attr('class', 'sjpp_table_header').attr('scope', 'col')
		if (column.width) th.style('width', column.width)
		if (column.headerTestId) th.attr('data-testid', column.headerTestId)
		if (column.tooltip) th.attr('title', column.tooltip)

		if (column.sortable) {
			// a real <button> is focusable and answers Enter/Space without extra key handling
			const button = th
				.append('button')
				.attr('type', 'button')
				.attr('class', 'sjpp-table-sort-button')
				.style('background', 'none')
				.style('border', 'none')
				.style('padding', '0')
				.style('font', 'inherit')
				.style('color', 'inherit')
				.style('cursor', 'pointer')
				.on('click', () => this.sortByColumn(colIdx))
			button.append('span').attr('class', 'sjpp-table-header-label').text(column.label)
			// the arrow is decorative: aria-sort on the <th> carries the state for screen readers
			const indicator = button
				.append('span')
				.attr('class', 'sjpp-table-sort-indicator')
				.attr('aria-hidden', 'true')
				.style('margin-left', '4px')
			this.sortIndicators.set(colIdx, indicator)
		} else {
			th.append('span').attr('class', 'sjpp-table-header-label').text(column.label)
		}
		if (column.filterable) {
			th.append('input')
				.attr('type', 'text')
				.attr('aria-label', `Filter ${column.label}`)
				.attr('placeholder', 'Filter')
				.attr('class', 'sjpp-table-filter-input')
				.attr('data-testid', `sjpp-table-filter-${colIdx}`)
				.attr('value', this.filters.get(colIdx)?.text ?? '')
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
		const tr: Tr = this.tbody.append('tr').attr('class', 'sjpp_row_wrapper').datum(row)
		if (this.striped && rowIdx % 2 === 1) tr.style('background-color', 'rgb(245,245,245)')
		if (this.showLines) {
			tr.append('td')
				.text(rowIdx + 1)
				.style('text-align', 'center')
				.style('width', '1vw')
				.style('font-size', '0.8rem')
		}
		const input = this.onSelect ? this.renderSelector(tr, row) : undefined
		row.forEach((cell, colIdx) => this.renderCell(tr, cell, colIdx, /*rowIdx*/))
		if (input) this.labelSelector(input, row, rowIdx)
		return tr
	}

	/** Extension point: the selection input and the row behavior that drives it. Every route to a
	 * selection change ends in the input's 'change' event, handled once in onSelectChange(). */
	protected renderSelector(tr: Tr, row: TableBaseRow): any {
		const input: any = tr
			.append('td')
			.style('width', '1.5vw')
			.append('input')
			.attr('type', this.singleMode ? 'radio' : 'checkbox')
			.attr('name', this.inputName)
			.attr('value', this.getOriginalIndex(row))
			.property('checked', this.selected.has(row))
			.on('change', () => this.onSelectChange(row, input))

		tr.attr('tabindex', 0)
			.on('click', (event: MouseEvent) => {
				// links, buttons and inputs do their own thing; do not also toggle the row
				if (['A', 'BUTTON', 'INPUT'].includes((event.target as HTMLElement).tagName)) return
				this.toggleRow(input)
			})
			.on('keydown', (event: KeyboardEvent) => {
				// ignore keys that bubbled up from a descendant
				if (event.target !== tr.node()) return
				if (event.key == 'Enter' || event.key == ' ') {
					event.preventDefault()
					this.toggleRow(input)
				}
			})
		return input
	}

	protected toggleRow(input: any): void {
		const checked = input.property('checked') as boolean
		if (this.singleMode && checked) return
		input.property('checked', !checked)
		input.dispatch('change')
	}

	protected onSelectChange(row: TableBaseRow, input: any): void {
		if (input.property('checked')) {
			if (this.singleMode) this.selected.clear()
			this.selected.add(row)
		} else this.selected.delete(row)
		this.onSelect!(this.getOriginalIndex(row), input.node())
	}

	/** Names the input after the row's first cell with text, for screen readers. */
	protected labelSelector(input: any, row: TableBaseRow, rowIdx: number): void {
		const td = row.find(cell => cell.value != null && cell.value !== '')?.__td
		if (!td) return void input.attr('aria-label', `Select row ${rowIdx + 1}`)
		let id = td.attr('id')
		if (!id) td.attr('id', (id = uniqueId('td')))
		input.attr('aria-labelledby', id)
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
			// the color is the only content, so give screen readers something to read
			td.attr('aria-label', cell.color)
		}

		if (column.editable && !cell.url && !cell.html) {
			td.style('cursor', 'text')
				.attr('tabindex', 0)
				.attr('aria-description', 'Press Enter to edit')
				.on('click', (event: MouseEvent) => {
					// editing a cell must not also select the row
					event.stopPropagation()
					this.startEdit(td, tr, cell, colIdx)
				})
				.on('keydown', (event: KeyboardEvent) => {
					// ignore keys that bubbled up from the edit input
					if (event.target !== td.node()) return
					if (event.key == 'Enter' || event.key == 'F2') {
						event.preventDefault()
						this.startEdit(td, tr, cell, colIdx)
					}
				})
		}

		cell.__td = td
		return td
	}

	/** Swaps the cell text for an input. A number cell only accepts a number, so a numeric column cannot
	 * be filled with arbitrary text and sorting keeps working. Invalid edits revert silently.
	 * The table is not redrawn: the caller decides when to call update(). */
	protected startEdit(td: Td, tr: Tr, cell: TableBaseCell, colIdx: number): void {
		if (!td.select('input').empty()) return
		const before = cell.value ?? ''
		let finished = false
		const input = td
			.text('')
			.append('input')
			.attr('type', 'text')
			.attr('class', 'sjpp-table-edit-input')
			.attr('aria-label', `Edit ${this.columns[colIdx].label}`)
			.attr('maxlength', MAX_EDIT_LENGTH)
			.style('width', '100%')
			.property('value', before)

		const isNumber = typeof before === 'number'
		const validate = this.columns[colIdx].validate
		const isValid = (text: string) =>
			text.length <= MAX_EDIT_LENGTH &&
			(!isNumber || (text.trim() !== '' && Number.isFinite(+text))) &&
			(!validate || validate(text))

		const finish = (commit: boolean) => {
			if (finished) return
			finished = true
			const text = input.property('value') as string
			if (commit && text !== String(before) && isValid(text)) {
				cell.value = isNumber ? +text : text
				td.text(cell.value)
				this.onEdit?.({ rowIdx: this.getOriginalIndex(tr.datum() as TableBaseRow), colIdx, cell })
			} else td.text(before)
		}
		input
			.on('keydown', (event: KeyboardEvent) => {
				if (event.key != 'Enter' && event.key != 'Escape') return
				finish(event.key == 'Enter')
				// the input is gone, so hand focus back to the cell rather than dropping it on <body>
				;(td.node() as HTMLElement).focus()
			})
			.on('blur', () => finish(true))

		const node = input.node() as HTMLInputElement
		node.focus()
		node.select()
	}
}