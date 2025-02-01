import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { icons as icon_functions, ColorScale, Menu, getMaxLabelWidth } from '#dom'
import { d3lasso } from '#common/lasso'
import { dt2label, morigin } from '#shared/common.js'
import { rgb } from 'd3-color'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { select } from 'd3-selection'
import { getSamplelstTW, getFilter } from '../mass/groups.js'
import { regressionPoly } from 'd3-regression'
import { line, extent, contourDensity, geoPath, scaleSequential, max, interpolateGreys, interpolateOranges } from 'd3'
import { getId } from '#mass/nav'
import { minShapeSize, maxShapeSize } from './sampleScatter.js'
import { addNewGroup } from '../mass/groups.js'
import { setRenderersThree } from './sampleScatter.rendererThree.js'
import { shapes } from './sampleScatter.js'
import { roundValueAuto } from '#shared/roundValue.js'

export function setRenderers(self) {
	setRenderersThree(self)
	self.render = function () {
		const chartDivs = self.mainDiv.selectAll(':scope > div').data(self.charts, chart => chart?.id)
		chartDivs.exit().remove()
		chartDivs.each(self.renderChart)
		chartDivs.enter().append('div').style('vertical-align', 'top').each(self.renderChart)
	}

	self.renderChart = function (chart) {
		chart.chartDiv = select(this)
		const s = self.settings
		chart.chartDiv.style('opacity', 0).style('display', 'inline-block')
		chart.chartDiv.on('mouseover', event => {
			if (!self.onClick) self.showTooltip(event, chart)
		})
		chart.chartDiv.on('click', event => self.showTooltip(event, chart))

		chart.svg = chart.chartDiv.select('svg').empty() ? chart.chartDiv.append('svg') : chart.chartDiv.select('svg')
		renderSVG(chart, s, 0)

		chart.chartDiv.transition().duration(s.duration).style('opacity', 1)
	}

	self.initAxes = function (chart) {
		if (chart.data.samples.length == 0) return
		const offsetX = self.axisOffset.x
		const offsetY = self.axisOffset.y

		const extraSpaceX = (chart.xMax - chart.xMin) * 0.01 //extra space added to avoid clipping the particles on the X axis
		const extraSpaceY = (chart.yMax - chart.yMin) * 0.01 //extra space added to avoid clipping the particles on the Y axis

		chart.xAxisScale = d3Linear()
			.domain([chart.xMin - extraSpaceX, chart.xMax + extraSpaceX])
			.range([offsetX, self.settings.svgw + offsetX])

		chart.axisBottom = axisBottom(chart.xAxisScale)
		chart.yAxisScale = d3Linear()
			.domain([chart.yMax + extraSpaceY, chart.yMin - extraSpaceY])
			.range([offsetY, self.settings.svgh + offsetY])

		chart.zAxisScale = d3Linear().domain([chart.zMin, chart.zMax]).range([0, self.settings.svgd])

		chart.xScaleMin = chart.xAxisScale(chart.xMin)
		chart.xScaleMax = chart.xAxisScale(chart.xMax)
		chart.yScaleMin = chart.xAxisScale(chart.yMin)
		chart.yScaleMax = chart.yAxisScale(chart.yMax)
		chart.zScaleMin = chart.xAxisScale(chart.zMin)
		chart.zScaleMax = chart.zAxisScale(chart.zMax)

		chart.axisLeft = axisLeft(chart.yAxisScale)

		const gradientColor = rgb(self.config.settings.sampleScatter.defaultColor)
		if (!self.config.startColor) {
			self.config.startColor = {}
			self.config.stopColor = {}
		}
		// supply start and stop color, if term has hardcoded colors, use; otherwise use default
		if (!self.config.startColor[chart.id]) {
			self.config.startColor[chart.id] =
				self.config.colorTW?.term.continuousColorScale?.minColor || gradientColor.brighter().brighter().toString()
		}

		if (!self.config.stopColor[chart.id]) {
			self.config.stopColor[chart.id] =
				self.config.colorTW?.term.continuousColorScale?.maxColor || gradientColor.darker().toString()
		}

		// Handle continuous color scaling when color term wrapper is in continuous mode
		if (self.config.colorTW?.q.mode === 'continuous') {
			// Synchronize the chart's internal mode state with the application config.
			// This ensures the color scale UI correctly reflects the current mode
			// when switching between auto, fixed, and percentile modes.
			chart.cutoffMode = self.config.settings.sampleScatter.colorScaleMode || 'auto'
			chart.percentile = self.config.settings.sampleScatter.colorScalePercentile || 95
			// Extract and sort all sample values for our calculations
			// We filter out any values that are explicitly defined in the term values
			// This gives us the raw numerical data we need for scaling
			const colorValues = chart.cohortSamples
				.filter(s => !self.config.colorTW.term.values || !(s.category in self.config.colorTW.term.values))
				.map(s => s.category)
				.sort((a, b) => a - b)
			chart.colorValues = colorValues // to use it in renderLegend
			// Determine min/max based on current mode
			let min, max
			const settings = self.config.settings.sampleScatter

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
					const index = Math.floor((colorValues.length * settings.colorScalePercentile) / 100)
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
				.range([self.config.startColor[chart.id], self.config.stopColor[chart.id]])

			// Store the current range for reference
			// This is useful when we need to recreate the color generator
			// or check the current scaling values
			chart.currentColorRange = { min, max }
		}
	}

	function renderSVG(chart, s) {
		const svg = chart.svg

		let step = Math.min((20 * 40) / chart.colorLegend.size, 25)
		if (step < 12) step = 12
		let colorLegendSize = chart.colorLegend.size * step
		if (chart.colorLegend.get('Ref')?.sampleCount > 0) colorLegendSize += 60
		const scaleHeight = self.config.scaleDotTW ? 200 : 100
		self.legendHeight = Math.max(colorLegendSize, chart.shapeLegend.size * 30) + scaleHeight //legend step and header

		let size = self.getFontSize(chart)
		//Dynamically calculate the length of the legend labels
		const getLegendLabelWidth = (key, svg) => {
			const legend = chart[`${key}Legend`]
			if (!legend) return 0
			const labels = []
			for (const [k, v] of legend.entries()) {
				if (k != 'Ref') labels.push(`${k}, n=(${v.sampleCount})`)
			}
			labels.push(self.config[`${key}TW`]?.term?.name ?? '')

			// Add 20 for the icon (16) and space
			return getMaxLabelWidth(svg, labels, size) + 50
		}
		/** Becomes the x offset for the shape legend.
		 * When in continuous mode, color scale renders with a
		 * default width of 150. */
		chart.colorLegendWidth =
			self.config?.colorTW?.q.mode == 'continuous'
				? Math.max(175, getMaxLabelWidth(svg, [self.config.colorTW.term.name]) + 20)
				: getLegendLabelWidth('color', svg)
		const shapeWidth = getLegendLabelWidth('shape', svg)
		const width = s.svgw + chart.colorLegendWidth + shapeWidth + 125
		svg
			.transition()
			.duration(s.duration)
			.attr('width', width)
			.attr('height', Math.max(s.svgh + 200, self.legendHeight)) //leaving some space for axis/ref/ scale legend/padding

		/* eslint-disable */
		fillSvgSubElems(chart)
		/* eslint-enable */

		if (self.is3D) self.render3DSerie(chart)
		else if (self.is2DLarge) self.render2DSerieLarge(chart)
		else {
			renderSerie(chart, s.duration)
			self.renderLegend(chart, step)
		}
	}

	function fillSvgSubElems(chart) {
		const svg = chart.svg
		let axisG, labelsG
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			chart.mainG = svg.append('g').attr('class', 'sjpcb-scatter-mainG')
			axisG = svg.append('g').attr('class', 'sjpcb-scatter-axis')
			labelsG = svg.append('g').attr('class', 'sjpcb-scatter-labelsG')
			chart.xAxis = axisG.append('g').attr('class', 'sjpcb-scatter-x-axis')
			chart.yAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-y-axis')
				.attr('transform', `translate(${self.axisOffset.x}, 0)`)
			chart.mainG
				.append('rect')
				.attr('class', 'zoom')
				.attr('x', self.axisOffset.x)
				.attr('y', self.axisOffset.y)
				.attr('width', self.settings.svgw)
				.attr('height', self.settings.svgh)
				.attr('fill', 'white')
			const id = 'clip' + self.id
			chart.svg
				.append('defs')
				.append('clipPath')
				.attr('id', id)
				.append('rect')
				.attr('x', self.axisOffset.x)
				.attr('y', self.axisOffset.y)
				.attr('width', self.settings.svgw + 10)
				.attr('height', self.settings.svgh)
			chart.mainG.attr('clip-path', `url(#${id})`)

			chart.serie = chart.mainG.append('g').attr('class', 'sjpcb-scatter-series')
			chart.regressionG = chart.mainG.append('g').attr('class', 'sjpcb-scatter-lowess')
			chart.legendG = svg.append('g').attr('class', 'sjpcb-scatter-legend')
		} else {
			chart.mainG = svg.select('.sjpcb-scatter-mainG')
			chart.serie = chart.mainG.select('.sjpcb-scatter-series')
			chart.regressionG = chart.mainG.select('.sjpcb-scatter-lowess')
			axisG = svg.select('.sjpcb-scatter-axis')
			labelsG = svg.select('.sjpcb-scatter-labelsG')
			chart.xAxis = axisG.select('.sjpcb-scatter-x-axis')
			chart.yAxis = axisG.select('.sjpcb-scatter-y-axis')
			chart.legendG = svg.select('.sjpcb-scatter-legend')
		}
		chart.xAxis.attr('transform', `translate(0, ${self.settings.svgh + self.axisOffset.y})`)

		chart.legendG.attr('transform', `translate(${self.settings.svgw + self.axisOffset.x + 50}, 20)`)
		if (chart.axisBottom) {
			chart.xAxis.call(chart.axisBottom)
			chart.yAxis.call(chart.axisLeft)
		}
		if (self.settings.showAxes && !(self.is2DLarge || self.is3D)) {
			axisG.style('opacity', 1)
			if (self.config.term) {
				let termName = self.config.term.term.name
				if (!self.config.colorTW && !self.config.shapeTW && !self.config.term0)
					termName = `${termName}, n=${chart.cohortSamples.length}`

				labelsG.selectAll('*').remove()
				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 40})`
					)
					.attr('text-anchor', 'middle')
					.text(termName)
				if (self.config.term0 && !self.config.colorTW && !self.config.shapeTW) {
					const term0Name = `${chart.id}, n=${chart.cohortSamples.length}`

					labelsG
						.append('text')
						.attr(
							'transform',
							`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 65})`
						)
						.attr('text-anchor', 'middle')
						.text(term0Name)
				}
				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x - 50}, ${self.settings.svgh / 2 + self.axisOffset.y}) rotate(-90)`
					)
					.attr('text-anchor', 'middle')
					.text(self.config.term2.term.name)
			}
		} else {
			axisG.style('opacity', 0)
		}
	}

	function renderSerie(chart, duration) {
		if (self.canvas) self.canvas.remove()

		const g = chart.serie
		const data = chart.data
		chart.serie.selectAll('*').remove()

		// remove all symbols as there is no data id for privacy
		//g.selectAll('path').remove()

		const symbols = g.selectAll('path[name="serie"]').data(data.samples)
		symbols
			.transition()
			.duration(duration)
			.attr('name', 'serie')
			.attr('transform', c => self.transform(chart, c))
			.attr('d', c => self.getShape(chart, c))
			.attr('fill', c => self.getColor(c, chart))
			.attr('stroke', c => self.getColor(c, chart))
			.attr('stroke-width', c => self.getStrokeWidth(c))
			.style('fill-opacity', c => self.getOpacity(c))
		symbols
			.enter()
			.append('path')
			.attr('name', 'serie')
			/*** you'd need to set the symbol position using translate, instead of previously with cx, cy for a circle ***/
			.attr('transform', c => self.transform(chart, c))
			.attr('d', c => self.getShape(chart, c))
			.attr('fill', c => self.getColor(c, chart))
			.attr('stroke', c => self.getColor(c, chart))
			.attr('stroke-width', c => self.getStrokeWidth(c))
			.style('fill-opacity', c => self.getOpacity(c))
			.transition()
			.duration(duration)
		self.mayRenderRegression()
		if (self.settings.showContour) self.renderContours(chart)
	}

	self.renderContours = function (chart) {
		const contourG = chart.serie
		let zAxisScale
		if (self.config.colorTW?.q.mode == 'continuous') {
			const [zMin, zMax] = extent(chart.data.samples, d => d.category)
			zAxisScale = d3Linear().domain([zMin, zMax]).range([0, 1])
		}

		const data = chart.data.samples.map(s => {
			return { x: chart.xAxisScale(s.x), y: chart.yAxisScale(s.y), z: zAxisScale ? zAxisScale(s.category) : 1 }
		})
		renderContours(
			contourG,
			data,
			self.settings.svgw,
			self.settings.svgh,
			self.settings.colorContours,
			self.settings.contourBandwidth,
			self.settings.contourThresholds
		)
	}

	self.getStrokeWidth = function (c) {
		const opacity = self.getOpacity(c)
		if (opacity <= 0.2)
			//hidden by filter or search
			return 0
		if (opacity == 1.2)
			//samples searched
			return 2
		return 1
	}

	self.processData = async function () {
		const term0Values = self.config.term0?.term.values
		if (term0Values) {
			// sort the divideBy subCharts based on pre-defined term0 order in db
			const orderedLabels = Object.values(term0Values).sort((a, b) =>
				'order' in a && 'order' in b ? a.order - b.order : 0
			)
			self.charts.sort(
				(a, b) => orderedLabels.findIndex(v => v.label == a.id) - orderedLabels.findIndex(v => v.label == b.id)
			)
		}
		for (const chart of self.charts) {
			self.initAxes(chart)
			const regressionType = self.config.settings.sampleScatter.regression

			if (!regressionType || regressionType == 'None') continue
			let regression
			const data = []
			await chart.cohortSamples.forEach(c => {
				const x = chart.xAxisScale(c.x)
				const y = chart.yAxisScale(c.y)
				data.push({ x, y })
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
				const X = [],
					Y = []
				for (const sample of data) {
					X.push(sample.x)
					Y.push(sample.y)
				}
				regressionCurve = await self.app.vocabApi.getLowessCurve({ coords: { X, Y } })
			} else {
				throw `unsupported regression type='${regressionType}'`
			}
			chart.regressionCurve = regressionCurve
		}
	}

	self.mayRenderRegression = async function () {
		for (const chart of self.charts) {
			chart.regressionG?.selectAll('*').remove()
			if (chart.regressionCurve) {
				const l = line()
					.x(d => d[0])
					.y(d => d[1])
				const regressionPath = chart.regressionG.append('path')
				regressionPath
					.attr('d', l(chart.regressionCurve))
					.attr('stroke', 'blue')
					.attr('fill', 'none')
					.style('stroke-width', '2')
			}
		}
	}

	self.getColor = function (c, chart) {
		if (self.config.colorTW?.q.mode == 'continuous' && 'sampleId' in c) {
			const [min, max] = chart.colorGenerator.domain()
			if (c.category < min) return chart.colorGenerator(min)
			if (c.category > max) return chart.colorGenerator(max)
			const color = chart.colorGenerator(c.category)
			return color
		}
		if (c.category == 'Default') return self.config.settings.sampleScatter.defaultColor
		const category = chart.colorLegend.get(c.category)
		return category.color
	}

	self.getOpacity = function (c) {
		if ('sampleId' in c) {
			if (self.filterSampleStr) {
				if (!c.sample?.toLowerCase().includes(self.filterSampleStr.toLowerCase())) return 0.2
				else return 1.2
			}
			const opacity = c.hidden?.['category'] || c.hidden?.['shape'] ? 0 : self.settings.opacity
			return opacity
		}
		const refOpacity = self.settings.showRef ? self.settings.opacity : 0
		return refOpacity
	}

	self.getShape = function (chart, c) {
		const index = chart.shapeLegend.get(c.shape).shape % shapes.length
		return shapes[index]
	}

	self.transform = function (chart, c, factor = 1) {
		const isRef = !('sampleId' in c)
		let scale
		if (!self.config.scaleDotTW || isRef) {
			scale = 'sampleId' in c ? self.settings.size : self.settings.refSize
		} else {
			const range = self.settings.maxShapeSize - self.settings.minShapeSize
			if (self.settings.scaleDotOrder == 'Ascending')
				scale = self.settings.minShapeSize + ((c.scale - chart.scaleMin) / (chart.scaleMax - chart.scaleMin)) * range
			else scale = self.settings.maxShapeSize - ((c.scale - chart.scaleMin) / (chart.scaleMax - chart.scaleMin)) * range
		}
		scale = (self.zoom * scale * factor) / 3
		const particleSize = 16 * scale
		const x = chart.xAxisScale(c.x) - particleSize / 2
		const y = chart.yAxisScale(c.y) - particleSize / 2
		const transform = `translate(${x},${y}) scale(${scale})` // original icons are scaled to 0.3
		return transform
	}

	self.lassoReset = chart => {
		const mainG = chart.chartDiv.select('.sjpcb-scatter-mainG')

		if (chart.lasso)
			chart.lasso
				.items(mainG.select('.sjpcb-scatter-series').selectAll('path[name="serie"]'))
				.targetArea(mainG)
				.on('start', lasso_start)
				.on('draw', lasso_draw)
				.on('end', lasso_end)

		function lasso_start() {
			if (self.lassoOn) {
				chart.lasso
					.items()
					.attr('transform', c => self.transform(chart, c, 1 / 2))
					.style('fill-opacity', c => (self.getOpacity(c) != 0 ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('selected', false)
			}
		}

		function lasso_draw() {
			if (self.lassoOn) {
				// Style the possible dots

				chart.lasso
					.possibleItems()
					.attr('transform', c => self.transform(chart, c, 1.2))
					.style('fill-opacity', c => self.getOpacity(c))
					.classed('not_possible', false)
					.classed('possible', true)

				//Style the not possible dot
				chart.lasso
					.notPossibleItems()
					.attr('transform', c => self.transform(chart, c, 1 / 2))
					.style('fill-opacity', c => (self.getOpacity(c) != 0 ? 0.5 : 0))
					.classed('not_possible', true)
					.classed('possible', false)
			}
		}

		function lasso_end(dragEnd) {
			if (self.lassoOn) {
				// Reset classes of all items (.possible and .not_possible are useful
				// only while drawing lasso. At end of drawing, only selectedItems()
				// should be used)
				chart.lasso.items().classed('not_possible', false).classed('possible', false)

				// Style the selected dots
				chart.lasso.selectedItems().attr('transform', c => self.transform(chart, c, 1.3))
				chart.lasso.items().style('fill-opacity', c => self.getOpacity(c))
				self.selectedItems = []
				for (const item of chart.lasso.selectedItems()) {
					const data = item.__data__
					if ('sampleId' in data && !(data.hidden['category'] || data.hidden['shape'])) self.selectedItems.push(item)
				}
				chart.lasso.notSelectedItems().attr('transform', c => self.transform(chart, c))

				showLassoMenu(dragEnd.sourceEvent)
			}
		}

		function showLassoMenu(event) {
			const samples = self.selectedItems.map(item => item.__data__)
			self.dom.tip.clear().hide()
			if (self.selectedItems.length == 0) return
			self.dom.tip.show(event.clientX, event.clientY)

			const menuDiv = self.dom.tip.d.append('div')
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(`List ${self.selectedItems.length} samples`)
				.on('click', event => {
					self.dom.tip.hide()
					self.showTable(
						{
							name: 'Group ' + (self.config.groups.length + 1),
							items: samples
						},
						event.clientX,
						event.clientY,
						true
					)
				})

			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group')
				.on('click', async () => {
					const group = {
						name: 'Group',
						items: samples
					}
					const tw = getSamplelstTW([group])
					const filter = getFilter(tw)
					addNewGroup(self.app, filter, self.state.groups)
				})
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group and filter')
				.on('click', () => {
					const group = {
						name: 'Group',
						items: samples
					}
					const tw = getSamplelstTW([group])
					const filter = getFilter(tw)
					addNewGroup(self.app, filter, self.state.groups)
					self.addToFilter(tw)
				})
			if ('sample' in samples[0])
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Show samples')
					.on('click', async () => {
						const groupSamples = []
						for (const sample of samples) groupSamples.push({ sampleId: sample.sampleId, sampleName: sample.sample })
						self.app.dispatch({
							type: 'plot_create',
							id: getId(),
							config: {
								chartType: 'sampleView',
								samples: groupSamples
							}
						})
						self.dom.tip.hide()
					})
		}

		if (self.lassoOn) {
			// this seems to clear stale lasso data as sometimes seen
			// when the global filter is changed between lassoing
			// uncertain explanation: the svg and mainG is potentially different between rerenders,
			// so the previous mainG.call(chart.lasso) inside toggle_lasso is on a removed mainG????
			mainG.on('.zoom', null)
			mainG.on('mousedown.drag', null)
			mainG.call(chart.lasso)
		}
	}

	self.addGroup = async function (group) {
		group.plotId = self.id
		await self.app.vocabApi.addGroup(group)
		self.dom.tip.hide()
	}

	self.setTools = function () {
		if (!self.charts[0]) return
		const toolsDiv = self.dom.toolsDiv.style('background-color', 'white')
		toolsDiv.selectAll('*').remove()
		let display = 'block'
		// const helpDiv = toolsDiv
		// 	.insert('div')
		// 	.style('display', display)
		// 	.style('margin', '20px')
		// 	.attr('name', 'sjpp-help-btn') //For unit tests
		// icon_functions['help'](helpDiv, {
		// 	handler: () => window.open('https://github.com/stjude/proteinpaint/wiki/Scatter-plot', '_blank')
		// })

		const homeDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-reset-btn') //For unit tests
		icon_functions['restart'](homeDiv, { handler: resetToIdentity, title: 'Reset plot to defaults' })
		const zoomInDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-zoom-in-btn') //For unit tests
		icon_functions['zoomIn'](zoomInDiv, {
			handler: zoomIn,
			title: 'Zoom in. You can also zoom in pressing the Ctrl key and using the mouse wheel'
		})
		const zoomOutDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '20px')
			.attr('name', 'sjpp-zoom-out-btn') //For unit tests
		icon_functions['zoomOut'](zoomOutDiv, {
			handler: zoomOut,
			title: 'Zoom out. You can also zoom out pressing the Ctrl key and using the mouse wheel'
		})
		const searchDiv = toolsDiv.insert('div').style('display', display).style('margin', '20px')
		const lassoDiv = toolsDiv.insert('div').style('display', display).style('margin', '20px')
		if (!(self.is2DLarge || self.is3D)) {
			icon_functions['search'](searchDiv, { handler: e => self.searchSample(e), title: 'Search samples' })
			icon_functions['lasso'](lassoDiv, {
				handler: toggle_lasso,
				enabled: self.lassoOn,
				title: 'Select a group of samples'
			})
		}
		self.dom.groupDiv = toolsDiv.insert('div').style('display', display).style('margin', '20px')

		const mainG = self.charts[0].mainG
		const zoom = d3zoom()
			.scaleExtent([0.5, self.config.scaleDotTW ? 4 : 10])
			.on('zoom', handleZoom)
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
		if (self.config.scaleDotTW && self.zoom > 4) resetToIdentity()
		mainG.call(zoom)
		for (const chart of self.charts) {
			chart.lasso = d3lasso()
			self.lassoReset(chart)
		}
		self.updateGroupsButton()

		function handleZoom(event) {
			for (const chart of self.charts) {
				// create new scale ojects based on event
				const new_xScale = event.transform.rescaleX(chart.xAxisScale)
				const new_yScale = event.transform.rescaleY(chart.yAxisScale)

				chart.xAxis.call(chart.axisBottom.scale(new_xScale))
				chart.yAxis.call(chart.axisLeft.scale(new_yScale))
				chart.serie.attr('transform', event.transform)
				self.zoom = event.transform.scale(1).k
				//on zoom in the particle size is kept
				const symbols = chart.serie.selectAll('path[name="serie"')
				symbols.attr('transform', c => self.transform(chart, c, 1))
				if (self.lassoOn) chart.lasso.selectedItems().attr('transform', c => self.transform(chart, c, 1.2))
				if (self.config.scaleDotTW) self.drawScaleDotLegend(chart)
			}
		}

		function zoomIn() {
			for (const chart of self.charts)
				if (self.is2DLarge) self.zoom = self.zoom + 0.15
				else zoom.scaleBy(chart.mainG.transition().duration(750), 1.2)
		}

		function zoomOut() {
			for (const chart of self.charts)
				if (self.is2DLarge) self.zoom = self.zoom - 0.15
				else zoom.scaleBy(chart.mainG.transition().duration(750), 0.8)
		}

		function resetToIdentity() {
			for (const chart of self.charts)
				if (self.is2DLarge) self.zoom = 1
				else chart.mainG.transition().duration(750).call(zoom.transform, zoomIdentity)
			self.render()
		}

		function toggle_lasso() {
			self.lassoOn = !self.lassoOn
			for (const chart of self.charts) {
				if (self.lassoOn) {
					chart.mainG.on('.zoom', null)
					chart.mainG.call(chart.lasso)
				} else {
					chart.mainG.on('mousedown.drag', null)
					chart.lasso.items().classed('not_possible', false)
					chart.lasso.items().classed('possible', false)
					chart.lasso
						.items()
						.attr('r', self.settings.size)
						.style('fill-opacity', c => self.getOpacity(c))
					chart.mainG.call(zoom)
					self.selectedItems = null
				}
			}
			lassoDiv.select('*').remove()
			icon_functions['lasso'](lassoDiv, { handler: toggle_lasso, enabled: self.lassoOn })
		}
	}

	self.updateGroupsButton = function () {
		self.dom.groupDiv.selectAll('*').remove()
		self.dom.tip.hide()
		if (self.config.groups.length == 0) return
		self.dom.groupDiv
			.append('button')
			.style('border', 'none')
			.style('background', 'transparent')
			.style('padding', 0)
			.append('div')
			.style('font-size', '1.1em')
			.html(`&#931${self.config.groups.length + 1};`)
			.on('click', event => {
				if (self.config.groups.length == 1) self.showGroupMenu(event, self.config.groups[0])
				else self.showGroupsMenu(event)
			})
	}

	self.getFontSize = function (chart) {
		let fontSize = 0.9
		const top = 20
		if (chart.colorLegend.size > top || chart.shapeLegend.size > top) {
			fontSize = Math.min(0.9, top / chart.colorLegend.size, top / chart.shapeLegend.size)
			if (fontSize < 0.5) fontSize = 0.5
		}
		return fontSize
	}

	self.renderLegend = function (chart, step) {
		const legendG = chart.legendG
		legendG.selectAll('*').remove()
		let offsetX = 0
		let offsetY = 25
		let legendHeight = 0
		if (!self.config.colorTW && !self.config.shapeTW && !self.config.colorColumn) {
			if (self.config.scaleDotTW) {
				chart.scaleG = legendG.append('g').attr('transform', `translate(${offsetX + 45},${self.legendHeight - 150})`)
				self.drawScaleDotLegend(chart)
			}
			return
		}

		let title
		let fontSize = self.getFontSize(chart)
		const colorG = legendG.style('font-size', `${fontSize}em`)
		let title0 = self.config.term0
			? `${self.config.term0.term.name + ' ' + chart.id}, n=${chart.cohortSamples.length}`
			: `${chart.cohortSamples.length} ${self.config.sampleType ? self.config.sampleType + 's' : 'samples'}`
		if (self.filterSampleStr) title0 += `, search = ${self.filterSampleStr}`
		colorG.append('text').attr('x', 0).attr('y', offsetY).text(title0).style('font-weight', 'bold')
		offsetY += step + 10
		if (self.config.colorTW || self.config.colorColumn) {
			title = `${getTitle(
				self.config.colorTW?.term?.name || self.config.colorColumn.name,
				self.config.shapeTW == undefined
			)}`
			const colorRefCategory = chart.colorLegend.get('Ref')

			if (self.config.colorTW?.term?.type == 'geneVariant' && self.config.colorTW?.q.type == 'values')
				offsetY = self.renderGeneVariantLegend(
					chart,
					offsetX,
					offsetY,
					legendG,
					self.config.colorTW,
					'category',
					chart.colorLegend
				)
			else {
				colorG
					.append('text')
					.attr('id', 'legendTitle')
					.attr('x', offsetX)
					.attr('y', offsetY)
					.text(title)
					.style('font-weight', 'bold')
				offsetY += step

				if (self.config.colorTW?.q?.mode === 'continuous') {
					// Get the current domain values from our color generator
					// These values represent the minimum and maximum values in our dataset
					let [min, max] = chart.colorGenerator.domain()

					// Extract and sort all sample values for our calculations
					// We filter out any values that are explicitly defined in the term values
					// This gives us the raw numerical data we need for scaling
					const colorValues = chart.colorValues

					// Create a ColorScale component with enhanced mode functionality
					const colorScale = new ColorScale({
						// Basic visual configuration
						holder: colorG, // SVG group to contain our color scale
						barheight: 20, // Height of the color gradient bar
						barwidth: 150, // Width of the color gradient bar
						colors: [
							// Start and end colors for our gradient
							self.config.startColor[chart.id],
							self.config.stopColor[chart.id]
						],
						domain: [min, max], // Current numerical range of our data
						position: `0, 100`, // Position within the legend
						ticks: 4, // Number of tick marks to show
						tickSize: 5, // Size of tick marks
						topTicks: true, // Display ticks above the gradient bar

						// Callback for when gradient colors are changed via color picker
						setColorsCallback: (val, idx) => {
							this.changeGradientColor(chart, val, idx)
						},

						// Configuration for our enhanced scaling modes
						numericInputs: {
							// Start with either the chart's current mode or default to 'auto'
							cutoffMode: chart.cutoffMode || 'auto',
							// Default percentile value for percentile mode
							defaultPercentile: chart.percentile || 95,

							// This callback handles all mode changes and updates
							callback: obj => {
								// Handle different modes for color scaling
								if (obj.cutoffMode === 'auto') {
									min = colorValues[0]
									max = colorValues[colorValues.length - 1]
								} else if (obj.cutoffMode === 'fixed') {
									min = obj.min
									max = obj.max
								} else if (obj.cutoffMode === 'percentile') {
									min = colorValues[0]
									const index = Math.floor((colorValues.length * obj.percentile) / 100)
									max = colorValues[index]
								}

								// Update the color generator with new range
								chart.colorGenerator = d3Linear()
									.domain([min, max])
									.range([self.config.startColor[chart.id], self.config.stopColor[chart.id]])

								// Dispatch the updated config
								self.app.dispatch({
									type: 'plot_edit',
									id: self.id,
									config: {
										settings: {
											sampleScatter: {
												colorScaleMode: obj.cutoffMode,
												colorScaleMinFixed: obj.cutoffMode === 'fixed' ? min : null,
												colorScaleMaxFixed: obj.cutoffMode === 'fixed' ? max : null,
												colorScalePercentile: obj.cutoffMode === 'percentile' ? obj.percentile : null
											}
										}
									}
								})
							}
						}
					})

					// Initialize the color scale with current settings
					colorScale.updateScale()
					offsetY += step
				} else {
					for (const [key, category] of chart.colorLegend) {
						if (key == 'Ref') continue
						const name = key
						const hidden = self.config.colorTW?.q.hiddenValues ? key in self.config.colorTW.q.hiddenValues : false
						const [circleG, itemG] = addLegendItem(colorG, category, name, key, offsetX, offsetY, hidden)
						if (!self.config.colorColumn) {
							circleG.on('click', e => self.onLegendClick(chart, 'colorTW', key, e, category))
							itemG.on('click', event => self.onLegendClick(chart, 'colorTW', key, event, category))
						}
						offsetY += step
					}
				}
			}
			if (colorRefCategory?.sampleCount > 0) {
				offsetY = offsetY + step
				const titleG = legendG.append('g')
				titleG.append('text').attr('x', offsetX).attr('y', offsetY).text('Reference').style('font-weight', 'bold')

				offsetY = offsetY + step

				const refColorG = legendG.append('g')
				refColorG
					.append('path')
					.attr('transform', () => `translate(${offsetX - 2}, ${offsetY - 5}) scale(1)`)
					.style('fill', colorRefCategory.color)
					.attr('d', shapes[0])
					.style('stroke', rgb(colorRefCategory.color).darker())

				refColorG.on('click', e => self.onLegendClick(chart, 'colorTW', 'Ref', e, colorRefCategory))
				const refText = legendG
					.append('g')
					.append('text')
					.attr('x', offsetX + 20)
					.attr('y', offsetY + 4)
					.text(`n=${colorRefCategory.sampleCount}`)
					.style('text-decoration', !self.settings.showRef ? 'line-through' : 'none')
					.attr('alignment-baseline', 'middle')

				refText.on('click', e => self.onLegendClick(chart, 'colorTW', 'Ref', e, colorRefCategory))
			}
			legendHeight = offsetY
		}

		if (self.config.shapeTW) {
			offsetX = chart.colorLegendWidth
			offsetY = 60
			title = `${getTitle(self.config.shapeTW.term.name)}`
			if (self.config.shapeTW.term.type == 'geneVariant' && self.config.shapeTW.q.type == 'values')
				self.renderGeneVariantLegend(chart, offsetX, offsetY, legendG, self.config.shapeTW, 'shape', chart.shapeLegend)
			else {
				const shapeG = legendG.append('g')

				shapeG.append('text').attr('x', offsetX).attr('y', offsetY).text(title).style('font-weight', 'bold')
				offsetY += step
				const color = 'gray'
				for (const [key, shape] of chart.shapeLegend) {
					if (key == 'Ref') continue
					const index = shape.shape % shapes.length
					const symbol = shapes[index]
					const name = key
					const count = shape.sampleCount
					const hidden = self.config.shapeTW.q.hiddenValues ? key in self.config.shapeTW.q.hiddenValues : false
					const itemG = shapeG.append('g')

					itemG
						.append('path')
						.attr('transform', () => `translate(${offsetX}, ${offsetY - 5}) scale(1)`)
						.style('pointer-events', 'bounding-box')
						.style('fill', color)
						.attr('d', symbol)
						.style('stroke', rgb(color).darker())

					itemG
						.append('text')
						.attr('x', offsetX + 25)
						.attr('y', offsetY + 4)
						.text(`${name}, n=${count}`)
						.style('text-decoration', hidden ? 'line-through' : 'none')
						.attr('alignment-baseline', 'middle')
					offsetY += step
					itemG.on('click', event => self.onLegendClick(chart, 'shapeTW', key, event, shape))
				}
			}
			if (offsetY > legendHeight) legendHeight = offsetY
		}

		if (self.config.scaleDotTW) {
			chart.scaleG = legendG.append('g').attr('transform', `translate(${0},${legendHeight + 50})`)
			self.drawScaleDotLegend(chart)
		}

		function getTitle(name, complete = false) {
			const size = 30
			if (name.length > size && !complete) name = name.slice(0, size) + '...'
			return name
		}

		function addLegendItem(g, category, name, key, x, y, hidden = false) {
			const circleG = g.append('g')
			circleG
				.append('path')
				.attr('d', shapes[0])
				.attr('transform', `translate(${x - 2}, ${y - 5}) scale(0.7)`)
				.style('fill', category.color)
				.style('stroke', rgb(category.color).darker())
			if (!self.config.colorColumn) circleG.on('click', e => self.onLegendClick(chart, 'colorTW', key, e, category))
			const itemG = g.append('g')
			itemG
				.append('text')
				.attr('name', 'sjpp-scatter-legend-label')
				.attr('font-size', '1.1em')
				.attr('x', x + 20)
				.attr('y', y + 4)
				.text(`${name}, n=${category.sampleCount}`)
				.style('text-decoration', hidden ? 'line-through' : 'none')
				.attr('alignment-baseline', 'middle')

			return [circleG, itemG]
		}
	}

	self.drawScaleDotLegend = function (chart) {
		const scaleG = chart.scaleG
		scaleG.selectAll('*').remove()
		const width = 70

		const minScale = self.settings.minShapeSize / 3
		const maxScale = self.settings.maxShapeSize / 3
		const order = self.settings.scaleDotOrder
		const isAscending = order == 'Ascending'

		const titleG = scaleG.append('g')

		titleG.append('text').text(self.config.scaleDotTW.term.name).style('font-weight', 'bold')
		const start = roundValueAuto(chart.scaleMin).toString()
		const end = roundValueAuto(chart.scaleMax).toString()
		const x = 30
		const y = 40
		const defaultSize = 16 //icons default size

		const minSize = defaultSize * minScale
		const maxSize = defaultSize * maxScale
		const minRadius = minSize / 2
		const maxRadius = maxSize / 2
		const minG = scaleG.append('g').attr('transform', `translate(${x},${y})`)
		const shift = 30
		minG
			.append('path')
			.attr('d', shapes[0])
			.style('fill', '#aaa')
			.style('stroke', '#aaa')
			.attr(
				'transform',
				`translate(${isAscending ? -minRadius : -maxRadius}, ${isAscending ? -minRadius : -maxRadius}) scale(${
					isAscending ? minScale : maxScale
				})`
			)

		const maxG = scaleG.append('g').attr('transform', `translate(${width + x},${y})`)

		maxG
			.append('path')
			.attr('d', shapes[0])
			.style('fill', '#aaa')
			.style('stroke', '#aaa')
			.attr(
				'transform',
				`translate(${isAscending ? -maxRadius : -minRadius}, ${isAscending ? -maxRadius : -minRadius}) scale(${
					isAscending ? maxScale : minScale
				})`
			)

		minG
			.append('text')
			.attr('x', isAscending ? -minRadius - shift : -maxRadius - shift)
			.attr('y', 5)
			.style('font-size', '.8em')
			.attr('text-anchor', 'start')
			.text(start)

		maxG
			.append('text')
			.attr('x', isAscending ? maxSize + 5 : minSize + 5)
			.attr('y', 5)
			.style('font-size', '.8em')
			.text(end)

		minG
			.append('line')
			.attr('x1', 0)
			.attr('y1', isAscending ? minRadius : maxRadius)
			.attr('x2', width)
			.attr('y2', isAscending ? maxRadius : minRadius)
			.style('stroke', '#aaa')
		minG
			.append('line')
			.attr('x1', 0)
			.attr('y1', isAscending ? -minRadius : -maxRadius)
			.attr('x2', width)
			.attr('y2', isAscending ? -maxRadius : -minRadius)
			.style('stroke', '#aaa')

		scaleG
			.append('rect')
			.attr('width', 110 * self.zoom)
			.attr('height', 50)
			.attr('fill', 'transparent')
			.on('click', e => {
				const menu = new Menu({ padding: '3px' })
				const div = menu.d
				div.append('label').text('Min:')
				const minInput = div
					.append('input')
					.attr('type', 'number')
					.attr('min', '1')
					.attr('max', '100')
					.style('width', '50px')
					.attr('value', self.settings.minShapeSize)
					.on('change', () => {
						let value = parseFloat(minInput.node().value)
						if (value < minShapeSize) {
							value = minShapeSize
							minInput.node().value = minShapeSize
						}
						self.config.settings.sampleScatter.minShapeSize = value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				div.append('label').text('Max:')
				const maxInput = div
					.append('input')
					.attr('type', 'number')
					.attr('min', '1')
					.attr('max', '1000')
					.style('width', '50px')
					.attr('value', self.settings.maxShapeSize)
					.on('change', () => {
						let value = parseFloat(maxInput.node().value)
						if (value > maxShapeSize) {
							value = maxShapeSize
							maxInput.node().value = maxShapeSize
						}
						self.config.settings.sampleScatter.maxShapeSize = value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				const divRadios = menu.d.append('div')
				divRadios.append('label').text('Order: ')
				const data = ['Ascending', 'Descending']
				divRadios.selectAll('input').data(data).enter().append('div').style('display', 'inline-block').each(addRadio)
				function addRadio(text) {
					const div = select(this)
					const input = div
						.append('input')
						.attr('type', 'radio')
						.attr('id', text)
						.attr('value', text)
						.property('checked', text => text == order)

					div.append('label').text(text).attr('for', text)
					input.on('change', e => {
						self.config.settings.sampleScatter.scaleDotOrder = e.target.value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				}
				menu.showunder(e.target)
			})
	}

	self.changeGradientColor = function (chart, color, idx) {
		const hexColor = rgb(color).formatHex()
		const colorKey = idx == 0 ? 'startColor' : 'stopColor'
		self.config[colorKey][chart.id] = hexColor

		// Recreate color generator with current settings
		const range = chart.currentColorRange || chart.colorGenerator.domain()
		chart.colorGenerator = d3Linear()
			.domain(range)
			.range([self.config.startColor[chart.id], self.config.stopColor[chart.id]])

		// Update the configuration
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: self.config
		})
	}

	self.renderGeneVariantLegend = function (chart, offsetX, offsetY, legendG, tw, cname, map) {
		const step = 125
		const name = tw.term.name.length > 25 ? tw.term.name.slice(0, 25) + '...' : tw.term.name
		let title = name
		const G = legendG.append('g')

		G.append('text')
			.attr('id', 'legendTitle')
			.attr('x', offsetX)
			.attr('y', offsetY)
			.text(title)
			.style('font-weight', 'bold')

		offsetX += step
		const mutations = chart.cohortSamples[0]['cat_info'][cname]
		offsetY += 10
		for (const mutation of mutations) {
			offsetY += 15
			const dt = mutation.dt
			const origin = morigin[mutation.origin]?.label
			const dtlabel = origin ? `${origin[0]} ${dt2label[dt]}` : dt2label[dt]

			G.append('text')
				.attr('x', offsetX - step)
				.attr('y', offsetY)
				.text(origin ? `${origin} ${dt2label[dt]}` : dt2label[dt])
				.style('font-weight', 'bold')
			offsetY += 25
			for (const [key, category] of map) {
				if (key == 'Ref') continue
				if (!key.includes(dtlabel)) continue
				const mkey = key.split(', ')[0]
				const itemG = G.append('g')
				if (cname == 'shape') {
					const index = category.shape % shapes.length
					itemG
						.append('path')
						.attr('transform', () => `translate(${offsetX - step - 2}, ${offsetY - 8}) scale(0.8)`)
						.style('fill', 'gray')
						.style('pointer-events', 'bounding-box')
						.attr('d', shapes[index])
						.style('stroke', rgb('gray').darker())
					itemG.on('click', e => self.onLegendClick(chart, 'shapeTW', key, e, category))
				} else {
					itemG
						.append('path')
						.attr('d', shapes[0])
						.attr('transform', `translate(${-2}, ${offsetY - 8}) scale(0.8)`)
						.style('fill', category.color)
						.style('stroke', rgb(category.color).darker())
					itemG.on('click', e => self.onLegendClick(chart, 'colorTW', key, e, category))
				}
				const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false

				G.append('g')
					.append('text')
					.attr('x', offsetX - step + 24)
					.attr('y', offsetY + 4)
					.attr('name', 'sjpp-scatter-legend-label')
					.style('text-decoration', hidden ? 'line-through' : 'none')
					.text(mkey.toUpperCase() + (key.includes(dtlabel) ? `, n=${category.sampleCount}` : ''))
					.on('click', event =>
						self.onLegendClick(chart, cname == 'shape' ? 'shapeTW' : 'colorTW', key, event, category)
					)

				offsetY += 25
			}
		}

		return offsetY
	}
}

export function renderContours(contourG, data, width, height, colorContours, bandwidth, thresholds) {
	// Create the horizontal and vertical scales.
	const x = d3Linear()
		.domain(extent(data, s => s.x))
		.nice()
		.rangeRound([0, width])
	const y = d3Linear()
		.domain(extent(data, s => s.y))
		.nice()
		.rangeRound([height, 0])
	const contours = contourDensity()
		.x(s => s.x)
		.y(s => s.y)
		.weight(s => s.z)
		.size([width, height])
		.cellSize(2)

		.bandwidth(bandwidth)
		.thresholds(thresholds)(data)


	const colorScale = scaleSequential()
		.domain([0, max(contours, d => d.value)])
		.interpolator(interpolateGreys)

	// Compute the density contours.
	// Append the contours.
	contourG
		.attr('fill', 'none')
		.attr('stroke', 'gray') // gray to make the contours visible
		.attr('stroke-linejoin', 'round')
		.selectAll()
		.data(contours)
		.join('path')
		.attr('stroke-width', (d, i) => (i % 5 ? 0.25 : 1))
		.attr('d', geoPath())
		.attr('fill', colorContours ? d => colorScale(d.value) : 'none')
		.attr('fill-opacity', 0.05) //this is the opacity of the contour, reduce it to 0.05 to avoid hiding the points
}
