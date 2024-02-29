import { ColorScale } from '../../../dom/colorScale'
import { getCompInit } from '#rx'
import { Tr } from '../../../types/d3'
import { bplen } from '#shared/common'

export class InfoBar {
	type: 'infoBar'
	app: any
	hic: any
	state: any
	labelRow: Tr
	valueRow: Tr

	resolution: any
	colorScaleLabel: any
	colorScaleDiv: any
	colorScale: any

	/** Defaults **/
	//Color shown on the left of the color scale
	startColor = 'white'
	//Color shown on the right of the color scale
	endColor = 'red'

	constructor(opts) {
		this.type = 'infoBar'
		this.app = opts.app
		this.hic = opts.hic
		this.state = opts.state
		const table = opts.infoBarDiv
		this.labelRow = table.append('tr')
		this.valueRow = table.append('tr')
	}

	addLabel = (text: string) => {
		return this.labelRow
			.append('td')
			.style('color', '#858585')
			.style('font-size', '.8em')
			.style('text-align', 'center')
			.style('vertical-align', 'middle')
			.text(text.toUpperCase())
	}

	addValue = (text: string | number) => {
		return this.valueRow
			.append('td')
			.style('font-size', '1em')
			.style('text-align', 'center')
			.style('vertical-align', 'middle')
			.text(text)
	}

	async init() {
		this.addLabel('Version')
		this.addValue(this.hic.version)

		this.addLabel('Enzyme')
		this.addValue(this.hic.enzyme || 'N/A')

		this.addLabel('Resolution')
		//Text dynamically updates from state in main()
		this.resolution = this.addValue('')

		//Color scale appears dynamically based on the state
		//Eventually this can be used in tandem with a color picker
		this.colorScaleLabel = this.addLabel('Scale')
		this.colorScaleDiv = this.valueRow.append('td')

		//TODO: Include upper line to show min cutoff when min < 0
		this.colorScale = new ColorScale({
			barheight: 10,
			barwidth: 85,
			holder: this.colorScaleDiv,
			startColor: this.startColor,
			endColor: this.endColor,
			position: '20,0',
			tickPosition: 'bottom',
			ticks: 2,
			width: 120
		})
		await this.colorScale.render()
	}

	async main() {
		//need to account for fragments in detail view later
		const resolutionText = bplen(this.state[this.state.currView].resolution)
		this.resolution.text(`${resolutionText} bp`)
		if (this.state.currView == 'horizontal') {
			this.colorScaleLabel.style('display', 'none')
			this.colorScaleDiv.style('display', 'none')
		} else {
			this.colorScaleLabel.style('display', '')
			this.colorScaleDiv.style('display', '')

			const min = this.state[this.state.currView].min
			const max = this.state[this.state.currView].max

			if (min < 0) {
				this.colorScale.bar.startColor = 'blue'
				this.colorScale.data = [min, max]
			} else {
				this.colorScale.bar.startColor = 'white'
				this.colorScale.data = [0, max]
			}

			this.colorScale.updateScale()
		}
	}
}

export const infoBarInit = getCompInit(InfoBar)

// /**
// ********* EXPORTED *********
// init_hicInfoBar()

// ********* INTERNAL *********

// see function documentation for more details
//  */

// /**
//  * Initializes the info bar above hic plots
//  * @param hic formatted hic object with defaults
//  * @param self app object
//  */
// export async function init_hicInfoBar(hic: any, self: any) {
// 	const wrapper = self.dom.infoBarDiv
// 		// .style('background', 'rgb(253, 250, 244)')
// 		.style('vertical-align', 'top')
// 		.style('padding', '5px')
// 		.style('border', 'solid 0.5px #ccc')

// 	const table = wrapper.append('table').style('border-spacing', '3px')
// 	const labelRow = table.append('tr')
// 	const valueRow = table.append('tr')

// 	//Display version
// 	addLabel('Version')
// 	addValue(hic.version)

// 	addLabel('Enzyme')
// 	addValue(hic.enzyme || 'N/A')

// 	//Text dynamically updates from hic.straw and controls.whole.genome
// 	addLabel('Resolution')
// 	self.dom.infoBarDiv.resolution = valueRow.append('td').append('span').style('text-align', 'center')

// 	//Color scale
// 	self.dom.infoBarDiv.colorScaleLabel = addLabel('Scale')
// 	self.dom.infoBarDiv.colorScaleDiv = valueRow.append('td')

// 	self.colorScale = new ColorScale({
// 		barheight: 10,
// 		barwidth: 85,
// 		holder: self.dom.infoBarDiv.colorScaleDiv,
// 		startColor: self.colorBar.startColor,
// 		endColor: self.colorBar.endColor,
// 		position: '20,0',
// 		tickPosition: 'bottom',
// 		ticks: 2,
// 		width: 120
// 	})
// 	await self.colorScale.render()

// 	function addLabel(text: string) {
// 		return labelRow
// 			.append('td')
// 			.style('color', '#858585')
// 			.style('font-size', '.8em')
// 			.style('text-align', 'center')
// 			.style('vertical-align', 'middle')
// 			.text(text.toUpperCase())
// 	}

// 	function addValue(text: string | number) {
// 		return valueRow
// 			.append('td')
// 			.style('font-size', '1em')
// 			.style('text-align', 'center')
// 			.style('vertical-align', 'middle')
// 			.text(text)
// 	}
// }
