import type { Table, Th, Tr, Td } from '../../types/d3'
import { Menu } from '../menu'
// Menu.show() calls selection.transition() but does not import d3-transition itself
import 'd3-transition'
import { debounce } from 'debounce'
import { filterAndSort, makeColumnFilter } from './tableSortFilter'
import { appendColumnMenuButton, renderFilterInput, renderSortOptions, styleColumnControl } from './tableColumnMenu'
import { createPager, pageInfoText, renderPagerNav } from './tablePager'
import { startCellEdit } from './tableEdit'
import { isSafeUrl, STRIPE, uniqueId } from './tableUtils'
import type {
	ColumnControl,
	ColumnFilter,
	ResolvedSelection,
	SortState,
	TableBaseButton,
	TableBaseCell,
	TableBaseColumn,
	TableBaseEdit,
	TableBaseOpts,
	TableBasePagination,
	TableBaseRow,
	TableBaseStyles
} from './tableTypes'

/** ms of no typing in a filter input before the filter is applied */
const FILTER_TYPING_DELAY = 250

export type {
	TableBaseButton,
	TableBaseCell,
	TableBaseColumn,
	TableBaseEdit,
	TableBaseOpts,
	TableBasePagination,
	TableBaseRow,
	TableBaseSelection,
	TableBaseStyles
} from './tableTypes'

/**
 * Extendable table renderer. Options are grouped by concern: `styles` for appearance, `selection` and
 * `buttons` for row selection, `pagination`, and per-column flags on `columns` (sortable, filterable, editable).
 * Protected extension points (renderHeader/renderHeaderCell/renderBody/renderRow/renderCell/renderSelector/
 * createFooter) are what subclasses override for behavior that does not belong here, such as hover effects or
 * post-render hooks. Add that kind of feature by extending this class, not by adding options.
 *
 * The pure logic lives beside this file: tableSortFilter (sorting and filtering rows), tablePager,
 * tableColumnMenu (the header icon and its popup), tableEdit (editing a cell) and tableUtils.
 */
export class TableBase {
	protected div: any
	protected columns: TableBaseColumn[]
	/** the caller's rows in their original order. Never reordered or filtered; sort/filter work on copies */
	protected originalRows: TableBaseRow[]
	/** original index of each row object, rebuilt on replacement, so callbacks report indexes into the caller's array */
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
	/** the header button of each sortable/filterable column, by column index */
	protected controls = new Map<number, ColumnControl>()
	/** the popup shared by every column's button, created the first time one is opened */
	protected menu?: any
	protected menuId = uniqueId('menu')
	/** the button the open popup belongs to */
	protected menuButton?: any
	/** What the user types in a filter input. Applying a filter redraws every matching row, so wait for a
	 * pause in typing. flush() applies it now, clear() drops it. setColumnFilter() itself is not delayed. */
	protected typedFilter = debounce(
		(colIdx: number, text: string) => this.setColumnFilter(colIdx, text),
		FILTER_TYPING_DELAY
	)
	protected styles: Required<TableBaseStyles>
	protected selection: ResolvedSelection
	protected selectable: boolean
	protected buttons: TableBaseButton[]
	protected dataTestId?: string
	protected ariaLabel?: string
	protected onEdit?: (edit: TableBaseEdit) => void
	/** first preselected row, scrolled into view after the first render */
	protected scrollTarget?: TableBaseRow
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
		this.dataTestId = opts.dataTestId
		this.ariaLabel = opts.ariaLabel
		this.onEdit = opts.onEdit

		const pagination = opts.pagination
		this.paginated = !!pagination
		this.pageSize = pagination?.pageSize ?? opts.rows.length
		this.currentPage = pagination?.currentPage ?? 1
		this.pageSizeOptions = [...new Set([...(pagination?.pageSizeOptions ?? [10, 25, 50, 100]), this.pageSize])].sort(
			(a, b) => a - b
		)
		this.onPageChange = pagination?.onChange

