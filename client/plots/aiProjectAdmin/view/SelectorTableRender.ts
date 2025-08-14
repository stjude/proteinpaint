import { renderTable } from '#dom'

export class SelectorTableRender {
	dom: any
	app: any
	images: string[]

	constructor(holder: any, app: any, images: string[]) {
		this.dom = {
			holder
		}
		this.app = app
		this.images = images

		this.render()
	}

	render() {
		this.dom.holder.append('div').attr('id', 'selector-table').style('padding', '10px 0')

		const columns = [{ label: 'Image' }]
		const rows = this.images.map(image => [{ value: image }])
		/** This is for development
		 * eventually the API request will return which rows should be selected.
		 */
		const selectedRows = rows.map((_, i) => (i < 50 ? i : -1)) // Select first 50 rows

		renderTable({
			div: this.dom.holder,
			columns,
			rows,
			selectedRows,
			striped: true,
			noButtonCallback: () => {
				// to show check boxes
			}
		})
	}
}
