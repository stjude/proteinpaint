import tape from 'tape'
import { renderTable, sortTableCallBack } from '../table'
import * as d3s from 'd3-selection'

/*
Tests: 
	Render table
	Missing columns array
	Missing rows array
	Missing div
	Missing and excess row data
	Return correct rows on button click
	Sort buttons
	sortTableCallBack correctly detect and sort numeric string values
	sortTableCallBack correctly detect and sort numeric values
	sortTableCallBack correctly detect and sort string values
	fillCell
	allowRestoreRowOrder: validate it requires sortable column
	allowRestoreRowOrder: table renders without error when columns are sortable
	allowRestoreRowOrder: restore button shows after sorting
	allowRestoreRowOrder: restore button restores original order and hides
*/

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

/**************
 test data
***************/

const testColData = [{ label: 'URL/Value' }, { label: 'Value' }, { label: 'HTML' }, { label: 'Values array' }]

const testRowData = [
	[{ url: 'https://proteinpaint.stjude.org/', value: 'A' }, { value: 'B' }, { html: '<p>AB</p>' }, { value: 'C' }],
	[
		{ url: 'https://proteinpaint.stjude.org/', value: 'C' },
		{ value: 'D' },
		{ html: '<p>CD</p>' },
		{
			values: [
				{ url: 'https://proteinpaint.stjude.org/', value: 'C' },
				{ url: 'https://proteinpaint.stjude.org/', value: 'D' },
				{ value: 'CD' },
				{ html: '<p>DC</p>' }
			]
		}
	]
]

const testOpts = {
	columns: [
		{ label: 'String', sortable: true },
		{ label: 'Number', sortable: true },
		{ label: 'Date', sortable: true }
	],
	rows: [
		[{ value: 'C' }, { value: 200 }, { value: '2021-01-01' }],
		[{ value: 'A' }, { value: 300 }, { value: '2021-01-02' }],
		[{ value: 'B' }, { value: 100 }, { value: '2021-01-03' }]
	],
	header: {
		allowSort: true
	}
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/table -***-')
	test.end()
})

