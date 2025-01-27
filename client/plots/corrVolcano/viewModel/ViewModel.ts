import type { TermWrapper } from '#types'
import { scaleLinear } from 'd3-scale'
import { getReadableType } from '#shared/terms.js'
import type { CorrelationVolcanoResponse } from '#types'
import type { CorrVolcanoDom, CorrVolcanoPlotConfig, CorrVolcanoSettings, ViewData } from '../CorrelationVolcanoTypes'

export class ViewModel {
	viewData: ViewData
	//For rendering the circles and legend info
	readonly defaultMinRadius = 5
	readonly defaultMaxRadius = 20
	readonly bottomPad = 60
	/** Only one side, left or right */
	readonly horizPad = 70
	readonly topPad = 40
	constructor(
		config: CorrVolcanoPlotConfig,
		data: CorrelationVolcanoResponse,
		dom: CorrVolcanoDom,
		settings: CorrVolcanoSettings,
		variableTwLst: TermWrapper[]
	) {
		const pValueKey = settings.isAdjustedPValue ? 'adjusted_pvalue' : 'original_pvalue'
		const d = this.transformPValues(data, pValueKey)
		const [absYMax, absYMin] = this.setMinMax(d, `transformed_${pValueKey}`)
		const [absXMax, absXMin] = this.setMinMax(d, 'correlation')
		const [absSampleMax, absSampleMin] = this.setMinMax(d, 'sampleSize')

		const plotDim = this.setPlotDimensions(config, settings, absYMax, absYMin, absXMax, absXMin)

		this.viewData = {
			plotDim,
			variableItems: this.setVariablesData(
				absSampleMax,
				absSampleMin,
				d,
				dom,
				pValueKey,
				plotDim,
				settings,
				variableTwLst
			),
			legendData: this.setLegendData(absSampleMin, absSampleMax)
		}
	}

	transformPValues(data: CorrelationVolcanoResponse, key: string) {
		//Items rendered in log scale
		//Remove any items with negative p values
		data.variableItems = data.variableItems.filter(v => v[key] > 0)
		//For each item, transform the p value to -log10
		for (const item of data.variableItems) {
			if (item[key] > 0) item[`transformed_${key}`] = -Math.log10(item[key])
			else item[key] = null
		}
		return data
	}

	setMinMax(data: CorrelationVolcanoResponse, key: string) {
		const sortedValues = data.variableItems.map(v => v[key]).sort((a, b) => a - b)
		const max = sortedValues[sortedValues.length - 1]
		const min = sortedValues[0]
		return [max, min]
	}

	setPlotDimensions(
		config: CorrVolcanoPlotConfig,
		settings: CorrVolcanoSettings,
		absYMax: number,
		absYMin: number,
		absXMax: number,
		absXMin: number
	) {
		//Ensure the neg and pos side of the plot are equal
		const maxXRange = Math.max(Math.abs(absXMin), absXMax)
		const xScale = scaleLinear().domain(this.setDomain(-maxXRange, maxXRange, 0.05)).range([0, settings.width])
		const yScale = scaleLinear().domain(this.setDomain(absYMin, absYMax)).range([settings.height, 0])
		return {
			svg: {
				height: settings.height + this.topPad + this.bottomPad * 2,
				width: settings.width + this.horizPad * 2
			},
			title: {
				text: `${config.featureTw.term.name} ${getReadableType(config.featureTw.term.type)}`,
				x: this.horizPad + settings.width / 2,
				y: this.topPad / 2
			},
			xAxisLabel: {
				x: this.horizPad + settings.width / 2,
				y: this.topPad + settings.height + this.bottomPad
			},
			yAxisLabel: {
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
				scale: yScale,
				x: this.horizPad,
				y: this.topPad
			},
			divideLine: {
				x: xScale(0) + this.horizPad,
				y1: settings.height + this.topPad,
				y2: this.topPad
			},
			thresholdLine: {
				y: yScale(-Math.log10(settings.threshold)) + this.topPad,
				x1: this.horizPad,
				x2: settings.width + this.horizPad
			}
		}
	}

	/** Increase the domain slightly so all data points fit within the plot */
	setDomain(min: number, max: number, percent = 0.1) {
		const rangeInc = (max - min) * percent
		const domain = [min - rangeInc, max + rangeInc]
		return domain
	}

	setVariablesData(
		absSampleMax: number,
		absSampleMin: number,
		data: any,
		dom: CorrVolcanoDom,
		key: string,
		plotDim: any,
		settings: CorrVolcanoSettings,
		variableTwLst: any[]
	) {
		const radiusScale = scaleLinear()
			.domain([absSampleMin, absSampleMax])
			.range([this.defaultMinRadius, this.defaultMaxRadius])
		const renderedCircles = dom.plot
			?.selectAll('circle')
			.nodes()
			.map((d: any) => d.__data__)
		for (const item of data.variableItems) {
			item.color = item.correlation > 0 ? settings.corrColor : settings.antiCorrColor
			item.label = variableTwLst.find(t => t.$id == item.tw$id).term.name
			item.x = plotDim.xScale.scale(item.correlation) + this.horizPad
			item.y = plotDim.yScale.scale(item[`transformed_${key}`]) + this.topPad
			item.radius = radiusScale(item.sampleSize)
			if (renderedCircles?.length > 0) {
				const findRenderdCircle = renderedCircles.find((d: any) => d.tw$id === item.tw$id) as any
				if (findRenderdCircle) {
					item.previousX = findRenderdCircle.x
					item.previousY = findRenderdCircle.y
				}
			} else {
				item.previousX = item.x
				item.previousY = item.y
			}
		}
		return data.variableItems
	}

	setLegendData(absSampleMin: number, absSampleMax: number) {
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
