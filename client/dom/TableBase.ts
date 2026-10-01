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

const STRIPE = 'rgb(245,245,245)'

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

export type TableBasePagination = {
	/** rows per page */
	pageSize: number
	/** choices offered in the rows-per-page <select>. Default [10, 25, 50, 100]; pageSize is added if missing */
	pageSizeOptions?: number[]
	/** 1-based page to show first. Default 1 */
	currentPage?: number
	/** called when the page or page size changes, whether the user changed it or a sort/filter reset it to page 1 */
	onChange?: (state: { currentPage: number; pageSize: number }) => void
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
	/** css for every column header <th>, e.g. { 'font-size': '1.1em' } */
	header?: Record<string, string>
	/** css for selected rows, e.g. { 'text-decoration': 'line-through' }. Each property is cleared when the row is deselected */
	selectedRow?: Record<string, string>
	/** which side of the table the buttons sit on. Default 'right' */
	buttonsAlign?: 'left' | 'right'
}

export type TableBaseSelection = {
	/** Called whenever the user selects or deselects a row, however they do it: the input, a click anywhere
	 * on the row, the header check-all, or Enter/Space on the focused row. There is one code path, so the
	 * callback is identical in single and multiple mode.
	 * idx is the row's index in the array the caller passed in, regardless of sort/filter/page.
	 * node is the row's <input>; read node.checked for the new state. */
	onSelect?: (idx: number, node: HTMLInputElement) => void
	/** radio buttons, one row selected at a time. Default is checkboxes, any number of rows */
	singleMode?: boolean
	/** Hide the radio/checkbox. Rows are still selected by click or keyboard, but screen readers get no
	 * selected state, so only use this when the selection is conveyed another way */
	hideInput?: boolean
	/** Rows selected on first render, as indexes into rows. Does not call onSelect */
	selectedRows?: number[]
	/** Select every row on first render. Not allowed with singleMode */
	selectAll?: boolean
	/** Scroll the first selectedRows row into view on first render. Default true */
	autoScroll?: boolean
}

export type TableBaseButton = {
	text: string
	/** Called on click with the selected rows' original indexes (including rows hidden by a filter or on
	 * other pages) and the button. */
	callback: (idxs: number[], button: HTMLButtonElement) => void
	/** Called whenever the selection changes, and once on render, so the button can reflect the selection,
	 * e.g. by changing its text. A button is disabled while nothing is selected. */
	onChange?: (idxs: number[], button: HTMLButtonElement) => void
	class?: string
	dataTestId?: string
}

export type TableBaseOpts = {
	/** d3 selection to render the table into */
	div: any
	columns: TableBaseColumn[]
	rows: TableBaseRow[]
	styles?: TableBaseStyles
	/** Show one page of rows at a time, with a pager at the bottom. Sort and filter apply to all rows, not just the page */
	pagination?: TableBasePagination
	dataTestId?: string
	/** accessible name for the table, read by screen readers. Recommended: say what the table contains */
	ariaLabel?: string
	/** called after the user commits an edit in an editable column */
	onEdit?: (edit: TableBaseEdit) => void
	/** Makes rows selectable: adds the selection column (checkboxes, or radios in singleMode). Without this
	 * or buttons, rows are not selectable */
	selection?: TableBaseSelection
	/** Action buttons below the table. Their presence also makes rows selectable */
	buttons?: TableBaseButton[]
}

/**
 * Extendable table renderer. Options are grouped by concern: `styles` for appearance, `selection` and
 * `buttons` for row selection, `pagination`, and per-column flags on `columns` (sortable, filterable, editable).
 * Protected extension points (renderHeader/renderHeaderCell/renderBody/renderRow/renderCell/renderSelector/
 * createFooter) are what subclasses override for behavior that does not belong here, such as hover effects or
 * post-render hooks. Add that kind of feature by extending this class, not by adding options.
 */
