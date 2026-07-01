import { shapesArray } from '#dom'
import { rgb } from 'd3-color'
import { scaleLinear as d3Linear, scaleTime } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { regressionPoly } from 'd3-regression'
import type { Scatter } from '../scatter'
import { getDateFromNumber, SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'
import type { ColorLegendItem, ScatterChart, ScatterDataResult, ScatterRanges, ShapeLegendItem } from '../scatterTypes'
import { maxSvgSamplesCutoff, noExpColor, expColor } from '../settings/defaults'
import type { SingleCellPlotDataResult } from '#types'
import { xAxisOffSet, yAxisOffSet, getCoordinate, calculatePadding } from '#shared'

//icons have size 16x16
export const shapes = shapesArray

export abstract class ScatterModelBase {
	scatter: Scatter
	charts!: ScatterChart[]
	is3D: boolean
	is2DLarge: boolean
	axisOffset: { x: number; y: number }
	startGradient: any
	stopGradient: any
	range!: ScatterRanges
	filterSampleStr: string | null = null

	constructor(scatter: Scatter) {
		this.scatter = scatter

		this.is3D = false
		this.is2DLarge = false
		this.axisOffset = { x: xAxisOffSet, y: yAxisOffSet }
	}

	abstract getDataRequestOpts(): any
	abstract initData(): Promise<void>

	createChart(id: string, data: ScatterDataResult | SingleCellPlotDataResult) {
		const cohortSamples: any[] = data.samples ? data.samples.filter(sample => 'sampleId' in sample) : []
		if (cohortSamples.length > maxSvgSamplesCutoff) this.is2DLarge = true
		const colorLegend: Map<string, ColorLegendItem> = new Map(data.colorLegend)
		const shapeLegend: Map<string, ShapeLegendItem> = new Map(data.shapeLegend)
		const chart: ScatterChart = { id, data, cohortSamples, colorLegend, shapeLegend }
		if (data.src) {
			chart.src = data.src
			if ('canvasWidth' in data) chart.canvasWidth = data.canvasWidth
			if ('canvasHeight' in data) chart.canvasHeight = data.canvasHeight
			if (data.totalSampleCount) chart.totalSampleCount = data.totalSampleCount
			this.is2DLarge = true
		}
		this.charts.push(chart)
	}

	async initRanges() {
		const settings = this.scatter.settings
		let samples: any[] = []
		for (const chart of this.charts) samples = samples.concat(chart.data?.samples || [])
		if (samples.length == 0) {
			if (this.scatter.config.singleCellPlot) {
				this.charts[0].ranges = {
					xMin: settings.minXScale != null ? settings.minXScale : this.range.xMin,
					xMax: settings.maxXScale != null ? settings.maxXScale : this.range.xMax,
					yMin: settings.minYScale != null ? settings.minYScale : this.range.yMin,
					yMax: settings.maxYScale != null ? settings.maxYScale : this.range.yMax,
					geMin: this.range.geMin,
					geMax: this.range.geMax
				}
			}
			return
		}
		if (samples.length > maxSvgSamplesCutoff) this.is2DLarge = true
		const s0 = samples[0] //First sample to start reduce comparisons
		const [xMin, xMax, yMin, yMax, zMin, zMax, scaleMin, scaleMax, geMin, geMax] = samples.reduce(
			(s, d) => [
				d.x < s[0] ? d.x : s[0],
				d.x > s[1] ? d.x : s[1],
				d.y < s[2] ? d.y : s[2],
				d.y > s[3] ? d.y : s[3],
				d.z < s[4] ? d.z : s[4],
				d.z > s[5] ? d.z : s[5],
				'scale' in d ? (d.scale < s[6] ? d.scale : s[6]) : Number.POSITIVE_INFINITY,
				'scale' in d ? (d.scale > s[7] ? d.scale : s[7]) : Number.NEGATIVE_INFINITY,
				'geneExp' in d ? (d.geneExp < s[8] ? d.geneExp : s[8]) : Number.POSITIVE_INFINITY,
				'geneExp' in d ? (d.geneExp > s[9] ? d.geneExp : s[9]) : Number.NEGATIVE_INFINITY
			],
			[s0.x, s0.x, s0.y, s0.y, s0.z, s0.z, s0.scale, s0.scale, s0.geneExp, s0.geneExp]
		)
		for (const chart of this.charts) {
			chart.ranges = {
				xMin: settings.minXScale != null ? settings.minXScale : settings.useGlobalMinMax ? this.range.xMin : xMin,
				xMax: settings.maxXScale != null ? settings.maxXScale : settings.useGlobalMinMax ? this.range.xMax : xMax,
				yMin: settings.minYScale != null ? settings.minYScale : settings.useGlobalMinMax ? this.range.yMin : yMin,
				yMax: settings.maxYScale != null ? settings.maxYScale : settings.useGlobalMinMax ? this.range.yMax : yMax,
				zMin,
				zMax,
				scaleMin,
				scaleMax,
				geMin,
				geMax
			}
		}
	}

	getOpacity(c) {
		if ('sampleId' in c) {
			const hidden = c.hidden?.['category'] || c.hidden?.['shape']
			if (this.filterSampleStr) {
				if (!c.sample?.toLowerCase().includes(this.filterSampleStr.toLowerCase())) {
					if (hidden) return 0
					else return 0.1
				} else return 1.2
			}
			const opacity = hidden ? 0 : this.scatter.settings.opacity
			return opacity
		}
		const refOpacity = this.scatter.settings.showRef ? this.scatter.settings.opacity : 0
		return refOpacity
	}

	getShape(chart, c) {
		const index = chart.shapeLegend.get(c.shape).shape % shapes.length
		return shapes[index]
	}

	/** Returns the calculated coordinate or the min/max axis
	 * cap set by the user. */
	getCoordinates(chart, c) {
		const cx = () => {
			return getCoordinate(c.x, this.scatter.settings.minXScale, this.scatter.settings.maxXScale)
		}
		const cy = () => {
			return getCoordinate(c.y, this.scatter.settings.minYScale, this.scatter.settings.maxYScale)
		}
		const x = chart.xAxisScale(cx())
		const y = chart.yAxisScale(cy())
		return { x, y }
	}

	getScale(chart, c, factor = 1) {
		const isRef = !('sampleId' in c)
		let scale
		if (!this.scatter.config.scaleDotTW || isRef) {
			scale = 'sampleId' in c ? this.scatter.settings.size : this.scatter.settings.refSize
		} else {
			const range = this.scatter.settings.maxShapeSize - this.scatter.settings.minShapeSize
			if (this.scatter.settings.scaleDotOrder == 'Ascending')
				scale =
					this.scatter.settings.minShapeSize +
					((c.scale - chart.ranges.scaleMin) / (chart.ranges.scaleMax - chart.ranges.scaleMin)) * range
			else
				scale =
					this.scatter.settings.maxShapeSize -
					((c.scale - chart.ranges.scaleMin) / (chart.ranges.scaleMax - chart.ranges.scaleMin)) * range
		}
		const zoom = this.is2DLarge ? this.scatter.zoom : 1 //if not 2d large the whole chart is zoomed
		scale = (zoom * scale * factor) / 3
		if (this.filterSampleStr) {
			if (c.sample?.toLowerCase().includes(this.filterSampleStr.toLowerCase())) scale = scale * 2
			else scale = scale * 0.8
		}
		return scale
	}

	transform(chart, c, factor = 1) {
		const scale = this.getScale(chart, c, factor)
		const particleSize = 16 * scale
		const { x, y } = this.getCoordinates(chart, c)
		const offSetX = x - particleSize / 2
		const offSetY = y - particleSize / 2
		const transform = `translate(${offSetX},${offSetY}) scale(${scale})` // original icons are scaled to 0.3
		return transform
	}

	getColor(c, chart) {
		if (this.scatter.config.colorTW?.term.type == SINGLECELL_GENE_EXPRESSION) {
			let color
			if (!c.geneExp) color = noExpColor
			else if (c.geneExp > chart.ranges.geMax) color = expColor
			else color = chart.colorGenerator(c.geneExp)
			return color
		}
		if (this.scatter.config.colorTW?.q.mode == 'continuous' && 'sampleId' in c) {
			const [min, max] = chart.colorGenerator.domain()
			if (c.category < min) return chart.colorGenerator(min)
			if (c.category > max) return chart.colorGenerator(max)
			const color = chart.colorGenerator(c.category)
			return color
		}
		if (c.category == 'Default') return this.scatter.settings.defaultColor
		const category = chart.colorLegend.get(c.category)
		return category.color
	}

	async addGroup(group) {
		group.plotId = this.scatter.id
		await this.scatter.app.vocabApi.addGroup(group)
	}

	getStrokeWidth(c) {
		const opacity = this.getOpacity(c)
		if (opacity <= 0.2)
			//hidden by filter or search
			return 0
		if (opacity == 1.2)
			//samples searched
			return 2
		return 1
	}

	initAxes(chart) {
		const config = this.scatter.config
		const settings = this.scatter.settings
		if ((!chart.data?.samples || chart.data.samples.length == 0) && !chart.totalSampleCount) return
		const offsetX = this.axisOffset.x
		const offsetY = this.axisOffset.y
		const xMin = chart.ranges.xMin
		const xMax = chart.ranges.xMax
		const yMin = chart.ranges.yMin
		const yMax = chart.ranges.yMax
		//unless there is a capping in the min/max values add a minimal extra space in the plot
		const extraSpaceX = calculatePadding(settings.minXScale, settings.maxXScale, xMin, xMax) //extra space added to avoid clipping the particles on the X axis
		const extraSpaceY = calculatePadding(settings.minYScale, settings.maxYScale, yMin, yMax) //extra space added to avoid clipping the particles on the Y axis
		chart.xAxisScale = d3Linear()
			.domain([xMin - extraSpaceX, xMax + extraSpaceX])
			.range([offsetX, settings.svgw + offsetX])
		if (config.term && config.term.term.type == 'date') {
			const xMinDate = getDateFromNumber(xMin - extraSpaceX)
			const xMaxDate = getDateFromNumber(xMax + extraSpaceX)

			chart.xAxisScaleTime = scaleTime()
				.domain([xMinDate, xMaxDate])
				.range([offsetX, settings.svgw + offsetX])

			chart.axisBottom = axisBottom(chart.xAxisScaleTime)
		} else chart.axisBottom = axisBottom(chart.xAxisScale)
		const svgh = settings.svgh
		chart.yAxisScale = d3Linear()
			.domain([yMax + extraSpaceY, yMin - extraSpaceY])
			.range([offsetY, svgh + offsetY])
		if (config.term2 && config.term2.term.type == 'date') {
			const yMinDate = getDateFromNumber(yMin - extraSpaceY)
			const yMaxDate = getDateFromNumber(yMax + extraSpaceY)

			chart.yAxisScaleTime = scaleTime()
				.domain([yMinDate, yMaxDate])
				.range([offsetY, settings.svgh + offsetY])

			chart.axisLeft = axisLeft(chart.yAxisScaleTime)
		} else chart.axisLeft = axisLeft(chart.yAxisScale)

		chart.zAxisScale = d3Linear().domain([chart.ranges.zMin, chart.ranges.zMax]).range([0, settings.svgd])

		this.initColorGenerator(chart)
	}

	initColorGenerator(chart) {
		const config = this.scatter.config
		const settings = this.scatter.settings
		if (!chart.ranges) return

		const gradientColor = rgb(settings.defaultColor)
		if (!config.startColor) {
			// FIXME should move these to getPlotConfig
			config.startColor = {}
			config.stopColor = {}
		}
		// supply start and stop color, if term has hardcoded colors, use; otherwise use default
		if (!config.startColor[chart.id]) {
			config.startColor[chart.id] =
				config.colorTW?.term.type == SINGLECELL_GENE_EXPRESSION
					? noExpColor
					: config.colorTW?.term.continuousColorScale?.minColor || gradientColor.brighter().brighter().toString()
		}

		if (!config.stopColor[chart.id]) {
			config.stopColor[chart.id] =
				config.colorTW?.term.type == SINGLECELL_GENE_EXPRESSION
					? expColor
					: config.colorTW?.term.continuousColorScale?.maxColor || gradientColor.darker().toString()
		}
		// Handle continuous color scaling when color term wrapper is in continuous mode
		if (config.colorTW?.q.mode === 'continuous') {
			// Extract and sort all sample values for our calculations
			// We filter out any values that are explicitly defined in the term values
			// This gives us the raw numerical data we need for scaling
			let colorValues
			if (config.colorTW.term.type == SINGLECELL_GENE_EXPRESSION) {
				colorValues = [chart.ranges.geMin, chart.ranges.geMax]
			} else {
				colorValues = chart.cohortSamples
					.filter(s => !config.colorTW.term.values || !(s.category in config.colorTW.term.values))
					.map(s => s.category)
					.sort((a, b) => a - b)
			}
			chart.colorValues = colorValues // to use it in renderLegend
			// Determine min/max based on current mode
			let min, max, index
			const colorScaleSettings = config.settings.sampleScatter

			switch (colorScaleSettings.colorScaleMode) {
				// Fixed mode: Use user-defined min/max values
				// This is useful when you want consistent scaling across different views
				case 'fixed':
					min = colorScaleSettings.colorScaleMinFixed
					max = colorScaleSettings.colorScaleMaxFixed
					break

				case 'percentile':
					// Percentile mode: Scale based on data distribution
					min = colorValues[0] // Start at the first value of the array for percentile mode
					// Calculate the value at the specified percentile
					// This helps handle outliers by focusing on the main distribution
					index = Math.floor((colorValues.length * colorScaleSettings.colorScalePercentile) / 100)
					max = colorValues[index]
					break

				case 'auto':
				default:
					// Auto mode (default): Use the full range of the data
					// This gives the most accurate representation of the actual data distribution
					min = colorValues[0]
					max = colorValues[colorValues.length - 1] // Since the values are already sorted in ascending
					// order just get the first and last values
					break
			}
			// Create the color generator using d3's linear scale
			// This maps our numerical range to a color gradient

			chart.colorGenerator = d3Linear()
				.domain([min, max])
				.range([config.startColor[chart.id], config.stopColor[chart.id]])

			// Store the current range for reference
			// This is useful when we need to recreate the color generator
			// or check the current scaling values
			chart.currentColorRange = { min, max }
		}
	}

	async processData() {
		const term0Values = this.scatter.config.term0?.term.values
		if (term0Values) {
			// sort the divideBy subCharts based on pre-defined term0 order in db
			const orderedLabels: any = Object.values(term0Values).sort((a: any, b: any) =>
				'order' in a && 'order' in b ? a.order - b.order : 0
			)
			this.charts.sort(
				(a, b) => orderedLabels.findIndex(v => v.label == a.id) - orderedLabels.findIndex(v => v.label == b.id)
			)
		}
		for (const chart of this.charts) {
			this.initAxes(chart)
			if (!chart.colorGenerator) this.initColorGenerator(chart)
			const regressionType = this.scatter.settings.regression

			if (!regressionType || regressionType == 'None') continue
			let regression
			const data: any = []
			await chart.cohortSamples.forEach(c => {
				data.push(this.getCoordinates(chart, c))
			})
			let regressionCurve
			// if (regressionType == 'Loess') {
			// 	regression = regressionLoess()
			// 		.x(c => c.x)
			// 		.y(c => c.y)
			// 		.bandwidth(0.25)
			// 	regressionCurve = regression(data)
			// } else
			if (regressionType == 'Polynomial') {
				regression = regressionPoly()
					.x(c => c.x)
					.y(c => c.y)
					.order(3)
				regressionCurve = regression(data)
			} else if (regressionType == 'Lowess') {
				const X: any = [],
					Y: any = []
				for (const sample of data) {
					X.push(sample.x)
					Y.push(sample.y)
				}
				regressionCurve = await this.scatter.app.vocabApi.getLowessCurve({ coords: { X, Y } })
			} else {
				throw `unsupported regression type='${regressionType}'`
			}
			chart.regressionCurve = regressionCurve
		}
	}
}
