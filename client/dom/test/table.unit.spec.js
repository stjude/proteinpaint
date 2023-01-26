import tape from 'tape'
import { renderTable } from '#dom/table'
import * as d3s from 'd3-selection'

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

tape('Render table', function(test) {
	test.timeoutAfter(3000)
	const holder = getHolder()

	renderTable({ columns: testColData, rows: testRowData, div: holder })

	testHeaderData(test)
	testRows(test)

	function testHeaderData(test) {
		const tableHeaders = holder.selectAll('th').nodes()
		let headers2Check = []
		for (const header of tableHeaders) {
			headers2Check.push(header.innerHTML)
		}
		let foundHeaders = 0
		let headersNotFound = []
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
			let badHighlightRowNum = []
			if (i % 2 == 1) {
				if (renderedRow.style.backgroundColor != 'rgb(245,245,245)') badHighlightRowNum++
				break
			}
			// badHighlightRowNum = [1]
			if (badHighlightRowNum.length)
				test.fail(`Table row highlighting misaligned starting at line = ${badHighlightRowNum}`)
			else test.pass(`Table highlighted correctly`)
		}

		// Catch cell data rendering issues
		let badLineNum = []
		for (const [i, row] of testRowData.entries()) {
			//Match rendered row data to supplied test data
			const testData = row.map(d => {
				if (d.url) return `${d.url}:${d.value}`
				else if (d.value) return d.value
				else if (d.html) return d.html
				else if (d.values) {
					let arrTestData2Str = []
					for (const obj of d.values) {
						if (obj.url) arrTestData2Str.push(`${obj.url}:${obj.value}`)
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
			// test.equal(renderedData.toString(), testData.toString(), `Rendered table data should match test row data.`)
		}
		if (badLineNum.length) test.fail(`Table data misaligned starting at line = ${badLineNum}`)
		else test.pass(`Rendered data matched test row data`)
	}

	if (test._ok) holder.remove()
	test.end()
})

// tape.only(' ', async test => {
//     test.timeoutAfter(3000)
//     const holder = getHolder()

//     renderTable({ columns: testColData, rows: testRowData })

//     // if(test._ok) holder.remove()
//     test.end()
// })
