import { select } from 'd3'
import { defaultcolor } from '../shared/common'

/*
print an html table, using the specified columns and rows

input:

div = d3-wrapped holder

columns = [ {label} ]
	each element is an object describing a column
	label: str, the text to show as header of a column

rows = [ [] ]
	each element is an array of cells for a row, with array length must matching columns.length
	a cell can be single value, or multi value:

	single value cell: 
	{
		url: string, to print in <a> element
		html: string, to print with .html() d3 method, may be susceptible to attack
		value: to print with .text() d3 method
		
	}

	multi-value cell:
	{
		values: [
			{url/html/value}, {}, ...
		]
	}
*/
export async function renderTable({ columns, rows, div, max_width = '90vw', max_height = '50vh', buttons }) {
	const numColumns = columns.length

	// create a Parent Div element to which the header and sample grid will be appended as divH and divS.
	const parentDiv = div
		.append('div')
		.style('overflow', 'scroll')
		.style('scrollbar-width', 'none')
		.style('width', '98%')
		.style('background-color', 'white')
		.attr('class', 'sjpp_grid_container')
		.style('grid-template-columns', `1.5vw ${buttons ? '2vw' : ''} repeat(${numColumns}, auto)`)
		.style('max-width', max_width)
		.style('max-height', max_height)

	// header div
	const divH = parentDiv.append('div').style('display', 'contents')
	divH
		.append('div')
		.attr('class', 'sjpp_grid_item sjpp_grid_header')
		.text('#')
	if (buttons) {
		const cell = divH.append('div').attr('class', 'sjpp_grid_item')
		const checkboxH = cell
			.append('input')
			.attr('type', 'checkbox')
			.on('change', () => {
				table.selectAll('input').property('checked', checkboxH.node().checked)
				enableButtons()
			})
	}

	// header values
	for (const c of columns) {
		divH
			.append('div')
			.text(c.label)
			.attr('class', 'sjpp_grid_item sjpp_grid_header')
	}

	// sample values
	// iterate over each row in rows and create a div for each row that has a grid layout similar to the header grid.
	const table = parentDiv.append('div').style('display', 'contents')

	for (const [i, row] of rows.entries()) {
		const rowGrid = table.append('div')
		rowGrid.attr('class', 'sjpp_grid_row_wrapper')
		const lineDiv = rowGrid
			.append('div')
			.text(i + 1)
			.style('font-size', '0.8rem')
			.style('color', defaultcolor)
			.attr('class', 'sjpp_grid_item')
			.style('background-color', i % 2 == 0 ? 'rgb(237, 237, 237)' : 'white')

		if (buttons) {
			const checkbox = rowGrid
				.append('div')
				.attr('class', 'sjpp_grid_item')
				.style('background-color', i % 2 == 0 ? 'rgb(237, 237, 237)' : 'white')
				.style('float', 'center')
				.append('input')
				.attr('type', 'checkbox')
				.attr('value', i)
				.on('change', () => enableButtons())
		}

		// each row comprises of cell and each cell has values that will get appended to div elements of the rowGrid stored in td.
		for (const [colIdx, cell] of row.entries()) {
			const td = rowGrid
				.append('div')
				.attr('class', 'sjpp_grid_item')
				.style('background-color', i % 2 == 0 ? 'rgb(237, 237, 237)' : 'white')

			// if index of each row is even then the background of that row should be grey and also add hovering in yellow.

			// if cell has values then append those values in new divs on td which is stored in d.
			if (cell.values) {
				for (const v of cell.values) {
					// if those values have url in them then tag it to the sample name/id otherwise just append the value of that cell onto the div
					if (v.url) {
						td.append('a')
							.text(v.value)
							.attr('href', v.url)
							.attr('target', '_blank')
					} else if (v.html) {
						td.html(v.html)
					} else {
						td.text(v.value)
					}
				}
			} else if (cell.url) {
				td.append('a')
					.text(cell.value)
					.attr('href', cell.url)
					.attr('target', '_blank')
			} else if (cell.html) {
				td.html(cell.html)
			} else if (cell.value) {
				td.text(cell.value)
			}
		}
	}
	if (buttons) {
		const footerDiv = div
			.append('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('margin', '5px 5px')

		for (const button of buttons) {
			const values = []

			button.button = footerDiv
				.append('button')
				.attr('disabled', true)
				.text(button.text)
				.style('margin-right', '10px')
				.on('click', e => {
					const checkboxs = table.selectAll('input:checked')
					if (!checkboxs.empty()) {
						checkboxs.each((d, i, nodes) => {
							const node = nodes[i]
							values.push(parseInt(node.value))
						})
						button.callback(values)
					}
				})
		}
	}

	function enableButtons() {
		const checkboxs = table.selectAll('input:checked')
		for (const button of buttons) button.button.node().disabled = checkboxs.empty()
	}
}
