/** TODO, clean this up */
export class ViewModel {
	config: any
	data: any
	settings: any
	viewData: any
	constructor(config, data, settings, variableTwLst) {
		const plotDim = this.setPlotDimensions(data, config, settings)

		this.viewData = {
			plotDim: this.setPlotDimensions(data, config, settings),
			variables: this.setVariablesData(data, config, settings, variableTwLst)
		}
	}

	setPlotDimensions(data, config, settings) {
		const plotDim = {
			svg: {
				height: settings.height,
				width: settings.width
			},
			xDomain: [-1, 1],
			xRange: [0, settings.width]
		}
	}

	setVariablesData(data, config, settings, variableTwLst) {
		for (const v of data.variables) {
			v.color = v.correlation > 0 ? 'blue' : 'red'
			v.label = variableTwLst.find(t => t.$id == v.tw$id).term.name
		}
	}
}
