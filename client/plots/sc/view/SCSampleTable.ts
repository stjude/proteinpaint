import { select } from 'd3-selection'
import type { SCTableData } from '../SCTypes'
import type { Div } from '../../../types/d3'
import { TableBase } from '#dom'
import type { TableBaseCell, TableBaseColumn } from '#dom'

const SHOWN_PLOTS = 'Shown plots'

/**
 * The SC sample table: a single-select TableBase with a "Shown plots" column that SC fills with
 * buttons.
 *
 * SC calls setTableData() on every update (e.g. each subplot state change). Redrawing the table there
 * moves the page scroll, so the rule is: construct once, and patch only what changed. setTableData()
 * only syncs the selected radio, and setShownPlotsColumnVisibility() only toggles display. A
 * different sample list or set of columns needs a new SCSampleTable (see isSameShape()).
 * A sort does redraw the <tbody>, because the user is looking at the table, and onBodyRendered
 * lets SC put its buttons back.
 */
export class SCSampleTable extends TableBase {
	tableData: SCTableData
	sampleColIdx: number
	/** sample id -> { sampleId, row: the <tr>, cells: { sample, shownPlots } }, the cells SC writes into */
	rowMap = new Map<string, any>()
	onRowClick?: (sampleId: string) => void
	onBodyRendered?: () => void
	showPlotsColumn = false

	/** holder is the div to render the table into (SCDom.tableDiv). */
	constructor(
		holder: Div,
		tableData: SCTableData,
		opts: { onRowClick?: (sampleId: string) => void; onBodyRendered?: () => void } = {}
	) {
		super({
			div: holder,
			// every column SC lets you sort also gets a filter box
			columns: tableData.columns.map(column => ({ ...column, filterable: column.sortable })),
			rows: tableData.rows,
			styles: { maxHeight: '30vh', maxWidth: '90vw', showLines: true },
			// autoScroll off: scrolling the page to the table on every rebuild is the jump this class avoids
			selection: { singleMode: true, selectedRows: tableData.selectedRows, autoScroll: false }
		})
		this.tableData = tableData
		this.sampleColIdx = tableData.sampleColIdx ?? 0
		this.onRowClick = opts.onRowClick
		this.onBodyRendered = opts.onBodyRendered
		this.selection.onSelect = idx => this.onRowClick?.(this.sampleIdOf(this.originalRows[idx]))
		this.render()
	}

	/** The element holding the table, for callers that need to know whether it was rebuilt. */
	get parentDiv() {
		return this.wrapper
	}

	private sampleIdOf(row: any[] | undefined, colIdx = this.sampleColIdx): string {
		return String(row?.[colIdx]?.value ?? '')
	}

	/** SC re-selects on every click, even the selected row, because selecting also closes the table.
	 * The base ignores a click on the selected radio, so report it here instead. */
	protected toggleRow(input: any): void {
		if (!input.property('checked')) return super.toggleRow(input)
		this.onRowClick?.(this.sampleIdOf(this.originalRows[Number(input.attr('value'))]))
	}

	/** Rebuilds the sample -> row/cell lookup after every body redraw, then lets SC re-add its buttons,
	 * since the redraw replaced the cells they lived in. */
	protected renderBody(): void {
		super.renderBody()
		this.rowMap.clear()
		const shownPlotsIdx = this.columns.findIndex(c => c.label === SHOWN_PLOTS)
		this.tbody.selectAll('tr').each((row: any[], i: number, nodes: any) => {
			const sampleId = this.sampleIdOf(row)
			if (!sampleId) return
			this.rowMap.set(sampleId, {
				sampleId,
				row: select(nodes[i]),
				cells: { sample: row[this.sampleColIdx].__td, shownPlots: row[shownPlotsIdx]?.__td }
			})
		})
		this.onBodyRendered?.()
	}

	/** True when tableData has the same columns and the same set of samples, in any order. */
	isSameShape(tableData: SCTableData): boolean {
		if (tableData.columns.length !== this.columns.length) return false
		if (this.columns.some((column, i) => tableData.columns[i]?.label !== column.label)) return false
		if (tableData.rows.length !== this.originalRows.length) return false
		const colIdx = tableData.sampleColIdx ?? this.sampleColIdx
		return tableData.rows.every(row => this.rowMap.has(this.sampleIdOf(row, colIdx)))
	}

	/** Patches the table for tableData that isSameShape(): only the selected radio can differ. */
	setTableData(tableData: SCTableData) {
		this.tableData = tableData
		const colIdx = tableData.sampleColIdx ?? this.sampleColIdx
		const selectedId = this.sampleIdOf(tableData.rows[tableData.selectedRows[0]], colIdx)
		const selectedIdx = this.originalRows.findIndex(row => this.sampleIdOf(row) === selectedId)
		this.setSelectedIndexes(selectedId && selectedIdx != -1 ? [selectedIdx] : [])
	}

	/** The "Shown plots" column only appears once two or more plots are open. Hidden with display, not
	 * by redrawing, so nothing moves; renderHeaderCell() and renderCell() reapply it after a redraw. */
	setShownPlotsColumnVisibility(visible: boolean) {
		if (visible === this.showPlotsColumn) return
		this.showPlotsColumn = visible
		const colIdx = this.columns.findIndex(c => c.label === SHOWN_PLOTS)
		if (colIdx == -1) return
		const display = visible ? null : 'none'
		const th = this.thead.selectAll('th.sjpp_table_header').nodes()[colIdx] as HTMLElement
		th.style.setProperty('display', display)
		for (const row of this.rows) row[colIdx].__td?.style('display', display as any)
	}

	protected renderHeaderCell(tr: any, column: TableBaseColumn, colIdx: number) {
		const th = super.renderHeaderCell(tr, column, colIdx)
		if (column.label === SHOWN_PLOTS && !this.showPlotsColumn) th.style('display', 'none')
		return th
	}

	protected renderCell(tr: any, cell: TableBaseCell, colIdx: number) {
		const td = super.renderCell(tr, cell, colIdx)
		if (this.columns[colIdx].label === SHOWN_PLOTS && !this.showPlotsColumn) td.style('display', 'none')
		return td
	}
}
