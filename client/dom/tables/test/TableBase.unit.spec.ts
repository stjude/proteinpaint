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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	const urlOnlyHolder = getHolder()
	new TableBase({
		columns: [{ label: 'Link' }],
		rows: [[{ url: 'https://example.com' }]],
		div: urlOnlyHolder
	}).render()
	const linkOnly = urlOnlyHolder.select('tbody a').node() as HTMLAnchorElement
	test.equal(linkOnly.textContent, 'https://example.com', 'Should fall back to the url as link text when value is missing')

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

	if ((test as any)._ok) for (const holder of [valueHolder, urlHolder, urlOnlyHolder, htmlHolder]) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('dataTestId applied to <table>', test => {
	test.timeoutAfter(100)
	const holder = getHolder()

	new TableBase({ columns: testColumns, rows: testRows, div: holder, dataTestId: 'my-table' }).render()

	test.equal(holder.select('table').attr('data-testid'), 'my-table', 'Should set data-testid on the <table>')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

/** Clicks a column's icon button. The popup it opens lives in <body>, so it is found through aria-controls. */
function openColumnMenu(holder: any, colIdx: number): HTMLElement {
	const th = holder.selectAll('thead th').nodes()[colIdx] as HTMLElement
	const button = th.querySelector('button.sjpp-table-column-menu-btn') as HTMLButtonElement
	button.click()
	return document.getElementById(button.getAttribute('aria-controls')!) as HTMLElement
}

/** Sorts the way a user does: open the popup and pick a direction. Ascending, unless the column is
 * already sorted ascending, so repeated calls toggle like the old header click did. */
function sortViaMenu(holder: any, colIdx: number) {
	const th = holder.selectAll('thead th').nodes()[colIdx] as HTMLElement
	const direction = th.getAttribute('aria-sort') == 'ascending' ? 'desc' : 'asc'
	const menu = openColumnMenu(holder, colIdx)
	;(menu.querySelector(`[data-testid="sjpp-table-sort-${direction}-${colIdx}"]`) as HTMLElement).click()
}

function typeFilter(holder: any, colIdx: number, text: string) {
	const menu = openColumnMenu(holder, colIdx)
	const input = menu.querySelector(`input[data-testid="sjpp-table-filter-${colIdx}"]`) as HTMLInputElement
	input.value = text
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

tape('sort and filter: one icon button per column, showing a symbol for each feature the column has', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const th = (i: number) => holder.selectAll('thead th').nodes()[i] as HTMLElement
	const has = (i: number, selector: string) => !!th(i).querySelector(selector)

	test.equal(holder.selectAll('thead button').size(), 3, 'Should render one button per column, not one per feature')
	test.ok(has(0, '.sjpp-table-sort-indicator') && has(0, '.sjpp-table-filter-icon'), 'Name is sortable and filterable: both symbols')
	test.ok(has(1, '.sjpp-table-sort-indicator') && !has(1, '.sjpp-table-filter-icon'), 'Age is sortable only: sort symbol only')
	test.ok(!has(2, '.sjpp-table-sort-indicator') && has(2, '.sjpp-table-filter-icon'), 'Role is filterable only: filter symbol only')
	test.equal(holder.selectAll('input').size(), 0, 'Should render no filter input in the header')
	test.equal((th(0).querySelector('.sjpp-table-header-label') as HTMLElement).style.cursor, '', 'The label itself is not clickable')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: clicking a header sorts ascending, then toggles descending, with a matching indicator', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const indicators = () => (holder.selectAll('.sjpp-table-sort-indicator').nodes() as HTMLElement[]).map(n => n.textContent)

	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Alice', 'Bob'], 'Should start in the input order')
	test.deepEqual(indicators(), ['⇅', '⇅'], 'Should show a neutral marker on every sortable column before any sort')

	sortViaMenu(holder, 0)
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Bob', 'Charlie'], 'First click should sort ascending')
	test.deepEqual(indicators(), ['▲', '⇅'], 'Should show ▲ on the sorted column')

	sortViaMenu(holder, 0)
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Bob', 'Alice'], 'Second click should sort descending')
	test.deepEqual(indicators(), ['▼', '⇅'], 'Should show ▼ on the sorted column')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: the icon button opens a popup with both directions and marks the current one', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const option = (menu: HTMLElement, dir: string) => menu.querySelector(`[data-testid="sjpp-table-sort-${dir}-0"]`) as HTMLElement
	const indicator = holder.select('.sjpp-table-sort-indicator').node() as HTMLElement

	let menu = openColumnMenu(holder, 0)
	test.ok(option(menu, 'asc') && option(menu, 'desc'), 'Should offer ascending and descending')
	test.equal(option(menu, 'asc').getAttribute('aria-current'), null, 'Should mark neither before a sort')
	test.notEqual(menu.style.display, 'none', 'Should show the popup')

	option(menu, 'desc').click()
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Bob', 'Alice'], 'Choosing descending should sort descending first')
	test.equal(indicator.textContent, '▼', 'Should show ▼ on the button')
	test.equal(menu.style.display, 'none', 'Should close the popup after choosing')

	menu = openColumnMenu(holder, 0)
	test.equal(option(menu, 'desc').getAttribute('aria-current'), 'true', 'Should mark the current direction')
	test.equal(option(menu, 'asc').getAttribute('aria-current'), null, 'Should not mark the other')
	option(menu, 'desc').click()
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Bob', 'Alice'], 'Choosing the current direction keeps it, it does not toggle')
	option(openColumnMenu(holder, 0), 'asc').click()
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Bob', 'Charlie'], 'Choosing ascending should sort ascending')
	test.equal(indicator.textContent, '▲', 'Should show ▲ on the button')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('column button: turns blue while a sort or a filter is applied on its column', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const button = (i: number) => holder.select(`[data-testid="sjpp-table-column-menu-btn-${i}"]`).node() as HTMLElement
	const blue = 'rgb(13, 110, 253)'
	const size = (i: number) => parseFloat(getComputedStyle(button(i)).fontSize)
	const isActive = (i: number) => getComputedStyle(button(i)).color == blue && button(i).classList.contains('sjpp-table-column-active')
	const baseSize = size(0)

	test.deepEqual([0, 1, 2].map(isActive), [false, false, false], 'No column should look active before anything is applied')

	sortViaMenu(holder, 1)
	test.deepEqual([0, 1, 2].map(isActive), [false, true, false], 'A sort should mark only its own column')
	test.ok(Math.abs(size(1) - baseSize) < 0.01, 'The color change should not change the size')

	typeFilter(holder, 2, 'eng')
	test.deepEqual([0, 1, 2].map(isActive), [false, true, true], 'A filter should mark its column too')

	typeFilter(holder, 2, '')
	test.deepEqual([0, 1, 2].map(isActive), [false, true, false], 'Emptying the filter should reset that column')
	test.ok(Math.abs(size(2) - baseSize) < 0.01, 'Should stay the normal size')

	sortViaMenu(holder, 0)
	test.deepEqual([0, 1, 2].map(isActive), [true, false, false], 'Sorting another column should move the mark')

	typeFilter(holder, 0, 'a')
	sortViaMenu(holder, 1)
	test.ok(isActive(0), 'A filtered column stays active when the sort moves to another column')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('column button: the funnel is empty until a filter is applied, then filled', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const fills = () =>
		(holder.selectAll('.sjpp-table-filter-icon path').nodes() as SVGPathElement[]).map(path => path.getAttribute('fill'))
	const outlined = () =>
		(holder.selectAll('.sjpp-table-filter-icon path').nodes() as SVGPathElement[]).every(
			path => path.getAttribute('stroke') == 'currentColor'
		)

	test.deepEqual(fills(), ['none', 'none'], 'Both funnels should start empty')
	test.ok(outlined(), 'An empty funnel is an outline')

	typeFilter(holder, 0, 'a')
	test.deepEqual(fills(), ['currentColor', 'none'], 'Only the filtered column should be filled')
	sortViaMenu(holder, 2 - 1) // sorting Age must not fill any funnel
	test.deepEqual(fills(), ['currentColor', 'none'], 'A sort alone should not fill a funnel')

	typeFilter(holder, 2, 'eng')
	test.deepEqual(fills(), ['currentColor', 'currentColor'], 'Every filtered column should be filled')
	typeFilter(holder, 0, '')
	typeFilter(holder, 2, '')
	test.deepEqual(fills(), ['none', 'none'], 'Emptying the filters should empty the funnels')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('column button: the active look comes back after the header is rebuilt', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	table.sortByColumn(1)
	table.setColumnFilter(2, 'eng')
	table.render()

	const colors = [1, 2, 0].map(i => getComputedStyle(holder.select(`[data-testid="sjpp-table-column-menu-btn-${i}"]`).node() as Element).color)
	test.deepEqual(colors.slice(0, 2), ['rgb(13, 110, 253)', 'rgb(13, 110, 253)'], 'Sorted and filtered columns should still be blue')
	test.notEqual(colors[2], 'rgb(13, 110, 253)', 'Other columns should not be')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: the popup removes with the table so none are left in <body>', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const menu = openColumnMenu(holder, 0)
	test.ok(document.body.contains(menu), 'Should have a popup while the table is rendered')

	table.remove()
	test.notOk(document.body.contains(menu), 'Should remove the popup with the table')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: sorting a different column resets the previous indicator and starts ascending', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const indicators = () => (holder.selectAll('.sjpp-table-sort-indicator').nodes() as HTMLElement[]).map(n => n.textContent)

	sortViaMenu(holder, 0)
	sortViaMenu(holder, 0) // name descending
	sortViaMenu(holder, 1)
	test.deepEqual(bodyColumn(holder, 1), ['25', '30', '35'], 'Should sort numbers ascending on the new column')
	test.deepEqual(indicators(), ['⇅', '▲'], 'Should reset the old indicator and show ▲ on the new column')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: numeric strings sort numerically, not lexically', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows: TableBaseRow[] = [[{ value: '1000' }], [{ value: '50' }], [{ value: '5' }], [{ value: '500' }]]
	new TableBase({ columns: [{ label: 'Id', sortable: true }], rows, div: holder }).render()

	sortViaMenu(holder, 0)
	test.deepEqual(bodyColumn(holder, 0), ['5', '50', '500', '1000'], 'Should sort numeric-string ids by number')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: does not sort when the column is not sortable', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	table.sortByColumn(2)
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Alice', 'Bob'], 'Should leave the order unchanged')

	if ((test as any)._ok) holder.remove()
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

	sortViaMenu(holder, 0)
	test.equal(holder.select('thead').node(), theadBefore, 'Should keep the same <thead>')
	test.equal(holder.select('thead th').node(), thBefore, 'Should keep the same header cells')
	test.equal(rows[0], firstRow, 'Should leave the caller rows array in its original order')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('filter: matching nothing renders an empty body, and the popup input survives updates', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const menu = openColumnMenu(holder, 0)
	const input = menu.querySelector('input[data-testid="sjpp-table-filter-0"]') as HTMLInputElement

	input.value = 'zzz'
	input.dispatchEvent(new Event('input', { bubbles: true }))
	test.equal(holder.selectAll('tbody tr').size(), 0, 'Should render no rows when nothing matches')
	test.equal(
		menu.querySelector('input[data-testid="sjpp-table-filter-0"]'),
		input,
		'Should keep the same <input> so typing focus is not lost'
	)
	test.notEqual(menu.style.display, 'none', 'Should keep the popup open while typing')

	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	test.equal(menu.style.display, 'none', 'Enter should close the popup')

	const icon = holder.select('.sjpp-table-filter-icon').node() as HTMLElement
	test.ok(icon.classList.contains('sjpp-table-filter-active'), 'Should mark the filter symbol active')
	typeFilter(holder, 0, '')
	test.notOk(icon.classList.contains('sjpp-table-filter-active'), 'Should clear the active mark when the filter is emptied')

	if ((test as any)._ok) holder.remove()
	test.end()
})

const numericFilterColumns: TableBaseColumn[] = [
	{ label: 'Name', filterable: true },
	{ label: 'Age', filterable: true }
]

/** Renders a fresh table, types into the Age filter and returns the names left. The holder is added to
 * `holders` so the calling test can remove it when it passes. */
function namesAfterAgeFilter(text: string, holders: any[]): string[] {
	const holder = getHolder()
	holders.push(holder)
	new TableBase({ columns: numericFilterColumns, rows: makeSortFilterRows().map(r => [r[0], r[1]]), div: holder }).render()
	typeFilter(holder, 1, text)
	return bodyColumn(holder, 0)
}

tape('filter: a numeric column accepts comparison and range expressions', test => {
	test.timeoutAfter(100)
	const holders: any[] = []

	test.deepEqual(namesAfterAgeFilter('>30', holders), ['Charlie'], '>30')
	test.deepEqual(namesAfterAgeFilter('>=30', holders), ['Charlie', 'Alice'], '>=30')
	test.deepEqual(namesAfterAgeFilter('<30', holders), ['Bob'], '<30')
	test.deepEqual(namesAfterAgeFilter('<= 30', holders), ['Alice', 'Bob'], '<= 30 (space allowed)')
	test.deepEqual(namesAfterAgeFilter('=35', holders), ['Charlie'], '=35')
	test.deepEqual(namesAfterAgeFilter('25-30', holders), ['Alice', 'Bob'], '25-30 is inclusive')
	test.deepEqual(namesAfterAgeFilter('30-25', holders), ['Alice', 'Bob'], 'a reversed range still works')

	if ((test as any)._ok) for (const holder of holders) holder.remove()
	test.end()
})

tape('filter: plain text in a numeric column falls back to substring matching', test => {
	test.timeoutAfter(100)
	const holders: any[] = []

	test.deepEqual(namesAfterAgeFilter('3', holders), ['Charlie', 'Alice'], '3 matches 35 and 30')
	test.deepEqual(namesAfterAgeFilter('>abc', holders), [], 'an invalid expression is treated as text and matches nothing')

	if ((test as any)._ok) for (const holder of holders) holder.remove()
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
	sortViaMenu(holder, 1)
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Charlie'], 'Should sort the rows the numeric filter kept')

	typeFilter(holder, 0, '>30')
	test.deepEqual(bodyColumn(holder, 0), [], 'A comparison typed in a text column is just text')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('popup: shows only the sort options and filter input a column has', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const sortOptions = (menu: HTMLElement) => menu.querySelectorAll('[data-testid^="sjpp-table-sort-"]').length
	const inputs = (menu: HTMLElement) => menu.querySelectorAll('input').length

	let menu = openColumnMenu(holder, 0)
	test.deepEqual([sortOptions(menu), inputs(menu)], [2, 1], 'Name: both directions and the filter input')
	menu = openColumnMenu(holder, 1)
	test.deepEqual([sortOptions(menu), inputs(menu)], [2, 0], 'Age: sort only')
	menu = openColumnMenu(holder, 2)
	test.deepEqual([sortOptions(menu), inputs(menu)], [0, 1], 'Role: filter only')
	test.equal(document.querySelectorAll(`#${CSS.escape(menu.id)}`).length, 1, 'All columns share one popup')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort + filter: sort persists while filtering and vice versa', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()

	sortViaMenu(holder, 1) // age ascending
	typeFilter(holder, 2, 'engineer')
	test.deepEqual(bodyColumn(holder, 0), ['Bob', 'Alice'], 'Should keep the age sort within the filtered rows')

	sortViaMenu(holder, 1) // age descending
	test.deepEqual(bodyColumn(holder, 0), ['Alice', 'Bob'], 'Should re-sort the filtered rows')

	typeFilter(holder, 2, '')
	test.deepEqual(bodyColumn(holder, 0), ['Charlie', 'Alice', 'Bob'], 'Should apply the age-descending sort to all rows once unfiltered')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('getOriginalIndex: reports the index in the caller array after sort and filter', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows = makeSortFilterRows()
	const table = new TableBase({ columns: sortFilterColumns, rows, div: holder }).render()

	// each displayed <tr> carries its row object as its datum
	const shownOriginalIndexes = () =>
		(holder.selectAll('tbody tr').nodes() as HTMLElement[]).map(tr => table.getOriginalIndex(d3s.select(tr).datum() as TableBaseRow))

	table.sortByColumn(0) // Alice, Bob, Charlie
	test.deepEqual(shownOriginalIndexes(), [1, 2, 0], 'Should map sorted rows back to their original positions')

	table.setColumnFilter(2, 'engineer') // Alice, Bob
	test.deepEqual(shownOriginalIndexes(), [1, 2], 'Should map filtered rows back to their original positions')
	test.equal(table.getOriginalIndex([{ value: 'stranger' }]), -1, 'Should return -1 for a row it does not own')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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
		styles: { showLines: opts.showLines },
		selection: {
			singleMode: opts.singleMode,
			onSelect: (idx, node) => calls.push({ idx, checked: node.checked, isInput: node instanceof HTMLInputElement })
		}
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) for (const { holder } of [multi, single]) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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
		selection: { onSelect: idx => calls.push(idx) }
	}).render()

	const td = trAt(holder, 0).cells[1] // cells[0] is the selection column
	td.dispatchEvent(new Event('click', { bubbles: true }))
	test.ok(td.querySelector('input'), 'Should start editing')
	test.equal(calls.length, 0, 'Should not select the row')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

/**************
 selection: preselection, check-all, buttons, selectedRow style
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - selection options and buttons -***-')
	test.end()
})

function makeOptTable(opts: Partial<ConstructorParameters<typeof TableBase>[0]> = {}) {
	const holder = getHolder()
	const table = new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder, ...opts }).render()
	return { holder, table }
}
const checkAll = (holder: any) => holder.select('input[data-testid="sjpp-table-checkall"]').node() as HTMLInputElement

tape('select: selectedRows preselects by index without calling onSelect, and selectAll selects everything', test => {
	test.timeoutAfter(100)
	let called = 0
	const pre = makeOptTable({ selection: { selectedRows: [0, 2], onSelect: () => called++ } })
	test.deepEqual(checkedNames(pre.holder), ['Charlie', 'Bob'], 'Should check the requested rows')
	test.deepEqual(pre.table.getSelectedIndexes(), [0, 2], 'Should report them as selected')
	test.equal(called, 0, 'Should not call onSelect for preselection')

	const all = makeOptTable({ selection: { selectAll: true } })
	test.deepEqual(checkedNames(all.holder), ['Charlie', 'Alice', 'Bob'], 'selectAll should check every row')
	test.ok(checkAll(all.holder).checked, 'The check-all box should be checked')

	if ((test as any)._ok) for (const { holder } of [pre, all]) holder.remove()
	test.end()
})

tape('select: invalid selection options throw', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const make = (selection: any) => () =>
		new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder, selection })
	test.throws(make({ selectedRows: [5] }), /out of range/, 'Should reject an index past the last row')
	test.throws(make({ singleMode: true, selectAll: true }), /singleMode/, 'Should reject selectAll with singleMode')
	test.throws(make({ singleMode: true, selectedRows: [0, 1] }), /only one/, 'Should reject two preselected rows in singleMode')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: the check-all box selects and clears displayed rows, calls onSelect per change, and shows a dash for some', test => {
	test.timeoutAfter(100)
	const calls: Call[] = []
	const { holder, table } = makeOptTable({
		selection: { onSelect: (idx, node) => calls.push({ idx, checked: node.checked, isInput: true }) }
	})

	checkAll(holder).click()
	test.deepEqual(table.getSelectedIndexes(), [0, 1, 2], 'Should select every displayed row')
	test.deepEqual(calls.map(c => c.idx), [0, 1, 2], 'Should call onSelect once per row that changed')

	inputAt(holder, 1).click()
	test.notOk(checkAll(holder).checked, 'Should uncheck when a row is deselected')
	test.ok(checkAll(holder).indeterminate, 'Should show a dash when only some rows are selected')

	calls.length = 0
	checkAll(holder).click() // dash -> all
	test.deepEqual(calls.map(c => c.idx), [1], 'Should only call for the row that was not already selected')
	checkAll(holder).click() // all -> none
	test.deepEqual(table.getSelectedIndexes(), [], 'Should clear every displayed row')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: there is no check-all box in singleMode', test => {
	test.timeoutAfter(100)
	const { holder } = makeOptTable({ selection: { singleMode: true } })

	test.ok(holder.select('input[data-testid="sjpp-table-checkall"]').empty(), 'Should not render check-all')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: check-all acts on the current page only', test => {
	test.timeoutAfter(100)
	const { holder, table } = makePagedTable(25, 10, { selection: {} })

	checkAll(holder).click()
	test.deepEqual(table.getSelectedIndexes(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'Should select the 10 rows on this page')
	table.goToPage(2)
	test.notOk(checkAll(holder).checked, 'Check-all should reflect the new page')
	test.equal(checkAll(holder).getAttribute('aria-label'), 'Select all rows on this page', 'Should say it acts on the page')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: hideInput hides the input and header cell but rows still select', test => {
	test.timeoutAfter(100)
	const calls: Call[] = []
	const { holder } = makeOptTable({
		selection: { singleMode: true, hideInput: true, onSelect: (idx, node) => calls.push({ idx, checked: node.checked, isInput: true }) }
	})

	const input = inputAt(holder, 0)
	test.equal((input.parentElement as HTMLElement).style.display, 'none', 'Should hide the input cell')
	test.equal((holder.select('thead th').node() as HTMLElement).style.display, 'none', 'Should hide the matching header cell')
	trAt(holder, 1).cells[1].dispatchEvent(new Event('click', { bubbles: true }))
	test.deepEqual(calls, [{ idx: 1, checked: true, isInput: true }], 'A row click should still select')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: styles.selectedRow is applied to selected rows and removed on deselect, keeping stripes', test => {
	test.timeoutAfter(100)
	const { holder } = makeOptTable({
		selection: { selectedRows: [0] },
		styles: { selectedRow: { 'text-decoration': 'line-through', 'background-color': 'yellow' } }
	})

	test.equal(trAt(holder, 0).style.textDecoration, 'line-through', 'Preselected row should be styled')
	inputAt(holder, 1).click()
	test.equal(trAt(holder, 1).style.backgroundColor, 'yellow', 'A newly selected row should be styled')
	inputAt(holder, 1).click()
	test.equal(trAt(holder, 1).style.backgroundColor, 'rgb(245, 245, 245)', 'Deselecting should restore the stripe')
	test.equal(trAt(holder, 1).style.textDecoration, '', 'Deselecting should clear the other properties')
	inputAt(holder, 0).click()
	test.equal(trAt(holder, 0).style.backgroundColor, '', 'Deselecting an unstriped row should clear the background')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: singleMode restyles the row the radio silently unchecked', test => {
	test.timeoutAfter(100)
	const { holder } = makeOptTable({
		selection: { singleMode: true, selectedRows: [0] },
		styles: { selectedRow: { 'text-decoration': 'line-through' } }
	})

	inputAt(holder, 2).click()
	test.equal(trAt(holder, 0).style.textDecoration, '', 'The previously selected row should lose the style')
	test.equal(trAt(holder, 2).style.textDecoration, 'line-through', 'The new row should get it')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: styles.selectedRow survives sort and page redraws', test => {
	test.timeoutAfter(100)
	const { holder, table } = makePagedTable(25, 10, {
		selection: { selectedRows: [0] },
		styles: { selectedRow: { 'text-decoration': 'line-through' } }
	})

	table.goToPage(2)
	table.goToPage(1)
	test.equal(trAt(holder, 0).style.textDecoration, 'line-through', 'Should restyle the selected row when it is redrawn')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('select: autoScroll scrolls the first preselected row into view, unless disabled or selectAll', async test => {
	test.timeoutAfter(3000)
	const scrolled: string[] = []
	const original = Element.prototype.scrollIntoView
	// earlier tests also preselect rows, and their own scroll timers may fire during this one
	const mine: HTMLElement[] = []
	Element.prototype.scrollIntoView = function (this: any) {
		if (mine.some(holder => holder.contains(this))) scrolled.push(this.cells[1].textContent || '')
	} as any
	try {
		for (const selection of [{ selectedRows: [2, 0] }, { selectedRows: [1], autoScroll: false }, { selectAll: true }]) {
			mine.push(makeOptTable({ selection }).holder.node() as HTMLElement)
		}
		test.deepEqual(scrolled, [], 'Should not scroll before the delay')
		await new Promise(resolve => setTimeout(resolve, 700))
		test.deepEqual(scrolled, ['Bob'], 'Should scroll only to the first preselected row of the table that allows it')
	} finally {
		Element.prototype.scrollIntoView = original
	} 

	if ((test as any)._ok) for (const table of mine) table.remove()
	test.end()
})

function makeButtonTable(opts: Partial<ConstructorParameters<typeof TableBase>[0]> = {}) {
	const pressed: { idxs: number[]; isButton: boolean }[] = []
	const changes: number[][] = []
	const made = makeOptTable({
		buttons: [
			{
				text: 'Go',
				class: 'go-btn',
				dataTestId: 'go',
				callback: (idxs, button) => pressed.push({ idxs, isButton: button instanceof HTMLButtonElement }),
				onChange: (idxs, button) => {
					changes.push(idxs)
					button.textContent = `Go (${idxs.length})`
				}
			}
		],
		...opts
	})
	const button = made.holder.select('button[data-testid="go"]').node() as HTMLButtonElement
	return { ...made, pressed, changes, button }
}

tape('buttons: render below the table, are disabled until a row is selected, and report original indexes', test => {
	test.timeoutAfter(100)
	const { holder, table, pressed, button } = makeButtonTable()

	test.ok(button.classList.contains('go-btn'), 'Should apply the class')
	test.ok(button.disabled, 'Should start disabled with nothing selected')
	test.ok(holder.select('tbody input').size() > 0, 'Buttons alone should make rows selectable')
	const tableNode = holder.select('table').node() as HTMLElement
	test.ok(tableNode.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING, 'Should come after the table')

	table.sortByColumn(0) // Alice(1), Bob(2), Charlie(0)
	inputAt(holder, 0).click()
	inputAt(holder, 2).click()
	test.notOk(button.disabled, 'Should enable once a row is selected')
	button.click()
	test.deepEqual(pressed, [{ idxs: [0, 1], isButton: true }], 'Should pass original indexes and the button')
	inputAt(holder, 0).click()
	inputAt(holder, 2).click()
	test.ok(button.disabled, 'Should disable again when the selection is cleared')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('buttons: onChange runs on render and on every selection change, but not on sort', test => {
	test.timeoutAfter(100)
	const { holder, table, changes, button } = makeButtonTable({ selection: { selectedRows: [1] } })

	test.deepEqual(changes, [[1]], 'Should call onChange once on render with the preselection')
	test.equal(button.textContent, 'Go (1)', 'The button can reflect the preselection')
	test.notOk(button.disabled, 'Should start enabled with a preselected row')

	inputAt(holder, 0).click()
	test.deepEqual(changes.pop(), [0, 1], 'Should call onChange when a row is selected')
	table.sortByColumn(0)
	test.equal(changes.length, 1, 'Sorting does not change the selection, so no call')
	checkAll(holder).click()
	test.equal(changes.length, 2, 'Check-all should call onChange once, not once per row')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('buttons: buttonsAlign, selectAll enabling, and validation', test => {
	test.timeoutAfter(100)
	const left = makeButtonTable({ styles: { buttonsAlign: 'left' } })
	test.equal((left.holder.select('.sjpp-table-buttons').node() as HTMLElement).style.justifyContent, 'flex-start', 'Should align left')
	const right = makeButtonTable()
	test.equal((right.holder.select('.sjpp-table-buttons').node() as HTMLElement).style.justifyContent, 'flex-end', 'Should align right by default')
	const all = makeButtonTable({ selection: { selectAll: true } })
	test.notOk(all.button.disabled, 'selectAll should enable the buttons')

	const holder = getHolder()
	const make = (buttons: any) => () => new TableBase({ columns: sortFilterColumns, rows: [], div: holder, buttons })
	test.throws(make([{ callback: () => 1 }]), /text/, 'Should require button text')
	test.throws(make([{ text: 'x' }]), /callback/, 'Should require a button callback')

	if ((test as any)._ok) for (const h of [left.holder, right.holder, all.holder, holder]) h.remove()
	test.end()
})

tape('buttons: sit in the footer together with the pager', test => {
	test.timeoutAfter(100)
	const { holder } = makePagedTable(25, 10, {
		buttons: [{ text: 'Go', callback: () => 1, dataTestId: 'go' }]
	})

	const footer = holder.select('.sjpp-table-footer').node() as HTMLElement
	test.ok(footer.querySelector('.sjpp-table-pager'), 'Footer should hold the pager')
	test.ok(footer.querySelector('button[data-testid="go"]'), 'Footer should hold the buttons')
	test.equal(footer.style.position, 'sticky', 'Footer should stay in view')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('styles.header is applied to column headers', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({
		columns: testColumns,
		rows: testRows,
		div: holder,
		styles: { header: { 'font-size': '1.3em', 'background-color': 'rgb(1, 2, 3)' } }
	}).render()

	const ths = holder.selectAll('thead th').nodes() as HTMLElement[]
	test.ok(
		ths.every(th => th.style.fontSize === '1.3em' && th.style.backgroundColor === 'rgb(1, 2, 3)'),
		'Every column header should get the style'
	)

	if ((test as any)._ok) holder.remove()
	test.end()
})

/**************
 sticky header, setSelectedIndexes
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - header, programmatic selection -***-')
	test.end()
})

tape('header: the <thead> is pinned to the top of the scrolling wrapper', test => {
	test.timeoutAfter(100)
	const { holder } = makeOptTable()

	const thead = holder.select('thead').node() as HTMLElement
	test.equal(thead.style.position, 'sticky', 'Should be sticky')
	test.equal(thead.style.top, '0px', 'Should stick to the top')
	test.equal(thead.style.backgroundColor, 'white', 'Should cover the rows scrolling under it')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('setSelectedIndexes: updates the inputs, styles, check-all and buttons without calling onSelect', test => {
	test.timeoutAfter(100)
	const calls: number[] = []
	const holder = getHolder()
	const changes: number[][] = []
	const table = new TableBase({
		columns: sortFilterColumns,
		rows: makeSortFilterRows(),
		div: holder,
		selection: { onSelect: idx => calls.push(idx) },
		buttons: [{ text: 'Go', callback: () => 1, onChange: idxs => changes.push(idxs) }],
		styles: { selectedRow: { 'text-decoration': 'line-through' } }
	}).render()
	const button = holder.select('.sjpp-table-buttons button').node() as HTMLButtonElement

	table.setSelectedIndexes([0, 2])
	test.deepEqual(checkedNames(holder), ['Charlie', 'Bob'], 'Should check the rows')
	test.deepEqual(table.getSelectedIndexes(), [0, 2], 'Should report them')
	test.equal(trAt(holder, 0).style.textDecoration, 'line-through', 'Should style selected rows')
	test.ok(checkAll(holder).indeterminate, 'Should show the check-all dash')
	test.notOk(button.disabled, 'Should enable the buttons')
	test.deepEqual(changes.pop(), [0, 2], 'Should tell buttons the new selection')
	test.equal(calls.length, 0, 'Should not call onSelect')

	table.setSelectedIndexes([1])
	test.deepEqual(checkedNames(holder), ['Alice'], 'Should replace the previous selection')
	test.equal(trAt(holder, 0).style.textDecoration, '', 'Should clear the style from deselected rows')

	table.setSelectedIndexes([])
	test.deepEqual(checkedNames(holder), [], 'Should clear the selection')
	test.ok(button.disabled, 'Should disable the buttons when nothing is selected')

	table.setSelectedIndexes([99])
	test.deepEqual(table.getSelectedIndexes(), [], 'Should ignore an index that does not exist')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('setSelectedIndexes: singleMode accepts one row, and selection survives a sort', test => {
	test.timeoutAfter(100)
	const { holder, table } = makeOptTable({ selection: { singleMode: true } })

	test.throws(() => table.setSelectedIndexes([0, 1]), /only one/, 'Should reject two rows in singleMode')
	table.setSelectedIndexes([2])
	table.sortByColumn(0) // Alice, Bob, Charlie
	test.deepEqual(checkedNames(holder), ['Bob'], 'Should keep the selected row through a sort')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: sort and filter act on all rows, reset to page 1, and report it', test => {
	test.timeoutAfter(100)
	const { holder, table, changes } = makePagedTable(25, 10)
	table.goToPage(3)
	changes.length = 0

	sortViaMenu(holder, 0) // name ascending
	sortViaMenu(holder, 0) // name descending
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

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) for (const h of [holder, h2]) h.remove()
	test.end()
})

tape('page: selection and original indexes hold across pages', test => {
	test.timeoutAfter(100)
	const calls: number[] = []
	const { holder, table } = makePagedTable(25, 10, { selection: { onSelect: idx => calls.push(idx) } })

	;(holder.select('tbody input').node() as HTMLInputElement).click() // row 0
	table.goToPage(2)
	;(holder.select('tbody input').node() as HTMLInputElement).click() // row 10
	test.deepEqual(calls, [0, 10], 'Should report original indexes on later pages')
	test.deepEqual(table.getSelectedIndexes(), [0, 10], 'Should keep selections from other pages')
	table.goToPage(1)
	test.ok((holder.select('tbody input').node() as HTMLInputElement).checked, 'Should restore the checkbox when coming back')
	test.equal(holder.selectAll('tbody tr').size(), 10, 'Should show one page of rows')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('page: update(rows) paginates the rows it is given', test => {
	test.timeoutAfter(100)
	const { holder, table } = makePagedTable(25, 10)

	table.update(makePagedRows(12))
	test.equal(pageInfo(holder), 'Showing 1 to 10 of 12 entries', 'Should page the replacement rows')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('a11y: the column button is focusable, named, and announces its popup; aria-sort reports the sort', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: sortFilterColumns, rows: makeSortFilterRows(), div: holder }).render()
	const th = (i: number) => holder.selectAll('thead th').nodes()[i] as HTMLElement
	const nameTh = th(0)
	const ageTh = th(1)

	const button = nameTh.querySelector('button') as HTMLButtonElement
	test.equal(button.type, 'button', 'Should not act as a form submit button')
	test.ok(button.tabIndex >= 0, 'Should be in the tab order')
	test.equal(button.getAttribute('aria-label'), 'Sort and filter Name', 'Should name both features')
	test.equal((th(1).querySelector('button') as HTMLElement).getAttribute('aria-label'), 'Sort Age', 'Should name sort only')
	test.equal((th(2).querySelector('button') as HTMLElement).getAttribute('aria-label'), 'Filter Role', 'Should name filter only')
	test.equal(button.getAttribute('aria-haspopup'), 'true', 'Should announce a popup')
	test.equal(button.getAttribute('aria-expanded'), 'false', 'Should start collapsed')
	test.equal(nameTh.querySelector('.sjpp-table-sort-indicator')!.getAttribute('aria-hidden'), 'true', 'Should hide the decorative arrow')
	test.equal(nameTh.querySelector('.sjpp-table-filter-icon')!.getAttribute('aria-hidden'), 'true', 'Should hide the decorative filter symbol')

	test.equal(nameTh.getAttribute('aria-sort'), 'none', 'Should start unsorted')
	sortViaMenu(holder, 0)
	test.equal(nameTh.getAttribute('aria-sort'), 'ascending', 'Should report ascending')
	sortViaMenu(holder, 0)
	test.equal(nameTh.getAttribute('aria-sort'), 'descending', 'Should report descending')
	sortViaMenu(holder, 1)
	test.equal(nameTh.getAttribute('aria-sort'), 'none', 'Should reset the previous column')
	test.equal(ageTh.getAttribute('aria-sort'), 'ascending', 'Should report the new column')

	const menu = openColumnMenu(holder, 0)
	test.equal(button.getAttribute('aria-expanded'), 'true', 'Should report expanded while the popup is open')
	test.equal(button.getAttribute('aria-controls'), menu.id, 'Should point at the popup')
	test.equal(document.activeElement, menu.querySelector('input'), 'Should move focus to the filter input')
	menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	test.equal(menu.style.display, 'none', 'Escape should close the popup')
	test.equal(button.getAttribute('aria-expanded'), 'false', 'Should report collapsed again')
	test.equal(document.activeElement, button, 'Should return focus to the button')

	if ((test as any)._ok) holder.remove()
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
		(openColumnMenu(holder, 0).querySelector('input') as HTMLElement).getAttribute('aria-label'),
		'Filter Name',
		'Should give the filter input an accessible name'
	)

	sortViaMenu(holder, 0)
	test.equal(status.textContent, 'Sorted by Name, ascending', 'Should announce the sort')
	sortViaMenu(holder, 0)
	test.equal(status.textContent, 'Sorted by Name, descending', 'Should announce the toggled sort')

	typeFilter(holder, 2, 'manager')
	test.equal(status.textContent, 'Showing 1 of 3 rows', 'Should announce how many rows the filter kept')
	typeFilter(holder, 2, 'zzz')
	test.equal(status.textContent, 'Showing 0 of 3 rows', 'Should announce an empty result')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('a11y: a color-only cell has a text alternative', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	new TableBase({ columns: [{ label: 'Color' }], rows: [[{ color: '#ff0000' }]], div: holder }).render()

	test.equal(holder.select('tbody td').attr('aria-label'), '#ff0000', 'Should name the cell after its color')

	if ((test as any)._ok) holder.remove()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

/**************
 security and robustness
***************/

tape('\n', test => {
	test.comment('-***- dom/TableBase - security and robustness -***-')
	test.end()
})

tape('url: only web, mail and relative urls become links; anything else is shown as text', test => {
	test.timeoutAfter(200)
	const holder = getHolder()
	const safe = ['https://example.com/a?b=1', 'http://example.com', 'mailto:someone@example.com', '/relative/path', 'page.html']
	const unsafe = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', '  javascript:alert(1)', '\tjavascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:msgbox(1)']
	const rows: TableBaseRow[] = [...safe, ...unsafe].map(url => [{ url }])
	new TableBase({ columns: [{ label: 'Link' }], rows, div: holder }).render()
	const cells = holder.selectAll('tbody td').nodes() as HTMLElement[]

	for (const [i, url] of safe.entries()) {
		test.equal(cells[i].querySelector('a')?.getAttribute('href'), url, `Should link ${url}`)
	}
	for (const [i, url] of unsafe.entries()) {
		const cell = cells[safe.length + i]
		test.equal(cell.querySelector('a'), null, `Should not link ${JSON.stringify(url)}`)
		test.equal(cell.textContent, url, `Should still show ${JSON.stringify(url)} as text`)
	}
	test.equal(holder.selectAll('a[href^="javascript" i]').size(), 0, 'No javascript: link anywhere in the table')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('url: an unsafe url does not hide the cell value, html or color', test => {
	test.timeoutAfter(200)
	const holder = getHolder()
	const rows: TableBaseRow[] = [
		[{ url: 'javascript:alert(1)', value: 'label' }],
		[{ url: 'javascript:alert(1)', html: '<b>bold</b>' }],
		[{ url: 'javascript:alert(1)', color: '#00ff00' }]
	]
	new TableBase({ columns: [{ label: 'Link' }], rows, div: holder }).render()
	const cells = holder.selectAll('tbody td').nodes() as HTMLElement[]

	test.equal(cells[0].textContent, 'label', 'Should show the value')
	test.equal(cells[1].innerHTML, '<b>bold</b>', 'Should show the html')
	test.equal(cells[2].style.backgroundColor, 'rgb(0, 255, 0)', 'Should show the color')
	test.equal(holder.selectAll('a').size(), 0, 'None should be links')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('filter: a very long numeric-looking filter is truncated and does not hang', test => {
	test.timeoutAfter(2000)
	const holder = getHolder()
	const table = new TableBase({
		columns: [{ label: 'Name', filterable: true }, { label: 'Age', filterable: true }],
		rows: makeSortFilterRows().map(r => [r[0], r[1]]),
		div: holder
	}).render()

	for (const hostile of ['>' + '1'.repeat(200000) + 'x', '1'.repeat(200000) + '-' + '1'.repeat(200000) + 'x', '-'.repeat(200000)]) {
		const start = performance.now()
		table.setColumnFilter(1, hostile)
		test.ok(performance.now() - start < 500, `Should return promptly for a ${hostile.length}-character filter`)
	}
	const input = openColumnMenu(holder, 1).querySelector('input') as HTMLInputElement
	test.equal(input.getAttribute('maxlength'), '100', 'The input should cap the length')
	test.ok(input.value.length <= 100, 'The kept filter text should be capped')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('styles: maxWidth and maxHeight size the wrapper, with defaults', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows: TableBaseRow[] = [[{ value: 'x' }]]
	const custom = new TableBase({ columns: [{ label: 'A' }], rows, div: holder, styles: { maxWidth: '300px', maxHeight: '120px' } }).render()
	const wrapper = holder.select('.sjpp-table-base').node() as HTMLElement
	test.equal(wrapper.style.maxWidth, '300px', 'Should apply maxWidth')
	test.equal(wrapper.style.maxHeight, '120px', 'Should apply maxHeight')

	custom.remove()
	new TableBase({ columns: [{ label: 'A' }], rows, div: holder }).render()
	const defaults = holder.select('.sjpp-table-base').node() as HTMLElement
	test.equal(defaults.style.maxWidth, '90vw', 'Default maxWidth is 90vw')
	test.equal(defaults.style.maxHeight, '40vh', 'Default maxHeight is 40vh')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('cells and headers: data-testid, tooltip and __td', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const columns: TableBaseColumn[] = [{ label: 'A', headerTestId: 'hdr-a', tooltip: 'about A' }]
	const rows: TableBaseRow[] = [[{ value: 'x', dataTestId: 'cell-x' }]]
	new TableBase({ columns, rows, div: holder }).render()

	const th = holder.select('thead th').node() as HTMLElement
	test.equal(th.getAttribute('data-testid'), 'hdr-a', 'Should set headerTestId')
	test.equal(th.getAttribute('title'), 'about A', 'Should set the tooltip')
	test.equal(holder.select('tbody td').attr('data-testid'), 'cell-x', 'Should set the cell dataTestId')
	test.equal(rows[0][0].__td?.node(), holder.select('tbody td').node(), 'Should attach the rendered <td> to the cell')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('sort: missing values keep their place, and a column of mixed types does not throw', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows: TableBaseRow[] = [[{ value: 'b' }], [{}], [{ value: 'a' }], [{ value: 3 }]]
	const table = new TableBase({ columns: [{ label: 'V', sortable: true }], rows, div: holder }).render()

	test.doesNotThrow(() => table.sortByColumn(0, true), 'Ascending should not throw')
	test.doesNotThrow(() => table.sortByColumn(0, false), 'Descending should not throw')
	test.equal(holder.selectAll('tbody tr').size(), 4, 'No row should be lost')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('filter: a url-only cell is matched on its url', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const rows: TableBaseRow[] = [[{ url: 'https://alpha.example.com' }], [{ url: 'https://beta.example.com' }]]
	new TableBase({ columns: [{ label: 'Link', filterable: true }], rows, div: holder }).render()

	typeFilter(holder, 0, 'beta')
	test.equal(holder.selectAll('tbody tr').size(), 1, 'Should keep only the matching url')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('pagination: goToPage() and setPageSize() are harmless without pagination or with a bad size', test => {
	test.timeoutAfter(100)
	const plain = getHolder()
	const noPaging = new TableBase({ columns: pagedColumns, rows: makePagedRows(12), div: plain }).render()
	noPaging.goToPage(2).setPageSize(5)
	test.equal(plain.selectAll('tbody tr').size(), 12, 'Should ignore both without pagination')

	const { holder, table, changes } = makePagedTable(25, 10)
	for (const bad of [0, -3, 2.5, NaN, 10]) table.setPageSize(bad)
	test.equal(pageInfo(holder), 'Showing 1 to 10 of 25 entries', 'Should ignore invalid and unchanged sizes')
	test.equal(changes.length, 0, 'Should not call onChange for them')

	if ((test as any)._ok) for (const h of [plain, holder]) h.remove()
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
	test.deepEqual(indicators, ['▲', '⇅'], 'Should restore the sort indicator')
	const input = openColumnMenu(holder, 2).querySelector('input') as HTMLInputElement
	test.equal(input.value, 'engineer', 'Should restore the filter text')
	test.ok(holder.select('.sjpp-table-filter-icon.sjpp-table-filter-active').node(), 'Should restore the active filter symbol')

	if ((test as any)._ok) holder.remove()
	test.end()
})
