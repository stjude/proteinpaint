import { select, style } from 'd3'
import { defaultcolor } from '../shared/common'

/*
print an html table, using the specified columns and rows

input:

div = d3-wrapped holder

columns = [ {label} ]
	each element is an object describing a column
	label: str, the text to show as header of a column
	width: str, column width

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

buttons = [ {button} ]
	Each element is an object describing a button:
	text: str, the text to show in the button
	callback: function, the function to be called when the button is clicked
	class: class to customize the button style

noButtonCallback = (index, node) => {}
	Function that will be called when a row is selected	

singleMode = false, boolean
	Specifies if a radio button should be rendered instead

showLines = true: boolean.
	Shows/hides line column. 

striped = true, boolean
	When active makes the table rows to alternate colors

maxWidth = 90vw, string
	The max width of the table
maxHeight = 40vw, string
	The max height of the table

selectedRows=[]
	Each element is an index indicating that the corresponding row should be selected
	
selectAll = false, boolean
	When active makes all the rows selected by default
	
*/
export async function renderTable({
	columns,
	rows,
	div,
	buttons,
	noButtonCallback,
	singleMode = false,
	showLines = true,
	striped = true,
	showHeader = true,
	maxWidth = '90vw',
	maxHeight = '40vh',
	selectedRows = [],
	selectAll = false
}) {
	if (rows?.length == 0) return
	// create a Parent Div element to which the header and sample table will be appended as divH and divS.
	const parentDiv = div
		.style('padding', '5px')
		.style('background-color', 'white')
		.append('table')
		.style('display', 'block')
		.style('background-color', 'white')
		.style('max-width', maxWidth)

	// header div
	const divH = parentDiv
		.append('thead')
		.style('display', 'table')
		.style('table-layout', 'fixed')
		.style('width', '100%')
		.append('tr')
	if (showLines) {
		divH
			.append('th')
			.attr('class', 'sjpp_table_header')
			.text('#')
			.style('width', '1vw')
	}

	if (buttons || noButtonCallback) {
		const cell = divH
			.append('td')
			.attr('class', 'sjpp_table_header')
			.style('width', '1.5vw')
		if (!singleMode) {
			const checkboxH = cell
				.append('input')
				.attr('aria-label', 'Check/Uncheck All')
				.attr('id', 'checkboxHeader')
				.attr('type', 'checkbox')
				.on('change', () => {
					table.selectAll('input').property('checked', checkboxH.node().checked)
					enableButtons()
				})
			checkboxH.node().checked = selectAll
		}
		if (!showHeader)
			divH
				.append('th')
				.text('Check/Uncheck All')
				.attr('class', 'sjpp_table_header sjpp_table_item')
	}
	if (showHeader)
		for (const c of columns) {
			const th = divH
				.append('th')
				.text(c.label)
				.attr('class', 'sjpp_table_item sjpp_table_header')
			if (c.width) th.style('width', c.width)
		}

	const table = parentDiv
		.append('tbody')
		.style('display', 'block')
		.style('max-height', maxHeight)
		.style('overflow', 'scroll')

	for (const [i, row] of rows.entries()) {
		let checkbox
		const rowtable = table
			.append('tr')
			.attr('class', 'sjpp_row_wrapper')
			.style('display', 'table')
			.style('table-layout', 'fixed')
			.style('width', '100%')
		if (striped && i % 2 == 1) rowtable.style('background-color', 'rgb(245,245,245)')

		if (buttons || noButtonCallback)
			rowtable.on('click', e => {
				if (e.target !== checkbox.node()) {
					if (singleMode)
						//not a checkbox
						checkbox.node().checked = true
					else checkbox.node().checked = !checkbox.node().checked
					checkbox.dispatch('change')
				}
			})
		if (showLines) {
			const lineDiv = rowtable
				.append('td')
				.text(i + 1)
				.style('width', '1vw')
				.style('font-size', '0.8rem')
		}

		if (buttons || noButtonCallback) {
			checkbox = rowtable
				.append('td')
				.style('width', '1.5vw')
				.style('float', 'center')
				.append('input')
				.attr('aria-label', 'Select row')
				.attr('type', singleMode ? 'radio' : 'checkbox')
				.attr('name', 'select')
				.attr('value', i)
				.on('change', () => {
					if (buttons) enableButtons()
					else noButtonCallback(i, checkbox.node())
				})
			if (selectAll || selectedRows.includes(i)) checkbox.node().checked = true
		}

		for (const [colIdx, cell] of row.entries()) {
			const td = rowtable.append('td').attr('class', 'sjpp_table_item')
			const column = columns[colIdx]
			if (column.width) td.style('width', column.width)

			if (cell.values) {
				for (const v of cell.values) {
					// if those values have url in them then tag it to the sample name/id otherwise just append the value of that cell onto the td
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
			.insert('div')
			.style('display', 'inline-block')
			.style('float', 'right')

		for (const button of buttons) {
			const values = []

			button.button = footerDiv
				.append('button')
				.text(button.text)
				.style('margin', '10px 10px 0 0')
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
			if (button.class) button.button.attr('class', button.class)
			button.button.node().disabled = selectedRows.length == 0
		}
	}

	function enableButtons() {
		const checkboxs = table.selectAll('input:checked')
		for (const button of buttons) button.button.node().disabled = checkboxs.empty()
	}
}
