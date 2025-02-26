import { select } from 'd3-selection'
import { icons, Menu, axisstyle } from '#dom'
import { axisTop } from 'd3-axis'
import { format as d3format } from 'd3-format'
import { scaleLinear } from 'd3-scale'
import type { Th } from '../types/d3'
import type { AxisDomain } from 'd3-axis'

export type Cell = {
	/** to print in <a> element */
	url?: string
	/** to print with .text() d3 method */
	value?: string | number
	/** color code to render as a color cell or, if value provided, cell font-color */
	color?: string
	/** to print with .html() d3 method, may be susceptible to attack
	 * If an a tag is used, 'onclick="event.stopPropagation()"' is
	 * added before the end of the opening tag to prevent uncheck the box. */
	html?: string
	/** is attached to each cell object pointing to <td>, for external code to render interactive contents in it */
	__td?: any
	disabled?: boolean
	/** may be used as a reference ID for aria-labelledby, or other use */
	elemId?: string
	id?: number
}

export type Column = {
	/** the text to show as header of a column */
	label: string
	/** column width */
	width?: string
	/** Makes this column editable  and allows to notify the change
	 * through the callback. It is only allowed for cells with a value or a color field */
	editCallback?: (i: number, cell: Cell) => void
	/** set white-space=nowrap on all <td> of this column so strings do not wrap */
	nowrap?: boolean
	/** left, center, right. If missing it is aligned to the left by default */
	align?: string
	/** tooltip describing column content */
	tooltip?: string
	/** Used for sorting function
	 * Do not use this field for html columns */
	sortable?: boolean
	/** assume all values from this column are numbers; this renders the column into a barplot
	note that this cannot be used together with `sortable:true` */
	barplot?: Barplot
}

type Barplot = {
	/** width of numerical axis, also defines bar plotting width */
	axisWidth?: number
	/** color for negative value bars */
	colorNegative?: string
	/** color for positive value bars */
	colorPositive?: string
	/** horizontal padding on left/right of axis, svg scale width=axisWidth+xpadding*2 */
	xpadding?: number
	/** dynamically assigned d3 scale; not a parameter */
	scale?: any
	/** number of ticks to override an default */
	tickCount?: number
	/** tick format string */
	tickFormat?: string
}

export type Button = {
	dataTestId?: any
	/** the text to show in the button */
	text: string
	/** called when the button is clicked. Receives selected indexes and the button dom object */
	callback: (idxs: number[], button: any) => void
	disabled?: (index: number) => boolean
	button: any
	/** Called when selecting rows, it would update the button text */
	onChange?: (idx: number[], button: any) => void
	/** to customize button style or to assist detection in testing */
	class?: string
}

/** ariaLabelledBy is an optional attribute on the array object,
 * if present, will be used as aria-labelledby attribute on the
 * radio or checkbox input element, to address Section 508 requirement */
export type TableRow = Cell[] & { ariaLabelledBy?: string }

export type TableArgs = {
	/** List of table columns */
	columns: Column[]
	/** each element is an array of cells for a row, with array length must matching columns length */
	rows: TableRow[]
	/** Holder to render the table */
	div: any
	/** List of buttons to render in a column */
	columnButtons?: Button[]
	/** List of buttons to do actions after the table is edited */
	buttons?: Button[]
	/** Function that will be called when a row is selected */
	noButtonCallback?: (i: number, node: any) => void
	/** true for single-selection. use radio button instead of checkboxes for multiselect */
	singleMode?: boolean
	/** true to show no radio buttons. should only use when singleMode=true */
	noRadioBtn?: boolean
	/** Shows or hides line column. */
	showLines?: boolean
	/** When active makes the table rows to alternate bg colors */
	striped?: boolean
	/** Render header or not */
	showHeader?: boolean
	/** Options for rendering the header */
	header?: {
		/** allow sorting from column headers */
		allowSort?: boolean
		/**  object of key-value pairs to customize style of header <th> elements, e.g. {'font-size':'1.1em', ...} */
		style?: object
	}
	/** The max width of the table, 90vw by default. */
	maxWidth?: string
	/** The max height of the table, 40vh by default */
	maxHeight?: string
	/** Preselect rows specified */
	selectedRows?: number[]
	/** Preselect all rows */
	selectAll?: boolean
	/** Allow to resize the table height dragging the border*/
	resize?: boolean
	/** An object of arbitrary css key-values on how to style selected rows,
	 * for example `{text-decoration: 'line-through'}`. If a row is not
	 * selected, each css property will be set to an empty string ''*/
	selectedRowStyle?: any
	/** For testing purposes */
	inputName?: any
	/** optional. value is predefined input name. this allows test to work.
	 * when not available, for each table made, create a unique name to use
	 * as the <input name=?> if the same name is always used, multiple tables
	 * created in one page will conflict in row selection */
	dataTestId?: any
	/** Show download icon that allows to download the table content and allow; object allows customization options e.g. placement of the button, styling, tooltip etc */
	download?: {
		/** optionally, provide download file name, if missing a default one is used */
		fileName?: string
	}
}

