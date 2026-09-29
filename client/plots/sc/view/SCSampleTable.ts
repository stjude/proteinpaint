import { select } from 'd3-selection'
import type { SCDom, SCTableData } from '../SCTypes'
import { icons, sortTableCallBack } from '#dom'

/**
 * Focused, stable renderer for the SC sample table.
 *
 * The shared renderTable() helper in client/dom/table.ts is a generic table system
 * that rebuilds rows/cells aggressively. That makes it awkward to preserve scroll
 * position when subplot state updates only change the "Shown plots" column.
 *
 * This class keeps the table shell stable and updates only the dynamic cells that
 * actually change:
 * - whether the "Shown plots" column is visible
 * - the buttons inside each sample's "Shown plots" cell
 * - the checked radio input, when the selected sample changes
 *
 * setTableData() is called on every SC update() (e.g. on every subplot state
 * change), so it only tears down and rebuilds the table shell when the sample
 * list or columns actually changed (see isSameShape()). Otherwise it leaves
 * existing row/cell DOM nodes in place so scroll position and row identity
 * survive updates that only affect plot buttons.
 */
export class SCSampleTable {
	dom: SCDom | any
	tableData!: SCTableData
	sampleColIdx = 0
	showPlotsColumn = false
	rowMap = new Map<string, any>()
	rows: any[] = []
	columns: any[] = []
	holder: any
	parentDiv: any
	table: any
	tbody: any
	thead: any
	tableHeaderRow: any
	onRowClick?: (sampleId: string) => void

	constructor(dom: SCDom | any, tableData: SCTableData, opts: { onRowClick?: (sampleId: string) => void } = {}) {
		this.dom = dom
		this.holder = dom?.tableDiv || dom
		this.onRowClick = opts.onRowClick
		this.applyTableData(tableData)
		this.renderStaticTable()
	}

	private applyTableData(tableData: SCTableData) {
		this.tableData = tableData
		this.rows = tableData.rows
		this.columns = tableData.columns
		this.sampleColIdx = tableData.sampleColIdx ?? 0
	}

	private renderStaticTable() {
		this.holder.selectAll('*').remove()

		this.parentDiv = this.holder
			.append('div')
			.style('background-color', 'white')
			.style('display', 'inline-block')
			.style('max-height', '30vh')
			.style('max-width', '90vw')
			.classed('sjpp_show_scrollbar', true)

		this.table = this.parentDiv.append('table').style('width', '100%')
		this.thead = this.table.append('thead')
		this.thead.style('position', 'sticky').style('top', '0').style('background-color', 'white').style('z-index', '1')
		this.tableHeaderRow = this.thead.append('tr')
		this.tbody = this.table.append('tbody')

		this.renderHeader()
		this.renderRows()
	}

	/** Renders into a freshly emptied header row (see renderStaticTable()), so this join
	 * never has anything to match against existing DOM -- every column enters. Still uses
	 * .data().join() over the manual loop so per-column attrs are declarative and the
	 * heterogeneous per-cell setup (label + optional sort icon) is isolated in one place. */
	private renderHeader() {
		this.tableHeaderRow.append('td').style('width', '1vw') // row-index gutter
		this.tableHeaderRow.append('th').style('width', '1.5vw').style('padding', '0') // radio placeholder

		this.tableHeaderRow
			.selectAll('th.sjpp_table_header')
			.data(this.columns)
			.join('th')
			.attr('class', 'sjpp_table_item sjpp_table_header')
			.style('display', (column: any) => (column.label === 'Shown plots' && !this.showPlotsColumn ? 'none' : null))
			.style('width', (column: any) => column.width || null)
			.attr('title', (column: any) => column.tooltip || null)
			.each((column: any, columnIndex: number, nodes: any) => this.renderHeaderLabel(select(nodes[columnIndex]), column, columnIndex))
	}

