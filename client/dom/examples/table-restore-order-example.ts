/**
 * Example demonstrating the allowRestoreRowOrder feature in the table component
 * 
 * This example shows how to use the new allowRestoreRowOrder parameter
 * which allows users to restore the original row order after sorting.
 */

import { renderTable } from '../table'
import { select } from 'd3-selection'

// Example 1: Basic usage with restore button
export function exampleBasicRestore() {
	const container = select('body').append('div')
	
	const columns = [
		{ label: 'Name', sortable: true },
		{ label: 'Age', sortable: true },
		{ label: 'Department', sortable: true }
	]
	
	const rows = [
		[{ value: 'Alice Johnson' }, { value: 30 }, { value: 'Engineering' }],
		[{ value: 'Bob Smith' }, { value: 25 }, { value: 'Design' }],
		[{ value: 'Charlie Brown' }, { value: 35 }, { value: 'Management' }],
		[{ value: 'Diana Prince' }, { value: 28 }, { value: 'Product' }],
		[{ value: 'Eve Adams' }, { value: 32 }, { value: 'Marketing' }]
	]
	
	renderTable({
		div: container,
		columns,
		rows,
		header: { allowSort: true },
		allowRestoreRowOrder: true,  // Enable the restore button
		showLines: true,
		striped: true
	})
	
	return container
}

// Example 2: Without restore button (standard behavior)
export function exampleWithoutRestore() {
	const container = select('body').append('div')
	
	const columns = [
		{ label: 'Product', sortable: true },
		{ label: 'Price', sortable: true },
		{ label: 'Stock', sortable: true }
	]
	
	const rows = [
		[{ value: 'Laptop' }, { value: 999 }, { value: 50 }],
		[{ value: 'Mouse' }, { value: 25 }, { value: 200 }],
		[{ value: 'Keyboard' }, { value: 75 }, { value: 150 }],
		[{ value: 'Monitor' }, { value: 350 }, { value: 80 }]
	]
	
	renderTable({
		div: container,
		columns,
		rows,
		header: { allowSort: true },
		allowRestoreRowOrder: false,  // No restore button
		showLines: true,
		striped: true
	})
	
	return container
}

// Example 3: Error case - will throw an error because no columns are sortable
export function exampleInvalidUsage() {
	const container = select('body').append('div')
	
	const columns = [
		{ label: 'Name' },  // Not sortable
		{ label: 'Email' }  // Not sortable
	]
	
	const rows = [
		[{ value: 'John Doe' }, { value: 'john@example.com' }]
	]
	
	try {
		renderTable({
			div: container,
			columns,
			rows,
			allowRestoreRowOrder: true  // This will throw an error!
		})
	} catch (error) {
		console.error('Expected error:', error)
		container.append('p')
			.style('color', 'red')
			.text(`Error: ${error}`)
	}
	
	return container
}

/**
 * Usage Instructions:
 * 
 * 1. The allowRestoreRowOrder parameter is optional and defaults to false
 * 2. When set to true, it will:
 *    - Validate that at least one column has sortable: true
 *    - Show a "Restore row order" button after the user sorts the table
 *    - Hide the button when the original order is restored
 * 3. The restore button will appear next to the table after sorting
 * 4. Clicking the restore button will:
 *    - Restore the original row order
 *    - Maintain any row selections
 *    - Hide the restore button
 * 
 * Requirements:
 * - Must set header.allowSort to true for sort buttons to appear
 * - At least one column must have sortable: true
 * - The parameter can only be set to true when sortable columns exist
 */
