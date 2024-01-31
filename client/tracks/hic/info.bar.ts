import { ColorScale } from '../../dom/colorScale'

/**
********* EXPORTED *********
init_hicInfoBar()

********* INTERNAL *********


see function documentation for more details
 */

/**
 * Initializes the info bar above hic plots
 * @param hic formatted hic object with defaults
 * @param self app object
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

	//Display version
	addLabel('Version')
	addValue(hic.version)

	addLabel('Enzyme')
	addValue(hic.enzyme || 'N/A')

	//Text dynamically updates from hic.straw and controls.whole.genome
	addLabel('Resolution')
	self.dom.infoBarDiv.resolution = valueRow.append('td').append('span').style('text-align', 'center')

	//Color scale
	addLabel('Scale')
	const colorScaleDiv = valueRow
		.append('td')
		.style('display', 'flex')
		.style('justify-content', 'center')
		.style('align-items', 'center')
	self.colorScale = new ColorScale({
		barheight: 10,
		barwidth: 85,
		holder: colorScaleDiv
		// tickPosition: 'bottom',
		// ticks: 1
	})
	self.colorScale.render()

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
