import tape from 'tape'
import { renderTable } from '../table'
import * as d3s from 'd3-selection'

/*
 Tests: 
	Render table
	Missing columns array
	Missing rows array
	Missing div
	Missing and excess row data
	Return correct rows on button click
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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test data
***************/

const testColData = [{ label: 'URL/Value' }, { label: 'Value' }, { label: 'HTML' }, { label: 'Values array' }]

const testRowData = [
	[
		{ url: 'https://proteinpaint.stjude.org/', value: 'A' },
		{ value: 'B' },
		{ html: '<p>AB</p>' },
		{
			values: [
				{ url: 'https://proteinpaint.stjude.org/', value: 'A' },
				{ url: 'https://proteinpaint.stjude.org/', value: 'B' },
				{ value: 'AB' },
				{ html: '<p>BA</p>' }
			]
		}
	],
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

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/table -***-')
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
				else if (d.values) {
					const arrTestData2Str = []
					for (const obj of d.values) {
						if (obj.url) arrTestData2Str.push(`${obj.url}:${obj.value || obj.value == 0 ? obj.value : obj.url}`)
						else if (obj.value) arrTestData2Str.push(obj.value)
						else arrTestData2Str.push(obj.html)
					}
					return arrTestData2Str.toString()
				}
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
					if (wrongSelect.length > 0) test.fail(`Should not returned row(s) = ${wrongSelect}`)
					test.equal(correctSelect, checkedBoxes.length, `Should only return selected checked rows = ${correctSelect}`)
				}
			}
		]
	})

	const selectAllBtn = holder.select('input#checkboxHeader').node()
	selectAllBtn.click() //Select all
	const testBtn = holder.select('button.test-btn').node()
	testBtn.click()

	selectAllBtn.click() //Unselect all
	holder.select(`input[name="${inputName}"]`).node().click() //First checkbox
	testBtn.click()

	if (test._ok) holder.remove()
	test.end()
})
