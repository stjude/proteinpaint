import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { icons as icon_functions, ColorScale, Menu, getMaxLabelWidth } from '#dom'
import { dt2label, morigin } from '#shared/common.js'
import { rgb } from 'd3-color'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { select } from 'd3-selection'
import { regressionPoly } from 'd3-regression'
import { line } from 'd3'
import { minShapeSize, maxShapeSize } from './runChart.js'
import { shapes } from './runChart.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { median as d3Median } from 'd3-array'

export function setRenderers(self) {
	self.render = function () {
		const chartDivs = self.dom.mainDiv.selectAll(':scope > div').data(self.charts, chart => chart?.id)
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
		renderSVG(chart, s)

		chart.chartDiv.transition().duration(s.duration).style('opacity', 1)
	}

	self.initAxes = function (chart) {
		if (chart.samples.length == 0) return
		const offsetX = self.axisOffset.x
		const offsetY = self.axisOffset.y
		const xMin = this.range.xMin
		const xMax = this.range.xMax
		const yMin = this.range.yMin
		const yMax = this.range.yMax
		const extraSpaceX = (xMax - xMin) * 0.01 //extra space added to avoid clipping the particles on the X axis
		const extraSpaceY = (yMax - yMin) * 0.01 //extra space added to avoid clipping the particles on the Y axis

		chart.xAxisScale = d3Linear()
			.domain([xMin - extraSpaceX, xMax + extraSpaceX])
			.range([offsetX, self.settings.svgw + offsetX])

		chart.axisBottom = axisBottom(chart.xAxisScale)
		chart.yAxisScale = d3Linear()
			.domain([yMax + extraSpaceY, yMin - extraSpaceY])
			.range([offsetY, self.settings.svgh + offsetY])

		chart.zAxisScale = d3Linear().domain([chart.zMin, chart.zMax]).range([0, self.settings.svgd])

		chart.axisLeft = axisLeft(chart.yAxisScale)

		const gradientColor = rgb(self.config.settings.runChart.defaultColor)
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
			// Extract and sort all sample values for our calculations
			// We filter out any values that are explicitly defined in the term values
			// This gives us the raw numerical data we need for scaling
			const colorValues = chart.samples
				.filter(s => !self.config.colorTW.term.values || !(s.category in self.config.colorTW.term.values))
				.map(s => s.category)
				.sort((a, b) => a - b)
			chart.colorValues = colorValues // to use it in renderLegend
			// Determine min/max based on current mode
			let min, max, index
			const settings = self.config.settings.runChart

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
		if (step < 18) step = 18
		let colorLegendSize = chart.colorLegend.size * step
		if (chart.colorLegend.get('Ref')?.sampleCount > 0) colorLegendSize += 60
		const scaleHeight = self.config.scaleDotTW ? 200 : 100
		self.legendHeight = Math.max(colorLegendSize, chart.shapeLegend.size * 30) + scaleHeight //legend step and header

		const size = self.getFontSize(chart)
		//Dynamically calculate the length of the legend labels
		const getLegendLabelWidth = (key, svg) => {
			const legend = chart[`${key}Legend`]
			if (!legend) return 0
			const labels: any = []
			for (const [k, v] of legend.entries()) {
				if (k != 'Ref') labels.push(`${k}, n=(${v.sampleCount})`)
			}
			labels.push(self.config[`${key}TW`]?.term?.name ?? '')

			// Add 70 for icons, paddings, etc.
			return getMaxLabelWidth(svg, labels, size) + 70
		}
		/** Becomes the x offset for the shape legend.
		 * When in continuous mode, color scale renders with a
		 * default width of 150. */
		if (self.config.colorTW)
			chart.colorLegendWidth =
				self.config?.colorTW?.q.mode == 'continuous'
					? Math.max(175, getMaxLabelWidth(svg, [self.config.colorTW.term.name]) + 40)
					: getLegendLabelWidth('color', svg)
		else chart.colorLegendWidth = 0
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

		renderSerie(chart, s.duration)
		self.renderLegend(chart, step)
	}

	function fillSvgSubElems(chart) {
		const svg = chart.svg
		let axisG, labelsG
		if (svg.select('.sjpcb-runchart-mainG').size() == 0) {
			chart.mainG = svg.append('g').attr('class', 'sjpcb-runchart-mainG')
			axisG = svg.append('g').attr('class', 'sjpcb-runchart-axis')
			labelsG = svg.append('g').attr('class', 'sjpcb-runchart-labelsG')
			chart.xAxis = axisG.append('g').attr('class', 'sjpcb-runchart-x-axis')
			chart.yAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-runchart-y-axis')
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

			chart.serie = chart.mainG.append('g').attr('class', 'sjpcb-runchart-series')
			chart.regressionG = chart.mainG.append('g').attr('class', 'sjpcb-runchart-lowess')
			chart.legendG = svg.append('g').attr('class', 'sjpcb-runchart-legend')
		} else {
			chart.mainG = svg.select('.sjpcb-runchart-mainG')
			chart.serie = chart.mainG.select('.sjpcb-runchart-series')
			chart.regressionG = chart.mainG.select('.sjpcb-runchart-lowess')
			axisG = svg.select('.sjpcb-runchart-axis')
			labelsG = svg.select('.sjpcb-runchart-labelsG')
			chart.xAxis = axisG.select('.sjpcb-runchart-x-axis')
			chart.yAxis = axisG.select('.sjpcb-runchart-y-axis')
			chart.legendG = svg.select('.sjpcb-runchart-legend')
		}
		chart.xAxis.attr('transform', `translate(0, ${self.settings.svgh + self.axisOffset.y})`)

		chart.legendG.attr('transform', `translate(${self.settings.svgw + self.axisOffset.x + 50}, 20)`)
		if (chart.axisBottom) {
			chart.xAxis.call(chart.axisBottom)
			chart.yAxis.call(chart.axisLeft)
		}

		axisG.style('opacity', 1)
		if (self.config.term) {
			let termName = getTitle(self.config.term.term.name, 60)
			if (!self.config.colorTW && !self.config.shapeTW && !self.config.term0)
				termName = `${termName}, n=${chart.samples.length}`

			labelsG.selectAll('*').remove()
			let text = labelsG
				.append('text')
				.attr(
					'transform',
					`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 40})`
				)
				.attr('text-anchor', 'middle')
				.text(termName)

			if (termName.length > 65) {
				text
					.on('mouseenter', event => {
						self.showText(event, self.config.term.term.name)
					})
					.on('mouseleave', () => self.dom.tooltip.hide())
			}
			if (self.config.term0 && !self.config.colorTW && !self.config.shapeTW) {
				const term0Name = `${chart.id}, n=${chart.samples.length}`

				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${self.axisOffset.x + self.settings.svgw / 2}, ${self.settings.svgh + self.axisOffset.y + 65})`
					)
					.attr('text-anchor', 'middle')
					.text(term0Name)
			}
			const term2Name = getTitle(self.config.term2.term.name, 60)
			text = labelsG
				.append('text')
				.attr(
					'transform',
					`translate(${self.axisOffset.x - 50}, ${self.settings.svgh / 2 + self.axisOffset.y}) rotate(-90)`
				)
				.attr('text-anchor', 'middle')
				.text(term2Name)
			if (term2Name.length > 60) {
				text
					.on('mouseenter', event => {
						self.showText(event, self.config.term2.term.name)
					})
					.on('mouseleave', () => self.dom.tooltip.hide())
			}
		}
	}

	function renderSerie(chart, duration) {
		if (self.canvas) self.canvas.remove()

		const g = chart.serie
		const samples = chart.samples
		chart.serie.selectAll('*').remove()

		// remove all symbols as there is no data id for privacy
		//g.selectAll('path').remove()

		const symbols = g.selectAll('path[name="serie"]').data(samples)
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

		self.showRunChart(chart, g)
	}

	self.showRunChart = function (chart, g) {
		const coords = chart.samples.map(s => self.getCoordinates(chart, s)).sort((a, b) => a.x - b.x)
		const color = this.settings.defaultColor
		const areaBuilder = line()
			.x((d: any) => d.x)
			.y((d: any) => d.y)
		g.append('path')
			.attr('stroke', color)
			.attr('fill', 'none')
			.attr('stroke-width', 1)
			.attr('stroke-linejoin', 'round')
			.attr('opacity', this.settings.opacity)
			.attr('d', areaBuilder(coords))
		const median = d3Median(chart.samples, (d: any) => d.y)
		const y = chart.yAxisScale(median)
		g.append('line')
			.attr('x1', coords[0].x)
			.attr('y1', y)
			.attr('x2', coords[coords.length - 1].x)
			.attr('y2', y)
			.attr('stroke', 'red')
			.attr('stroke-width', 1)
		g.append('text')
			.attr('x', coords[coords.length - 1].x)
			.attr('y', y - 10)
			.attr('text-anchor', 'end')
			.text('Median = ' + roundValueAuto(median, true, 1))
			.attr('font-size', '0.8em')
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
			const orderedLabels = Object.values(term0Values).sort((a: any, b: any) =>
				'order' in a && 'order' in b ? a.order - b.order : 0
			)
			self.charts.sort(
				(a, b) =>
					orderedLabels.findIndex((v: any) => v.label == a.id) - orderedLabels.findIndex((v: any) => v.label == b.id)
			)
		}
		for (const chart of self.charts) {
			self.initAxes(chart)
			const regressionType = self.config.settings.runChart.regression

			if (!regressionType || regressionType == 'None') continue
			let regression
			const data: any = []
			await chart.samples.forEach(c => {
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
				const X: any = [],
					Y: any = []
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
		if (c.category == 'Default') return self.config.settings.runChart.defaultColor
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

	self.getCoordinates = function (chart, c) {
		const x = chart.xAxisScale(c.x)
		const y = chart.yAxisScale(c.y)
		return { x, y }
	}

	self.getScale = function (chart, c, factor = 1) {
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
		return scale
	}

	self.transform = function (chart, c, factor = 1) {
		const scale = self.getScale(chart, c, factor)
		const particleSize = 16 * scale
		const x = chart.xAxisScale(c.x) - particleSize / 2
		const y = chart.yAxisScale(c.y) - particleSize / 2
		const transform = `translate(${x},${y}) scale(${scale})` // original icons are scaled to 0.3
		return transform
	}

	self.setTools = function () {
		if (!self.charts[0]) return
		const toolsDiv = self.dom.toolsDiv.style('background-color', 'white')
		toolsDiv.selectAll('*').remove()
		const display = 'block'

		const homeDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '15px 10px')
			.attr('name', 'sjpp-reset-btn') //For unit tests
		icon_functions['restart'](homeDiv, { handler: resetToIdentity, title: 'Reset plot to defaults' })
		const zoomInDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '15px 10px')
			.attr('name', 'sjpp-zoom-in-btn') //For unit tests
		icon_functions['zoomIn'](zoomInDiv, {
			handler: zoomIn,
			title: 'Zoom in. You can also zoom in pressing the Ctrl key and using the mouse wheel'
		})
		const zoomOutDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '15px 10px')
			.attr('name', 'sjpp-zoom-out-btn') //For unit tests
		icon_functions['zoomOut'](zoomOutDiv, {
			handler: zoomOut,
			title: 'Zoom out. You can also zoom out pressing the Ctrl key and using the mouse wheel'
		})

		const mainG = self.charts[0].mainG
		const zoom = d3zoom()
			.scaleExtent([0.1, self.config.scaleDotTW ? 4 : 10])
			.on('zoom', handleZoom)
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
		if (self.config.scaleDotTW && self.zoom > 4) resetToIdentity()
		mainG.call(zoom)

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
	}

	self.getFontSize = function (legend) {
		let fontSize = 0.9
		const top = 20
		if (legend.size > top) {
			fontSize = Math.min(0.9, top / legend.size)
			if (fontSize < 0.7) fontSize = 0.7
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
		const title0 = self.config.term0
			? `${self.config.term0.term.name + ' ' + chart.id}, n=${chart.samples.length}`
			: `${chart.samples.length} samples`
		legendG.append('text').attr('x', 0).attr('y', offsetY).text(title0).style('font-weight', 'bold')

		const colorG = legendG.append('g').style('font-size', `${self.getFontSize(chart.colorLegend)}em`)
		offsetY += step + 10
		if (self.config.colorTW || self.config.colorColumn) {
			title = `${getTitle(
				self.config.colorTW?.term?.name || self.config.colorColumn.name,
				30,
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
				legendG
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
					const scaleG = colorG.append('g')
					// Create a ColorScale component with enhanced mode functionality
					const colorScale = new ColorScale({
						// Basic visual configuration
						holder: scaleG, // SVG group to contain our color scale
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
							cutoffMode: this.settings.colorScaleMode,
							// Default percentile value for percentile mode
							defaultPercentile: this.settings.colorScalePercentile,

							// This callback handles all mode changes and updates
							callback: (obj: any) => {
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

								// Dispatch the updated config
								self.app.dispatch({
									type: 'plot_edit',
									id: self.id,
									config: {
										settings: {
											runChart: {
												colorScaleMode: obj.cutoffMode,
												colorScaleMinFixed: obj.cutoffMode === 'fixed' ? min : null,
												colorScaleMaxFixed: obj.cutoffMode === 'fixed' ? max : null,
												colorScalePercentile:
													obj.cutoffMode === 'percentile' ? obj.percentile : this.settings.colorScalePercentile
											}
										}
									}
								})
							}
						}
					})

					// Initialize the color scale with current settings
					colorScale.updateScale()
					offsetY += step * 2
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

			legendHeight = offsetY
		}

		if (self.config.shapeTW) {
			offsetX = chart.colorLegendWidth
			offsetY = 60
			title = `${getTitle(self.config.shapeTW.term.name)}`
			if (self.config.shapeTW.term.type == 'geneVariant' && self.config.shapeTW.q.type == 'values')
				self.renderGeneVariantLegend(chart, offsetX, offsetY, legendG, self.config.shapeTW, 'shape', chart.shapeLegend)
			else {
				const shapeG = legendG.append('g').style('font-size', `${self.getFontSize(chart.shapeLegend)}em`)

				legendG.append('text').attr('x', offsetX).attr('y', offsetY).text(title).style('font-weight', 'bold')
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
						.attr('transform', () => `translate(${offsetX}, ${offsetY - 5}) scale(0.8)`)
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
				.attr('name', 'sjpp-runchart-legend-label')
				.attr('font-size', '1.1em')
				.attr('x', x + 20)
				.attr('y', y + 4)
				.text(`${name}, n=${category.sampleCount}`)
				.style('text-decoration', hidden ? 'line-through' : 'none')
				.attr('alignment-baseline', 'middle')

			return [circleG, itemG]
		}
	}

	function getTitle(name, size = 30, complete = false) {
		if (name.length > size && !complete) name = name.slice(0, size) + '...'
		return name
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
				const minInput: any = div
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
						self.config.settings.runChart.minShapeSize = value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				div.append('label').text('Max:')
				const maxInput: any = div
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
						self.config.settings.runChart.maxShapeSize = value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				const divRadios = menu.d.append('div')
				divRadios.append('label').text('Order: ')
				const data = ['Ascending', 'Descending']
				const addRadio = text => {
					const div = select(this)
					const input = div
						.append('input')
						.attr('type', 'radio')
						.attr('id', text)
						.attr('value', text)
						.property('checked', text => text == order)

					div.append('label').text(text).attr('for', text)
					input.on('change', e => {
						self.config.settings.runChart.scaleDotOrder = e.target.value
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
				}
				divRadios.selectAll('input').data(data).enter().append('div').style('display', 'inline-block').each(addRadio)

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
		const title = name
		const G = legendG.append('g')

		G.append('text')
			.attr('id', 'legendTitle')
			.attr('x', offsetX)
			.attr('y', offsetY)
			.text(title)
			.style('font-weight', 'bold')

		offsetX += step
		const mutations: any = []
		for (const [key, value] of map)
			if (value.mutation)
				//if no mutation is Ref
				mutations.push(value.mutation)

		const mutationsLabels = new Set()
		offsetY += 10
		for (const mutation of mutations) {
			const dt = mutation.dt
			const origin = morigin[mutation.origin]?.label
			const dtlabel = origin ? `${origin[0]} ${dt2label[dt]}` : dt2label[dt]
			if (!mutationsLabels.has(dtlabel)) mutationsLabels.add(dtlabel)
			else continue
			offsetY += 15

			G.append('text')
				.attr('x', offsetX - step)
				.attr('y', offsetY)
				.text(origin ? `${origin} ${dt2label[dt]}` : dt2label[dt])
				.style('font-weight', 'bold')
			offsetY += 25
			for (const [key, category] of map) {
				if (key == 'Ref') continue
				if (!key.includes(dtlabel)) continue
				const [mkey, cat_dtlabel] = key.split(', ')

				if (!cat_dtlabel.includes(dtlabel)) continue
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
					.attr('name', 'sjpp-runchart-legend-label')
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