		const styles = opts.styles ?? {}
		this.styles = {
			striped: styles.striped ?? true,
			showLines: styles.showLines ?? false,
			maxWidth: styles.maxWidth || '90vw',
			maxHeight: styles.maxHeight || '40vh',
			header: styles.header ?? {},
			selectedRow: styles.selectedRow ?? {},
			buttonsAlign: styles.buttonsAlign ?? 'right'
		}

		const selection = opts.selection
		this.buttons = opts.buttons ?? []
		this.selectable = !!selection || this.buttons.length > 0
		this.selection = {
			onSelect: selection?.onSelect,
			singleMode: selection?.singleMode ?? false,
			hideInput: selection?.hideInput ?? false,
			autoScroll: selection?.autoScroll ?? true
		}
		const preselected = selection?.selectAll ? opts.rows : (selection?.selectedRows ?? []).map(i => opts.rows[i])
		for (const row of preselected) this.selected.add(row)
		this.scrollTarget = selection?.selectAll ? undefined : preselected[0]
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

	/* ---- public api ---- */

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

	/** Removes the rendered table from the DOM, if present. */
	remove(): void {
		// typed text still waiting to be applied would redraw a table that is gone
		this.typedFilter.clear()
		// the popup lives in <body>, so it has to be removed along with the table
		this.menu?.destroy()
		this.menu = undefined
		this.menuButton = undefined
		this.wrapper?.remove()
		this.wrapper = undefined
	}

	/** Index of a row in the array the caller passed in, regardless of the current sort/filter. -1 if unknown.
	 * Use this, not the displayed position, when reporting rows back to the caller. */
	getOriginalIndex(row: TableBaseRow): number {
		return this.originalIndex.get(row) ?? -1
	}

	/** Original indexes of the selected rows, ascending, including rows a filter is currently hiding. */
	getSelectedIndexes(): number[] {
		return [...this.selected].map(row => this.getOriginalIndex(row)).sort((a, b) => a - b)
	}

	/** Replaces the selection from code, e.g. when app state changes which row is selected. Updates the
	 * inputs, row styles, check-all and buttons, but does not call onSelect: the caller already knows. */
	setSelectedIndexes(idxs: number[]): this {
		if (this.selection.singleMode && idxs.length > 1)
			throw new Error('TableBase: singleMode allows only one selected row')
		this.selected = new Set(idxs.map(i => this.originalRows[i]).filter(Boolean))
		this.eachDisplayedRow((row, tr) => {
			const input = this.rowInput(tr)
			if (input) input.checked = this.selected.has(row)
		})
		this.repaintRows()
		this.afterSelectionChange()
		return this
	}

	/** Redraws the body only; the header (and any filter input focus) is untouched.
	 * With rows, replaces the caller's data and retains selection only for row objects still present.
	 * With or without rows, applies the current filters, sort and pagination. */
	update(rows?: TableBaseRow[]): this {
		const previousPage = this.currentPage
		if (rows !== undefined) {
			TableBase.validateRows(rows, this.columns)
			this.originalRows = rows
			this.originalIndex = new Map(rows.map((row, i) => [row, i]))
			this.selected = new Set([...this.selected].filter(row => this.originalIndex.has(row)))
			if (this.scrollTarget && !this.originalIndex.has(this.scrollTarget)) this.scrollTarget = undefined
		}
		this.matched = filterAndSort(this.originalRows, this.filters, this.sortState)
		this.renderPage()
		if (rows !== undefined) {
			this.updateButtons()
			if (this.paginated && this.currentPage !== previousPage) this.notifyPage()
		}
		return this
	}

	/** Sorts by a sortable column, in the given direction. Without one, repeat calls on the same column
	 * toggle ascending/descending, starting with ascending. */
	sortByColumn(colIdx: number, direction?: boolean): this {
		if (!this.columns[colIdx]?.sortable) return this
		const ascending = direction ?? (this.sortState?.colIdx === colIdx ? !this.sortState.ascending : true)
		this.sortState = { colIdx, ascending }
		this.applyViewChange(() => `Sorted by ${this.columns[colIdx].label}, ${ascending ? 'ascending' : 'descending'}`)
		return this
	}

