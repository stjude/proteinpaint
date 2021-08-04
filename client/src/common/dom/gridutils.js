/*
********************** EXPORTED
get_list_cells
get_table_header
get_table_cell

basic utility functions for getting grid related divs for table/list view
*/

// for single sample list of metadata,
// this function will give label and value cells with underline at bottom
export function get_list_cells(holder) {
	return [
		holder
			.append('div')
			.style('width', '100%')
			.style('padding', '5px 20px 5px 0px')
			.style('color', '#bbb')
			.style('border-bottom', 'solid 1px #ededed'),
		holder
			.append('div')
			.style('width', '100%')
			.style('border-bottom', 'solid 1px #ededed')
			.style('padding', '5px 20px 5px 0px')
	]
}

// for table view, this function will give cells for header
export function get_table_header(table, title_text) {
	return table
		.append('div')
		.style('opacity', 0.5)
		.style('font-size', '.8em')
		.style('padding', '2px 5px')
		.text(title_text)
}

// for table view, this function will give row cells
// with alternative rows with white and light gray background
export function get_table_cell(table, row_id) {
	return table
		.append('div')
		.style('justify-self', 'stretch')
		.style('height', '100%')
		.style('padding', '2px 5px')
		.style('background-color', row_id % 2 == 0 ? '#eee' : '#fff')
}
