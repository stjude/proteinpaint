import { renderTable } from '#dom'

/** If wilcoxon test results are available, render the association table */
export class AssociationTableRender {
	constructor(div, data) {
		const wrapper = div.style('vertical-align', 'top').style('margin-top', '30px')

		//Title div
		wrapper
			.append('div')
			.text("Group comparisons (Wilcoxon's rank sum test)")
			.style('font-weight', '600')
			.style('text-align', 'center')

		const tableDiv = wrapper.append('div').style('margin-top', '5px')
		renderTable({
			div: tableDiv,
			columns: [{ label: 'Group 1' }, { label: 'Group 2' }, { label: 'P-Value' }],
			rows: data
		})
	}
}