export class TableBase {
	protected div: any
	protected columns: TableBaseColumn[]
	/** the caller's rows in their original order. Never reordered or filtered; sort/filter work on copies */
	protected originalRows: TableBaseRow[]
	/** original index of each row object, built once, so callbacks can report indexes into the caller's array */
	protected originalIndex: Map<TableBaseRow, number>
	/** every row that passes the filters, in sort order: what the pager counts */
	protected matched: TableBaseRow[]
	/** the rows currently displayed: the current page of matched */
	protected rows: TableBaseRow[]
	/** index in matched of the first displayed row, so line numbers continue across pages */
	protected pageStart = 0
	protected paginated: boolean
	protected pageSize: number
	protected currentPage: number
	protected pageSizeOptions: number[]
	protected onPageChange?: TableBasePagination['onChange']
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
	protected selectable: boolean
	protected onSelect?: (idx: number, node: HTMLInputElement) => void
	protected singleMode: boolean
	protected hideInput: boolean
	protected autoScroll: boolean
	/** first preselected row, scrolled into view after the first render */
	protected scrollTarget?: TableBaseRow
	protected buttons: TableBaseButton[]
	protected buttonsAlign: 'left' | 'right'
	protected headerStyle: Record<string, string>
	protected selectedRowStyle: Record<string, string>
	/** true while check-all changes many rows, so buttons and the check-all box update once at the end */
	protected bulkSelecting = false
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
	protected footer?: any
	protected buttonEls: any[] = []
	protected selectAllInput?: any
	protected pagerInfo?: any
	protected pagerNav?: any

	constructor(opts: TableBaseOpts) {
		TableBase.validate(opts)
		this.div = opts.div
		this.columns = opts.columns
		this.originalRows = opts.rows
		this.originalIndex = new Map(opts.rows.map((row, i) => [row, i]))
		this.matched = opts.rows
		this.rows = opts.rows
		const pagination = opts.pagination
		this.paginated = !!pagination
		this.pageSize = pagination?.pageSize ?? opts.rows.length
		this.currentPage = pagination?.currentPage ?? 1
		this.pageSizeOptions = [...new Set([...(pagination?.pageSizeOptions ?? [10, 25, 50, 100]), this.pageSize])].sort(
			(a, b) => a - b
		)
		this.onPageChange = pagination?.onChange
		const styles = opts.styles || {}
		this.striped = styles.striped ?? true
		this.showLines = styles.showLines ?? false
		this.maxWidth = styles.maxWidth || '90vw'
		this.maxHeight = styles.maxHeight || '40vh'
		this.dataTestId = opts.dataTestId
		this.ariaLabel = opts.ariaLabel
		this.onEdit = opts.onEdit
		this.headerStyle = styles.header ?? {}
		this.selectedRowStyle = styles.selectedRow ?? {}
		this.buttonsAlign = styles.buttonsAlign ?? 'right'
		const selection = opts.selection
		this.buttons = opts.buttons ?? []
		this.selectable = !!selection || this.buttons.length > 0
		this.onSelect = selection?.onSelect
		this.singleMode = selection?.singleMode ?? false
		this.hideInput = selection?.hideInput ?? false
		this.autoScroll = selection?.autoScroll ?? true
		if (selection?.selectAll) for (const row of opts.rows) this.selected.add(row)
		else {
			for (const i of selection?.selectedRows ?? []) this.selected.add(opts.rows[i])
			this.scrollTarget = opts.rows[selection?.selectedRows?.[0] ?? -1]
		}
	}

