import { renderTable } from '#dom'

export class SelectorTableRender {
	dom: any
	app: any
	images: { rows: any[]; cols: any[] }

	constructor(holder: any, app: any, images: { rows: any[]; cols: any[] }) {
		this.dom = {
			holder
		}
		this.app = app
		this.images = images

		this.render()
	}

	render() {
		this.dom.holder.append('div').attr('id', 'selector-table').style('padding', '10px 0')

		/** This is for development
		 * eventually the API request will return which rows should be selected.
		 */
		const selectedRows = this.images.rows.map((_, i) => (i < 50 ? i : -1)) // Select first 50 rows

		renderTable({
			div: this.dom.holder,
			columns: this.images.cols,
			rows: this.images.rows,
			selectedRows,
			striped: true,
			noButtonCallback: () => {
				// to show check boxes
			}
		})
	}
}
