export async function renderTable({ columns, rows, div }) {
	// columns is an Array of a number of elements that contains attribute 'label' that contains objects such as Sample, Access, Disease type, Primary site, Project id...etc'
	// columns will make the header row.
	// rows comprises an array of elements and each element is a sample/case.

	// columns length is 1 less than the original column.length to support the width for the last column because of difference in information in different datasets
	const numColumns = columns.length - 1

	// create a Parent Div element to which the header and sample grid will be appended as divH and divS.
	const ParentDiv = div
		.append('div')
		.style('overflow', 'auto')
		.style('scrollbar-width', 'none')
		.style('max-height', '30vw')
		.style('max-width', '70vw')
		.style('background-color', 'white')
	// .style('border', '2px outset black')

	// header div
	const divH = ParentDiv.append('div')
		.attr('class', 'grid-container')
		.style('grid-template-columns', `2vw repeat(${numColumns}, 0.5fr) 1fr`)
		.style('position', 'sticky')
		.style('z-index', '2')
	// .style('border', '2px outset black')

	// sample div
	const divS = ParentDiv.append('div').style('position', 'relative')
	// .style('z-index', '1')
	// .style('border', '2px outset red')

	// append empty div element to header to adjust columns
	divH.append('div').attr('header-container')

	// header values
	for (const c of columns) {
		divH
			.append('div')
			.text(c.label)
			.style('font-family', 'Arial')
			.style('font-size', '1em')
			.style('opacity', 0.5)
	}

	// sample values
	// iterate over each row in rows and create a div for each row that has a grid layout similar to the header grid.
	for (const [i, row] of rows.entries()) {
		const rowGrid = divS
			.append('div')
			.attr('class', 'grid-container')
			.style('grid-template-columns', `2vw repeat(${numColumns}, 0.5fr) 1fr`)
			.text(i + 1)
			.style('font-size', '1em')
			.style('align-items', 'center')
			// .style('border', '2px outset green')
			.style('transition', '0.4s')
		// .style('z-index', '3')

		// each row comprises of cell and each cell has values that will get appended to div elements of the rowGrid stored in td.
		for (const [colIdx, cell] of row.entries()) {
			const td = rowGrid
				.append('div')
				.style('display', 'flex')
				.style('word-break', 'break-word')
				.style('padding', '1px')
			// .style('align-items', 'center')

			// if index of each row is even then the background of that row should be grey and also add hovering in yellow.
			rowGrid
				.style('background-color', i % 2 == 0 ? 'rgb(237, 237, 237)' : 'white')
				.on('mouseover', () => rowGrid.style('background-color', '#fcfcca'))
				.on('mouseout', () => rowGrid.style('background-color', i % 2 == 0 ? 'rgb(237, 237, 237)' : 'white'))

			// if cell has values then append those values in new divs on td which is stored in d.
			if (cell.values) {
				for (const v of cell.values) {
					const d = td.append('div')

					// if those values have url in them then tag it to the sample name/id otherwise just append the value of that cell onto the div
					if (v.url) {
						d.append('a')
							.text(v.value)
							.attr('href', v.url)
							.attr('target', '_blank')
					} else if (v.html) {
						d.html(v.html)
					} else {
						d.text(v.value)
					}
				}
			} else if (cell.url) {
				td.append('a')
					.text(cell.value)
					.attr('href', cell.url)
					.attr('target', '_blank')
			} else if (cell.html) {
				td.html(cell.html)
			} else if (cell.value) {
				td.text(cell.value)
			}
		}
	}
}