	/** Keeps only rows whose cell in this column contains text (case-insensitive). Number cells also accept
	 * >n, >=n, <n, <=n, =n and lo-hi. Empty text clears the filter. */
	setColumnFilter(colIdx: number, text: string): this {
		const filter = makeColumnFilter(text)
		if (filter) this.filters.set(colIdx, filter)
		else this.filters.delete(colIdx)
		this.applyViewChange(() => `Showing ${this.matched.length} of ${this.originalRows.length} rows`)
		return this
	}

	/** Shows a page, 1-based, clamped to the valid range. No-op without pagination. */
	goToPage(page: number): this {
		if (!this.paginated || !Number.isFinite(page)) return this
		const next = Math.min(Math.max(1, Math.trunc(page)), this.totalPages())
		if (next === this.currentPage) return this
		this.currentPage = next
		this.renderPage()
		this.announce(`Page ${next} of ${this.totalPages()}`)
		this.notifyPage()
		return this
	}

	/** Changes rows per page and returns to page 1. No-op without pagination. */
	setPageSize(size: number): this {
		if (!this.paginated || !Number.isInteger(size) || size < 1 || size === this.pageSize) return this
		this.pageSize = size
		if (!this.pageSizeOptions.includes(size))
			this.pageSizeOptions = [...this.pageSizeOptions, size].sort((a, b) => a - b)
		this.currentPage = 1
		this.renderPage()
		this.announce(`${size} rows per page, page 1 of ${this.totalPages()}`)
		this.notifyPage()
		return this
	}

	/* ---- rows, pages and what a sort or filter changes ---- */

