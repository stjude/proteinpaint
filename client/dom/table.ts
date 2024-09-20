import { select } from 'd3-selection'

export type Cell = {
	url?: string // to print in <a> element
	value?: string | number // to print with .text() d3 method
	color?: string // color code to render as a color cell or, if value provided, cell font-color
	html?: string // to print with .html() d3 method, may be susceptible to attack
	__td?: any //is attached to each cell object pointing to <td>, for external code to render interactive contents in it
	disabled?: boolean
	elemId?: string // may be used as a reference ID for aria-labelledby, or other use
}

export type Column = {
	label: string //the text to show as header of a column
	width?: string // column width
	editCallback?: (i: number, cell: Cell) => void // Makes this column editable  and allows to notify the change through the callback.
	//It is only allowed for cells with a value or a color field
	nowrap?: boolean // set white-space=nowrap on all <td> of this column so strings do not wrap
	align?: string // left, center, right. If missing it is aligned to the left by default
}

export type Button = {
	dataTestId?: any
	text: string //the text to show in the button
	callback: (idxs: number[], button: any) => void //called when the button is clicked. Receives selected indexes and the button dom object
	disabled?: (index: number) => boolean
	button: any
	onChange?: (idx: number[], button: any) => void //Called when selecting rows, it would update the button text
	class?: string //to customize button style or to assist detection in testing
}

// ariaLabelledBy is an optional attribute on the array object,
// if present, will be used as aria-labelledby attribute on the
// radio or checkbox input element, to address Section 508 requirement
type TableRow = Cell[] & { ariaLabelledBy?: string }

export type TableArgs = {
	columns: Column[] //List of table columns
	rows: TableRow[] //each element is an array of cells for a row, with array length must matching columns length

	div: any //Holder to render the table
	columnButtons?: Button[] //List of buttons to render in a column
	buttons?: Button[] //List of buttons to do actions after the table is edited
	noButtonCallback?: (i: number, node: any) => void //Function that will be called when a row is selected
	singleMode?: boolean //	true for single-selection. use radio button instead of checkboxes for multiselect
	noRadioBtn?: boolean // true to show no radio buttons. should only use when singleMode=true
	showLines?: boolean //Shows or hides line column.
	striped?: boolean //When active makes the table rows to alternate bg colors
	showHeader?: boolean //Render header or not
	maxWidth?: string //The max width of the table, 90vw by default.
	maxHeight?: string //The max height of the table, 40vh by default

	selectedRows?: number[] //Preselect rows specified
	selectAll: boolean //Preselect all rows
	resize?: boolean //Allow to resize the table height dragging the border
	selectedRowStyle?: any //An object of arbitrary css key-values on how to style selected rows,
	//for example `{text-decoration: 'line-through'}`. If a row is not
	//selected, each css property will be set to an empty string ''
	inputName?: any //For testing purposes
	//optional. value is predefined input name. this allows test to work.
	//when not available, for each table made, create a unique name to use as the <input name=?>
	//if the same name is always used, multiple tables created in one page will conflict in row selection
	dataTestId?: any
	//Optional
	//For testing purposes
}

// incremented input ID will guarantee no collision from using getUniqueNameOrId()
let idIncr = 0
// random suffix will minimize the chance of collission of other code that
// happen to use the same prefix/beginning substring for element ID
const randomSuffix = Math.random()
// generate unique input name or id string
function getUniqueNameOrId(str = 'elem') {
	return `sjpp-${str}-${idIncr++}-${randomSuffix}`
}

