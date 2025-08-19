import { renderTable } from '#dom'

export class SelectorTableRender {
	dom: any
	app: any
	images: { rows: any[]; cols: any[] }
	interactions: any
	selectedRows: any

	constructor(holder: any, app: any, interactions, images: { rows: any[]; cols: any[] }) {
		this.dom = {
			holder,
			tableDiv: holder.append('div').attr('id', 'sjpp-selector-table').style('padding', '10px 0'),
			btnDiv: holder.append('div').attr('id', 'sjpp-selector-btns')
		}
		this.app = app
		this.images = images
		this.interactions = interactions
		/** This is for development
		 * eventually the API request will return which rows should be selected.
		 */
		this.selectedRows = new Set(this.images.rows.map((_, i) => (i < 50 ? i : -1))) // Select first 50 rows for prototype

		this.render()
	}

	private render() {
		renderTable({
			div: this.dom.tableDiv,
			columns: this.images.cols,
			rows: this.images.rows,
			selectedRows: Array.from(this.selectedRows),
			striped: true,
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
		this.dom.btnDiv
			.append('div')
			.text('Apply')
			.classed('sja_menuoption', true)
			.style('display', 'block')
			.style('width', 'fit-content')
			.style('margin-left', '5vw')
			.on('click', async () => {
				this.interactions.editProject({
					project: {
						images: Array.from(this.selectedRows).map((_, i) => this.images.rows[i][0].value)
					}
				})
			})
	}
}
