import { Elem } from '../../types/d3'

/**
********* EXPORTED *********
init_hicInfoBar()

********* INTERNAL *********


see function documentation for more details
 */

export function init_hicInfoBar(hic: any, self: any) {
	const wrapper = self.dom.infoBarDiv
		// .style('background', 'rgb(253, 250, 244)')
		.style('vertical-align', 'top')
		.style('padding', '5px')
		.style('border', 'solid 0.5px #ccc')

	const table = wrapper.append('table').style('border-spacing', '3px')
	const labelRow = table.append('tr')
	const valueRow = table.append('tr')

	//Display verion
	addLabel('Version')
	addValue(hic.version)

	if (hic.enzyme) {
		addLabel('Enzyme')
		addValue(hic.enzyme)
	}

	//Text dynamically updates from hic.straw and controls.whole.genome
	addLabel('Resolution')
	self.dom.infoBarDiv.resolution = valueRow.append('td').append('span').style('text-align', 'center')

	function addLabel(text: string) {
		return labelRow
			.append('td')
			.style('color', '#858585')
			.style('font-size', '.8em')
			.style('text-align', 'center')
			.style('vertical-align', 'middle')
			.text(text.toUpperCase())
	}

	function addValue(text: string | number) {
		return valueRow
			.append('td')
			.style('font-size', '1em')
			.style('text-align', 'center')
			.style('vertical-align', 'middle')
			.text(text)
	}
}
