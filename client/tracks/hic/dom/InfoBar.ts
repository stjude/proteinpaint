import { ColorScale } from '../../../dom/colorScale'
import { Tr } from '../../../types/d3'
import { bplen } from '../../../shared/common'

export class InfoBar {
	type: 'infoBar'
	app: any
	hic: any
	labelRow: Tr
	valueRow: Tr
	parent: any
	resolution: number

	resolutionDiv: any
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
		const table = opts.infoBarDiv
		this.labelRow = table.append('tr')
		this.valueRow = table.append('tr')
		this.parent = opts.parent
		this.resolution = opts.resolution
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

	async render() {
		this.addLabel('Version')
		this.addValue(this.hic.version)

		this.addLabel('Enzyme')
		this.addValue(this.hic.enzyme || 'N/A')

		this.addLabel('Resolution')
		//Text dynamically updates from state in main()
		this.resolutionDiv = this.addValue('')

		//Color scale appears dynamically based on the state
		//Eventually this can be used in tandem with a color picker
		this.colorScaleLabel = this.addLabel('Scale')
		this.colorScaleDiv = this.valueRow.append('td')

		//TODO: Include upper line to show min cutoff when min < 0
		this.colorScale = new ColorScale({
			barheight: 14,
			barwidth: 85,
			data: [this.parent('min'), this.parent('max')],
			fontSize: 12,
			height: 35,
			width: 120,
			holder: this.colorScaleDiv,
			startColor: this.startColor,
			endColor: this.endColor,
			position: '20,0',
			ticks: 2,
			tickPosition: 'bottom',
			tickSize: 3
		})
		await this.colorScale.render()
		this.update()
	}

	update() {
		const res = this.parent('calcResolution') || this.resolution
		let resolutionText: string
		if (res < Math.min(this.hic.bpresolution)) {
			resolutionText = `${res} fragment${res > 1 ? 's' : ''}`
		} else {
			resolutionText = bplen(res)
		}
		this.resolutionDiv.text(resolutionText)
		if (this.parent('state').currView == 'horizontal') {
			this.colorScaleLabel.style('display', 'none')
			this.colorScaleDiv.style('display', 'none')
		} else {
			this.colorScaleLabel.style('display', '')
			this.colorScaleDiv.style('display', '')

			const min = this.parent('min')
			const max = this.parent('max')

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