	protected static validate(opts: TableBaseOpts) {
		if (!opts.div) throw new Error('TableBase: missing div')
		if (!opts.columns?.length) throw new Error('TableBase: missing columns')
		if (!opts.rows) throw new Error('TableBase: missing rows')
		TableBase.validateRows(opts.rows, opts.columns)
		if (opts.pagination) {
			const { pageSize, pageSizeOptions = [] } = opts.pagination
			for (const size of [pageSize, ...pageSizeOptions]) {
				if (!Number.isInteger(size) || size < 1) throw new Error(`TableBase: invalid page size ${size}`)
			}
		}
		for (const [i, button] of (opts.buttons ?? []).entries()) {
			if (!button.text) throw new Error(`TableBase: missing buttons[${i}].text`)
			if (!button.callback) throw new Error(`TableBase: missing buttons[${i}].callback`)
		}
		const { singleMode, selectAll, selectedRows = [] } = opts.selection ?? {}
		if (singleMode && selectAll) throw new Error('TableBase: selection.selectAll is not allowed with singleMode')
		if (singleMode && selectedRows.length > 1) throw new Error('TableBase: singleMode allows only one selected row')
		for (const i of selectedRows) {
			if (!opts.rows[i]) throw new Error(`TableBase: selection.selectedRows index ${i} is out of range`)
		}
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
		if (this.paginated || this.buttons.length) this.createFooter()
		// the wrapper scrolls, so pin the header to its top
		this.thead = this.table
			.append('thead')
			.style('position', 'sticky')
			.style('top', '0')
			.style('background-color', 'white')
			.style('z-index', '1')
		this.tbody = this.table.append('tbody')
		this.renderHeader()
		this.update()
		this.scrollToSelected()
		return this
	}

