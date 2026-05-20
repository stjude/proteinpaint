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
	lastSampleSandboxes: Map<string, { plotId: string; div: any; plotName: string }[]> | undefined

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
				/** Sort removes all custom html.
				 * Re-apply the plot buttons after sort. */
				if (this.lastSampleSandboxes) {
					this.reapplyAllPlotButtons()
				}
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

	updateTable(
		sampleId: string | undefined,
		sampleSandboxes: Map<string, { plotId: string; div: any; plotName: string }[]>
	) {
		this.lastSampleSandboxes = sampleSandboxes
		if (!sampleId) return
		this.applyButtonsForSample(sampleId)
	}

	/** Called by afterRender to re-apply buttons for all samples with subplots. */
	private reapplyAllPlotButtons() {
		if (!this.lastSampleSandboxes) return
		for (const sampleId of this.lastSampleSandboxes.keys()) {
			this.applyButtonsForSample(sampleId)
		}
	}

	/** Applies plot buttons to a single sample's row. */
	private applyButtonsForSample(sampleId: string) {
		const sampleSandboxes = this.lastSampleSandboxes
		const sampleIdx = this.tableData.sampleColIdx
		if (!sampleSandboxes) return

		/** Rows array mutates on sort. Find the row by matching sampleId.*/
		const row = this.tableData.rows.find(r => r[sampleIdx].value === sampleId)
		if (!row) return

		const cell = row[sampleIdx + 1].__td
		// Clear previous plot buttons before re-rendering
		cell.selectAll('.sjpp-sc-table-plot-btn').remove()
		const sandboxes = sampleSandboxes.get(sampleId)
		if (!sandboxes || sandboxes.length === 0) return

		for (const { div, plotName } of sandboxes) {
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
