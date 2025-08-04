import { renderTable } from '#dom'
import { getColors } from '#shared/common.js'
import { rgb } from 'd3-color'
import type { TableColumn, TableRow } from '#dom'
import type { Elem } from '../../../types/d3'

export class ClassesTableRender {
	dom: {
		tableDiv: Elem
		btnDiv: Elem
	}
	columns: TableColumn[]
	rows: TableRow[]

	constructor(holder: any, rows?: TableRow[]) {
		holder.style('padding', '10px')
		this.dom = {
			tableDiv: holder.append('div').attr('id', 'sjpp-ai-prjt-admin-classes-table'),
			btnDiv: holder.append('div')
		}
		this.columns = [
			{ label: '' }, // Empty for the delete icon
			{
				label: 'NAME',
				editCallback: (rowIdx, cell) => {
					console.log('Edited row', rowIdx, 'cell:', cell)
				}
			},
			{ label: 'COLOR' }
		]
		const colorScale = getColors(4)
		this.rows = rows || this.setDefaultClasses(colorScale)

		this.renderTable()
		this.renderAddClassBtn(colorScale)
	}

	renderTable() {
		this.dom.tableDiv.select('table').remove()
		if (!this.rows || this.rows.length === 0) return

		renderTable({
			div: this.dom.tableDiv,
			columns: this.columns,
			rows: this.rows,
			striped: false,
			showLines: false,
			singleMode: false
		})

		//editCallback only works with changing the value of the cell
		for (const [i, row] of this.rows.entries()) {
			const deleteBtn = row[0].__td.select('.sja_menuoption')
			deleteBtn.on('click', () => {
				this.rows.splice(i, 1)
				this.renderTable()
			})
		}
	}

	setDefaultClasses(colorScale) {
		//TODO default classes from dataset
		const rows: TableRow[] = []

		for (let i = 0; i < 4; i++) {
			this.getNewClass(colorScale, i, rows)
		}
		return rows
	}

	getNewClass(colorScale, i, rows) {
		rows.push([
			{ html: `<div class="sja_menuoption">&times;<div>` },
			{ value: `New class ${i == 0 ? '' : i + 1}` },
			{ color: rgb(colorScale(`${i + 1}`)).formatHex() }
		])
	}

	renderAddClassBtn(colorScale) {
		this.dom.btnDiv
			.append('div')
			.text('Add Class')
			.classed('sja_menuoption', true)
			.style('display', 'inline-block')
			.on('click', () => {
				const i = this.rows.length
				this.getNewClass(colorScale, i, this.rows)
				this.renderTable()
			})
	}
}