/** incremented input ID will guarantee no collision from using getUniqueNameOrId()*/
let idIncr = 0
/** random suffix will minimize the chance of collission of other code that
happen to use the same prefix/beginning substring for element ID  */
const randomSuffix = Math.random()
/** generate unique input name or id string */
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
	header = {},
	maxWidth = '90vw',
	maxHeight = '40vh',
	selectedRows = [],
	selectAll = false,
	resize = false,
	selectedRowStyle = {},
	inputName = null,
	dataTestId = null,
	download = undefined
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
	const parentDiv = div.append('div').style('background-color', 'white').style('display', 'inline-block')
	if (download) {
		const downloadDiv = div
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('vertical-align', 'top')

		icons['download'](downloadDiv, {
			width: 15,
			height: 15,
			title: 'Download table',
			handler: () => {
				downloadTable(rows, columns, download.fileName || 'table.tsv')
			}
		})
	}
	if (resize) {
		if (rows.length > 15) parentDiv.style('height', maxHeight)
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
		const th = theadRow.append('th').text('Actions').attr('class', 'sjpp_table_item sjpp_table_header')
		if (header?.style) {
			for (const k in header.style) th.style(k, header.style[k])
		}
	}

	if (showHeader) {
		for (const [i, c] of columns.entries()) {
			const th = theadRow.append('th').text(c.label).attr('class', 'sjpp_table_item sjpp_table_header')
			if (c.width) th.style('width', c.width)
			if (c.tooltip) th.attr('title', c.tooltip)
			if (header?.allowSort) {
				//Only create sort button for columns with data
				//(i.e. not html columns)
				if (c.sortable) {
					const callback = (opt: string) => sortTableCallBack(i, rows, opt)
					const updateTable = (newRows: any) => {
						rows = newRows
						updateRows()
					}
					createSortButton(c, th, callback, updateTable)
				}
			}
			if (header?.style) {
				for (const k in header.style) th.style(k, header.style[k])
			}
			if (c.barplot) {
				// barplot column
				th.text('') // quick fix; th.text() has been assigned above in order that sort button can show. here clear the text to render axis svg instead
				prepareBarPlot(c.barplot, i, rows)
				drawBarplotAxis(c, th)
				continue
			}
		}
	}

	//Assign a persistent id that does not change on sort
	rows.forEach((row, i) => {
		row.push({ id: i })
	})

	const tbody = table.append('tbody')
	function updateRows() {
		tbody.selectAll('tr').remove()
		for (const [i, row] of rows.entries()) {
			if (i == rows.length - 1) continue //skip id entry
			let checkbox
			const tr = tbody.append('tr').attr('class', 'sjpp_row_wrapper').attr('tabindex', 0)
			if (striped && i % 2 == 1) tr.style('background-color', 'rgb(245,245,245)')

			// for Section 508 compliance: always create an aria-labelledby attribute on an input
			// NOTE: a title attribute, wrapping with a label element, or other solutions are possible,
			// but using aria-labelled by is less likely to conflict with existing elem attributes or layout
			const ariaLabelledBy = row.ariaLabelledBy || row[0]?.elemId || getUniqueNameOrId('td')
			// by default, assume that the first data cell should be used to label the input to its left,
			// and should create an element id on it as needed
			if (!row.ariaLabelledBy && row[0] && !row[0].elemId) row[0].elemId = ariaLabelledBy

			if (buttons || noButtonCallback) {
				const clickHandler = (e: any) => {
					// fix for clicking on <a> check/unchecking box to the left
					if (e.target.tagName == 'A') {
						e.stopPropagation()
						return
					}
					if (e.target !== checkbox.node()) {
						if (singleMode)
							//not a checkbox
							checkbox.node().checked = true
						else checkbox.node().checked = !checkbox.node().checked
						checkbox.dispatch('change')
					}
				}
				tr.on('click', clickHandler)
				tr.on('keydown', event => {
					// ignore this event if it bubbled up from a descendant element
					if (event.target.tagName != 'TR') return
					if (event.key == 'Enter') clickHandler(event)
				})
			}

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
					.attr('value', row[row.length - 1].id)
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

				if (i === selectedRows[0] && tr.node()) {
					// if there is at least one selected row, scroll to the  table row,
					// so that it's visible and obvious to the user which rows are pre-selected
					setTimeout(() => {
						tr.node()?.scrollIntoView({ behavior: 'smooth', block: 'center' })
					}, 500)
				}

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
				if (colIdx == row.length - 1) continue //skip id entry
				const td = tr
					.append('td')
					.attr('id', cell.elemId || null)
					.attr('class', 'sjpp_table_item')

				// attach <td> for external code to modify
				cell.__td = td

				const column = columns[colIdx]

				if (column.barplot) {
					if (typeof cell.value === 'number') {
						drawBarplotInCell(cell.value, td, column.barplot)
					}
					continue
				}

				// column is not barplot
				if (column.editCallback && cell.value) {
					td.on('click', (event: MouseEvent) => {
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
				} else if (cell.html) {
					td.html(cell.html)
				} else if ('value' in cell) {
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
	}

	updateRows()

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

/**
 * Downloads table data as a TSV (Tab-Separated Values) file.
 *
 * @param {Array<Array<Cell>>} rows - Array of rows, where each row is an array of cell objects.
 *        Each cell object can have one of the following properties:
 *        - value: The primary content to display (can be string, number, including 0)
 *        - url: A URL to be used if value is not present
 *        - color: A color value to be used if neither value nor url is present
 * @param {Array<Column>} cols - Array of column definition objects.
 *        Each column object must have:
 *        - label: string - The header text for the column
 * @param {string} [filename='table.tsv'] - Optional custom filename for the downloaded file
 *
 * @example
 * // Basic usage
 * const rows = [
 *   [{ value: "John" }, { value: 25 }, { value: "New York" }],
 *   [{ value: "Jane" }, { value: 0 }, { value: "Boston" }]
 * ];
 * const cols = [
 *   { label: "Name" },
 *   { label: "Age" },
 *   { label: "City" }
 * ];
 * await downloadTable(rows, cols, "users.tsv");
 *
 * @example
 * // Using different cell property types
 * const rows = [
 *   [{ value: "Doc" }, { url: "https://example.com" }, { color: "#FF0000" }]
 * ];
 * const cols = [
 *   { label: "Name" },
 *   { label: "Link" },
 *   { label: "Color" }
 * ];
 * await downloadTable(rows, cols);
 *
 * @returns {Promise<void>} - The function creates and triggers a download in the browser
 */
export async function downloadTable(rows, cols, filename = 'table.tsv') {
	let lines = ''

	// Add header row with column labels
	for (const column of cols) {
		lines += `${column.label}\t`
	}
	lines += '\n'

	// Add data rows
	for (const row of rows) {
		for (const cell of row) {
			let value = ''
			// Check for cell.value existence to properly handle zero values
			if ('value' in cell) value = cell.value
			else if (cell.url) value = cell.url
			else if (cell.color) value = cell.color
			lines += `${value}\t`
		}
		lines += '\n'
	}

	// Create and trigger download
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

function createSortButton(col: Column, th: Th, callback, updateTable) {
	const sortDiv = th.append('div').style('display', 'inline-block').attr('class', 'sjpp-table-sort-button')
	icons['updown'](sortDiv, {
		// title: `Sort table by ${col.label}`,
		handler: () => {
			const menu = new Menu({ padding: '' })
			menu.showunder(sortDiv.node())
			const options = ['ascending', 'descending']
			for (const opt of options) {
				menu.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.style('border-radius', '0px')
					.text(`Sort ${opt}`)
					.on('click', () => {
						const newRows = callback(opt)
						updateTable(newRows)
						menu.destroy()
					})
			}
		}
	})
}

function sortTableCallBack(i: number, rows: any, opt: string) {
	const newRows = rows.sort((a, b) => {
		if (!a[i].value || !b[i].value) return
		//numbers
		if (typeof a[i].value === 'number' && typeof b[i].value === 'number') {
			if (opt == 'descending') return b[i].value - a[i].value
			else return a[i].value - b[i].value
			//strings
		} else if (typeof a[i].value === 'string' && typeof b[i].value === 'string') {
			if (opt == 'descending') return b[i].value.localeCompare(a[i].value)
			else return a[i].value.localeCompare(b[i].value)
		}
	})
	return newRows
}

function prepareBarPlot(cb: Barplot, i: number, rows: any) {
	if (!cb.axisWidth) cb.axisWidth = 130
	if (!cb.colorPositive) cb.colorPositive = '#d49353'
	if (!cb.colorNegative) cb.colorNegative = '#5256d1'
	if (!cb.xpadding) cb.xpadding = 5
	let min: number | null = null,
		max: number | null = null
	for (const r of rows) {
		const v = r[i].value
		if (!Number.isFinite(v)) continue // ignore invalid value
		if (min == null) {
			min = v
			max = v
		} else {
			min = Math.min(min as number, v)
			max = Math.max(max as number, v)
		}
	}
	if (min !== null && max !== null && min < 0 && max > 0) {
		// force equal span on both sides
		const a = Math.max(-min, max)
		min = -a
		max = a
	}
	cb.scale = scaleLinear()
		.domain([min ?? 0, max ?? 0])
		.range([0, cb.axisWidth])
}

function drawBarplotAxis(c: Column, th: any) {
	const cb = c.barplot! // assert it is truthy
	const labfontsize = 14
	const ypad = 5 // padding between axis label and axis
	const tickfontsize = 12
	const ticksize = 4 // where is ticksize applied in axis?
	const svg = th
		.append('svg')
		.attr('width', 2 * (cb.xpadding || 0) + (cb.axisWidth || 0))
		.attr('height', labfontsize + ypad + tickfontsize + ticksize + 1) // plus 1 so axis bottom line can fully show
	const axis = axisTop(cb.scale).ticks(cb.tickCount || 4)
	if (cb.tickFormat) axis.tickFormat(d3format(cb.tickFormat) as (domainValue: AxisDomain, index: number) => string)

	axisstyle({
		axis: svg
			.append('g')
			.attr('transform', `translate(0,${labfontsize + ypad + tickfontsize + ticksize})`)
			.call(axis),
		color: 'black',
		showline: true
	})
	svg
		.append('text')
		.attr('fill', 'black')
		.attr('font-size', labfontsize)
		.attr('text-anchor', 'middle')
		.text(c.label)
		.attr('x', (cb.xpadding || 0) + (cb.axisWidth || 0) / 2)
		.attr('y', labfontsize)
}

function drawBarplotInCell(value: number, td: any, c: Barplot) {
	if (!Number.isFinite(value)) return
	const [min, max] = c.scale.domain()
	let x1, x2, color
	if (min >= 0) {
		// all positive values
		x1 = 0 // bar starts at left and extends to right
		x2 = c.scale(value)
		color = c.colorPositive
	} else if (max <= 0) {
		// all neg values
		x2 = c.axisWidth //bar starts at right and extends to left
		x1 = c.scale(value)
		color = c.colorNegative
	} else {
		const x0 = c.scale(0)
		const xv = c.scale(value)
		x1 = Math.min(x0, xv)
		x2 = Math.max(x0, xv)
		color = value > 0 ? c.colorPositive : c.colorNegative
	}
	const height = 14
	td.append('svg')
		.style('margin-top', '4px') // poor fix for the svg to appear in middle of <td> vertically
		.attr('width', 2 * (c.xpadding ?? 0) + (c.axisWidth ?? 0))
		.attr('height', height)
		.append('rect')
		.attr('x', x1)
		.attr('y', 0)
		.attr('width', Math.max(1, x2 - x1)) // avoid bar width of fraction of pixel
		.attr('height', height)
		.attr('fill', color)
}