	/** Scrolls the first preselected row into view, unless that row is not on the displayed page. */
	protected scrollToSelected(): void {
		const target = this.autoScroll ? this.scrollTarget : undefined
		if (!target) return
		const tr = this.tbody.selectAll('tr').filter((row: TableBaseRow) => row === target).node() as HTMLElement | null
		// the delay lets the table settle in its container first
		if (tr) setTimeout(() => tr.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 500)
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

	/** Replaces the selection from code, e.g. when app state changes which row is selected. Updates the
	 * inputs, row styles, check-all and buttons, but does not call onSelect: the caller already knows. */
	setSelectedIndexes(idxs: number[]): this {
		if (this.singleMode && idxs.length > 1) throw new Error('TableBase: singleMode allows only one selected row')
		this.selected = new Set(idxs.map(i => this.originalRows[i]).filter(Boolean))
		this.tbody?.selectAll('tr').each((row: TableBaseRow, i: number, nodes: HTMLElement[]) => {
			const input = nodes[i].querySelector(`input[name="${this.inputName}"]`) as HTMLInputElement | null
			if (input) input.checked = this.selected.has(row)
		})
		this.repaintRows()
		this.afterSelectionChange()
		return this
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
		this.matched = next
		this.renderPage()
		return this
	}

	/** Shows the current page of matched rows and redraws the pager. Keeps the page in range as matched shrinks. */
	protected renderPage(): void {
		if (this.paginated) {
			this.currentPage = Math.min(Math.max(1, this.currentPage), this.totalPages())
			this.pageStart = (this.currentPage - 1) * this.pageSize
			this.rows = this.matched.slice(this.pageStart, this.pageStart + this.pageSize)
		} else {
			this.pageStart = 0
			this.rows = this.matched
		}
		this.renderBody()
		this.renderPager()
		this.syncSelectAll()
	}

	protected totalPages(): number {
		return Math.max(1, Math.ceil(this.matched.length / this.pageSize))
	}

	/** Shows a page, 1-based, clamped to the valid range. No-op without pagination. */
	goToPage(page: number): this {
		if (!this.paginated) return this
		const next = Math.min(Math.max(1, Math.trunc(page)), this.totalPages())
		if (next === this.currentPage) return this
		this.currentPage = next
		this.renderPage()
		this.announce(`Page ${next} of ${this.totalPages()}`)
		this.onPageChange?.({ currentPage: this.currentPage, pageSize: this.pageSize })
		return this
	}

	/** Changes rows per page and returns to page 1. No-op without pagination. */
	setPageSize(size: number): this {
		if (!this.paginated || !Number.isInteger(size) || size < 1 || size === this.pageSize) return this
		this.pageSize = size
		this.currentPage = 1
		this.renderPage()
		this.announce(`${size} rows per page, page 1 of ${this.totalPages()}`)
		this.onPageChange?.({ currentPage: 1, pageSize: size })
		return this
	}

	/** A sort or filter changes which rows are on each page, so go back to page 1. Returns whether the page moved. */
	protected resetPage(): boolean {
		const moved = this.paginated && this.currentPage !== 1
		this.currentPage = 1
		return moved
	}

	/** Sorts by a sortable column. Repeat calls on the same column toggle ascending/descending. */
	sortByColumn(colIdx: number): this {
		if (!this.columns[colIdx]?.sortable) return this
		const ascending = this.sortState?.colIdx === colIdx ? !this.sortState.ascending : true
		this.sortState = { colIdx, ascending }
		this.updateSortIndicators()
		const moved = this.resetPage()
		this.update()
		this.announce(`Sorted by ${this.columns[colIdx].label}, ${ascending ? 'ascending' : 'descending'}`)
		if (moved) this.onPageChange?.({ currentPage: 1, pageSize: this.pageSize })
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
		const moved = this.resetPage()
		this.update()
		this.announce(`Showing ${this.matched.length} of ${this.originalRows.length} rows`)
		if (moved) this.onPageChange?.({ currentPage: 1, pageSize: this.pageSize })
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
			// a neutral marker on unsorted columns is what tells the user the header can be clicked
			indicator.text(!sorted ? '⇅' : this.sortState!.ascending ? '▲' : '▼')
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
		this.selectAllInput = undefined
		const tr: Tr = this.thead.append('tr')
		if (this.showLines) tr.append('th').attr('scope', 'col').attr('aria-label', 'Row number').style('width', '1vw')
		if (this.selectable) this.renderSelectHeader(tr)
		this.columns.forEach((column, colIdx) => this.renderHeaderCell(tr, column, colIdx))
		this.updateSortIndicators()
	}

	/** Extension point: the selection column's header. Multiple mode gets a check-all box that acts on the
	 * rows displayed now (the current page), and shows a dash when only some of them are selected. */
	protected renderSelectHeader(tr: Tr): Th {
		const th: Th = tr.append('th').attr('scope', 'col').style('width', '1.5vw')
		if (this.hideInput) th.style('display', 'none')
		if (this.singleMode) return th.attr('aria-label', 'Select a row')
		this.selectAllInput = th
			.append('input')
			.attr('type', 'checkbox')
			.attr('aria-label', this.paginated ? 'Select all rows on this page' : 'Select all rows')
			.attr('data-testid', 'sjpp-table-checkall')
			.on('change', () => this.selectAllDisplayed(this.selectAllInput.property('checked')))
		return th
	}

	/** Extension point: render a single header cell, including its sort and filter controls. */
	protected renderHeaderCell(tr: Tr, column: TableBaseColumn, colIdx: number): Th {
		const th: Th = tr.append('th').attr('class', 'sjpp_table_header').attr('scope', 'col')
		for (const [key, value] of Object.entries(this.headerStyle)) th.style(key, value)
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
		// rowIdx is the position in matched, so striping and line numbers continue across pages
		this.rows.forEach((row, i) => this.renderRow(row, this.pageStart + i))
	}

	/** Extension point: the area below the table holding the pager and buttons. Sticky, so it stays in view
	 * while the table scrolls. */
	protected createFooter(): void {
		this.footer = this.wrapper
			.append('div')
			.attr('class', 'sjpp-table-footer')
			.style('position', 'sticky')
			.style('bottom', '0')
			.style('background-color', 'white')
		if (this.paginated) this.createPager()
		if (this.buttons.length) this.createButtons()
	}

	protected createButtons(): void {
		const bar = this.footer
			.append('div')
			.attr('class', 'sjpp-table-buttons')
			.style('display', 'flex')
			.style('gap', '10px')
			.style('padding', '5px 4px')
			.style('justify-content', this.buttonsAlign == 'left' ? 'flex-start' : 'flex-end')
		this.buttonEls = this.buttons.map(config => {
			const button: any = bar
				.append('button')
				.attr('type', 'button')
				.text(config.text)
				.on('click', () => config.callback(this.getSelectedIndexes(), button.node()))
			if (config.class) button.attr('class', config.class)
			if (config.dataTestId) button.attr('data-testid', config.dataTestId)
			return button
		})
		this.updateButtons()
	}

	/** Disables the buttons while nothing is selected and lets each one react to the new selection. */
	protected updateButtons(): void {
		const idxs = this.getSelectedIndexes()
		this.buttons.forEach((config, i) => {
			const node = this.buttonEls[i].node() as HTMLButtonElement
			node.disabled = idxs.length == 0
			config.onChange?.(idxs, node)
		})
	}

	/** Extension point: builds the pager once per render(). Its contents are redrawn by renderPager(). */
	protected createPager(): void {
		const pager = this.footer
			.append('div')
			.attr('class', 'sjpp-table-pager')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('justify-content', 'space-between')
			.style('flex-wrap', 'wrap')
			.style('gap', '8px')
			.style('padding', '8px 4px')
			.style('font-size', '0.9em')

		const left = pager.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '8px')
		left.append('span').text('Show')
		const select = left
			.append('select')
			.attr('aria-label', 'Rows per page')
			.attr('class', 'sjpp-table-page-size')
			.style('padding', '2px 4px')
			.on('change', (event: Event) => this.setPageSize(Number((event.target as HTMLSelectElement).value)))
		for (const size of this.pageSizeOptions) {
			select.append('option').attr('value', size).property('selected', size === this.pageSize).text(size)
		}
		left.append('span').text('entries')

		this.pagerInfo = pager.append('div').attr('class', 'sjpp-table-page-info')
		this.pagerNav = pager.append('nav').attr('aria-label', 'Pagination').attr('class', 'sjpp-table-page-nav')
	}

