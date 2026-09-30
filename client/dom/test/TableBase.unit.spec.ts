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
