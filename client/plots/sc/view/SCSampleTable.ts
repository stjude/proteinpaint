import type { SCDom, SCSampleSandbox, SCTableData } from '../SCTypes'
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
 *
 * This is meant to be used as the long-term replacement for the ad hoc logic in
 * SampleTableRenderer when we want to avoid full table teardown during SC updates.
 */
export class SCSampleTable {
	dom: SCDom | any
	tableData: SCTableData
	sampleColIdx: number
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
	activeSandboxes = new Map<string, SCSampleSandbox[]>()
	onRowClick?: (rowIndex: number) => void

	constructor(dom: SCDom | any, tableData: SCTableData, opts: { onRowClick?: (rowIndex: number) => void } = {}) {
		this.dom = dom
		this.holder = dom?.tableDiv || dom
		this.tableData = tableData
		this.sampleColIdx = tableData.sampleColIdx ?? 0
		this.rows = tableData.rows
		this.columns = tableData.columns
		this.onRowClick = opts.onRowClick
		this.renderStaticTable()
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
		this.thead
			.style('position', 'sticky')
			.style('top', '0')
			.style('background-color', 'white')
			.style('z-index', '1')
		this.tableHeaderRow = this.thead.append('tr')
		this.tbody = this.table.append('tbody')

		this.renderHeader()
		this.renderRows()
	}

	private renderHeader() {
		this.tableHeaderRow.append('th').style('width', '1.5vw').style('padding', '0')
		for (const [columnIndex, column] of this.columns.entries()) {
			const th = this.tableHeaderRow.append('th').attr('class', 'sjpp_table_item sjpp_table_header')
			if (column.label === 'Shown plots' && !this.showPlotsColumn) th.style('display', 'none')
			if (column.width) th.style('width', column.width)
			if (column.tooltip) th.attr('title', column.tooltip)
			const labelWrap = th.append('span').style('display', 'inline-flex').style('align-items', 'center')
			labelWrap.append('span').text(column.label)
			if (column.sortable) {
				const sortDiv = labelWrap.append('div').style('display', 'inline-block').style('padding-left', '6px')
				let isAscending = false
				icons['updown'](sortDiv, {
					handler: () => {
						isAscending = !isAscending
						const nextRows = sortTableCallBack(columnIndex, this.rows, isAscending)
						this.sortRows(nextRows)
					}
				})
			}
		}
	}

	private renderRows() {
		this.rowMap.clear()
		for (const [rowIndex, row] of this.rows.entries()) {
			const tr = this.tbody.append('tr').attr('class', 'sjpp_row_wrapper').attr('tabindex', 0)
			if (rowIndex % 2 === 1) tr.style('background-color', 'rgb(245,245,245)')
			const sampleCell = row[this.sampleColIdx]
			const sampleId = String(sampleCell?.value ?? '')
			if (!sampleId) continue

			const entry: any = {
				sampleId,
				row: tr,
				cells: {}
			}

			const radioCell = tr.append('td').style('width', '1.5vw').style('padding', '0 6px').style('text-align', 'center')
			radioCell
				.append('input')
				.attr('type', 'radio')
				.attr('name', 'sjpp-sc-row-selection')
				.attr('value', sampleId)
				.property('checked', this.tableData.selectedRows.includes(rowIndex))
				.on('change', () => {
					if (this.onRowClick) this.onRowClick(rowIndex)
				})

			for (const [colIdx, cell] of row.entries()) {
				const td = tr.append('td').attr('class', 'sjpp_table_item').attr('data-testid', 'sjpp-table-cell-item')
				if (this.columns[colIdx]?.label === 'Shown plots' && !this.showPlotsColumn) td.style('display', 'none')
				cell.__td = td
				if (colIdx === this.sampleColIdx) {
					entry.cells.sample = td
				}
				if (this.columns[colIdx]?.label === 'Shown plots') {
					entry.cells.shownPlots = td
				}
				if ('value' in cell) td.text(cell.value)
				else if (cell.html) td.html(cell.html)
				else if (cell.url) td.append('a').text(cell.value || cell.url).attr('href', cell.url)
			}

			tr.on('click', () => {
				if (this.onRowClick) this.onRowClick(rowIndex)
			})
			tr.on('keydown', event => {
				if (event.key === 'Enter') {
					if (this.onRowClick) this.onRowClick(rowIndex)
				}
			})

			this.rowMap.set(sampleId, entry)
		}
	}

	setTableData(tableData: SCTableData) {
		this.tableData = tableData
		this.rows = tableData.rows
		this.columns = tableData.columns
		this.sampleColIdx = tableData.sampleColIdx ?? 0
		this.renderStaticTable()
	}

	updatePlotBtns(activeSandboxes: Map<string, SCSampleSandbox[]>) {
		this.activeSandboxes = activeSandboxes
		const shouldShow = [...activeSandboxes.values()].reduce((total, items) => total + items.length, 0) >= 2
		this.setShownPlotsColumnVisibility(shouldShow)

		for (const [sampleId, sandboxes] of activeSandboxes) {
			this.updateSamplePlotButtons(sampleId, sandboxes)
		}
	}

	setShownPlotsColumnVisibility(visible: boolean) {
		if (visible !== this.showPlotsColumn) this.toggleShownPlotsColumn(visible)
	}

	private toggleShownPlotsColumn(visible: boolean) {
		this.showPlotsColumn = visible
		const shownPlotsHeaderIndex = this.columns.findIndex(c => c.label === 'Shown plots')
		if (shownPlotsHeaderIndex === -1) return
		const domColumnIndex = shownPlotsHeaderIndex + 1

		const headerCells = this.tableHeaderRow.selectAll('th').nodes()
		const visibleState = visible ? 'table-cell' : 'none'
		if (headerCells[domColumnIndex]) headerCells[domColumnIndex].style.display = visibleState

		for (const row of this.rows) {
			const sampleId = String(row[this.sampleColIdx]?.value ?? '')
			const entry = this.rowMap.get(sampleId)
			if (!entry) continue
			const rowCells = entry.row.selectAll('td').nodes()
			if (rowCells[domColumnIndex]) rowCells[domColumnIndex].style.display = visibleState
		}
	}

	private updateSamplePlotButtons(sampleId: string, sandboxes: SCSampleSandbox[]) {
		const entry = this.rowMap.get(sampleId)
		if (!entry) return
		const shownPlotsCell = entry.cells.shownPlots
		if (!shownPlotsCell) return

		shownPlotsCell.selectAll('*').remove()
		for (const sandbox of sandboxes) {
			const text = sandbox.plotName.length > 25 ? sandbox.plotName.slice(0, 12) + '...' : sandbox.plotName
			const btn = shownPlotsCell
				.append('button')
				.attr('class', 'sjpp-sc-table-plot-btn')
				.attr('data-testid', `sjpp-sc-table-${sampleId}-${sandbox.plotName}-btn`)
				.style('padding', '2px 5px')
				.style('margin-left', '4px')
				.style('font-size', '0.8em')
				.style('border-radius', '20px')
				.style('border', '0.5px solid black')
				.style('cursor', 'pointer')
				.text(text)
				.attr('aria-label', `Scroll to ${sandbox.plotName}`)
				.attr('title', `Scroll to ${sandbox.plotName}`)
				.attr('tabindex', 0)
				.on('click', () => {
					sandbox.div.node().scrollIntoView({ behavior: 'smooth', block: 'start' })
				})
			btn.node()
		}
	}

	/**
	 * Placeholder for future sorted-row updates.
	 *
	 * This intentionally keeps row identity stable and reorders existing DOM nodes
	 * instead of deleting/recreating the whole table when sorting.
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
	}
}