/*
Prints an html table, using the specified columns and rows
See the paramters in TableArgs; function has no return
*/
export function renderTable({
	columns,
	rows,
	div,
	columnButtons,
	buttons,
	noButtonCallback,
	singleMode = false,
	noRadioBtn = false,
	showLines = true,
	striped = true,
	showHeader = true,
	maxWidth = '90vw',
	maxHeight = '40vh',
	selectedRows = [],
	selectAll = false,
	resize = false,
	selectedRowStyle = {},
	inputName = null,
	dataTestId = null
}: TableArgs) {
	validateInput()
	let _selectedRowStyle = selectedRowStyle

	function validateInput() {
		if (!columns || columns?.length == 0) throw `Missing columns data`
		if (!rows) throw `Missing rows data`
		if (!div) throw `Missing div argument`
		const lineNumsWithDataProbs: number[] = []
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

	const uniqueInputName = inputName || getUniqueNameOrId('input')

	const parentDiv = div.append('div').style('background-color', 'white')

	if (resize) {
		if (rows.length > 10) parentDiv.style('height', maxHeight)
		parentDiv.style('max-width', maxWidth)
		parentDiv.style('resize', 'both')
	} else {
		parentDiv.style('max-height', maxHeight).style('max-width', maxWidth)
		if (columns.length > 2) parentDiv.style('resize', 'horizontal')
	}
	parentDiv.attr('class', 'sjpp_show_scrollbar')

	const table = parentDiv.append('table').style('width', '100%')

	if (dataTestId) {
		table.attr('data-testid', dataTestId)
	}
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
		const cell = theadRow.append('td').attr('class', 'sjpp_table_header').style('width', '1.5vw')
		if (!singleMode) {
			const checkboxH = cell
				.append('input')
				// TODO: should use a globally-unique element id for the checkbox
				.attr('id', 'checkboxHeader')
				.attr('type', 'checkbox')
				.attr('title', 'Check or uncheck all')
				.on('change', () => {
					const nodes = tbody.selectAll('input').nodes()
					tbody.selectAll('input').property('checked', checkboxH.node().checked)
					if (buttons) updateButtons()
					if (noButtonCallback) for (const [i, node] of nodes.entries()) noButtonCallback(i, node)
				})
			checkboxH.node().checked = selectAll
			if (!showHeader)
				theadRow.append('th').text('Check/Uncheck All').attr('class', 'sjpp_table_header sjpp_table_item')
		}
	}
	if (columnButtons && columnButtons.length > 0) {
		theadRow.append('th').text('Actions').attr('class', 'sjpp_table_item sjpp_table_header')
	}
	if (showHeader)
		for (const c of columns) {
			const th = theadRow.append('th').text(c.label).attr('class', 'sjpp_table_item sjpp_table_header')
			if (c.width) th.style('width', c.width)
		}

	const tbody = table.append('tbody')
	for (const [i, row] of rows.entries()) {
		let checkbox
		const tr = tbody.append('tr').attr('class', 'sjpp_row_wrapper')
		if (striped && i % 2 == 1) tr.style('background-color', 'rgb(245,245,245)')

		// for Section 508 compliance: always create an aria-labelledby attribute on an input
		// NOTE: a title attribute, wrapping with a label element, or other solutions are possible,
		// but using aria-labelled by is less likely to conflict with existing elem attributes or layout
		const ariaLabelledBy = row.ariaLabelledBy || row[0]?.elemId || getUniqueNameOrId('td')
		// by default, assume that the first data cell should be used to label the input to its left,
		// and should create an element id on it as needed
		if (!row.ariaLabelledBy && row[0] && !row[0].elemId) row[0].elemId = ariaLabelledBy

		if (buttons || noButtonCallback)
			tr.on('click', e => {
				if (e.target !== checkbox.node()) {
					if (singleMode)
						//not a checkbox
						checkbox.node().checked = true
					else checkbox.node().checked = !checkbox.node().checked
					checkbox.dispatch('change')
				}
			})
		if (showLines) {
			tr.append('td')
				.text(i + 1)
				.style('text-align', 'center')
				.style('width', '1vw')
				.style('font-size', '0.8rem')
		}

		if (buttons || noButtonCallback) {
			const td = tr.append('td').style('width', '1.5vw').style('float', 'center')
			if (noRadioBtn) {
				// should be in singleMode and do not want to show radio buttons for cleaner look. <input> elements are still rendered since "checkbox" element is required for selection. thus simply hide <td>.
				td.style('display', 'none')
			}
			checkbox = td
				.append('input')
				.attr('type', singleMode ? 'radio' : 'checkbox')
				.attr('name', uniqueInputName)
				.attr('value', i)
				.attr('aria-labelledby', ariaLabelledBy)
				.property('checked', selectAll || selectedRows.includes(i))
				.on('change', () => {
					if (buttons) updateButtons()
					else noButtonCallback!(i, checkbox.node())

					const checked = checkbox.property('checked')
					for (const key in _selectedRowStyle) {
						tr.style(key, checked ? _selectedRowStyle[key] : '')
					}
				})

			const checked = checkbox.property('checked')
			for (const key in selectedRowStyle) {
				tr.style(key, checked ? selectedRowStyle[key] : '')
			}
		}
		if (columnButtons && columnButtons.length > 0) {
			const td = tr.append('td').attr('class', 'sjpp_table_item')
			// Assuming x is your variable
			for (const button of columnButtons) {
				button.button = td
					.append('button')
					.style('white-space', 'normal')
					.text(button.text)
					.on('click', event => button.callback(event, i))
				if (button.dataTestId) {
					button.button.attr('data-testid', button.dataTestId)
				}
				if ('disabled' in button) button.button.node().disabled = button.disabled!(i)
			}
		}
		for (const [colIdx, cell] of row.entries()) {
			const td = tr
				.append('td')
				.attr('id', cell.elemId || null)
				.attr('class', 'sjpp_table_item')

			// attach <td> for external code to modify
			cell.__td = td

			const column = columns[colIdx]
			if (column.editCallback && cell.value) {
				td.on('click', event => {
					event.stopImmediatePropagation()
					const isEdit = td.select('input').empty()
					if (!isEdit) return
					td.html('')
					const input = td
						.append('input')
						.attr('value', cell.value)
						.on('change', () => {
							const value = input.node().value
							cell.value = value
							td.text(cell.value)
							column.editCallback!(i, cell)
						})
					input.node().focus()
					input.node().select()
				})
			}
			if (column.width) td.style('width', column.width)
			if (column.align) td.style('text-align', column.align)

			if (column.nowrap) td.style('white-space', 'nowrap')
			if (cell.url) {
				td.append('a')
					.text(cell.value || cell.value == 0 ? cell.value : cell.url) //Fix for if .value missing, url does not display
					.attr('href', cell.url)
					.attr('target', '_blank')
			} else if (cell.html) td.html(cell.html)
			else if ('value' in cell) {
				td.text(cell.value)
				if (cell.color) td.style('color', cell.color)
			} else if (cell.color) {
				if (cell.disabled) {
					td.style('background-color', cell.color)
				} else {
					const input = td
						.append('input')
						.attr('type', 'color')
						.attr('value', cell.color)
						.on('change', () => {
							const color = input.node().value
							cell.color = color
							if (column.editCallback) column.editCallback(i, cell)
						})
				}
			}
		}
	}

	if (buttons) {
		const footerDiv = div
			.append('div')
			.insert('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('padding-bottom', '5px')

		for (const bCfg of buttons) {
			bCfg.button = footerDiv
				.append('button')
				.text(bCfg.text)
				.style('margin', '10px 10px 0 0')
				.on('click', () => {
					bCfg.callback(getCheckedRowIndex(), bCfg.button.node())
				})
			if (bCfg.class) bCfg.button.attr('class', bCfg.class)
			//else button.button.attr('class', 'sjpp_apply_btn')
			bCfg.button.node().disabled = selectedRows.length == 0 && !selectAll
		}

		// call function to update buttons with .onChange(), so their text can reflect default checkbox selection
		updateButtons()
	}

	function updateButtons() {
		if (!buttons) return
		const idxlst = getCheckedRowIndex()
		for (const b of buttons) {
			b.button.node().disabled = idxlst.length == 0
			if (b.onChange) b.onChange(idxlst, b.button.node())
		}
	}

	function getCheckedRowIndex() {
		const checkboxes = tbody.selectAll('input:checked')
		const idxlst: Array<number> = []
		if (!checkboxes.empty()) {
			checkboxes.each((d, i, nodes) => {
				const node = nodes[i]
				idxlst.push(Number.parseInt(node.value))
			})
		}
		return idxlst
	}

	const api = {
		update(opts) {
			if (opts.selectedRowStyle) {
				_selectedRowStyle = opts.selectedRowStyle
				const trs = tbody.selectAll('tr')
				for (const key in _selectedRowStyle) {
					trs.style(key, function (this: any) {
						return select(this).select('td input').property('checked') ? _selectedRowStyle[key] : ''
					})
				}
			}
		}
	}

	return api
}

export async function downloadTable(rows, cols) {
	const filename = `table.tsv`
	let lines = ''
	for (const column of cols) {
		lines += `${column.label}\t`
	}
	lines += '\n'

	for (const row of rows) {
		for (const cell of row) {
			let value = ''
			if (cell.value) value = cell.value
			else if (cell.url) value = cell.url
			else if (cell.color) value = cell.color
			lines += `${value}\t`
		}
		lines += '\n'
	}
	const dataStr = 'data:text/tsv;charset=utf-8,' + encodeURIComponent(lines)

	const link = document.createElement('a')
	link.setAttribute('href', dataStr)
	// If you don't know the name or want to use
	// the webserver default set name = ''
	link.setAttribute('download', filename)
	document.body.appendChild(link)
	link.click()
	link.remove()
}
