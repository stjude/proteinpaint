import type { TermWrapper } from '#types'
import { scaleLinear, scaleLog } from 'd3-scale'
import type { CorrVolcanoSettings } from '../CorrelationVolcano'

export type ViewData = {
	plotDim: any
	variableItems: any
}

/** TODO, clean this up */
export class ViewModel {
	// config: any
	// data: any
	// settings: CorrVolcanoSettings
	viewData: ViewData
	readonly topPad = 40
	/** Only one side, left or right */
	readonly horizPad = 70
	readonly bottomPad = 20
	constructor(config, data, settings: CorrVolcanoSettings, variableTwLst: TermWrapper[]) {
		/** Test data for development until the server code is ready
		 * Will remove
		 */
		data.variableItems = [
			{
				tw$id: 'TDQWmvitw0gPLX7I9iWYAVcgJG4-', //pragma: allowlist secret
				correlation: 0.5,
				pvalue: 0.025,
				sampleSize: 1
			},
			{
				tw$id: '0idPJ69kmHlL5kcaEBOlZmKmasg-', //pragma: allowlist secret
				correlation: -0.5,
				pvalue: 0.002,
				sampleSize: 2
			}
		]
		const sortedValues = data.variableItems.map(v => v.pvalue).sort((a, b) => a - b)
		const absYMax = sortedValues[sortedValues.length - 1]
		const absYMin = sortedValues[0]
		const plotDim = this.setPlotDimensions(config, settings, absYMax, absYMin)

		this.viewData = {
			plotDim,
			variableItems: this.setVariablesData(data, variableTwLst, plotDim)
		}
	}

	setPlotDimensions(config, settings, absYMax: number, absYMin: number) {
		return {
			svg: {
				height: settings.height + this.topPad + this.bottomPad,
				width: settings.width + this.horizPad * 2
			},
			title: {
				text: config.featureTw.term.name,
				x: this.horizPad + settings.width / 2,
				y: this.topPad / 2
			},
			yAxisLabel: {
				text: '-log10(pvalue)',
				x: this.horizPad / 3,
				y: this.topPad + settings.height / 2
			},
			xScale: {
				scale: scaleLinear().domain([-1, 1]).range([0, settings.width]),
				x: this.horizPad,
				y: settings.height + this.topPad
			},
			yScale: {
				scale: scaleLog().domain([absYMin, absYMax]).range([settings.height, 0]),
				x: this.horizPad,
				y: this.topPad
			},
			divideLine: {
				x: this.horizPad + settings.width / 2,
				y1: settings.height + this.topPad,
				y2: this.topPad
			}
		}
	}

	setVariablesData(data, variableTwLst, plotDim) {
		for (const item of data.variableItems) {
			item.color = item.correlation > 0 ? 'blue' : 'red'
			item.label = variableTwLst.find(t => t.$id == item.tw$id).term.name
			item.x = plotDim.xScale.scale(item.correlation) + this.horizPad
			item.y = plotDim.yScale.scale(item.pvalue) + this.topPad
		}
		return data.variableItems
	}
}
