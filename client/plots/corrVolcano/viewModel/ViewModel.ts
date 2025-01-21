import type { TermWrapper } from '#types'
import { scaleLinear } from 'd3-scale'
import type { CorrVolcanoSettings } from '../CorrelationVolcano'

export type ViewData = {
	plotDim: any
	variableItems: any
	legendData: any
}

/** TODO, clean this up */
export class ViewModel {
	// config: any
	// data: any
	// settings: CorrVolcanoSettings
	viewData: ViewData
	readonly defaultMinRadius = 5
	readonly defaultMaxRadius = 20
	readonly topPad = 40
	/** Only one side, left or right */
	readonly horizPad = 70
	readonly bottomPad = 60
	constructor(config: any, data: any, settings: CorrVolcanoSettings, variableTwLst: TermWrapper[]) {
		const pValueKey = settings.isAdjustedPValue ? 'adjusted_pvalue' : 'original_pvalue'
		const d = this.transformPValues(data, pValueKey)
		const [absYMax, absYMin] = this.setMinMax(d, pValueKey)
		const [absXMax, absXMin] = this.setMinMax(d, 'correlation')
		const [absSampleMax, absSampleMin] = this.setMinMax(d, 'sampleSize')

		const plotDim = this.setPlotDimensions(config, settings, absYMax, absYMin, absXMax, absXMin)

		this.viewData = {
			plotDim,
			variableItems: this.setVariablesData(d, variableTwLst, plotDim, pValueKey, absSampleMax, absSampleMin),
			legendData: this.setLegendData(absSampleMin, absSampleMax)
		}
	}

	transformPValues(data, key) {
		data.variableItems = data.variableItems.filter(v => v[key] > 0)
		for (const item of data.variableItems) {
			if (item[key] > 0) item[key] = -Math.log10(item[key])
			else item[key] = null
		}
		return data
	}

	setMinMax(data: any, key: string) {
		const sortedValues = data.variableItems.map(v => v[key]).sort((a, b) => a - b)
		const max = sortedValues[sortedValues.length - 1]
		const min = sortedValues[0]
		return [max, min]
	}

	setPlotDimensions(config, settings, absYMax: number, absYMin: number, absXMax: number, absXMin: number) {
		//Ensure the neg and pos side of the plot are equal
		const maxXRange = Math.max(Math.abs(absXMin), absXMax)
		const xScale = scaleLinear().domain(this.setDomain(-maxXRange, maxXRange, 0.05)).range([0, settings.width])
		return {
			svg: {
				height: settings.height + this.topPad + this.bottomPad * 2,
				width: settings.width + this.horizPad * 2
			},
			title: {
				text: config.featureTw.term.name,
				x: this.horizPad + settings.width / 2,
				y: this.topPad / 2
			},
			xAxisLabel: {
				//TODO: If this never changes, move to View
				text: 'Correlation Coefficient',
				x: this.horizPad + settings.width / 2,
				y: this.topPad + settings.height + this.bottomPad
			},
			yAxisLabel: {
				text: this.getReadableType(config.featureTw.term.type),
				x: this.horizPad / 3,
				y: this.topPad + settings.height / 2
			},
			xScale: {
				scale: xScale,
				x: this.horizPad,
				y: settings.height + this.topPad
			},
			yScale: {
				//Do not use scaleLog() here. scaleLog is for raw values before the log transformation
				//Using it will distort the values.
				scale: scaleLinear().domain(this.setDomain(absYMin, absYMax)).range([settings.height, 0]),
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

	/** Increase the domain slightly so all data points fit within the plot */
	setDomain(min: number, max: number, percent = 0.1) {
		const rangeInc = (max - min) * percent
		const domain = [min - rangeInc, max + rangeInc]
		return domain
	}

	//TODO: Add more types
	getReadableType(type: string) {
		switch (type) {
			case 'geneExpression':
				return 'Gene Expression'
			case 'geneVariant':
				return 'Gene Variant'
			default:
				return 'Gene Expression'
		}
	}

	setVariablesData(data, variableTwLst, plotDim, key, absSampleMax, absSampleMin) {
		//5 and 15 are the min and max radius
		const radiusScale = scaleLinear()
			.domain([absSampleMin, absSampleMax])
			.range([this.defaultMinRadius, this.defaultMaxRadius])
		for (const item of data.variableItems) {
			item.color = item.correlation > 0 ? 'blue' : 'red'
			item.label = variableTwLst.find(t => t.$id == item.tw$id).term.name
			item.x = plotDim.xScale.scale(item.correlation) + this.horizPad
			item.y = plotDim.yScale.scale(item[key]) + this.topPad
			item.radius = radiusScale(item.sampleSize)
		}
		return data.variableItems
	}

	setLegendData(absSampleMin, absSampleMax) {
		return [
			{
				label: absSampleMin,
				x: 25,
				y: 30,
				radius: this.defaultMinRadius
			},
			{
				label: absSampleMax,
				x: 25,
				y: this.defaultMaxRadius + 50,
				radius: this.defaultMaxRadius
			}
		]
	}
}
