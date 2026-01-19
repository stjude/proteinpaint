import { renderTable } from '#dom'
import type { AIProjectAdminInteractions } from '../interactions/AIProjectAdminInteractions'
import type { Elem, Div } from '../../../types/d3'

export class SelectorTableRender {
	dom: {
		holder: Elem
		tableDiv: Div | Elem
		btnDiv: Div | Elem
	}
	images: { rows: any[]; cols: any[] } = { rows: [], cols: [] }
	interactions: AIProjectAdminInteractions
	selectedRows: Set<number> = new Set<number>()
	sortedIndexMap: number[] = []

	constructor(holder: Elem, interactions: AIProjectAdminInteractions, images: any) {
		this.dom = {
			holder,
			tableDiv: holder
				.append('div')
				.attr('class', '.sjpp-deletable-ai-prjt-admin-div')
				.attr('id', 'sjpp-selector-table')
				.style('padding', '10px 0'),
			btnDiv: holder.append('div').attr('class', '.sjpp-deletable-ai-prjt-admin-div').attr('id', 'sjpp-selector-btns')
		}

		this.images = images

		this.interactions = interactions

		// Collect selectedImages from any known location
		const selectedList: string[] = images?.selectedImages as string[]

		// Normalize helper: strip .svs and lowercase for robust comparison
		const normalize = (s: any) =>
			String(s ?? '')
				.replace(/\.svs$/i, '')
				.toLowerCase()

		const selectedSet = new Set((selectedList || []).map(normalize))

		// Build set of selected row indices whose image (assumed in first column value) is in selectedSet
		this.selectedRows = new Set<number>()
		;(this.images?.rows ?? []).forEach((row: any, i: number) => {
			const candidate = row?.[0]?.value
			const n = normalize(candidate)
			if (selectedSet.has(n)) this.selectedRows.add(i)
		})

		this.render()
	}

	private render() {
		const columns = this.images.cols.map(c => ({ ...c, sortable: true })) || []

		// If columns missing, show a friendly message instead of throwing
		if (!columns.length) {
			this.dom.tableDiv.append('div').text('Missing columns data').style('color', 'red')
			// still render Apply button (disabled) so user can continue
			this.renderApplyBtn(/*disable=*/ true)
			return
		}

		// Build mapping of rows with original indices and selection flags
		const rows = (this.images?.rows ?? []) as any[]
		const mapped = rows.map((row, origIdx) => ({
			row,
			origIdx,
			selected: this.selectedRows.has(origIdx)
		}))

		// Sort so selected rows come first, stable by original index
		mapped.sort((a, b) => {
			const selDiff = Number(b.selected) - Number(a.selected)
			return selDiff || a.origIdx - b.origIdx
		})

		// Prepare sorted rows and a map from sorted index -> original index
		const rowsSorted = mapped.map(m => m.row)
		this.sortedIndexMap = mapped.map(m => m.origIdx)

		// Selected indices must be in terms of the sorted array for the renderer
		const selectedRowsForRender = mapped.reduce<number[]>((acc, m, idx) => {
			if (m.selected) acc.push(idx)
			return acc
		}, [])

		renderTable({
			div: this.dom.tableDiv,
			columns,
			rows: rowsSorted,
			selectedRows: selectedRowsForRender,
			striped: true,
			header: { allowSort: true },
			noButtonCallback: (sortedIdx, node) => {
				// map back to original index when toggling selection
				const orig = this.sortedIndexMap?.[sortedIdx]
				if (orig === undefined) return
				if (node.checked) {
					this.selectedRows.add(orig)
				} else {
					this.selectedRows.delete(orig)
				}
				// Re-render so selected rows move to the top immediately
				;(this.dom.tableDiv as any).selectAll('*').remove()
				this.render()
			}
		})

		this.renderApplyBtn(/*disable=*/ false)
	}

	private renderApplyBtn(disable = false) {
		const btn = this.dom.btnDiv
			.append('div')
			.text('Apply')
			.classed('sja_menuoption', true)
			.style('display', 'block')
			.style('width', 'fit-content')
			.style('margin-left', '5vw')

		if (disable) btn.attr('disabled', true)

		btn.on('click', async () => {
			if (!this.selectedRows.size) {
				alert(`No rows selected. Please select some rows.`)
				return
			}
			//Don't allow multiple clicks
			btn.attr('disabled', true)

			const images = Array.from(this.selectedRows).map(i => `${this.images.rows[i][0].value}.svs`)
			await this.interactions.editProject({
				project: {
					images
				}
			})
			;(this.dom.holder as any).selectAll('*').remove()
			await this.interactions.launchViewer(this.dom.holder, images)
		})
	}
}