tape('Render table', function (test) {
	test.timeoutAfter(100)
	const holder = getHolder()

	renderTable({ columns: testColData, rows: testRowData, div: holder })

	testHeaderData(test)
	testRows(test)

	function testHeaderData(test) {
		const tableHeaders = holder.selectAll('th').nodes()
		const headers2Check = []
		for (const header of tableHeaders) {
			headers2Check.push(header.innerHTML)
		}
		let foundHeaders = 0
		const headersNotFound = []
		for (const testHeader of testColData) {
			if (headers2Check.some(d => d === testHeader.label)) ++foundHeaders
			else headersNotFound.push(testHeader.label)
		}
		if (headersNotFound.length) {
			test.fail(`Missing headers: ${headersNotFound}`)
		} else {
			test.equal(headers2Check.length, foundHeaders, `Should display ${testColData.length} headers`)
		}
	}

	function testRows(test) {
		const renderedRows = holder.selectAll('tr.sjpp_row_wrapper').nodes()

		const renderedRowsMap = new Map()
		for (const [i, renderedRow] of renderedRows.entries()) {
			//Map rendered cell data to later compare against test row data
			const renderedCells = renderedRow.childNodes
			renderedRowsMap.set(renderedCells[0].innerHTML, [])
			for (const [i, cell] of renderedCells.entries()) {
				if (i == 0) continue //skip index cell
				if (cell?.firstChild?.tagName != undefined) {
					for (const child of cell.childNodes) {
						//push all .url and .values:[{url:...}] links
						if (child.tagName == 'A')
							renderedRowsMap.get(renderedCells[0].innerHTML).push(`${child.href}:${child.innerHTML}`)
						else if (child.tagName != 'A' && cell.childNodes.length == 1) {
							//push .html cell data
							renderedRowsMap.get(renderedCells[0].innerHTML).push(child.outerHTML)
						}
						//push remaining .values:[{value:...}, {html:...}] cell data
						else renderedRowsMap.get(renderedCells[0].innerHTML).push(child.innerHTML)
					}
					//push .value cell data
				} else renderedRowsMap.get(renderedCells[0].innerHTML).push(cell.innerHTML)
			}

			// Catch row highlight rendering issues
			let badBackgrdColorRowNum = 0
			if (i % 2 == 1) {
				if (renderedRow.style.backgroundColor != 'rgb(245,245,245)') badBackgrdColorRowNum++
				break
			}
			if (badBackgrdColorRowNum.length)
				test.fail(`Table row background color misaligned starting at line = ${badBackgrdColorRowNum}`)
			else test.pass(`Table rows display correct background colors`)
		}

		// Catch cell data rendering issues
		const badLineNum = []
		for (const [i, row] of testRowData.entries()) {
			//Match rendered row data to supplied test data
			const testData = row.map(d => {
				if (d.url) return `${d.url}:${d.value || d.value == 0 ? d.value : d.url}`
				else if (d.value) return d.value
				else if (d.html) return d.html
			})
			const renderedData = renderedRowsMap.get((i + 1).toString())
			if (renderedData.toString() !== testData.toString()) {
				badLineNum.push(i + 1)
				break
			}
		}
		if (badLineNum.length) test.fail(`Table data misaligned starting at line = ${badLineNum}`)
		else test.pass(`Rendered data matched test row data`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Missing columns array', async test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = `Should throw for missing columns array`

	try {
		async function testTable() {
			return renderTable({ rows: testRowData, div: holder })
		}
		await testTable()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Missing rows array', async test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = `Should throw for missing rows array`

	try {
		async function testTable() {
			return renderTable({ columns: testColData, div: holder })
		}
		await testTable()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Missing div', async test => {
	test.timeoutAfter(100)
	const message = `Should throw for missing div argument`

	try {
		async function testTable() {
			return renderTable({ columns: testColData, rows: testRowData })
		}
		await testTable()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

tape('Missing and excess row data', async test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = `Should throw for missing and additional row data`

	try {
		async function testTable() {
			const rows2 = structuredClone(testRowData)
			rows2[0].pop()
			rows2[1].push({ value: 1 })
			return renderTable({ columns: testColData, rows: rows2, div: holder })
		}
		await testTable()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Return correct rows on button click', async test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const inputName = 'select' // predefine input name. otherwise random names are used and prevent the test to work

	renderTable({
		columns: testColData,
		rows: testRowData,
		div: holder,
		inputName,
		buttons: [
			{
				text: 'Test Button',
				class: 'test-btn',
				callback: indexes => {
					const checkboxes = holder.selectAll(`input[name="${inputName}"]`).nodes()
					const checkedBoxes = []
					for (const [i, checkbox] of checkboxes.entries()) {
						if (checkbox.checked == true) checkedBoxes.push(i)
					}
					let correctSelect = 0
					const wrongSelect = []
					for (const i of indexes) {
						// Check if the index array sent to button callback
						// matches user selected rows
						if (checkedBoxes.some(d => d == i)) ++correctSelect
						else wrongSelect.push(i)
					}
					if (wrongSelect.length) test.fail(`Should not returned row(s) = ${wrongSelect}`)
					test.equal(correctSelect, checkedBoxes.length, `Should only return selected checked rows = ${correctSelect}`)
				}
			}
		]
	})

	const selectAllBtn = holder.select('input[data-testid=sjpp-table-checkall]').node()
	selectAllBtn.click() //Select all
	const testBtn = holder.select('button.test-btn').node()
	testBtn.click()

	selectAllBtn.click() //Unselect all
	holder.select(`input[name="${inputName}"]`).node().click() //First checkbox
	testBtn.click()

	if (test._ok) holder.remove()
	test.end()
})

tape('Bar plot rendering', async test => {
	test.timeoutAfter(100)

	const holder = getHolder()
	const testCopy = structuredClone(testOpts)
	testCopy.div = holder
	testCopy.columns.push({ label: 'Bar plot', barplot: { colorNegative: 'red', colorPositive: 'green' } })
	testCopy.rows[0].push({ value: -5 })
	testCopy.rows[1].push({ value: 5 })
	testCopy.rows[2].push({ value: 1 })
	renderTable(testCopy)

	const foundBarplots = holder.selectAll('rect[data-testid="sjpp-table-barplot-item"]').nodes()
	test.equal(foundBarplots.length, testCopy.rows.length, 'Should display bar plots')

	if (test._ok) holder.remove()
	test.end()
})

tape('Sort buttons', async test => {
	test.timeoutAfter(100)

	const holder = getHolder()
	const testCopy = structuredClone(testOpts)
	testCopy.div = holder
	testCopy.columns.push({
		label: 'Bar plot',
		barplot: { colorNegative: 'red', colorPositive: 'green' },
		sortable: true
	})
	testCopy.rows[0].push({ value: -5 })
	testCopy.rows[1].push({ value: 5 })
	testCopy.rows[2].push({ value: 1 })
	renderTable(testCopy)

	test.equal(
		holder.selectAll('.sjpp-table-sort-button').nodes().length,
		testCopy.columns.length,
		'Should display sort buttons'
	)

	if (test._ok) holder.remove()
	test.end()
})

tape('sortTableCallBack correctly detect and sort numeric string values', async test => {
	test.timeoutAfter(100)

	const mockRows = [[{ value: '1000' }], [{ value: '1050' }], [{ value: '50' }], [{ value: '500' }], [{ value: '5' }]]
	const isAscenting = true
	const result = sortTableCallBack(0, mockRows, isAscenting)
	const expected = [[{ value: '5' }], [{ value: '50' }], [{ value: '500' }], [{ value: '1000' }], [{ value: '1050' }]]
	test.deepEqual(result, expected, 'Should sort numeric string values correctly')

	test.end()
})

tape('sortTableCallBack correctly detect and sort numeric values', async test => {
	test.timeoutAfter(100)

	const mockRows = [[{ value: 1000 }], [{ value: 1050 }], [{ value: 50 }], [{ value: 500 }], [{ value: 5 }]]
	const isAscenting = true
	const result = sortTableCallBack(0, mockRows, isAscenting)
	const expected = [[{ value: 5 }], [{ value: 50 }], [{ value: 500 }], [{ value: 1000 }], [{ value: 1050 }]]
	test.deepEqual(result, expected, 'Should sort numeric values correctly')

	test.end()
})

tape('sortTableCallBack correctly detect and sort string values', async test => {
	test.timeoutAfter(100)

	const isAscenting = true
	const result = sortTableCallBack(0, testOpts.rows, isAscenting)
	const expected = [
		[{ value: 'A' }, { value: 300 }, { value: '2021-01-02' }],
		[{ value: 'B' }, { value: 100 }, { value: '2021-01-03' }],
		[{ value: 'C' }, { value: 200 }, { value: '2021-01-01' }]
	]
	test.deepEqual(result, expected, 'Should sort string values correctly')

	test.end()
})

tape('fillCell', async test => {
	const holder = getHolder()
	const opts = JSON.parse(JSON.stringify(testOpts))
	opts.div = holder
	// apply fillCell() for 2nd column
	opts.columns[1].fillCell = (td, i) => {
		td.text('fillCell called at ' + i)
	}
	for (const r of opts.rows) delete r[1].value // must delete cell.value otherwise fillCell won't be called

	renderTable(opts)
	for (const [i, row] of opts.rows.entries()) {
		const text = 'fillCell called at ' + i
		test.equal(row[1].__td.node().innerHTML, text, text)
	}

	if (test._ok) holder.remove()
	test.end()
})

/**************
 allowRestoreRowOrder tests
***************/

tape('\n', test => {
	test.comment('-***- dom/table - allowRestoreRowOrder -***-')
	test.end()
})

tape('allowRestoreRowOrder: validate it requires sortable column', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const columns = [{ label: 'Name' }, { label: 'Age' }, { label: 'Role' }]

	const rows = [
		[{ value: 'Alice' }, { value: 30 }, { value: 'Engineer' }],
		[{ value: 'Bob' }, { value: 25 }, { value: 'Designer' }]
	]

	const message = 'Should throw when allowRestoreRowOrder=true but no columns have sortable:true'
	try {
		renderTable({
			div: holder,
			columns,
			rows,
			allowRestoreRowOrder: true
		})
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e.message || e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('allowRestoreRowOrder: table renders without error when columns are sortable', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const columns = [
		{ label: 'Name', sortable: true },
		{ label: 'Age', sortable: true },
		{ label: 'Role', sortable: false }
	]

	const rows = [
		[{ value: 'Alice' }, { value: 30 }, { value: 'Engineer' }],
		[{ value: 'Bob' }, { value: 25 }, { value: 'Designer' }],
		[{ value: 'Charlie' }, { value: 35 }, { value: 'Manager' }]
	]

	try {
		renderTable({
			div: holder,
			columns,
			rows,
			header: { allowSort: true },
			allowRestoreRowOrder: true
		})
		test.pass('Should render table successfully when allowRestoreRowOrder=true and at least one column is sortable')

		// Check that restore button exists but is hidden initially
		const restoreButton = holder.select('[data-testid="sjpp-table-restore-button"]')

		const buttonDiv = d3s.select(restoreButton.node().parentNode)
		test.equal(buttonDiv.style('display'), 'none', 'Restore button should be hidden initially')
	} catch (e) {
		test.fail(`Should not throw error: ${e.message || e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('allowRestoreRowOrder: restore button shows after sorting', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const columns = [
		{ label: 'Name', sortable: true },
		{ label: 'Age', sortable: true }
	]

	const rows = [
		[{ value: 'Charlie' }, { value: 35 }],
		[{ value: 'Alice' }, { value: 30 }],
		[{ value: 'Bob' }, { value: 25 }]
	]

	renderTable({
		div: holder,
		columns,
		rows,
		header: { allowSort: true },
		allowRestoreRowOrder: true
	})

	// Get the restore button
	const restoreButton = holder.select('[data-testid="sjpp-table-restore-button"]')

	// Get the sort button for the Name column
	const sortButtons = holder.selectAll('.sjpp-table-sort-button')
	test.true(sortButtons.size() >= 1, 'Should have at least one sort button')

	// Click the sort button
	const firstSortButton = sortButtons.node()
	if (firstSortButton) {
		// Use native dispatchEvent with bubbles:true so the click reaches the handler
		// regardless of which child element (svg, path, etc.) the icons function attached it to
		firstSortButton.dispatchEvent(new Event('click', { bubbles: true }))

		// Check if restore button is now visible (check the parent div's display)
		const buttonParent = d3s.select(restoreButton.node().parentNode)
		test.equal(buttonParent.style('display'), 'block', 'Restore button should be visible after sorting')
	} else {
		test.fail('Sort button not found')
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('allowRestoreRowOrder: restore button restores original order and hides', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const columns = [
		{ label: 'Name', sortable: true },
		{ label: 'Age', sortable: true }
	]

	const rows = [
		[{ value: 'Charlie' }, { value: 35 }],
		[{ value: 'Alice' }, { value: 30 }],
		[{ value: 'Bob' }, { value: 25 }]
	]

	renderTable({
		div: holder,
		columns,
		rows,
		header: { allowSort: true },
		allowRestoreRowOrder: true,
		showLines: true
	})

	// Get table rows to check order
	const getTableRowValues = () => {
		return holder
			.selectAll('tbody tr')
			.nodes()
			.map(tr => {
				// Get all td elements, skip the first one (line number), then get the first data cell (Name)
				const tds = d3s.select(tr).selectAll('td').nodes()
				return d3s.select(tds[1]).text() // Index 1 is Name (after line number at index 0)
			})
	}

	const originalOrder = getTableRowValues()
	test.deepEqual(originalOrder, ['Charlie', 'Alice', 'Bob'], 'Initial order should match input')

	// Click sort button to sort
	const sortButtons = holder.selectAll('.sjpp-table-sort-button')
	if (sortButtons.size() > 0) {
		const firstSortButton = sortButtons.node()
		// Use native dispatchEvent with bubbles:true so the click reaches the handler
		firstSortButton.dispatchEvent(new Event('click', { bubbles: true }))

		// Verify order changed after sorting
		const sortedOrder = getTableRowValues()
		test.notDeepEqual(sortedOrder, originalOrder, 'Order should change after sorting')

		// Click restore button
		const restoreButton = holder.select('[data-testid="sjpp-table-restore-button"]')

		if (!restoreButton.empty()) {
			restoreButton.dispatch('click')

			// Check that order is restored
			const restoredOrder = getTableRowValues()
			test.deepEqual(restoredOrder, originalOrder, 'Order should be restored to original')

			// Check that restore button is hidden again (check the parent div)
			const buttonParent = d3s.select(restoreButton.node().parentNode)
			test.equal(buttonParent.style('display'), 'none', 'Restore button should be hidden after restoring')
		} else {
			test.fail('Restore button not found')
		}
	} else {
		test.fail('Sort button not found')
	}

	if (test._ok) holder.remove()
	test.end()
})
