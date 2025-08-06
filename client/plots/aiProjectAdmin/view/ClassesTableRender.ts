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
	/** table.ts updates this.rows and cell values in editCallback
	 * Save a copy to check for duplicates when editing class names.
	 */
	rowsCopy: TableRow[]

	constructor(holder: any, rows?: TableRow[]) {
		this.dom = {
			tableDiv: holder.append('div'),
			btnDiv: holder.append('div')
		}
		this.columns = [
			{ label: '' }, // Empty for the delete icon
			{
				label: 'NAME',
				editCallback: (rowIdx, cell) => {
					const newValue = (cell.value as string).trim()
					const foundSameName = this.rows.some((r, i) => newValue === (r[1].value as string).trim() && i !== rowIdx)
					if (foundSameName) {
						alert(`Class name '${newValue}' already exists`)
						/** Reset to original value
						 * renderTable() updates arg.rows and cell value before this callback.
						 * This resets the value to the original value */
						cell.value = this.rowsCopy[rowIdx][1].value
						cell.__td.text(this.rowsCopy[rowIdx][1].value)
						return
					}
					this.rowsCopy = this.rows.map(r => r.map(c => ({ ...c })))
				}
			},
			{ label: 'COLOR' }
		]
		const colorScale = getColors(5)
		this.rows = rows || this.setDefaultClasses(colorScale)
		this.rowsCopy = []

		this.renderTable()
		this.renderAddClassBtn(colorScale)
	}

	renderTable() {
		this.dom.tableDiv.select('table').remove()
		if (!this.rows || this.rows.length === 0) return

		// Deep copy to avoid reference issues
		// Regenerate on every render
		this.rowsCopy = this.rows.map(r => r.map(c => ({ ...c })))

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
			this.getNewClass(colorScale, rows)
		}

		return rows
	}

	getNewClass(colorScale: any, rows: TableRow[]) {
		const getName = (i: number) => `New class${i == 0 ? '' : ` ${i + 1}`}`

		let i = 0
		let found = true
		while (found) {
			const checkName = getName(i)
			found = rows.some(r => r[1].value == checkName)
			if (found) i++
		}

		rows.push([
			{ html: `<div class="sja_menuoption">&times;<div>` },
			{ value: getName(i) },
			{ color: rgb(colorScale(`${i + 1}`)).formatHex() }
		])
	}

	renderAddClassBtn(colorScale: any) {
		this.dom.btnDiv
			.append('div')
			.text('Add Class')
			.classed('sja_menuoption', true)
			.style('display', 'inline-block')
			.style('margin', '10px 0px 0px 0px')
			.on('click', () => {
				this.getNewClass(colorScale, this.rows)
				this.renderTable()
			})
	}
}