	/** Redraws the page info and buttons. The rows-per-page <select> is left alone. */
	protected renderPager(): void {
		if (!this.pagerNav) return
		const total = this.matched.length
		const pages = this.totalPages()
		const end = Math.min(this.pageStart + this.pageSize, total)
		this.pagerInfo.text(
			total === 0
				? 'Showing 0 entries'
				: `Showing ${(this.pageStart + 1).toLocaleString()} to ${end.toLocaleString()} of ${total.toLocaleString()} entries`
		)

		this.pagerNav.selectAll('*').remove()
		const addButton = (text: string, page: number, disabled: boolean, label?: string) => {
			const active = page === this.currentPage
			const button = this.pagerNav
				.append('button')
				.attr('type', 'button')
				.text(text)
				.style('margin', '0 2px')
				.style('padding', '3px 8px')
				.style('border', '1px solid #ccc')
				.style('border-radius', '3px')
				.style('background-color', active ? '#000' : 'white')
				.style('color', active ? 'white' : disabled ? '#999' : '#000')
				.style('cursor', disabled ? 'not-allowed' : 'pointer')
			if (label) button.attr('aria-label', label)
			if (active) button.attr('aria-current', 'page')
			if (disabled) button.attr('disabled', 'disabled')
			else button.on('click', () => this.goToPage(page))
		}

		addButton('Previous', this.currentPage - 1, this.currentPage === 1, 'Go to previous page')
		// first, last, and two either side of the current page; a gap becomes an ellipsis
		const shown = new Set([1, pages])
		for (let p = this.currentPage - 2; p <= this.currentPage + 2; p++) if (p >= 1 && p <= pages) shown.add(p)
		let previous = 0
		for (const page of [...shown].sort((a, b) => a - b)) {
			if (previous && page - previous > 1) {
				this.pagerNav.append('span').attr('aria-hidden', 'true').text('…').style('margin', '0 4px').style('color', '#999')
			}
			addButton(String(page), page, false, `Page ${page}`)
			previous = page
		}
		addButton('Next', this.currentPage + 1, this.currentPage === pages, 'Go to next page')
	}

