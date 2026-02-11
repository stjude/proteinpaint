import tape from 'tape'
import * as d3s from 'd3-selection'
import { renderTable } from '../table'

/**************
 helper functions
***************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/table - allowRestoreRowOrder -***-')
	test.end()
})

tape('allowRestoreRowOrder: validate it requires sortable column', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any

	const columns = [
		{ label: 'Name' },
		{ label: 'Age' },
		{ label: 'Role' }
	]

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
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('allowRestoreRowOrder: table renders without error when columns are sortable', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any

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
		const restoreButton = holder.selectAll('button').filter(function (this: any) {
			return d3s.select(this).text() === 'Restore row order'
		})
		test.equal(restoreButton.size(), 1, 'Should create a "Restore row order" button')

		const buttonDiv = d3s.select(restoreButton.node().parentNode)
		test.equal(buttonDiv.style('display'), 'none', 'Restore button should be hidden initially')
	} catch (e: any) {
		test.fail(`Should not throw error: ${e.message || e}`)
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('allowRestoreRowOrder: restore button shows after sorting', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any

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
	const restoreButton = holder.selectAll('button').filter(function (this: any) {
		return d3s.select(this).text() === 'Restore row order'
	})

	// Get the sort button for the Name column
	const sortButtons = holder.selectAll('.sjpp-table-sort-button')
	test.true(sortButtons.size() >= 1, 'Should have at least one sort button')

	// Click the sort button
	const firstSortButton = sortButtons.node()
	if (firstSortButton) {
		const svgElement = d3s.select(firstSortButton).select('svg')
		if (!svgElement.empty()) {
			svgElement.dispatch('click')
		}

		// Check if restore button is now visible
		const buttonDiv = d3s.select(restoreButton.node().parentNode)
		test.equal(buttonDiv.style('display'), 'inline-block', 'Restore button should be visible after sorting')
	} else {
		test.fail('Sort button not found')
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('allowRestoreRowOrder: restore button restores original order and hides', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any

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
			.map((tr: any) => {
				return d3s.select(tr).select('td:nth-child(3)').text() // Get name from 3rd column (after line number and checkbox)
			})
	}

	const originalOrder = getTableRowValues()
	test.deepEqual(originalOrder, ['Charlie', 'Alice', 'Bob'], 'Initial order should match input')

	// Click sort button to sort
	const sortButtons = holder.selectAll('.sjpp-table-sort-button')
	if (sortButtons.size() > 0) {
		const firstSortButton = sortButtons.node()
		const svgElement = d3s.select(firstSortButton).select('svg')
		svgElement.dispatch('click')

		// Verify order changed after sorting
		const sortedOrder = getTableRowValues()
		test.notDeepEqual(sortedOrder, originalOrder, 'Order should change after sorting')

		// Click restore button
		const restoreButton = holder.selectAll('button').filter(function (this: any) {
			return d3s.select(this).text() === 'Restore row order'
		})

		if (!restoreButton.empty()) {
			restoreButton.dispatch('click')

			// Check that order is restored
			const restoredOrder = getTableRowValues()
			test.deepEqual(restoredOrder, originalOrder, 'Order should be restored to original')

			// Check that restore button is hidden again
			const buttonDiv = d3s.select(restoreButton.node().parentNode)
			test.equal(buttonDiv.style('display'), 'none', 'Restore button should be hidden after restoring')
		} else {
			test.fail('Restore button not found')
		}
	} else {
		test.fail('Sort button not found')
	}

	if (test['_ok']) holder.remove()
	test.end()
})