	private renderHeaderLabel(th: any, column: any, columnIndex: number) {
		const labelWrap = th.append('span').style('display', 'inline-flex').style('align-items', 'center')
		labelWrap.append('span').text(column.label)
		if (!column.sortable) return

		const sortDiv = labelWrap.append('div').style('display', 'inline-block').style('padding-left', '6px')
		let isAscending = false
		icons['updown'](sortDiv, {
			handler: () => {
				isAscending = !isAscending
				this.sortRows(sortTableCallBack(columnIndex, this.rows, isAscending))
			}
		})
	}

	/** Renders into a freshly emptied tbody (see renderStaticTable()), so this join
	 * never has anything to match against existing DOM -- every row enters. */
	private renderRows() {
		this.rowMap.clear()

		this.tbody
			.selectAll('tr.sjpp_row_wrapper')
			.data(this.rows)
			.join('tr')
			.attr('class', 'sjpp_row_wrapper')
			.attr('tabindex', 0)
			.each((row: any[], rowIndex: number, nodes: any) => this.renderRow(select(nodes[rowIndex]), row, rowIndex))

		this.renumberRows()
	}

	private renderRow(tr: any, row: any[], rowIndex: number) {
		const sampleId = String(row[this.sampleColIdx]?.value ?? '')
		if (!sampleId) return

		tr.append('td')
			.attr('class', 'sjpp_row_index')
			.text(rowIndex + 1)
			.style('text-align', 'center')
			.style('width', '1vw')
			.style('font-size', '0.8rem')

		tr.append('td') // radio cell
			.style('width', '1.5vw')
			.style('padding', '0 6px')
			.style('text-align', 'center')
			.append('input')
			.attr('type', 'radio')
			.attr('name', 'sjpp-sc-row-selection')
			.attr('value', sampleId)
			.attr('aria-label', `Select ${sampleId}`)
			.property('checked', this.tableData.selectedRows.includes(rowIndex))
			.on('change', () => this.onRowClick?.(sampleId))

		const entry: any = { sampleId, row: tr, cells: {} }
		tr.selectAll('td.sjpp_table_item')
			.data(row)
			.join('td')
			.attr('id', (cell: any) => cell.elemId || null)
			.attr('class', 'sjpp_table_item')
			.attr('data-testid', (cell: any) => cell.dataTestId || 'sjpp-table-cell-item')
			.each((cell: any, colIdx: number, nodes: any) => this.renderDataCell(select(nodes[colIdx]), cell, colIdx, entry))

		tr.on('click', () => this.onRowClick?.(sampleId))
		tr.on('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter') this.onRowClick?.(sampleId)
		})

		this.rowMap.set(sampleId, entry)
	}

	/** url > html > value, matching the old renderTable() priority (client/dom/table.ts):
	 * meta-result rows set both html (display label) and value (raw sample id, used
	 * elsewhere for lookups), and html is meant to win for rendering. */
	private renderDataCell(td: any, cell: any, colIdx: number, entry: any) {
		const isShownPlotsCol = this.columns[colIdx]?.label === 'Shown plots'
		if (isShownPlotsCol && !this.showPlotsColumn) td.style('display', 'none')
		if (colIdx === this.sampleColIdx) entry.cells.sample = td
		if (isShownPlotsCol) entry.cells.shownPlots = td

		if (cell.url)
			td.append('a')
				.text(cell.value || cell.value === 0 ? cell.value : cell.url)
				.attr('href', cell.url)
				.attr('target', '_blank')
				.attr('rel', 'noopener noreferrer')
				.attr('aria-label', `Click to ${cell.url}`)
				.on('click', (event: MouseEvent) => event.stopPropagation())
		else if (cell.html) td.html(cell.html)
		else if ('value' in cell) td.text(cell.value).attr('aria-label', cell.value)
	}

	/** Patches the table in place when the incoming data describes the same
	 * set of samples/columns (e.g. a subplot state change re-triggers SC's
	 * main()/update() without the sample list itself changing). Only falls
	 * back to a full teardown+rebuild when the sample list or columns
	 * actually changed, so row identity (and scroll position) survives
	 * updates that only affect plot buttons. */
	setTableData(tableData: SCTableData) {
		const needsRebuild = !this.isSameShape(tableData)
		this.applyTableData(tableData)
		if (needsRebuild) this.renderStaticTable()
		else this.syncSelectedRows(tableData)
	}

	/** Compares by the set of sample IDs rather than row order, since sortRows()
	 * reorders this.rows/DOM in place on user interaction. Comparing positionally
	 * would treat that as a "shape change" on the next incoming tableData and
	 * force an unnecessary rebuild that undoes the sort and resets scroll. */
	private isSameShape(tableData: SCTableData): boolean {
		if (tableData.columns.length !== this.columns.length) return false
		for (const [i, column] of this.columns.entries()) {
			if (tableData.columns[i]?.label !== column.label) return false
		}
		if (tableData.rows.length !== this.rows.length) return false
		const incomingSampleColIdx = tableData.sampleColIdx ?? this.sampleColIdx
		return tableData.rows.every(row => this.rowMap.has(String(row[incomingSampleColIdx]?.value ?? '')))
	}

	/** selectedRows is always 0 or 1 entries (radio selection), see SCViewModel. */
	private syncSelectedRows(tableData: SCTableData) {
		const sampleColIdx = tableData.sampleColIdx ?? this.sampleColIdx
		const selectedRowIndex = tableData.selectedRows[0]
		const selectedId =
			selectedRowIndex != null ? String(tableData.rows[selectedRowIndex]?.[sampleColIdx]?.value ?? '') : ''
		for (const [sampleId, entry] of this.rowMap) {
			const input = entry.row.select('input[type="radio"]').node()
			if (input) input.checked = sampleId === selectedId
		}
	}

	setShownPlotsColumnVisibility(visible: boolean) {
		if (visible !== this.showPlotsColumn) this.toggleShownPlotsColumn(visible)
	}

	private toggleShownPlotsColumn(visible: boolean) {
		this.showPlotsColumn = visible
		const shownPlotsHeaderIndex = this.columns.findIndex(c => c.label === 'Shown plots')
		if (shownPlotsHeaderIndex === -1) return
		const domColumnIndex = shownPlotsHeaderIndex + 1 // +1 for the radio placeholder <th> (see renderHeader())

		const headerCells = this.tableHeaderRow.selectAll('th').nodes()
		const visibleState = visible ? 'table-cell' : 'none'
		if (headerCells[domColumnIndex]) headerCells[domColumnIndex].style.display = visibleState

		for (const entry of this.rowMap.values()) entry.cells.shownPlots?.style('display', visibleState)
	}

	/**
	 * Reorders existing DOM nodes to match a sort, instead of deleting/recreating the
	 * whole table -- this intentionally keeps row identity (and any injected plot
	 * buttons) stable. The row-index text and striping were set once at creation from
	 * that row's original position, so they're now stale for any row that moved;
	 * renumberRows() recomputes both from the new DOM order, the same way the generic
	 * renderTable() derives them from visible row position (client/dom/table.ts).
	 */
	sortRows(sortedRows: any[]) {
		const parentNode = this.tbody.node()
		for (const row of sortedRows) {
			const sampleId = String(row[this.sampleColIdx]?.value ?? '')
			const entry = this.rowMap.get(sampleId)
			if (!entry) continue
			parentNode.appendChild(entry.row.node())
		}
		this.rows = sortedRows
		this.renumberRows()
	}

	private renumberRows() {
		this.tbody.selectAll('tr.sjpp_row_wrapper').each((_row: any, rowIndex: number, nodes: any) => {
			const tr = select(nodes[rowIndex])
			tr.select('td.sjpp_row_index').text(rowIndex + 1)
			tr.style('background-color', () => (rowIndex % 2 === 1 ? 'rgb(245,245,245)' : null))
		})
	}
}
