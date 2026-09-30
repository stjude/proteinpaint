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

	new TableBase({ columns: testColumns, rows: testRows, div: holder, styles: { showLines: true } }).render()

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
		styles: { striped: false }
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

/**************
 sort and filter tests
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - sort and filter -***-')
	test.end()
})

const sortFilterColumns: TableBaseColumn[] = [
	{ label: 'Name', sortable: true, filterable: true },
	{ label: 'Age', sortable: true },
	{ label: 'Role', filterable: true }
]

function makeSortFilterRows(): TableBaseRow[] {
	return [
		[{ value: 'Charlie' }, { value: 35 }, { value: 'Manager' }],
		[{ value: 'Alice' }, { value: 30 }, { value: 'Engineer' }],
		[{ value: 'Bob' }, { value: 25 }, { value: 'Engineer' }]
	]
}

function bodyColumn(holder: any, colIdx: number): string[] {
	return (holder.selectAll('tbody tr').nodes() as HTMLTableRowElement[]).map(tr => tr.cells[colIdx].textContent || '')
}

function clickHeaderLabel(holder: any, colIdx: number) {
	const th = holder.selectAll('thead th').nodes()[colIdx] as HTMLElement
	const label = th.querySelector('.sjpp-table-header-label') as HTMLElement
	label.dispatchEvent(new Event('click', { bubbles: true }))
}

function typeFilter(holder: any, colIdx: number, text: string) {
	const input = holder.select(`input[data-testid="sjpp-table-filter-${colIdx}"]`).node() as HTMLInputElement
	input.value = text
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

tape('sort: only sortable columns get a clickable label and indicator', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	test.equal(holder.selectAll('.sjpp-table-sort-indicator').size(), 2, 'Should render an indicator per sortable column')
	const roleTh = holder.selectAll('thead th').nodes()[2] as HTMLElement
	const roleLabel = roleTh.querySelector('.sjpp-table-header-label') as HTMLElement
	test.equal(roleLabel.style.cursor, '', 'Should not style a non-sortable label as clickable')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: clicking a header sorts ascending, then toggles descending, with a matching indicator', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const indicators = () => (holder.selectAll('.sjpp-table-sort-indicator').nodes() as HTMLElement[]).map(n => n.textContent)

	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Alice', 'Bob'], 'Should start in the input order')
	test.deepEqual(indicators(), ['', ''], 'Should show no indicator before any sort')

	clickHeaderLabel(holder, 0)
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Bob', 'Charlie'], 'First click should sort ascending')
	test.deepEqual(indicators(), ['▲', ''], 'Should show ▲ on the sorted column')

	clickHeaderLabel(holder, 0)
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Bob', 'Alice'], 'Second click should sort descending')
	test.deepEqual(indicators(), ['▼', ''], 'Should show ▼ on the sorted column')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: clicking the arrow indicator also toggles the sort', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	clickHeaderLabel(holder, 0) // ascending, arrow now visible
	const arrow = holder.select('.sjpp-table-sort-indicator').node() as HTMLElement
	arrow.dispatchEvent(new Event('click', { bubbles: true }))
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Bob', 'Alice'], 'Clicking the arrow should sort descending')
	test.equal(arrow.textContent, '▼', 'Should show ▼ after clicking the arrow')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: sorting a different column resets the previous indicator and starts ascending', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const indicators = () => (holder.selectAll('.sjpp-table-sort-indicator').nodes() as HTMLElement[]).map(n => n.textContent)

	clickHeaderLabel(holder, 0)
	clickHeaderLabel(holder, 0) // name descending
	clickHeaderLabel(holder, 1)
	test.deepEqual(bodyColumn(holder, 1), ['25', '30', '35'], 'Should sort numbers ascending on the new column')
	test.deepEqual(indicators(), ['', '▲'], 'Should clear the old indicator and show ▲ on the new column')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: numeric strings sort numerically, not lexically', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows: TableBaseRow[] = [[{ value: '1000' }], [{ value: '50' }], [{ value: '5' }], [{ value: '500' }]]
	new TableBase({ columns: [{ label: 'Id', sortable: true }], rows, div: holder }).render()

	clickHeaderLabel(holder, 0)
	test.deepEqual(bodyColumn(holder, 0), ['5', '50', '500', '1000'], 'Should sort numeric-string ids by number')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: does not sort when the column is not sortable', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	table.sortByColumn(2)
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Alice', 'Bob'], 'Should leave the order unchanged')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: does not rebuild the header or mutate the caller rows array', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeSortFilterRows()
	const firstRow = rows[0]
	new TableBase({ columns: sortFilterColumns, rows, div: holder }).render()
	const theadBefore = holder.select('thead').node()
	const thBefore = holder.select('thead th').node()

	clickHeaderLabel(holder, 0)
	test.equal(holder.select('thead').node(), theadBefore, 'Should keep the same <thead>')
	test.equal(holder.select('thead th').node(), thBefore, 'Should keep the same header cells')
	test.equal(rows[0], firstRow, 'Should leave the caller rows array in its original order')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('filter: per-column text filter keeps matching rows, case-insensitively', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	typeFilter(holder, 2, 'ENGI')
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Bob'], 'Should show only rows whose Role contains the text')

	typeFilter(holder, 0, 'bo')
	test.deepEqual(bodyColumn(holder, 0), ['Bob'], 'Should AND filters across columns')

	typeFilter(holder, 0, '')
	typeFilter(holder, 2, '')
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Alice', 'Bob'], 'Should restore every row when filters are cleared')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('filter: matching nothing renders an empty body, and the filter input survives updates', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const inputBefore = holder.select('input[data-testid="sjpp-table-filter-0"]').node()

	typeFilter(holder, 0, 'zzz')
	test.equal(holder.selectAll('tbody tr').size(), 0, 'Should render no rows when nothing matches')
	test.equal(
		holder.select('input[data-testid="sjpp-table-filter-0"]').node(),
		inputBefore,
		'Should keep the same <input> so typing focus is not lost'
	)

	//if ((test as any)._ok) holder.remove()
	test.end()
})

const numericFilterColumns: TableBaseColumn[] = [
	{ label: 'Name', filterable: true },
	{ label: 'Age', filterable: true }
]

function namesAfterAgeFilter(text: string): string[] {
	const holder = getHolder()
	new TableBase({ columns: numericFilterColumns, rows: makeSortFilterRows().map(r => [r[0], r[1]]), div: holder }).render()
	typeFilter(holder, 1, text)
	return bodyColumn(holder, 0)
}

tape('filter: a numeric column accepts comparison and range expressions', test => {
	test.timeoutAfter(100)

	test.deepEqual(namesAfterAgeFilter('>30'), ['Charlie'], '>30')
	test.deepEqual(namesAfterAgeFilter('>=30'), ['Charlie', 'Alice'], '>=30')
	test.deepEqual(namesAfterAgeFilter('<30'), ['Bob'], '<30')
	test.deepEqual(namesAfterAgeFilter('<= 30'), ['Alice', 'Bob'], '<= 30 (space allowed)')
	test.deepEqual(namesAfterAgeFilter('=35'), ['Charlie'], '=35')
	test.deepEqual(namesAfterAgeFilter('25-30'), ['Alice', 'Bob'], '25-30 is inclusive')
	test.deepEqual(namesAfterAgeFilter('30-25'), ['Alice', 'Bob'], 'a reversed range still works')

	test.end()
})

tape('filter: plain text in a numeric column falls back to substring matching', test => {
	test.timeoutAfter(100)

	test.deepEqual(namesAfterAgeFilter('3'), ['Charlie', 'Alice'], '3 matches 35 and 30')
	test.deepEqual(namesAfterAgeFilter('>abc'), [], 'an invalid expression is treated as text and matches nothing')

	test.end()
})

tape('filter: numeric expressions combine with sort and do not break text columns', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({
		columns: [{ label: 'Name', filterable: true }, { label: 'Age', filterable: true, sortable: true }],
		rows: makeSortFilterRows().map(r => [r[0], r[1]]),
		div: holder
	}).render()

	typeFilter(holder, 1, '>=30')
	clickHeaderLabel(holder, 1)
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Charlie'], 'Should sort the rows the numeric filter kept')

	typeFilter(holder, 0, '>30')
	test.deepEqual(bodyColumn(holder, 0), [], 'A comparison typed in a text column is just text')

	test.end()
})

tape('filter: only filterable columns render an input', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	test.equal(holder.selectAll('.sjpp-table-filter-input').size(), 2, 'Should render an input per filterable column')
	test.ok(holder.select('input[data-testid="sjpp-table-filter-1"]').empty(), 'Should not render an input for Age')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort + filter: sort persists while filtering and vice versa', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	clickHeaderLabel(holder, 1) // age ascending
	typeFilter(holder, 2, 'engineer')
	test.deepEqual(bodyColumn(holder, 0), ['Bob', 'Alice'], 'Should keep the age sort within the filtered rows')

	clickHeaderLabel(holder, 1) // age descending
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Bob'], 'Should re-sort the filtered rows')

	typeFilter(holder, 2, '')
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Alice', 'Bob'], 'Should apply the age-descending sort to all rows once unfiltered')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('getOriginalIndex: reports the index in the caller array after sort and filter', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeSortFilterRows()
	const table = new TableBase({ columns: sortFilterColumns, rows, div: holder }).render()

	table.sortByColumn(0) // Alice, Bob, Charlie
	test.deepEqual(
		table.getRows().map(row => table.getOriginalIndex(row)),
		[1, 2, 0],
		'Should map sorted rows back to their original positions'
	)

	table.setColumnFilter(2, 'engineer') // Alice, Bob
	test.deepEqual(
		table.getRows().map(row => table.getOriginalIndex(row)),
		[1, 2],
		'Should map filtered rows back to their original positions'
	)
	test.equal(table.getOriginalIndex([{ value: 'stranger' }]), -1, 'Should return -1 for a row it does not own')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

/**************
 editing tests
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - editing -***-')
	test.end()
})

const editColumns: TableBaseColumn[] = [
	{ label: 'Name', editable: true, sortable: true },
	{ label: 'Age', editable: true },
	{ label: 'Fixed' }
]

function makeEditRows(): TableBaseRow[] {
	return [
		[{ value: 'Charlie' }, { value: 35 }, { value: 'a' }],
		[{ value: 'Alice' }, { value: 30 }, { value: 'b' }]
	]
}

function editCell(holder: any, rowIdx: number, colIdx: number, text: string | null, key = 'Enter') {
	const tr = holder.selectAll('tbody tr').nodes()[rowIdx] as HTMLTableRowElement
	const td = tr.cells[colIdx]
	td.dispatchEvent(new Event('click', { bubbles: true }))
	const input = td.querySelector('input') as HTMLInputElement | null
	if (input && text !== null) {
		input.value = text
		input.dispatchEvent(new KeyboardEvent('keydown', { key }))
	}
	return { td, input }
}

tape('edit: clicking an editable cell shows an input holding the current text', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: editColumns, rows: makeEditRows(), div: holder }).render()

	const { input } = editCell(holder, 0, 0, null)
	test.ok(input, 'Should render an input in the clicked cell')
	test.equal(input!.value, 'Charlie', 'Should start with the current text')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('edit: non-editable, url and html cells do not become inputs', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const columns: TableBaseColumn[] = [{ label: 'A', editable: true }, { label: 'B' }]
	const rows: TableBaseRow[] = [[{ url: 'https://example.com' }, { value: 'x' }], [{ html: '<b>b</b>' }, { value: 'y' }]]
	new TableBase({ columns, rows, div: holder }).render()

	test.notOk(editCell(holder, 0, 0, null).input, 'Should not edit a url cell')
	test.notOk(editCell(holder, 1, 0, null).input, 'Should not edit an html cell')
	test.notOk(editCell(holder, 0, 1, null).input, 'Should not edit a cell in a non-editable column')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('edit: Enter commits, updates the cell and reports the original row index', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeEditRows()
	const edits: any[] = []
	const table = new TableBase({ columns: editColumns, rows, div: holder, onEdit: e => edits.push(e) }).render()

	table.sortByColumn(0) // Alice, Charlie: displayed position 0 is original row 1
	const { td } = editCell(holder, 0, 0, 'Alicia')

	test.equal(td.textContent, 'Alicia', 'Should show the new text')
	test.equal(td.querySelector('input'), null, 'Should remove the input')
	test.equal(rows[1][0].value, 'Alicia', "Should update the caller's cell")
	test.equal(edits.length, 1, 'Should call onEdit once')
	test.equal(edits[0].rowIdx, 1, 'Should report the index in the original array, not the displayed position')
	test.equal(edits[0].colIdx, 0, 'Should report the column index')
	test.equal(edits[0].cell, rows[1][0], 'Should report the edited cell')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('edit: Escape cancels and leaves the value and callback alone', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeEditRows()
	let called = 0
	new TableBase({ columns: editColumns, rows, div: holder, onEdit: () => called++ }).render()

	const { td } = editCell(holder, 0, 0, 'changed', 'Escape')
	test.equal(td.textContent, 'Charlie', 'Should restore the original text')
	test.equal(rows[0][0].value, 'Charlie', 'Should not change the cell value')
	test.equal(called, 0, 'Should not call onEdit')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('edit: blur commits, and an unchanged value does not call onEdit', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeEditRows()
	let called = 0
	new TableBase({ columns: editColumns, rows, div: holder, onEdit: () => called++ }).render()

	const first = editCell(holder, 0, 0, null)
	first.input!.value = 'Chuck'
	first.input!.dispatchEvent(new Event('blur'))
	test.equal(rows[0][0].value, 'Chuck', 'Blur should commit')
	test.equal(called, 1, 'Should call onEdit for the change')

	editCell(holder, 1, 0, 'Alice')
	test.equal(called, 1, 'Should not call onEdit when the text is unchanged')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('edit: a number cell only accepts numbers and stays a number', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeEditRows()
	let called = 0
	new TableBase({ columns: editColumns, rows, div: holder, onEdit: () => called++ }).render()

	editCell(holder, 0, 1, '40')
	test.strictEqual(rows[0][1].value, 40, 'Should store a number')
	test.equal(called, 1, 'Should call onEdit for a valid number')

	for (const bad of ['n/a', "1; DROP TABLE users", '', '  ']) {
		const { td } = editCell(holder, 1, 1, bad)
		test.strictEqual(rows[1][1].value, 30, `Should reject "${bad}" and keep the number`)
		test.equal(td.textContent, '30', `Should revert the displayed text after "${bad}"`)
	}
	test.equal(called, 1, 'Should not call onEdit for rejected edits')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('edit: column.validate rejects disallowed text and reverts', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeEditRows()
	let called = 0
	const columns: TableBaseColumn[] = [
		{ label: 'Name', editable: true, validate: text => /^[\w .-]+$/.test(text) },
		{ label: 'Age' },
		{ label: 'Fixed' }
	]
	new TableBase({ columns, rows, div: holder, onEdit: () => called++ }).render()

	const bad = editCell(holder, 0, 0, "x'; DROP TABLE users;--")
	test.equal(rows[0][0].value, 'Charlie', 'Should keep the old value')
	test.equal(bad.td.textContent, 'Charlie', 'Should revert the displayed text')
	test.equal(called, 0, 'Should not call onEdit')

	editCell(holder, 0, 0, 'Chuck-2')
	test.equal(rows[0][0].value, 'Chuck-2', 'Should accept text the validator allows')
	test.equal(called, 1, 'Should call onEdit for accepted text')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('edit: the input is length-limited and over-long text is rejected', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeEditRows()
	let called = 0
	new TableBase({ columns: editColumns, rows, div: holder, onEdit: () => called++ }).render()

	const { input } = editCell(holder, 0, 0, 'x'.repeat(501))
	test.equal(input!.getAttribute('maxlength'), '500', 'Should set maxlength on the input')
	test.equal(rows[0][0].value, 'Charlie', 'Should reject text over the limit even if maxlength is bypassed')
	test.equal(called, 0, 'Should not call onEdit')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

/**************
 selection tests (onSelect, singleMode)
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - selection -***-')
	test.end()
})

type Call = { idx: number; checked: boolean; isInput: boolean }

function makeSelectTable(opts: { singleMode?: boolean; showLines?: boolean; rows?: TableBaseRow[] } = {}) {
	const holder = getHolder()
	const calls: Call[] = []
	const table = new TableBase({
		columns: sortFilterColumns,
		rows: opts.rows || makeSortFilterRows(),
		div: holder,
		singleMode: opts.singleMode,
		styles: { showLines: opts.showLines },
		onSelect: (idx, node) => calls.push({ idx, checked: node.checked, isInput: node instanceof HTMLInputElement })
	}).render()
	return { holder, table, calls }
}

const trAt = (holder: any, i: number) => holder.selectAll('tbody tr').nodes()[i] as HTMLTableRowElement
const inputAt = (holder: any, i: number) => trAt(holder, i).querySelector('input') as HTMLInputElement
const checkedNames = (holder: any) =>
	(holder.selectAll('tbody tr').nodes() as HTMLTableRowElement[])
		.filter(tr => (tr.querySelector('input') as HTMLInputElement).checked)
		.map(tr => tr.cells[1].textContent)

tape('select: no onSelect means no selection column', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	test.equal(holder.selectAll('tbody input').size(), 0, 'Should render no selection inputs')
	test.equal(trAt(holder, 0).getAttribute('tabindex'), null, 'Rows should not be focusable')
	test.equal(trAt(holder, 0).cells.length, sortFilterColumns.length, 'Should add no extra cell')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: multiple mode renders checkboxes, single mode renders radios sharing one name', test => {
	test.timeoutAfter(100)
	const multi = makeSelectTable()
	const single = makeSelectTable({ singleMode: true })

	const multiInputs = multi.holder.selectAll('tbody input').nodes() as HTMLInputElement[]
	const singleInputs = single.holder.selectAll('tbody input').nodes() as HTMLInputElement[]
	test.ok(multiInputs.every(i => i.type === 'checkbox'), 'Should render checkboxes by default')
	test.ok(singleInputs.every(i => i.type === 'radio'), 'Should render radios in singleMode')
	test.equal(new Set(singleInputs.map(i => i.name)).size, 1, 'Radios should share one name so they group')
	test.notEqual(singleInputs[0].name, multiInputs[0].name, 'Two tables should not share an input name')
	test.equal(multi.holder.selectAll('thead th').size(), sortFilterColumns.length + 1, 'Should add a header cell for the column')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: clicking the input, the row, or pressing Enter/Space all call the same callback', test => {
	test.timeoutAfter(100)
	const { holder, calls } = makeSelectTable()
	const rowCell = (i: number) => trAt(holder, i).cells[1]

	inputAt(holder, 0).click()
	test.deepEqual(calls.pop(), { idx: 0, checked: true, isInput: true }, 'Input click: original index, node.checked, input node')

	rowCell(1).dispatchEvent(new Event('click', { bubbles: true }))
	test.deepEqual(calls.pop(), { idx: 1, checked: true, isInput: true }, 'Row click: same arguments')
	rowCell(1).dispatchEvent(new Event('click', { bubbles: true }))
	test.deepEqual(calls.pop(), { idx: 1, checked: false, isInput: true }, 'Row click again deselects and reports checked=false')

	trAt(holder, 2).focus()
	trAt(holder, 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	test.deepEqual(calls.pop(), { idx: 2, checked: true, isInput: true }, 'Enter on the focused row: same arguments')
	trAt(holder, 2).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
	test.deepEqual(calls.pop(), { idx: 2, checked: false, isInput: true }, 'Space on the focused row: same arguments')
	test.equal(calls.length, 0, 'Every action should have called the callback exactly once')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: keys from a descendant and clicks on links or inputs do not toggle the row', test => {
	test.timeoutAfter(100)
	const rows: TableBaseRow[] = [[{ value: 'A' }, { value: 1 }, { url: 'https://example.com', value: 'link' }]]
	const { holder, calls } = makeSelectTable({ rows })

	const link = trAt(holder, 0).querySelector('a') as HTMLElement
	link.dispatchEvent(new Event('click', { bubbles: true }))
	test.equal(calls.length, 0, 'A link click should not select the row')
	link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	test.equal(calls.length, 0, 'Enter on a descendant should not select the row')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: single mode selects one row at a time and ignores a click on the selected row', test => {
	test.timeoutAfter(100)
	const { holder, table, calls } = makeSelectTable({ singleMode: true })

	trAt(holder, 0).cells[1].dispatchEvent(new Event('click', { bubbles: true }))
	trAt(holder, 2).cells[1].dispatchEvent(new Event('click', { bubbles: true }))
	test.deepEqual(
		calls,
		[
			{ idx: 0, checked: true, isInput: true },
			{ idx: 2, checked: true, isInput: true }
		],
		'Should call back only for the newly selected row'
	)
	test.deepEqual(table.getSelectedIndexes(), [2], 'Should keep only the last selected row')
	test.deepEqual(checkedNames(holder), ['Bob'], 'Only one radio should be checked')

	trAt(holder, 2).cells[1].dispatchEvent(new Event('click', { bubbles: true }))
	test.equal(calls.length, 2, 'Clicking the already selected row should not call back again')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: multiple mode tracks selected original indexes', test => {
	test.timeoutAfter(100)
	const { holder, table } = makeSelectTable()

	inputAt(holder, 2).click()
	inputAt(holder, 0).click()
	test.deepEqual(table.getSelectedIndexes(), [0, 2], 'Should list original indexes, ascending')
	inputAt(holder, 0).click()
	test.deepEqual(table.getSelectedIndexes(), [2], 'Should drop a deselected row')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: the callback reports the original index after sort, and selection survives sort and filter', test => {
	test.timeoutAfter(100)
	const { holder, table, calls } = makeSelectTable()

	table.sortByColumn(0) // Alice, Bob, Charlie
	inputAt(holder, 0).click() // Alice is original row 1
	test.equal(calls.pop()!.idx, 1, 'Should report the index in the caller array, not the displayed position')
	test.equal((inputAt(holder, 0).getAttribute('value')), '1', "Input value should be the original index")

	table.sortByColumn(0) // Charlie, Bob, Alice
	test.deepEqual(checkedNames(holder), ['Alice'], 'Selection should follow the row through a re-sort')

	table.setColumnFilter(2, 'manager') // Charlie only; Alice is hidden but still selected
	test.deepEqual(checkedNames(holder), [], 'Hidden row is not displayed')
	test.deepEqual(table.getSelectedIndexes(), [1], 'Hidden row should stay selected')
	table.setColumnFilter(2, '')
	test.deepEqual(checkedNames(holder), ['Alice'], 'Selection should reappear when the filter is cleared')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: editing a cell does not select the row', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const calls: number[] = []
	new TableBase({
		columns: editColumns,
		rows: makeEditRows(),
		div: holder,
		onSelect: idx => calls.push(idx)
	}).render()

	const td = trAt(holder, 0).cells[1] // cells[0] is the selection column
	td.dispatchEvent(new Event('click', { bubbles: true }))
	test.ok(td.querySelector('input'), 'Should start editing')
	test.equal(calls.length, 0, 'Should not select the row')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: the selection column sits after the line numbers, and inputs are labelled for screen readers', test => {
	test.timeoutAfter(100)
	const rows: TableBaseRow[] = [
		[{ value: 'Alice' }, { value: 30 }, { value: 'x' }],
		[{ value: '' }, { color: '#fff' }, { value: '' }]
	]
	const { holder } = makeSelectTable({ showLines: true, rows })

	test.equal(trAt(holder, 0).cells[0].textContent, '1', 'Line number should come first')
	test.ok(trAt(holder, 0).cells[1].querySelector('input'), 'Selection input should come second')

	const input = inputAt(holder, 0)
	const labelId = input.getAttribute('aria-labelledby')!
	test.equal(document.getElementById(labelId)!.textContent, 'Alice', 'Should be labelled by the first cell with text')
	test.equal(inputAt(holder, 1).getAttribute('aria-label'), 'Select row 2', 'Should fall back to a generic label')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

/**************
 pagination tests
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - pagination -***-')
	test.end()
})

function makePagedRows(n: number): TableBaseRow[] {
	return Array.from({ length: n }, (_, i) => [{ value: `name-${String(i).padStart(2, '0')}` }, { value: i }])
}

const pagedColumns: TableBaseColumn[] = [
	{ label: 'Name', sortable: true, filterable: true },
	{ label: 'Num', sortable: true, filterable: true }
]

function makePagedTable(n: number, pageSize: number, extra: Partial<ConstructorParameters<typeof TableBase>[0]> = {}) {
	const holder = getHolder()
	const changes: { currentPage: number; pageSize: number }[] = []
	const table = new TableBase({
		columns: pagedColumns,
		rows: makePagedRows(n),
		div: holder,
		pagination: { pageSize, onChange: s => changes.push(s) },
		...extra
	}).render()
	return { holder, table, changes }
}

const pagerButton = (holder: any, label: string) =>
	(holder.selectAll('.sjpp-table-page-nav button').nodes() as HTMLButtonElement[]).find(b => b.textContent === label)!
const pageInfo = (holder: any) => holder.select('.sjpp-table-page-info').text()

tape('page: no pagination option means no pager and every row is shown', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: pagedColumns, rows: makePagedRows(25), div: holder }).render()

	test.equal(holder.selectAll('.sjpp-table-pager').size(), 0, 'Should render no pager')
	test.equal(holder.selectAll('tbody tr').size(), 25, 'Should render every row')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: shows one page at the bottom with info, page-size select and buttons', test => {
	test.timeoutAfter(100)
	const { holder } = makePagedTable(25, 10)

	test.equal(holder.selectAll('tbody tr').size(), 10, 'Should render pageSize rows')
	test.deepEqual(bodyColumn(holder, 0).slice(0, 2), ['name-00', 'name-01'], 'Should start at the first row')
	test.equal(pageInfo(holder), 'Showing 1 to 10 of 25 entries', 'Should describe the page')
	const select = holder.select('select.sjpp-table-page-size').node() as HTMLSelectElement
	test.equal(select.value, '10', 'Should select the current page size')
	test.equal(select.getAttribute('aria-label'), 'Rows per page', 'Should label the select')
	test.ok(pagerButton(holder, 'Previous').disabled, 'Previous should be disabled on page 1')
	test.notOk(pagerButton(holder, 'Next').disabled, 'Next should be enabled')
	test.equal(pagerButton(holder, '1').getAttribute('aria-current'), 'page', 'Should mark the current page')
	const tableNode = holder.select('table').node() as HTMLElement
	const pagerNode = holder.select('.sjpp-table-pager').node() as HTMLElement
	test.ok(tableNode.compareDocumentPosition(pagerNode) & Node.DOCUMENT_POSITION_FOLLOWING, 'Pager should come after the table')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: Next and Previous change the page, redraw only the body, and call onChange', test => {
	test.timeoutAfter(100)
	const { holder, changes } = makePagedTable(25, 10)
	const theadBefore = holder.select('thead').node()

	pagerButton(holder, 'Next').click()
	test.deepEqual(bodyColumn(holder, 0).slice(0, 1), ['name-10'], 'Should show the second page')
	test.equal(pageInfo(holder), 'Showing 11 to 20 of 25 entries', 'Should update the info')
	test.deepEqual(changes, [{ currentPage: 2, pageSize: 10 }], 'Should call onChange')
	test.equal(holder.select('thead').node(), theadBefore, 'Should not rebuild the header')

	pagerButton(holder, '3').click()
	test.equal(holder.selectAll('tbody tr').size(), 5, 'Last page should hold the remainder')
	test.ok(pagerButton(holder, 'Next').disabled, 'Next should be disabled on the last page')

	pagerButton(holder, 'Previous').click()
	test.equal(pageInfo(holder), 'Showing 11 to 20 of 25 entries', 'Previous should go back one page')
	test.equal(changes.length, 3, 'Should call onChange once per change')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: line numbers and striping continue across pages', test => {
	test.timeoutAfter(100)
	const { holder, table } = makePagedTable(25, 10, { styles: { showLines: true } })

	table.goToPage(2)
	const trs = holder.selectAll('tbody tr').nodes() as HTMLTableRowElement[]
	test.equal(trs[0].cells[0].textContent, '11', 'First row on page 2 should be numbered 11')
	test.equal(trs[0].style.backgroundColor, '', 'Row 11 (index 10) should not be striped')
	test.equal(trs[1].style.backgroundColor, 'rgb(245, 245, 245)', 'Row 12 (index 11) should be striped')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: changing page size returns to page 1 and calls onChange', test => {
	test.timeoutAfter(100)
	const { holder, changes } = makePagedTable(60, 10)
	pagerButton(holder, '3').click()

	const select = holder.select('select.sjpp-table-page-size').node() as HTMLSelectElement
	select.value = '25'
	select.dispatchEvent(new Event('change', { bubbles: true }))
	test.equal(holder.selectAll('tbody tr').size(), 25, 'Should show the new page size')
	test.equal(pageInfo(holder), 'Showing 1 to 25 of 60 entries', 'Should be back on page 1')
	test.deepEqual(changes.pop(), { currentPage: 1, pageSize: 25 }, 'Should call onChange with the new size')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: a long page list collapses with ellipses', test => {
	test.timeoutAfter(100)
	const { holder, table } = makePagedTable(200, 10) // 20 pages

	const labels = () => (holder.selectAll('.sjpp-table-page-nav button').nodes() as HTMLElement[]).map(b => b.textContent)
	test.deepEqual(labels(), ['Previous', '1', '2', '3', '20', 'Next'], 'Page 1 should show 1-3 and the last page')
	table.goToPage(10)
	test.deepEqual(labels(), ['Previous', '1', '8', '9', '10', '11', '12', '20', 'Next'], 'A middle page should show a window')
	test.equal(holder.selectAll('.sjpp-table-page-nav span').size(), 2, 'Should render an ellipsis for each gap')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: sort and filter act on all rows, reset to page 1, and report it', test => {
	test.timeoutAfter(100)
	const { holder, table, changes } = makePagedTable(25, 10)
	table.goToPage(3)
	changes.length = 0

	clickHeaderLabel(holder, 0) // name ascending
	clickHeaderLabel(holder, 0) // name descending
	test.deepEqual(bodyColumn(holder, 0).slice(0, 1), ['name-24'], 'Descending sort should use every row, not just the page')
	test.equal(pageInfo(holder), 'Showing 1 to 10 of 25 entries', 'Sort should go back to page 1')
	test.deepEqual(changes, [{ currentPage: 1, pageSize: 10 }], 'Should report the reset once, not when already on page 1')

	pagerButton(holder, 'Next').click()
	changes.length = 0
	typeFilter(holder, 0, 'name-1')
	test.equal(pageInfo(holder), 'Showing 1 to 10 of 10 entries', 'Filter should count only matching rows and reset the page')
	test.deepEqual(changes, [{ currentPage: 1, pageSize: 10 }], 'Filter should report the reset')

	typeFilter(holder, 0, 'zzz')
	test.equal(pageInfo(holder), 'Showing 0 entries', 'Should handle no matches')
	test.equal(holder.selectAll('tbody tr').size(), 0, 'Should render no rows')
	test.ok(pagerButton(holder, 'Next').disabled && pagerButton(holder, 'Previous').disabled, 'Both arrows should be disabled')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: currentPage option, clamping, and invalid page sizes', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({
		columns: pagedColumns,
		rows: makePagedRows(25),
		div: holder,
		pagination: { pageSize: 10, currentPage: 3 }
	}).render()
	test.equal(pageInfo(holder), 'Showing 21 to 25 of 25 entries', 'Should open on the requested page')

	const { holder: h2, table } = makePagedTable(25, 10, { pagination: { pageSize: 10, currentPage: 99 } })
	test.equal(pageInfo(h2), 'Showing 21 to 25 of 25 entries', 'Should clamp an out-of-range page')
	table.goToPage(-5)
	test.equal(pageInfo(h2), 'Showing 1 to 10 of 25 entries', 'goToPage should clamp too')

	for (const bad of [0, -1, 2.5]) {
		try {
			new TableBase({ columns: pagedColumns, rows: [], div: holder, pagination: { pageSize: bad } })
			test.fail(`Should throw for pageSize ${bad}`)
		} catch (e: any) {
			test.pass(`Should throw for pageSize ${bad}: ${e.message}`)
		}
	}

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: selection and original indexes hold across pages', test => {
	test.timeoutAfter(100)
	const calls: number[] = []
	const { holder, table } = makePagedTable(25, 10, { onSelect: idx => calls.push(idx) })

	;(holder.select('tbody input').node() as HTMLInputElement).click() // row 0
	table.goToPage(2)
	;(holder.select('tbody input').node() as HTMLInputElement).click() // row 10
	test.deepEqual(calls, [0, 10], 'Should report original indexes on later pages')
	test.deepEqual(table.getSelectedIndexes(), [0, 10], 'Should keep selections from other pages')
	table.goToPage(1)
	test.ok((holder.select('tbody input').node() as HTMLInputElement).checked, 'Should restore the checkbox when coming back')
	test.deepEqual(table.getRows().length, 10, 'getRows() should return the displayed page')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: page changes are announced and the pager is labelled', test => {
	test.timeoutAfter(100)
	const { holder, table } = makePagedTable(25, 10)
	const status = holder.select('[role="status"]').node() as HTMLElement

	table.goToPage(2)
	test.equal(status.textContent, 'Page 2 of 3', 'Should announce the page')
	test.equal(holder.select('nav').attr('aria-label'), 'Pagination', 'Should label the nav')
	test.equal(pagerButton(holder, '2').getAttribute('aria-label'), 'Page 2', 'Page buttons should have a full label')
	test.equal(pagerButton(holder, 'Next').getAttribute('aria-label'), 'Go to next page', 'Arrows should have a full label')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: update(rows) paginates the rows it is given', test => {
	test.timeoutAfter(100)
	const { holder, table } = makePagedTable(25, 10)

	table.update(makePagedRows(12))
	test.equal(pageInfo(holder), 'Showing 1 to 10 of 12 entries', 'Should page the replacement rows')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

/**************
 accessibility tests
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - accessibility -***-')
	test.end()
})

tape('a11y: headers have scope=col and the table can be given an accessible name', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({
		columns: testColumns,
		rows: testRows,
		div: holder,
		ariaLabel: 'People',
		styles: { showLines: true }
	}).render()

	const ths = holder.selectAll('thead th').nodes() as HTMLElement[]
	test.ok(ths.every(th => th.getAttribute('scope') === 'col'), 'Every <th> should have scope="col"')
	test.equal(ths[0].getAttribute('aria-label'), 'Row number', 'Should name the otherwise empty line-number header')
	test.equal(holder.select('table').attr('aria-label'), 'People', 'Should set aria-label on the table')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('a11y: a sortable header is a keyboard-focusable button with aria-sort', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const nameTh = holder.selectAll('thead th').nodes()[0] as HTMLElement
	const ageTh = holder.selectAll('thead th').nodes()[1] as HTMLElement
	const roleTh = holder.selectAll('thead th').nodes()[2] as HTMLElement

	const button = nameTh.querySelector('button') as HTMLButtonElement
	test.ok(button, 'Should render a <button> for a sortable column')
	test.equal(button.type, 'button', 'Should not act as a form submit button')
	test.ok(button.tabIndex >= 0, 'Should be in the tab order')
	test.equal(roleTh.querySelector('button'), null, 'Should not render a button for a non-sortable column')
	test.equal(nameTh.querySelector('.sjpp-table-sort-indicator')!.getAttribute('aria-hidden'), 'true', 'Should hide the decorative arrow')

	test.equal(nameTh.getAttribute('aria-sort'), 'none', 'Should start unsorted')
	button.click()
	test.equal(nameTh.getAttribute('aria-sort'), 'ascending', 'Should report ascending')
	button.click()
	test.equal(nameTh.getAttribute('aria-sort'), 'descending', 'Should report descending')
	;(ageTh.querySelector('button') as HTMLButtonElement).click()
	test.equal(nameTh.getAttribute('aria-sort'), 'none', 'Should reset the previous column')
	test.equal(ageTh.getAttribute('aria-sort'), 'ascending', 'Should report the new column')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('a11y: filter inputs are labelled and sort/filter changes are announced', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const status = holder.select('[role="status"]').node() as HTMLElement

	test.equal(status.getAttribute('aria-live'), 'polite', 'Should render a polite live region')
	test.equal(status.textContent, '', 'Should announce nothing on initial render')
	test.equal(
		(holder.select('input[data-testid="sjpp-table-filter-0"]').node() as HTMLElement).getAttribute('aria-label'),
		'Filter Name',
		'Should give the filter input an accessible name'
	)

	clickHeaderLabel(holder, 0)
	test.equal(status.textContent, 'Sorted by Name, ascending', 'Should announce the sort')
	clickHeaderLabel(holder, 0)
	test.equal(status.textContent, 'Sorted by Name, descending', 'Should announce the toggled sort')

	typeFilter(holder, 2, 'manager')
	test.equal(status.textContent, 'Showing 1 of 3 rows', 'Should announce how many rows the filter kept')
	typeFilter(holder, 2, 'zzz')
	test.equal(status.textContent, 'Showing 0 of 3 rows', 'Should announce an empty result')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('a11y: a color-only cell has a text alternative', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: [{ label: 'Color' }], rows: [[{ color: '#ff0000' }]], div: holder }).render()

	test.equal(holder.select('tbody td').attr('aria-label'), '#ff0000', 'Should name the cell after its color')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('a11y: editable cells are reachable and operable by keyboard', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeEditRows()
	new TableBase({ columns: editColumns, rows, div: holder }).render()
	const cell = (r: number, c: number) => (holder.selectAll('tbody tr').nodes()[r] as HTMLTableRowElement).cells[c]

	test.equal(cell(0, 0).getAttribute('tabindex'), '0', 'Editable cell should be in the tab order')
	test.ok(cell(0, 0).getAttribute('aria-description'), 'Should describe how to start editing')
	test.equal(cell(0, 2).getAttribute('tabindex'), null, 'Non-editable cell should not be focusable')

	const td = cell(0, 0)
	td.focus()
	td.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	const input = td.querySelector('input') as HTMLInputElement
	test.ok(input, 'Enter on the focused cell should start editing')
	test.equal(input.getAttribute('aria-label'), 'Edit Name', 'Should name the edit input')
	test.equal(document.activeElement, input, 'Should move focus into the input')

	input.value = 'Chuck'
	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	test.equal(rows[0][0].value, 'Chuck', 'Enter should commit and not restart editing')
	test.equal(td.querySelector('input'), null, 'Should close the input')
	test.equal(document.activeElement, td, 'Should return focus to the cell after Enter')

	td.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
	const second = td.querySelector('input') as HTMLInputElement
	test.ok(second, 'F2 should also start editing')
	second.value = 'ignored'
	second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	test.equal(rows[0][0].value, 'Chuck', 'Escape should cancel')
	test.equal(document.activeElement, td, 'Should return focus to the cell after Escape')

	//if ((test as any)._ok) holder.remove()
	test.end()
})

tape('render(): a second render keeps the current sort and filter state', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	table.sortByColumn(0)
	table.setColumnFilter(2, 'engineer')
	table.render()

	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Bob'], 'Should still show the filtered and sorted rows')
	const indicators = (holder.selectAll('.sjpp-table-sort-indicator').nodes() as HTMLElement[]).map(n => n.textContent)
	test.deepEqual(indicators, ['▲', ''], 'Should restore the sort indicator')
	const input = holder.select('input[data-testid="sjpp-table-filter-2"]').node() as HTMLInputElement
	test.equal(input.value, 'engineer', 'Should restore the filter text')

	//if ((test as any)._ok) holder.remove()
	test.end()
})