	/** A sort or filter changes which rows are on each page: update the header symbols, go back to page 1,
	 * redraw, tell screen readers, and report the page move. `message` is read after the redraw. */
	protected applyViewChange(message: () => string): void {
		this.updateColumnControls()
		const pageMoved = this.paginated && this.currentPage !== 1
		this.currentPage = 1
		this.update()
		this.announce(message())
		if (pageMoved) this.notifyPage()
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

	protected notifyPage(): void {
		this.onPageChange?.({ currentPage: this.currentPage, pageSize: this.pageSize })
	}

	/** Tells screen readers about a change they cannot see. The status element is created in render(). */
	protected announce(message: string): void {
		this.status?.text(message)
	}

	/** Scrolls the first preselected row into view, unless that row is not on the displayed page. */
	protected scrollToSelected(): void {
		const target = this.selection.autoScroll ? this.scrollTarget : undefined
		if (!target) return
		const tr = this.tbody
			.selectAll('tr')
			.filter((row: TableBaseRow) => row === target)
			.node() as HTMLElement | null
		// the delay lets the table settle in its container first
		if (tr) setTimeout(() => tr.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 500)
	}

	/* ---- table shell ---- */

	/** Extension point: customize the outer scrollable wrapper. */
	protected createWrapper() {
		return this.div
			.append('div')
			.attr('class', 'sjpp-table-base sjpp_show_scrollbar')
			.style('display', 'inline-block')
			.style('background-color', 'white')
			.style('max-width', this.styles.maxWidth)
			.style('max-height', this.styles.maxHeight)
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

	/* ---- header ---- */

	/** Extension point: rebuilds the header row. Only runs from render(), never on update(). */
	protected renderHeader(): void {
		this.thead.selectAll('tr').remove()
		this.controls.clear()
		this.selectAllInput = undefined
		const tr: Tr = this.thead.append('tr')
		if (this.styles.showLines)
			tr.append('th').attr('scope', 'col').attr('aria-label', 'Row number').style('width', '1vw')
		if (this.selectable) this.renderSelectHeader(tr)
		this.columns.forEach((column, colIdx) => this.renderHeaderCell(tr, column, colIdx))
		this.updateColumnControls()
	}

	/** Extension point: the selection column's header. Multiple mode gets a check-all box that acts on the
	 * rows displayed now (the current page), and shows a dash when only some of them are selected. */
	protected renderSelectHeader(tr: Tr): Th {
		const th: Th = tr.append('th').attr('scope', 'col').style('width', '1.5vw')
		if (this.selection.hideInput) th.style('display', 'none')
		if (this.selection.singleMode) return th.attr('aria-label', 'Select a row')
		this.selectAllInput = th
			.append('input')
			.attr('type', 'checkbox')
			.attr('aria-label', this.paginated ? 'Select all rows on this page' : 'Select all rows')
			.attr('data-testid', 'sjpp-table-checkall')
			.on('change', () => this.selectAllDisplayed(this.selectAllInput.property('checked')))
		return th
	}

	/** Extension point: render a single header cell, including its sort and filter button. */
	protected renderHeaderCell(tr: Tr, column: TableBaseColumn, colIdx: number): Th {
		const th: Th = tr.append('th').attr('class', 'sjpp_table_item sjpp_table_header').attr('scope', 'col')
		for (const [key, value] of Object.entries(this.styles.header)) th.style(key, value)
		if (column.width) th.style('width', column.width)
		if (column.headerTestId) th.attr('data-testid', column.headerTestId)
		if (column.tooltip) th.attr('title', column.tooltip)

		th.append('span').attr('class', 'sjpp-table-header-label').text(column.label)
		if (column.sortable || column.filterable) {
			const control = appendColumnMenuButton(th, column, colIdx, this.menuId, button =>
				this.openColumnMenu(button, column, colIdx)
			)
			this.controls.set(colIdx, control)
		}
		return th
	}

	/** Sets each column button's sort arrow, aria-sort, color and funnel to match the current sort and filters. */
	protected updateColumnControls(): void {
		for (const [colIdx, control] of this.controls) {
			const sorted = this.sortState?.colIdx === colIdx
			const filtered = this.filters.has(colIdx)
			if (control.indicator) {
				const direction = !sorted ? 'none' : this.sortState!.ascending ? 'ascending' : 'descending'
				// a neutral marker on unsorted columns is what tells the user the header can be clicked
				control.indicator.text({ none: '⇅', ascending: '▲', descending: '▼' }[direction])
				control.button.node().closest('th')?.setAttribute('aria-sort', direction)
			}
			styleColumnControl(control, sorted, filtered)
		}
	}

	/** Fills the shared popup for one column and shows it under that column's button. */
	protected openColumnMenu(button: any, column: TableBaseColumn, colIdx: number): void {
		if (!this.menu) {
			this.menu = new Menu({
				padding: '8px',
				testid: 'sjpp-table-column-menu',
				onHide: () => this.menuButton?.attr('aria-expanded', 'false')
			})
			this.menu.d
				.attr('id', this.menuId)
				.attr('role', 'dialog')
				.on('keydown.tablebase', (event: KeyboardEvent) => {
					if (event.key == 'Escape') this.closeColumnMenu()
				})
		}
		// text typed in another column's popup still counts: apply it before this popup replaces that one
		this.typedFilter.flush()
		this.menuButton?.attr('aria-expanded', 'false')
		this.menuButton = button
		button.attr('aria-expanded', 'true')

		const d = this.menu.clear().d
		d.attr('aria-label', button.attr('aria-label'))
		if (column.sortable) {
			const sorted = this.sortState?.colIdx === colIdx ? this.sortState.ascending : undefined
			renderSortOptions(d, colIdx, sorted, ascending => {
				this.typedFilter.flush()
				this.sortByColumn(colIdx, ascending)
				this.closeColumnMenu()
			})
		}
		if (column.filterable) {
			renderFilterInput(d, {
				colIdx,
				label: column.label,
				text: this.filters.get(colIdx)?.text ?? '',
				afterSort: !!column.sortable,
				onInput: text => this.typedFilter(colIdx, text),
				onCommit: () => this.typedFilter.flush(),
				onEnter: () => this.closeColumnMenu()
			})
		}
		this.menu.showunder(button.node())
		;(d.select('input').node() || d.select('button').node())?.focus()
	}

	protected closeColumnMenu(): void {
		this.typedFilter.flush()
		this.menu?.hide()
		this.menuButton?.node()?.focus()
	}

	/* ---- body ---- */

	/** Extension point: rebuilds all body rows. Called by render() and update(). */
	protected renderBody(): void {
		this.tbody.selectAll('tr').remove()
		// rowIdx is the position in matched, so striping and line numbers continue across pages
		this.rows.forEach((row, i) => this.renderRow(row, this.pageStart + i))
	}

	/** Calls back for each displayed row with its object, its <tr> and its position in matched. */
	protected eachDisplayedRow(callback: (row: TableBaseRow, tr: HTMLElement, rowIdx: number) => void): void {
		this.tbody?.selectAll('tr').each((row: TableBaseRow, i: number, nodes: HTMLElement[]) => {
			callback(row, nodes[i], this.pageStart + i)
		})
	}

	/** Extension point: render a single row. Subclasses adding selection/click
	 * behavior should override this. */
	protected renderRow(row: TableBaseRow, rowIdx: number): Tr {
		const tr: Tr = this.tbody.append('tr').attr('class', 'sjpp_row_wrapper').datum(row)
		if (this.styles.striped && rowIdx % 2 === 1) tr.style('background-color', STRIPE)
		if (this.styles.showLines) {
			tr.append('td')
				.text(rowIdx + 1)
				.style('text-align', 'center')
				.style('width', '1vw')
				.style('font-size', '0.8rem')
		}
		const input = this.selectable ? this.renderSelector(tr, row, rowIdx) : undefined
		row.forEach((cell, colIdx) => this.renderCell(tr, cell, colIdx))
		if (input) {
			this.labelSelector(input, row, rowIdx)
			this.paintRow(tr.node() as HTMLElement, row, rowIdx)
		}
		return tr
	}

	/** Extension point: render a single cell. Subclasses adding barplots, buttons, etc. should override this. */
	protected renderCell(tr: Tr, cell: TableBaseCell, colIdx: number): Td {
		const column = this.columns[colIdx]
		const td: Td = tr.append('td').attr('class', 'sjpp_table_item')
		if (cell.dataTestId) td.attr('data-testid', cell.dataTestId)
		if (column.width) td.style('width', column.width)
		if (column.align) td.style('text-align', column.align)
		if (column.nowrap) td.style('white-space', 'nowrap')

		if (cell.url && isSafeUrl(cell.url)) {
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
		} else if (cell.url) {
			// a url that is not safe to link (see isSafeUrl) is still shown, as plain text
			td.text(cell.url)
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

	/** Edits a cell in place (see startCellEdit). The table is not redrawn: the caller decides when to call update(). */
	protected startEdit(td: Td, tr: Tr, cell: TableBaseCell, colIdx: number): void {
		const column = this.columns[colIdx]
		startCellEdit(td, cell, {
			label: column.label,
			validate: column.validate,
			onCommit: () => this.onEdit?.({ rowIdx: this.getOriginalIndex(tr.datum() as TableBaseRow), colIdx, cell })
		})
	}

	/* ---- footer: pager and buttons ---- */

	/** Extension point: the area below the table holding the pager and buttons. Sticky, so it stays in view
	 * while the table scrolls. */
	protected createFooter(): void {
		this.footer = this.wrapper
			.append('div')
			.attr('class', 'sjpp-table-footer')
			.style('position', 'sticky')
			.style('bottom', '0')
			.style('background-color', 'white')
		if (this.paginated) {
			const { info, nav } = createPager(this.footer, {
				pageSizeOptions: this.pageSizeOptions,
				pageSize: this.pageSize,
				onPageSize: size => this.setPageSize(size)
			})
			this.pagerInfo = info
			this.pagerNav = nav
		}
		if (this.buttons.length) this.createButtons()
	}

	/** Synchronizes the rows-per-page control and redraws the page info and buttons. */
	protected renderPager(): void {
		if (!this.pagerNav) return
		const select = this.footer.select('select.sjpp-table-page-size')
		select
			.selectAll('option')
			.data(this.pageSizeOptions)
			.join('option')
			.attr('value', size => size)
			.text(size => size)
		select.property('value', this.pageSize)
		this.pagerInfo.text(pageInfoText(this.pageStart, this.pageSize, this.matched.length))
		renderPagerNav(this.pagerNav, this.currentPage, this.totalPages(), page => this.goToPage(page))
	}

	protected createButtons(): void {
		const bar = this.footer
			.append('div')
			.attr('class', 'sjpp-table-buttons')
			.style('display', 'flex')
			.style('gap', '10px')
			.style('padding', '5px 4px')
			.style('justify-content', this.styles.buttonsAlign == 'left' ? 'flex-start' : 'flex-end')
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

	/* ---- row selection ---- */

	/** Applies the selectedRow style to a selected row and clears it from a deselected one. Clearing the
	 * background must not wipe the stripe. */
	protected paintRow(tr: HTMLElement, row: TableBaseRow, rowIdx: number): void {
		const selected = this.selected.has(row)
		for (const [key, value] of Object.entries(this.styles.selectedRow)) {
			const resting = key == 'background-color' && this.styles.striped && rowIdx % 2 === 1 ? STRIPE : ''
			tr.style.setProperty(key, selected ? value : resting)
		}
	}

	protected repaintRows(): void {
		this.eachDisplayedRow((row, tr, rowIdx) => this.paintRow(tr, row, rowIdx))
	}

	/** The selection <input> in a displayed row, if rows are selectable. */
	protected rowInput(tr: HTMLElement): HTMLInputElement | null {
		return tr.querySelector(`input[name="${this.inputName}"]`)
	}

	/** Extension point: the selection input and the row behavior that drives it. Every route to a
	 * selection change ends in the input's 'change' event, handled once in onSelectChange(). */
	protected renderSelector(tr: Tr, row: TableBaseRow, rowIdx: number): any {
		const cell = tr.append('td').style('width', '1.5vw')
		if (this.selection.hideInput) cell.style('display', 'none')
		const input: any = cell
			.append('input')
			.attr('type', this.selection.singleMode ? 'radio' : 'checkbox')
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
		if (this.selection.singleMode && checked) return
		input.property('checked', !checked)
		input.dispatch('change')
	}

	protected onSelectChange(row: TableBaseRow, input: any, tr: Tr, rowIdx: number): void {
		const { singleMode, onSelect } = this.selection
		if (input.property('checked')) {
			if (singleMode) this.selected.clear()
			this.selected.add(row)
		} else this.selected.delete(row)
		// a radio does not fire change on the row it unchecks, so restyle every displayed row
		if (singleMode) this.repaintRows()
		else this.paintRow(tr.node() as HTMLElement, row, rowIdx)
		if (!this.bulkSelecting) this.afterSelectionChange()
		onSelect?.(this.getOriginalIndex(row), input.node())
	}

	protected afterSelectionChange(): void {
		this.syncSelectAll()
		this.updateButtons()
	}

	/** Selects or deselects every displayed row through each row's own input, so onSelect and styling
	 * behave exactly as if the user had clicked the rows one by one. */
	protected selectAllDisplayed(checked: boolean): void {
		this.bulkSelecting = true
		this.eachDisplayedRow((row, tr) => {
			const input = this.rowInput(tr)
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
}
