import { select } from 'd3-selection'
import { icons, axisstyle } from '#dom'
import { axisTop } from 'd3-axis'
import { format as d3format } from 'd3-format'
import { scaleLinear } from 'd3-scale'
import type { Th } from '../types/d3'
import type { AxisDomain } from 'd3-axis'
import type { TableArgs, TableBarplot, TableCell, TableColumn } from './types/table'

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
	download = undefined,
	hoverEffects
}: TableArgs) {
	validateInput()
	let _selectedRowStyle = selectedRowStyle

	/** make a shallow copy of the rows[] array to preserve the original index for the rows, not affected by sorting
	table may allow to sort rows by a column. in such case, table still needs to report original index of selected rows
	to a callback, so that the downstream code can correctly access data for the selected rows after sorting
	*/
	const rowsCopy = rows.map(i => i)

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
		// rows are clickable
		if (noRadioBtn) {
			// should be in singleMode and do not want to show radio buttons
		} else {
			// create column for radio button
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
				if (c.sortable) addSort(th, i)
			}
			if (header?.style) {
				for (const k in header.style) th.style(k, header.style[k])
			}
			if (c.barplot) {
				// barplot column
				th.text('') // quick fix; th.text() has been assigned above in order that sort button can show. here clear the text to render axis svg instead
				prepareBarPlot(c.barplot, i, rows)
				drawBarplotAxis(c, th)
				if (c.sortable) addSort(th, i) //Add the sort after the scale and title is created
				continue
			}
		}
	}

	const tbody = table.append('tbody')
	function updateRows() {
		tbody.selectAll('tr').remove()
		for (const [rowIdx, row] of rows.entries()) {
			let checkbox
			const tr = tbody.append('tr').attr('class', 'sjpp_row_wrapper').attr('tabindex', 0)
			if (striped && rowIdx % 2 == 1) tr.style('background-color', 'rgb(245,245,245)')

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
					if (e.target.tagName == 'A' || e.target.tagName == 'BUTTON') {
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
					.text(rowIdx + 1)
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
				const checkboxValue = rowsCopy.findIndex(r => row == r)
				checkbox = td
					.append('input')
					.attr('type', singleMode ? 'radio' : 'checkbox')
					.attr('name', uniqueInputName)
					.attr('value', checkboxValue)
					.attr('aria-labelledby', ariaLabelledBy)
					.property('checked', selectAll || selectedRows.includes(rowIdx))
					.on('change', () => {
						if (buttons) updateButtons()
						else noButtonCallback!(rowIdx, checkbox.node())

						const checked = checkbox.property('checked')
						for (const key in _selectedRowStyle) {
							tr.style(key, checked ? _selectedRowStyle[key] : '')
						}
					})
				//Do not scroll when all rows are selected. Problem appears when sorting.
				if (selectedRows.length != rows.length && rowIdx === selectedRows[0] && tr.node()) {
					// if there is at least one selected row (but not all rows are selected),
					// scroll to the  table row,so that it's visible and obvious to the user
					// which rows are pre-selected
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
						.on('click', event => button.callback(event, rowIdx))
					if (button.dataTestId) {
						button.button.attr('data-testid', button.dataTestId)
					}
					if (button.class) button.button.attr('class', button.class)
					if ('disabled' in button) button.button.node().disabled = button.disabled!(rowIdx)
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
								column.editCallback!(rowIdx, cell)
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
								if (column.editCallback) column.editCallback(rowIdx, cell)
							})
					}
				} else if (column.fillCell) {
					column.fillCell(td, rowIdx)
				}
			}
			//Table code may update when the caller code does not (e.g. sorting)
			//Added event listeners in caller code will be lost when the rows update.
			//Allows for hover effects to remain consistent when the rows are updated.
			if (hoverEffects) hoverEffects(tr, row)
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

	/** Returns the index from the original input array
	 * (captured in rowsCopy) not the current array index. */
	function getCheckedRowIndex() {
		const checkboxes = tbody.selectAll('input:checked')
		const idxlst: number[] = []
		if (!checkboxes.empty()) {
			checkboxes.each((d, i, nodes) => {
				const node = nodes[i]
				idxlst.push(Number.parseInt(node.value))
			})
		}
		return idxlst
	}

	function addSort(th: Th, i: number) {
		const callback = (isAscending: boolean) => sortTableCallBack(i, rows, isAscending)
		const updateTable = (newRows: TableCell[][]) => {
			const checked = getCheckedRowIndex()
			const idxMap = new Map(rowsCopy.map((val, idx) => [val, idx]))
			selectedRows = checked.map(i => newRows.findIndex((v: TableCell[]) => idxMap.get(v) === i))

			/** Must override caller setting once user selects row(s) */
			if (selectedRows.length) selectAll = false

			rows = newRows
			updateRows()
		}
		createSortButton(th, callback, updateTable)
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
 * @param {Array<TableColumn>} cols - Array of column definition objects.
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

/** Toggles between ascending and descending sort */
function createSortButton(th: Th, callback, updateTable) {
	let isAscending = false
	const sortDiv = th.append('div').style('display', 'inline-block').attr('class', 'sjpp-table-sort-button')
	icons['updown'](sortDiv, {
		handler: () => {
			isAscending = !isAscending
			const newRows = callback(isAscending)
			updateTable(newRows)
		}
	})
}

/** Detects the type of values in a column and sorts accordingly */
function sortTableCallBack(i: number, rows: any, isAscending: boolean) {
	/** Some values always returned as strings may be numeric values
	 * (e.g. file names used as either alphanumeric or numeric ids).
	 * In the latter case, sorting fails.
	 * Detect such columns and sort the value as numbers */
	let allNumStrs = true
	for (let r = 0; r < rows.length; r++) {
		const v = rows[r][i].value
		if (typeof v !== 'string' || !Number.isFinite(+v)) {
			allNumStrs = false
			break
		}
	}
	const newRows = rows.sort((a: TableCell, b: TableCell) => {
		const aVal = a[i].value
		const bVal = b[i].value

		if ((aVal == null && aVal !== 0) || (bVal == null && bVal !== 0)) return 0
		// numbers
		if (typeof aVal === 'number' && typeof bVal === 'number') {
			return isAscending ? aVal - bVal : bVal - aVal
		}
		// numeric strings, detected above
		if (allNumStrs) {
			const aNum = +aVal
			const bNum = +bVal
			return isAscending ? aNum - bNum : bNum - aNum
		}
		// regular strings
		if (typeof aVal === 'string' && typeof bVal === 'string') {
			return isAscending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
		}
		return 0
	})
	return newRows
}

function prepareBarPlot(cb: TableBarplot, i: number, rows: any) {
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

function drawBarplotAxis(c: TableColumn, th: any) {
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

function drawBarplotInCell(value: number, td: any, c: TableBarplot) {
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
		.attr('data-testid', 'sjpp-table-barplot-item')
		.attr('x', x1)
		.attr('y', 0)
		.attr('width', Math.max(1, x2 - x1)) // avoid bar width of fraction of pixel
		.attr('height', height)
		.attr('fill', color)
}
