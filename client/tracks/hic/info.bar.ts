import { Elem } from '../../types/d3'
import { scaleLinear } from 'd3-scale'

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
	addValue(hic.enzyme || 'None')

	//Text dynamically updates from hic.straw and controls.whole.genome
	addLabel('Resolution')
	self.dom.infoBarDiv.resolution = valueRow.append('td').append('span').style('text-align', 'center')

	//Color scale
	addLabel('Scale')
	const colorScale = valueRow.append('td')
	makecolorScale(colorScale, self)

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

function makecolorScale(td: Elem, self: any) {
	const barheight = 14
	const space = 1
	self.colorScale.barwidth = 100

	const scaleSvg = td.append('svg').attr('width', 100).attr('height', 20)
	self.colorScale.g = scaleSvg.append('g').attr('transform', 'translate(0, 0)')

	const defs = self.colorScale.g.append('defs')
	const id = Math.random().toString()
	const gradient = defs.append('linearGradient').attr('id', id)
	//Anticipating implementing a color picker in the future
	self.colorScale.gradientStart = gradient.append('stop').attr('offset', 0).attr('stop-color', self.colorScale.negative)
	self.colorScale.gradientStop = gradient.append('stop').attr('offset', 1).attr('stop-color', self.colorScale.positive)

	self.colorScale.bar = self.colorScale.g
		.append('rect')
		.attr('height', barheight)
		.attr('width', self.colorScale.barwidth)
		.attr('fill', 'url(#' + id + ')')
	self.colorScale.axisg = self.colorScale.g.append('g').attr('transform', 'translate(0,' + (barheight + space) + ')')
	self.colorScale.scale = scaleLinear().range([0, self.colorScale.barwidth])

	// min cutoff indicator
	self.colorScale.tick_mincutoff = self.colorScale.g
		.append('line')
		.attr('y1', barheight + space - 3)
		.attr('y2', barheight + space)
	self.colorScale.label_mincutoff = self.colorScale.g
		.append('text')
		.attr('text-anchor', 'middle')
		.attr('font-size', '1em')
		.attr('y', barheight + space - 4)
}

export function updateColorScale(hic: any, self: any, view: any) {
	self.colorScale.gradientStart.attr('stop-color', self.colorScale.negative)
	self.colorScale.gradientStop.attr('stop-color', self.colorScale.positive)
}