	/** Extension point: render a single row. Subclasses adding selection/click
	 * behavior should override this. */
	protected renderRow(row: TableBaseRow, rowIdx: number): Tr {
		const tr: Tr = this.tbody.append('tr').attr('class', 'sjpp_row_wrapper').datum(row)
		if (this.striped && rowIdx % 2 === 1) tr.style('background-color', STRIPE)
		if (this.showLines) {
			tr.append('td')
				.text(rowIdx + 1)
				.style('text-align', 'center')
				.style('width', '1vw')
				.style('font-size', '0.8rem')
		}
		const input = this.selectable ? this.renderSelector(tr, row, rowIdx) : undefined
		row.forEach((cell, colIdx) => this.renderCell(tr, cell, colIdx, /*rowIdx*/))
		if (input) {
			this.labelSelector(input, row, rowIdx)
			this.paintRow(tr.node() as HTMLElement, row, rowIdx)
		}
		return tr
	}

	/** Applies the selectedRow style to a selected row and clears it from a deselected one. Clearing the
	 * background must not wipe the stripe. */
	protected paintRow(tr: HTMLElement, row: TableBaseRow, rowIdx: number): void {
		const selected = this.selected.has(row)
		for (const [key, value] of Object.entries(this.selectedRowStyle)) {
			const resting = key == 'background-color' && this.striped && rowIdx % 2 === 1 ? STRIPE : ''
			tr.style.setProperty(key, selected ? value : resting)
		}
	}

	/** Extension point: the selection input and the row behavior that drives it. Every route to a
	 * selection change ends in the input's 'change' event, handled once in onSelectChange(). */
	protected renderSelector(tr: Tr, row: TableBaseRow, rowIdx: number): any {
		const cell = tr.append('td').style('width', '1.5vw')
		if (this.hideInput) cell.style('display', 'none')
		const input: any = cell
			.append('input')
			.attr('type', this.singleMode ? 'radio' : 'checkbox')
			.attr('name', this.inputName)
			.attr('value', this.getOriginalIndex(row))
			.property('checked', this.selected.has(row))
			.on('change', () => this.onSelectChange(row, input, tr, rowIdx))

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

	protected onSelectChange(row: TableBaseRow, input: any, tr: Tr, rowIdx: number): void {
		if (input.property('checked')) {
			if (this.singleMode) this.selected.clear()
			this.selected.add(row)
		} else this.selected.delete(row)
		// a radio does not fire change on the row it unchecks, so restyle every displayed row
		if (this.singleMode) this.repaintRows()
		else this.paintRow(tr.node() as HTMLElement, row, rowIdx)
		if (!this.bulkSelecting) this.afterSelectionChange()
		this.onSelect?.(this.getOriginalIndex(row), input.node())
	}

	protected repaintRows(): void {
		this.tbody.selectAll('tr').each((row: TableBaseRow, i: number, nodes: HTMLElement[]) => {
			this.paintRow(nodes[i], row, this.pageStart + i)
		})
	}

	protected afterSelectionChange(): void {
		this.syncSelectAll()
		this.updateButtons()
	}

	/** Selects or deselects every displayed row through each row's own input, so onSelect and styling
	 * behave exactly as if the user had clicked the rows one by one. */
	protected selectAllDisplayed(checked: boolean): void {
		this.bulkSelecting = true
		this.tbody.selectAll('tr').each((row: TableBaseRow, i: number, nodes: HTMLElement[]) => {
			const input = nodes[i].querySelector(`input[name="${this.inputName}"]`) as HTMLInputElement | null
			if (!input || this.selected.has(row) == checked) return
			input.checked = checked
			input.dispatchEvent(new Event('change'))
		})
		this.bulkSelecting = false
		this.afterSelectionChange()
	}

	/** Reflects the displayed rows in the check-all box: checked for all, a dash for some. */
	protected syncSelectAll(): void {
		if (!this.selectAllInput) return
		const count = this.rows.filter(row => this.selected.has(row)).length
		const node = this.selectAllInput.node() as HTMLInputElement
		node.checked = count > 0 && count === this.rows.length
		node.indeterminate = count > 0 && count < this.rows.length
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