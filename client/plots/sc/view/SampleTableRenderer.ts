import type { SCDom, SCTableData } from '../SCTypes'
import type { TableCell } from '#dom'
import { renderTable } from '#dom'
import type { SCInteractions } from '../interactions/SCInteractions'

/** Renders the sample table for selection on SC app init()
 * On selecting a sample, the plot buttons will appear and
 * the user can select a plot to render in the dashboard. */
export class SampleTableRenderer {
	dom: SCDom
	interactions: SCInteractions
	tableData: SCTableData
	activeSandboxes: Map<string, { plotId: string; div: any; plotName: string }[]> = new Map()
	/** Tracks rendered btns per sample to avoid unnecessary destroy/recreate pattern. */
	rendered: Map<string, { cell: any; plotIds: string }> = new Map()

	constructor(dom: SCDom, interactions: SCInteractions, tableData: SCTableData) {
		this.dom = dom
		this.interactions = interactions
		this.tableData = tableData
		this.renderSamplesTable(tableData)
	}

	/** Users select one item at a time to render the plot buttons
	 * to init() plots in the dashboard.*/
	renderSamplesTable(tableData: SCTableData) {
		renderTable({
			rows: tableData.rows,
			columns: tableData.columns,
			div: this.dom.tableDiv,
			singleMode: true,
			maxWidth: tableData.columns.length > 3 ? '95vw' : 'auto',
			maxHeight: '30vh',
			header: {
				allowSort: true,
				style: { 'text-transform': 'capitalize' }
			},
			striped: true,
			selectedRows: tableData.selectedRows,
			afterRender: () => {
				this.reapplyAllPlotButtons()
			},
			noButtonCallback: index => {
				const item = this.buildItemFromRow(tableData, index)
				this.interactions.updateItem(item)
				this.dom.plotsBtnsDiv.style('display', 'block')
			}
		})
	}

	/** Builds an item object from a table row, mapping column labels to keys.
	 * Converts 'sample' -> 'sID' and 'experiment' -> 'eID'.
	 * Extracted out from noButtonCallback for testing.  */
	buildItemFromRow(tableData: SCTableData, index: number) {
		const item = {} as { sID: string; eID: string; [key: string]: any }
		tableData.rows[index].forEach((r: TableCell, idx: number) => {
			if (!r.value) return
			let key = tableData.columns[idx].label.toLowerCase()
			/** Convert the column labels into the required sample structure keys.
			 * Maintains the sample obj used throughout the app whilst allowing for
			 * dynamic column labels based on the config. */
			key = key === 'sample' ? 'sID' : key === 'experiment' ? 'eID' : key
			item[key] = r.value
		})
		if (!item.sID) throw new Error('Selected item must have sID property')
		return item
	}

	updateTable(activeSandboxes: Map<string, { plotId: string; div: any; plotName: string }[]>) {
		this.activeSandboxes = activeSandboxes
		this.reapplyAllPlotButtons()
	}

	/** Called by afterRender to re-apply buttons for all samples with subplots.
	 * Also called in updateTable when the active sandboxes (i.e. subplots) change.*/
	reapplyAllPlotButtons() {
		/** Check btns still apply to active sandboxes. If not delete
		 * from table and tracker. */
		for (const sampleId of this.rendered.keys()) {
			if (!this.activeSandboxes.has(sampleId)) {
				this.deleteBtns(sampleId)
			}
		}
		for (const sampleId of this.activeSandboxes.keys()) {
			this.applyButtonsForSample(sampleId)
		}
	}

	deleteBtns(sampleId: string) {
		const cached = this.rendered.get(sampleId)
		if (cached) {
			cached.cell.selectAll('.sjpp-sc-table-plot-btn').remove()
			this.rendered.delete(sampleId)
		}
	}

	/** Applies buttons for a single sample. Skips DOM work if cell and plots are unchanged. */
	applyButtonsForSample(sampleId: string) {
		const sampleIdx = this.tableData.sampleColIdx

		/** Rows array mutates on sort. Find the row by matching sampleId.*/
		const row = this.tableData.rows.find(r => r[sampleIdx].value === sampleId)
		if (!row) return

		const cell = row[sampleIdx + 1].__td
		const sampleSandboxes = this.activeSandboxes.get(sampleId)
		if (!sampleSandboxes || sampleSandboxes.length === 0) return

		const plotIds = sampleSandboxes.map(s => s.plotId).join(',')
		const cached = this.rendered.get(sampleId)
		/** Guard against rerendering btns */
		if (cached && cached.cell === cell && cached.plotIds === plotIds) return

		cell.selectAll('.sjpp-sc-table-plot-btn').remove()
		this.rendered.set(sampleId, { cell, plotIds })
		for (const { div, plotName } of sampleSandboxes) {
			this.appendPlotBtn(cell, div, plotName, sampleId)
		}
	}

	appendPlotBtn(cell: any, sandboxDiv: any, plotName: string, sampleId: string) {
		const text = plotName.length > 25 ? plotName.slice(0, 12) + '...' : plotName
		const label = `Scroll to ${plotName}`
		cell
			.append('button')
			.attr('class', 'sjpp-sc-table-plot-btn')
			.attr('data-testid', `sjpp-sc-table-${sampleId}-${plotName}-btn`)
			.style('padding', '2px 5px')
			.style('margin-left', '4px')
			.style('font-size', '0.8em')
			.style('border-radius', '20px')
			.style('border', '0.5px solid black')
			.style('cursor', 'pointer')
			.text(text)
			.attr('aria-label', label)
			.attr('title', label)
			.attr('tabindex', 0)
			.on('click', () => {
				sandboxDiv.node().scrollIntoView({ behavior: 'smooth', block: 'start' })
			})
	}
}
