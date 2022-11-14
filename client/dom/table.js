import { icons as icon_functions } from '../dom/control.icons'

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
export async function renderTable({
	columns,
	rows,
	div,
	max_width = '90vw',
	max_height = '90vh',
	deleteCallback = null
}) {
	const numColumns = columns.length
	const sampleWidth = numColumns < 10 ? 'auto' : '5vw'

	// create a Parent Div element to which the header and sample grid will be appended as divH and divS.
	const parentDiv = div
		.append('div')
		.style('overflow', 'scroll')
		.style('scrollbar-width', 'none')

		.style('width', '100%')
		.style('background-color', 'white')
		.attr('class', 'sjpp_grid_container')
		.style('grid-template-columns', `2vw ${deleteCallback ? '4vw' : ''} repeat(${numColumns}, auto)`)
		.style('max-width', max_width)
		.style('max-height', max_height)

	// header div
	const divH = parentDiv.append('div').style('display', 'contents')

	// append empty div element to header to adjust columns
	divH.append('div').attr('class', 'sjpp_grid_item')
	if (deleteCallback)
		divH
			.append('div')
			.attr('class', 'sjpp_grid_item')
			.text('Delete')

	// header values
	for (const c of columns) {
		divH
			.append('div')
			.text(c.label)
			.attr('class', 'sjpp_grid_item')
			.style('font-family', 'Arial')
			.style('font-size', '1em')
			.style('opacity', 0.5)
	}

	// sample values
	// iterate over each row in rows and create a div for each row that has a grid layout similar to the header grid.

	for (const [i, row] of rows.entries()) {
		const rowGrid = parentDiv.append('div')
		rowGrid.attr('class', 'sjpp_grid_row_wrapper')

		const lineDiv = rowGrid
			.append('div')
			.text(i + 1)
			.attr('class', 'sjpp_grid_item')
			.style('background-color', i % 2 == 0 ? 'rgb(237, 237, 237)' : 'white')
		if (deleteCallback) {
			const deleteDiv = rowGrid
				.append('div')
				.attr('class', 'sjpp_grid_item')
				.style('background-color', i % 2 == 0 ? 'rgb(237, 237, 237)' : 'white')
			icon_functions['delete'](deleteDiv, { handler: () => deleteCallback(i + 1) })
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
}
