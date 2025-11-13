import { shapesArray } from '#dom'
import { rgb } from 'd3-color'
import { scaleLinear as d3Linear, scaleTime } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { regressionPoly } from 'd3-regression'
import type { Scatter } from '../scatter'
import { getDateFromNumber } from '../../../../shared/utils/src/terms.js'
import type {
	ScatterResponse,
	ScatterChart,
	ColorLegendItem,
	ShapeLegendItem,
	ScatterDataResult
} from '../scatterTypes.js'
//icons have size 16x16
export const shapes = shapesArray

const numberOfSamplesCutoff = 20000 // if map is greater than cutoff, switch from svg to canvas rendering

export class ScatterModel {
	startGradient: any
	stopGradient: any
	range: any
	charts!: ScatterChart[]
	is2DLarge: boolean
	is3D: boolean
	axisOffset: any
	filterSampleStr: string | null = null
	scatter: Scatter

	constructor(scatter: Scatter) {
		this.startGradient = {}
		this.stopGradient = {}
		this.scatter = scatter
		this.axisOffset = { x: 80, y: 30 }
		this.is2DLarge = false
		this.is3D = false
	}

	// creates an opts object for the vocabApi.someMethod(),
	// may need to add a new method to client/termdb/vocabulary.js
	// for now, just add methods to TermdbVocab,
	// later on, add methods with same name to FrontendVocab
	getDataRequestOpts() {
		const c: any = this.scatter.config
		if (c.singleCellPlot) return c
		const coordTWs: any = []
		if (c.term) coordTWs.push(c.term)
		if (c.term2) coordTWs.push(c.term2)
		//If filter is provided in the config use it. The config filter includes the term filter, used by the report plot
		const filter = this.scatter.parentId ? this.scatter.state.termfilter.filter : this.scatter.getFilter()
		const opts: any = {
			name: c.name, // the actual identifier of the plot, for retrieving data from server
			colorTW: c.colorTW,
			filter,
			coordTWs
		}
		if (this.scatter.state.termfilter.filter0) opts.filter0 = this.scatter.state.termfilter.filter0
		if (c.colorColumn) opts.colorColumn = c.colorColumn
		if (c.shapeTW) opts.shapeTW = c.shapeTW
		if (c.scaleDotTW) {
			if (!c.scaleDotTW.q) c.scaleDotTW.q = {}
			c.scaleDotTW.q.mode = 'continuous'
			opts.scaleDotTW = c.scaleDotTW
		}
		if (c.term0) opts.divideByTW = c.term0
		opts.excludeOutliers = this.scatter.settings.excludeOutliers

		return opts
	}

	async initData() {
		try {
			const reqOpts = this.getDataRequestOpts()
			if (reqOpts.coordTWs?.length == 1 && this.scatter.type == 'sampleScatter') return //To allow removing a term in the controls, though nothing is rendered (summary tab with violin active)
			const data: ScatterResponse = await this.scatter.app.vocabApi.getScatterData(reqOpts)
			this.is3D = this.scatter.config.term0?.q.mode == 'continuous'
			if ('error' in data) throw data.error
			this.range = data.range
			this.charts = []
			for (const [key, chartData] of Object.entries(data.result)) {
				if (!Array.isArray(chartData.samples)) throw 'data.samples[] not array'
				this.createChart(key, chartData)
			}
			this.initRanges()
		} catch (e: any) {
			console.error(e)
			throw e.message || e
		}
	}

	createChart(id: string, data: ScatterDataResult) {
		const cohortSamples: any[] = data.samples.filter(sample => 'sampleId' in sample)
		if (cohortSamples.length > numberOfSamplesCutoff) this.is2DLarge = true
		const colorLegend: Map<string, ColorLegendItem> = new Map(data.colorLegend)
		const shapeLegend: Map<string, ShapeLegendItem> = new Map(data.shapeLegend)
		this.charts.push({ id, data, cohortSamples, colorLegend, shapeLegend })
	}

