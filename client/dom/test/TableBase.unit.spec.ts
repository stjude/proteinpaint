import tape from 'tape'
import * as d3s from 'd3-selection'
import { TableBase } from '../TableBase'
import type { TableBaseColumn, TableBaseRow } from '../TableBase'

/*
Tests:
	Render table structure
	Renders header labels
	Renders row and cell content: value, url, html, color
	showLines renders a line-number column
	striped alternates row background color
	Column width/align/nowrap styling
	dataTestId applied to <table>
	Missing columns array
	Missing rows array
	Missing div
	Mismatched row length
	update() replaces rows and redraws body only
	update() validates replacement rows
	render() is idempotent (no duplicate tables on repeat calls)
	remove() detaches the table from the DOM
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

const testColumns: TableBaseColumn[] = [{ label: 'Name' }, { label: 'Link' }, { label: 'Html' }]

const testRows: TableBaseRow[] = [
	[{ value: 'Alice' }, { url: 'https://proteinpaint.stjude.org/', value: 'PP' }, { html: '<b>bold</b>' }],
	[{ value: 'Bob' }, { url: 'https://proteinpaint.stjude.org/' }, { html: '<i>italic</i>' }]
]

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase -***-')
	test.end()
})

tape('Render table structure', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const table = new TableBase({ columns: testColumns, rows: testRows, div: holder })
	table.render()

	test.equal(holder.selectAll('table').size(), 1, 'Should render exactly one <table>')
	test.equal(holder.selectAll('thead').size(), 1, 'Should render a <thead>')
	test.equal(holder.selectAll('tbody').size(), 1, 'Should render a <tbody>')
	test.equal(holder.selectAll('tbody tr').size(), testRows.length, 'Should render one <tr> per row')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('Renders header labels', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	new TableBase({ columns: testColumns, rows: testRows, div: holder }).render()

	const headers = holder.selectAll('thead th').nodes() as HTMLElement[]
	test.deepEqual(
		headers.map(h => h.textContent),
		testColumns.map(c => c.label),
		'Should render one <th> per column, in order, with the column label'
	)

	// //if ((test as any)._ok) holder.remove()
	test.end()
})

tape('Renders row and cell content: value, url, html, color', test => {
	test.timeoutAfter(100)

	const valueHolder = getHolder()
	const rows: TableBaseRow[] = [[{ value: 'plain' }, { color: 'red' }, { value: 0 }]]
	new TableBase({ columns: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], rows, div: valueHolder }).render()
	const cells = valueHolder.selectAll('tbody td').nodes() as HTMLElement[]
	test.equal(cells[0].textContent, 'plain', 'Should render cell.value as text')
	test.equal((cells[1] as HTMLElement).style.backgroundColor, 'red', 'Should render cell.color as background when no value')
	test.equal(cells[2].textContent, '0', 'Should render a numeric 0 value, not treat it as empty')
	valueHolder.remove()

	const urlHolder = getHolder()
	new TableBase({
		columns: [{ label: 'Link' }],
		rows: [[{ url: 'https://example.com', value: 'Example' }]],
		div: urlHolder
	}).render()
	const link = urlHolder.select('tbody a').node() as HTMLAnchorElement
	test.equal(link.getAttribute('href'), 'https://example.com', 'Should render cell.url as <a href>')
	test.equal(link.textContent, 'Example', 'Should prefer cell.value as the link text when present')
	test.equal(link.getAttribute('rel'), 'noopener noreferrer', 'Should set rel=noopener noreferrer on links')
	urlHolder.remove()

	const urlOnlyHolder = getHolder()
	new TableBase({
		columns: [{ label: 'Link' }],
		rows: [[{ url: 'https://example.com' }]],
		div: urlOnlyHolder
	}).render()
	const linkOnly = urlOnlyHolder.select('tbody a').node() as HTMLAnchorElement
	test.equal(linkOnly.textContent, 'https://example.com', 'Should fall back to the url as link text when value is missing')
	urlOnlyHolder.remove()

	const htmlHolder = getHolder()
	new TableBase({
		columns: [{ label: 'Html' }],
		rows: [[{ html: '<b>bold</b>' }]],
		div: htmlHolder
	}).render()
	test.equal(
		(htmlHolder.select('tbody td').node() as HTMLTableCellElement).innerHTML,
		'<b>bold</b>',
		'Should render cell.html verbatim'
	)
	htmlHolder.remove()

	test.end()
})

tape('showLines renders a line-number column', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	new TableBase({ columns: testColumns, rows: testRows, div: holder, showLines: true }).render()

	const firstDataRowCells = holder.selectAll('tbody tr').nodes()[0] as HTMLTableRowElement
	test.equal(firstDataRowCells.cells.length, testColumns.length + 1, 'Should add one extra <td> for the line number')
	test.equal(firstDataRowCells.cells[0].textContent, '1', 'Should number the first row as 1')

	const headerRow = holder.select('thead tr').node() as HTMLTableRowElement
	test.equal(headerRow.cells.length, testColumns.length + 1, 'Should add a matching blank <th> in the header')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('striped alternates row background color', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	new TableBase({ columns: [{ label: 'A' }], rows: [[{ value: '1' }], [{ value: '2' }], [{ value: '3' }]], div: holder }).render()

	const trs = holder.selectAll('tbody tr').nodes() as HTMLElement[]
	test.equal(trs[0].style.backgroundColor, '', 'First row should not be highlighted')
	test.equal(trs[1].style.backgroundColor, 'rgb(245, 245, 245)', 'Second row should be highlighted')
	test.equal(trs[2].style.backgroundColor, '', 'Third row should not be highlighted')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('striped: false disables row highlighting', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	new TableBase({
		columns: [{ label: 'A' }],
		rows: [[{ value: '1' }], [{ value: '2' }]],
		div: holder,
		striped: false
	}).render()

	const trs = holder.selectAll('tbody tr').nodes() as HTMLElement[]
	test.ok(trs.every(tr => tr.style.backgroundColor === ''), 'No row should be highlighted when striped=false')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('Column width/align/nowrap styling', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	new TableBase({
		columns: [{ label: 'A', width: '10vw', align: 'right', nowrap: true }],
		rows: [[{ value: 'x' }]],
		div: holder
	}).render()

	const th = holder.select('thead th').node() as HTMLElement
	const td = holder.select('tbody td').node() as HTMLElement
	test.equal(th.style.width, '10vw', 'Should apply column width to the header cell')
	test.equal(td.style.width, '10vw', 'Should apply column width to the data cell')
	test.equal(td.style.textAlign, 'right', 'Should apply column align to the data cell')
	test.equal(td.style.whiteSpace, 'nowrap', 'Should apply column nowrap to the data cell')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('dataTestId applied to <table>', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	new TableBase({ columns: testColumns, rows: testRows, div: holder, dataTestId: 'my-table' }).render()

	test.equal(holder.select('table').attr('data-testid'), 'my-table', 'Should set data-testid on the <table>')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('Missing columns array', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = 'Should throw for missing columns array'

	try {
		new TableBase({ rows: testRows, div: holder } as any)
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	holder.remove()
	test.end()
})

tape('Missing rows array', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = 'Should throw for missing rows array'

	try {
		new TableBase({ columns: testColumns, div: holder } as any)
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	holder.remove()
	test.end()
})

tape('Missing div', test => {
	test.timeoutAfter(100)
	const message = 'Should throw for missing div argument'

	try {
		new TableBase({ columns: testColumns, rows: testRows } as any)
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	test.end()
})

tape('Mismatched row length', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = 'Should throw when a row length does not match columns length'

	try {
		new TableBase({ columns: testColumns, rows: [[{ value: 'only one cell' }]], div: holder } as any)
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	holder.remove()
	test.end()
})

tape('update() replaces rows and redraws body only', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const table = new TableBase({ columns: [{ label: 'A' }], rows: [[{ value: 'one' }]], div: holder })
	table.render()

	const theadBefore = holder.select('thead').node()
	table.update([[{ value: 'two' }], [{ value: 'three' }]])

	test.equal(holder.select('thead').node(), theadBefore, 'Should not recreate the <thead> element')
	test.equal(holder.selectAll('tbody tr').size(), 2, 'Should render the new number of rows')
	test.deepEqual(
		(holder.selectAll('tbody td').nodes() as HTMLElement[]).map(td => td.textContent),
		['two', 'three'],
		'Should render the replacement row values'
	)
	test.deepEqual(
		table.getRows().map(row => row.map(cell => cell.value)),
		[['two'], ['three']],
		'getRows() should reflect the update'
	)

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('update() validates replacement rows', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = 'Should throw when update() rows do not match column count'

	const table = new TableBase({ columns: testColumns, rows: testRows, div: holder })
	table.render()

	try {
		table.update([[{ value: 'too short' }]])
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('render() is idempotent (no duplicate tables on repeat calls)', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const table = new TableBase({ columns: testColumns, rows: testRows, div: holder })
	table.render()
	table.render()
	table.render()

	test.equal(holder.selectAll('table').size(), 1, 'Repeated render() calls should not accumulate extra <table> elements')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('remove() detaches the table from the DOM', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	const table = new TableBase({ columns: testColumns, rows: testRows, div: holder })
	table.render()
	test.equal(holder.selectAll('table').size(), 1, 'Table should be present after render()')

	table.remove()
	test.equal(holder.selectAll('table').size(), 0, 'Table should be gone after remove()')

	holder.remove()
	test.end()
})
