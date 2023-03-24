import { select } from 'd3-selection'

/*
print an html table, using the specified columns and rows

Accepts following parameters; function has no return

******************
REQUIRED ARGUMENTS
******************

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

******************
OPTIONAL ARGUMENTS
******************

columnButtons = [ {button} ]
	Each element is an object describing a button:
	text: str, the text to show in the button
	callback: function, the function to be called when the button is clicked
	class: class to customize the button style

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

resize = false, boolean
	If true, allow to adjust table height by dragging

selectedRowStyle={}
  an object of arbitrary css key-values on how to style selected rows,
  for example `{text-decoration: 'line-through'}`. If a row is not
  selected, each css property will be set to an empty string ''
*/
export function renderTable({
	columns,
	rows,
	div,
	columnButtons,
	buttons,
	noButtonCallback,
	singleMode = false,
	showLines = true,
	striped = true,
	showHeader = true,
	maxWidth = '90vw',
	maxHeight = '40vh',
	selectedRows = [],
	selectAll = false,
	resize = false,
	selectedRowStyle = {}
}) {
	validateInput()
	let _selectedRowStyle = selectedRowStyle

	function validateInput() {
		if (!columns || columns?.length == 0) throw `Missing columns data`
		if (!rows) throw `Missing rows data`
		if (!div) throw `Missing div argument`
		let lineNumsWithDataProbs = []
		for (const [i, row] of rows.entries()) {
			if (row.length != columns.length) lineNumsWithDataProbs.push(i + 1)
		}
		if (lineNumsWithDataProbs.length > 0)
			throw `Num of row objects != num of cols. Line num(s) = ${lineNumsWithDataProbs}`
		if (buttons) {
			for (const [i, btn] of buttons.entries()) {
				if (!btn.text) throw `Missing button.text in buttons, line #${i + 1}`
				if (!btn.callback) throw `Missing button.callback in buttons, line #${i + 1}`
			}
		}

		// this check is disabled for now as it breaks gdc bam slicing ui
		//if (singleMode == true && (!buttons || !noButtonCallback)) throw `Missing buttons array and noButtonCallback but singleMode = true`
	}

	const parentDiv = div.append('div').style('background-color', 'white')

	if (resize) {
		if (rows.length > 10) parentDiv.style('height', maxHeight)
		parentDiv.style('max-width', maxWidth)
		parentDiv.style('resize', 'both')
	} else {
		parentDiv
			.style('max-height', maxHeight)
			.style('max-width', maxWidth)
			.style('resize', 'horizontal')
	}
	parentDiv.attr('class', 'sjpp_hide_scrollbar')

	const table = parentDiv.append('table').style('width', '100%')

	// should not use "fixed", it does not make sense to force equal width of all columns. also sample name column is a bit longer than most fields but we do want it to be entirely visible
	//.style('table-layout', 'fixed')

	// header div
	const thead = table
		.append('thead')
		.style('position', 'sticky')
		.style('top', '0')
		.style('background-color', 'white')
		.style('padding', '5px')

	const theadRow = thead.append('tr')
	if (showLines) theadRow.append('td').style('width', '1vw')

	if (buttons || noButtonCallback) {
		const cell = theadRow
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
					const nodes = tbody.selectAll('input').nodes()
					tbody.selectAll('input').property('checked', checkboxH.node().checked)
					if (buttons) enableButtons()
					if (noButtonCallback) for (const [i, node] of nodes.entries()) noButtonCallback(i, node)
				})
			checkboxH.node().checked = selectAll
		}
		if (!showHeader)
			theadRow
				.append('th')
				.text('Check/Uncheck All')
				.attr('class', 'sjpp_table_header sjpp_table_item')
	}
	if (showHeader)
		for (const c of columns) {
			const th = theadRow
				.append('th')
				.text(c.label)
				.attr('class', 'sjpp_table_item sjpp_table_header')
			if (c.width) th.style('width', c.width)
		}
	if (columnButtons) {
		theadRow
			.append('th')
			.text('Actions')
			.attr('class', 'sjpp_table_item sjpp_table_header')
	}

	const tbody = table.append('tbody')
	for (const [i, row] of rows.entries()) {
		let checkbox
		const rowtable = tbody.append('tr').attr('class', 'sjpp_row_wrapper')
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
				.style('text-align', 'center')
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
				.property('checked', selectAll || selectedRows.includes(i))
				.on('change', () => {
					if (buttons) enableButtons()
					else noButtonCallback(i, checkbox.node())

					const checked = checkbox.property('checked')
					for (const key in _selectedRowStyle) {
						rowtable.style(key, checked ? _selectedRowStyle[key] : '')
					}
				})

			const checked = checkbox.property('checked')
			for (const key in selectedRowStyle) {
				rowtable.style(key, checked ? selectedRowStyle[key] : '')
			}
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
							.text(v.value || v.value == 0 ? v.value : v.url) //Fix for if .value missing, url does not display
							.attr('href', v.url)
							.attr('target', '_blank')
					} else if (v.html) {
						//Fix for only the last html or value displaying in the td
						//instead of all objs in values array
						td.append('div').html(v.html)
					} else {
						td.append('div').text(v.value)
					}
				}
			} else if (cell.url) {
				td.append('a')
					.text(cell.value || cell.value == 0 ? cell.value : cell.url) //Fix for if .value missing, url does not display
					.attr('href', cell.url)
					.attr('target', '_blank')
			} else if (cell.html) {
				td.html(cell.html)
			} else if (cell.value) {
				td.text(cell.value)
			}
		}
		if (columnButtons) {
			const td = rowtable.append('td').attr('class', 'sjpp_table_item')
			for (const button of columnButtons) {
				button.button = td
					.append('button')
					.text(button.text)
					.on('click', () => button.callback(i))
			}
		}
	}

	if (buttons) {
		const footerDiv = div
			.append('div')
			.style('position', 'sticky')
			.style('bottom', '0')
			.insert('div')
			.style('display', 'inline-block')
			.style('float', 'right')

		for (const button of buttons) {
			button.button = footerDiv
				.append('button')
				.text(button.text)
				.style('margin', '10px 10px 0 0')
				.on('click', e => {
					const checkboxs = tbody.selectAll('input:checked')
					const values = []
					if (!checkboxs.empty()) {
						checkboxs.each((d, i, nodes) => {
							const node = nodes[i]
							values.push(parseInt(node.value))
						})
						button.callback(values)
					}
				})
			if (button.class) button.button.attr('class', button.class)
			//else button.button.attr('class', 'sjpp_apply_btn')
			button.button.node().disabled = selectedRows.length == 0 && !selectAll
		}
	}

	function enableButtons() {
		const checkboxs = tbody.selectAll('input:checked')
		for (const button of buttons) button.button.node().disabled = checkboxs.empty()
	}

	const api = {
		update(opts) {
			if (opts.selectedRowStyle) {
				_selectedRowStyle = opts.selectedRowStyle
				const trs = tbody.selectAll('tr')
				for (const key in _selectedRowStyle) {
					const value = trs.style(key, function() {
						return select(this)
							.select('td input')
							.property('checked')
							? _selectedRowStyle[key]
							: ''
					})
				}
			}
		}
	}

	return api
}
