import { scaleLinear } from 'd3-scale'

/** TODO, clean this up */
export class ViewModel {
	config: any
	data: any
	settings: any
	viewData: any
	readonly topPad = 40
	readonly rightPad = 60
	readonly bottomPad = 40
	constructor(config, data, settings, variableTwLst) {
		/** Test data for development until the server code is ready
		 * Will remove
		 */
		data.variableItems = [
			{
				tw$id: 'TDQWmvitw0gPLX7I9iWYAVcgJG4-',
				correlation: 0.5,
				pvalue: 0.025,
				sampleSize: 1
			},
			{
				tw$id: '0idPJ69kmHlL5kcaEBOlZmKmasg-',
				correlation: -0.5,
				pvalue: 0.002,
				sampleSize: 2
			}
		]
		const absYMax = data.variableItems.sort((a, b) => b.pvalue - a.pvalue)[0].pvalue
		const plotDim = this.setPlotDimensions(settings, absYMax)

		this.viewData = {
			plotDim,
			variableItems: this.setVariablesData(data, variableTwLst, plotDim)
		}
	}

	setPlotDimensions(settings, absYMax: number) {
		return {
			svg: {
				height: settings.height + this.topPad + this.bottomPad,
				width: settings.width + this.rightPad
			},
			xScale: {
				scale: scaleLinear().domain([-1, 1]).range([0, settings.width]),
				x: this.rightPad,
				y: settings.height + this.topPad
			},
			yScale: {
				scale: scaleLinear().domain([0, absYMax]).range([settings.height, 0]),
				x: this.rightPad,
				y: this.topPad
			}
		}
	}

	setVariablesData(data, variableTwLst, plotDim) {
		for (const v of data.variableItems) {
			v.color = v.correlation > 0 ? 'blue' : 'red'
			v.label = variableTwLst.find(t => t.$id == v.tw$id).term.name
			v.x = plotDim.xScale.scale(v.correlation) + this.rightPad
			v.y = plotDim.yScale.scale(v.pvalue) + this.topPad

			console.log(v)
		}
		return data.variableItems
	}
}
