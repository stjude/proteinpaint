import { renderTable } from '#dom'
import type { TableColumn, TableRow } from '#dom'
import type { AIProjectAdminInteractions } from '../interactions/AIProjectAdminInteractions'
import type { Elem, Div } from '../../../types/d3'

export class SelectorTableRender {
	dom: {
		holder: Elem
		tableDiv: Div | Elem
		btnDiv: Div | Elem
	}
	images: { rows: any[]; cols: any[] }
	interactions: AIProjectAdminInteractions
	selectedRows: Set<number>

	constructor(
		holder: Elem,
		interactions: AIProjectAdminInteractions,
		images: { rows: TableRow[]; cols: TableColumn[] }
	) {
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
		/** This is for development
		 * eventually the API request will return which rows should be selected.
		 */
		this.selectedRows = new Set(
			this.images.rows
				.filter((_, i) => {
					if (i < 50) return true
				})
				.map((_, i) => i)
		) // Select first 50 rows for prototype

		this.render()
	}

	private render() {
		renderTable({
			div: this.dom.tableDiv,
			columns: this.images.cols.map(c => ({ ...c, sortable: true })),
			rows: this.images.rows,
			selectedRows: Array.from(this.selectedRows),
			striped: true,
			header: { allowSort: true },
			noButtonCallback: (i, node) => {
				if (node.checked) {
					this.selectedRows.add(i)
				} else {
					this.selectedRows.delete(i)
				}
			}
		})

		this.renderApplyBtn()
	}

	private renderApplyBtn() {
		const btn = this.dom.btnDiv
			.append('div')
			.text('Apply')
			.classed('sja_menuoption', true)
			.style('display', 'block')
			.style('width', 'fit-content')
			.style('margin-left', '5vw')
			.on('click', async () => {
				if (!this.selectedRows.size) alert(`No rows selected. Please select some rows.`)
				//Don't allow multiple clicks
				btn.attr('disabled', true)

				const images = Array.from(this.selectedRows).map(i => `${this.images.rows[i][0].value}.svs`)
				await this.interactions.editProject({
					project: {
						images
					}
				})
				this.dom.holder.selectAll('*').remove()
				this.interactions.launchViewer(this.dom.holder, images)
			})
	}
}
