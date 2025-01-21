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
		const [absYMax, absYMin] = this.setMinMax(data, settings.isAdjustedPValue ? 'adjusted_pvalue' : 'original_pvalue')
		const [absXMax, absXMin] = this.setMinMax(data, 'correlation')
		const [absSampleMax, absSampleMin] = this.setMinMax(data, 'sampleSize')

		const plotDim = this.setPlotDimensions(config, settings, absYMax, absYMin, absXMax, absXMin)

		this.viewData = {
			plotDim,
			variableItems: this.setVariablesData(
				data,
				variableTwLst,
				plotDim,
				settings.isAdjustedPValue,
				absSampleMax,
				absSampleMin
			)
		}
	}

	setMinMax(data, key) {
		const sortedValues = data.variableItems.map(v => v[key]).sort((a, b) => a - b)
		const max = sortedValues[sortedValues.length - 1]
		const min = sortedValues[0]
		return [max, min]
	}

	setPlotDimensions(config, settings, absYMax: number, absYMin: number, absXMax: number, absXMin: number) {
		const xScale = scaleLinear().domain([absXMin, absXMax]).range([0, settings.width])
		return {
			svg: {
				height: settings.height + this.topPad + this.bottomPad,
				width: settings.width + this.horizPad * 2
			},
			title: {
				text: this.getReadableType(config.featureTw.term.type),
				x: this.horizPad + settings.width / 2,
				y: this.topPad / 2
			},
			yAxisLabel: {
				//TODO: If this never changes, move to View
				text: 'Correlation Coefficient',
				x: this.horizPad / 3,
				y: this.topPad + settings.height / 2
			},
			xScale: {
				scale: xScale,
				x: this.horizPad,
				y: settings.height + this.topPad
			},
			yScale: {
				scale: scaleLog().domain([absYMin, absYMax]).range([0, settings.height]),
				x: this.horizPad,
				y: this.topPad
			},
			divideLine: {
				x: xScale(0) + this.horizPad,
				y1: settings.height + this.topPad,
				y2: this.topPad
			}
		}
	}

	setVariablesData(data, variableTwLst, plotDim, isAdjustedPValue, absSampleMax, absSampleMin) {
		//5 and 15 are the min and max radius
		const radiusScale = scaleLinear().domain([absSampleMin, absSampleMax]).range([5, 15])
		for (const item of data.variableItems) {
			item.color = item.correlation > 0 ? 'blue' : 'red'
			item.label = variableTwLst.find(t => t.$id == item.tw$id).term.name
			item.x = plotDim.xScale.scale(item.correlation) + this.horizPad
			const key = isAdjustedPValue ? 'adjusted_pvalue' : 'original_pvalue'
			item.y = Math.abs(-plotDim.yScale.scale(item[key]) - this.topPad)
			item.radius = radiusScale(item.sampleSize)
		}
		return data.variableItems
	}

	//TODO: Add more types
	getReadableType(type: string) {
		switch (type) {
			case 'geneExpression':
				return 'Gene Expression'
			default:
				return 'Gene Expression'
		}
	}
}