	initRanges() {
		let samples: any[] = []
		for (const chart of this.charts) samples = samples.concat(chart.data.samples)
		if (samples.length > numberOfSamplesCutoff) this.is2DLarge = true
		if (samples.length == 0) return
		const s0 = samples[0] //First sample to start reduce comparisons
		const [xMin, xMax, yMin, yMax, zMin, zMax, scaleMin, scaleMax] = samples.reduce(
			(s, d) => [
				d.x < s[0] ? d.x : s[0],
				d.x > s[1] ? d.x : s[1],
				d.y < s[2] ? d.y : s[2],
				d.y > s[3] ? d.y : s[3],
				d.z < s[4] ? d.z : s[4],
				d.z > s[5] ? d.z : s[5],
				'scale' in d ? (d.scale < s[6] ? d.scale : s[6]) : Number.POSITIVE_INFINITY,
				'scale' in d ? (d.scale > s[7] ? d.scale : s[7]) : Number.NEGATIVE_INFINITY
			],
			[s0.x, s0.x, s0.y, s0.y, s0.z, s0.z, s0.scale, s0.scale]
		)
		const settings = this.scatter.settings
		for (const chart of this.charts) {
			chart.ranges = {
				xMin: settings.minXScale != null ? settings.minXScale : settings.useGlobalMinMax ? this.range.xMin : xMin,
				xMax: settings.maxXScale != null ? settings.maxXScale : settings.useGlobalMinMax ? this.range.xMax : xMax,
				yMin: settings.minYScale != null ? settings.minYScale : settings.useGlobalMinMax ? this.range.yMin : yMin,
				yMax: settings.maxYScale != null ? settings.maxYScale : settings.useGlobalMinMax ? this.range.yMax : yMax,
				zMin,
				zMax,
				scaleMin,
				scaleMax
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
		const coord = (val, min, max) => {
			if (min != null && val < min) return min
			if (max != null && val > max) return max
			return val
		}
		const cx = () => {
			return coord(c.x, this.scatter.settings.minXScale, this.scatter.settings.maxXScale)
		}
		const cy = () => {
			return coord(c.y, this.scatter.settings.minYScale, this.scatter.settings.maxYScale)
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

	initAxes(chart) {
		if (chart.data.samples.length == 0) return
		const offsetX = this.axisOffset.x
		const offsetY = this.axisOffset.y
		const xMin = chart.ranges.xMin
		const xMax = chart.ranges.xMax
		const yMin = chart.ranges.yMin
		const yMax = chart.ranges.yMax
		const extraSpaceX = (xMax - xMin) * 0.01 //extra space added to avoid clipping the particles on the X axis
		const extraSpaceY = (yMax - yMin) * 0.01 //extra space added to avoid clipping the particles on the Y axis
		chart.xAxisScale = d3Linear()
			.domain([xMin - extraSpaceX, xMax + extraSpaceX])
			.range([offsetX, this.scatter.settings.svgw + offsetX])

		if (this.scatter.config.term && this.scatter.config.term.term.type == 'date') {
			const xMinDate = getDateFromNumber(xMin - extraSpaceX)
			const xMaxDate = getDateFromNumber(xMax + extraSpaceX)

			chart.xAxisScaleTime = scaleTime()
				.domain([xMinDate, xMaxDate])
				.range([offsetX, this.scatter.settings.svgw + offsetX])

			chart.axisBottom = axisBottom(chart.xAxisScaleTime)
		} else chart.axisBottom = axisBottom(chart.xAxisScale)
		const svgh = this.scatter.settings.svgh
		chart.yAxisScale = d3Linear()
			.domain([yMax + extraSpaceY, yMin - extraSpaceY])
			.range([offsetY, svgh + offsetY])
		if (this.scatter.config.term2 && this.scatter.config.term2.term.type == 'date') {
			const yMinDate = getDateFromNumber(yMin - extraSpaceY)
			const yMaxDate = getDateFromNumber(yMax + extraSpaceY)

			chart.yAxisScaleTime = scaleTime()
				.domain([yMinDate, yMaxDate])
				.range([offsetY, this.scatter.settings.svgh + offsetY])

			chart.axisLeft = axisLeft(chart.yAxisScaleTime)
		} else chart.axisLeft = axisLeft(chart.yAxisScale)

		chart.zAxisScale = d3Linear().domain([chart.ranges.zMin, chart.ranges.zMax]).range([0, this.scatter.settings.svgd])

		const gradientColor = rgb(this.scatter.settings.defaultColor)
		if (!this.scatter.config.startColor) {
			this.scatter.config.startColor = {}
			this.scatter.config.stopColor = {}
		}
		// supply start and stop color, if term has hardcoded colors, use; otherwise use default
		if (!this.scatter.config.startColor[chart.id]) {
			this.scatter.config.startColor[chart.id] =
				this.scatter.config.colorTW?.term.continuousColorScale?.minColor ||
				gradientColor.brighter().brighter().toString()
		}

		if (!this.scatter.config.stopColor[chart.id]) {
			this.scatter.config.stopColor[chart.id] =
				this.scatter.config.colorTW?.term.continuousColorScale?.maxColor || gradientColor.darker().toString()
		}

		// Handle continuous color scaling when color term wrapper is in continuous mode
		if (this.scatter.config.colorTW?.q.mode === 'continuous') {
			// Extract and sort all sample values for our calculations
			// We filter out any values that are explicitly defined in the term values
			// This gives us the raw numerical data we need for scaling
			const colorValues = chart.cohortSamples
				.filter(
					s => !this.scatter.config.colorTW.term.values || !(s.category in this.scatter.config.colorTW.term.values)
				)
				.map(s => s.category)
				.sort((a, b) => a - b)
			chart.colorValues = colorValues // to use it in renderLegend
			// Determine min/max based on current mode
			let min, max, index
			const settings = this.scatter.config.settings.sampleScatter

			switch (settings.colorScaleMode) {
				// Fixed mode: Use user-defined min/max values
				// This is useful when you want consistent scaling across different views
				case 'fixed':
					min = settings.colorScaleMinFixed
					max = settings.colorScaleMaxFixed
					break

				case 'percentile':
					// Percentile mode: Scale based on data distribution
					min = colorValues[0] // Start at the first value of the array for percentile mode
					// Calculate the value at the specified percentile
					// This helps handle outliers by focusing on the main distribution
					index = Math.floor((colorValues.length * settings.colorScalePercentile) / 100)
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
				.range([this.scatter.config.startColor[chart.id], this.scatter.config.stopColor[chart.id]])

			// Store the current range for reference
			// This is useful when we need to recreate the color generator
			// or check the current scaling values
			chart.currentColorRange = { min, max }
		}
	}
}
